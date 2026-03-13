"""WhatsApp notification routes and forgot-password with OTP."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid, random, string
from deps import get_current_user, db, hash_password
from services.whatsapp import (
    send_whatsapp, send_password_reset, send_task_notification,
    send_task_status_update, send_indent_notification, send_invoice_notification,
    send_low_stock_alert,
)

router = APIRouter(prefix="/whatsapp")


class ForgotPasswordRequest(BaseModel):
    phone: str

class ResetPasswordRequest(BaseModel):
    phone: str
    code: str
    new_password: str

class SendNotificationRequest(BaseModel):
    to_phone: str
    message: str

class WhatsAppSettingsUpdate(BaseModel):
    phone: Optional[str] = None
    whatsapp_notifications: Optional[bool] = None


# ========= FORGOT PASSWORD via WhatsApp OTP =========

@router.post("/forgot-password")
async def forgot_password_whatsapp(req: ForgotPasswordRequest):
    """Send a password reset OTP via WhatsApp."""
    user = await db.users.find_one({"phone": req.phone}, {"_id": 0})
    if not user:
        # Don't reveal if user exists
        return {"message": "If this number is registered, you will receive a reset code"}
    code = "".join(random.choices(string.digits, k=6))
    await db.password_resets.update_one(
        {"phone": req.phone},
        {"$set": {"phone": req.phone, "code": code, "created_at": datetime.now(timezone.utc).isoformat(),
                  "used": False}},
        upsert=True,
    )
    sent = await send_password_reset(req.phone, code)
    return {"message": "If this number is registered, you will receive a reset code", "sent": sent}


@router.post("/reset-password")
async def reset_password_whatsapp(req: ResetPasswordRequest):
    """Reset password using WhatsApp OTP code."""
    reset = await db.password_resets.find_one(
        {"phone": req.phone, "code": req.code, "used": False}, {"_id": 0})
    if not reset:
        raise HTTPException(status_code=400, detail="Invalid or expired reset code")
    # Check expiry (15 min)
    created = datetime.fromisoformat(reset["created_at"])
    if (datetime.now(timezone.utc) - created).total_seconds() > 900:
        raise HTTPException(status_code=400, detail="Reset code has expired")
    # Update password
    await db.users.update_one({"phone": req.phone}, {"$set": {"password_hash": hash_password(req.new_password)}})
    await db.password_resets.update_one({"phone": req.phone, "code": req.code}, {"$set": {"used": True}})
    return {"message": "Password reset successful"}


# ========= NOTIFICATION PREFERENCES =========

@router.put("/settings")
async def update_whatsapp_settings(data: WhatsAppSettingsUpdate, current_user: dict = Depends(get_current_user)):
    """Update user's WhatsApp phone number and notification preferences."""
    update = {}
    if data.phone is not None:
        update["phone"] = data.phone
    if data.whatsapp_notifications is not None:
        update["whatsapp_notifications"] = data.whatsapp_notifications
    if update:
        await db.users.update_one({"id": current_user["user_id"]}, {"$set": update})
    user = await db.users.find_one({"id": current_user["user_id"]}, {"_id": 0, "phone": 1, "whatsapp_notifications": 1})
    return {"phone": user.get("phone"), "whatsapp_notifications": user.get("whatsapp_notifications", True)}


@router.get("/settings")
async def get_whatsapp_settings(current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["user_id"]}, {"_id": 0, "phone": 1, "whatsapp_notifications": 1})
    return {"phone": user.get("phone", ""), "whatsapp_notifications": user.get("whatsapp_notifications", True)}


# ========= SEND CUSTOM NOTIFICATION (Director only) =========

@router.post("/send")
async def send_custom_notification(req: SendNotificationRequest, current_user: dict = Depends(get_current_user)):
    """Director can send a custom WhatsApp message to any number."""
    user = await db.users.find_one({"id": current_user["user_id"]}, {"_id": 0, "role": 1})
    if not user or user.get("role") != "director":
        raise HTTPException(status_code=403, detail="Only directors can send custom notifications")
    sent = await send_whatsapp(req.to_phone, req.message)
    return {"sent": sent}


@router.get("/status")
async def whatsapp_status():
    """Check if WhatsApp integration is configured."""
    import os
    configured = bool(os.environ.get("TWILIO_ACCOUNT_SID") and os.environ.get("TWILIO_AUTH_TOKEN"))
    return {"configured": configured}
