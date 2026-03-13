"""WhatsApp notification service using Twilio."""
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

_client = None
_from_number = None


def _get_client():
    global _client, _from_number
    if _client is not None:
        return _client
    sid = os.environ.get("TWILIO_ACCOUNT_SID")
    token = os.environ.get("TWILIO_AUTH_TOKEN")
    _from_number = os.environ.get("TWILIO_WHATSAPP_NUMBER", "whatsapp:+14155238886")
    if not sid or not token:
        logger.warning("Twilio credentials not configured — WhatsApp notifications disabled")
        return None
    try:
        from twilio.rest import Client
        _client = Client(sid, token)
        return _client
    except Exception as e:
        logger.error(f"Twilio init failed: {e}")
        return None


async def send_whatsapp(to_number: str, message: str) -> bool:
    """Send a WhatsApp message. Returns True on success."""
    client = _get_client()
    if not client:
        logger.info(f"WhatsApp skipped (no client): {to_number} -> {message[:50]}...")
        return False
    try:
        to = to_number if to_number.startswith("whatsapp:") else f"whatsapp:{to_number}"
        msg = client.messages.create(body=message, from_=_from_number, to=to)
        logger.info(f"WhatsApp sent: {msg.sid} to {to_number}")
        return True
    except Exception as e:
        logger.error(f"WhatsApp send failed to {to_number}: {e}")
        return False


async def send_task_notification(to_number: str, task_title: str, assigned_by: str):
    return await send_whatsapp(to_number,
        f"New Task Assigned: {task_title}\nAssigned by: {assigned_by}\nPlease check your dashboard for details.")


async def send_password_reset(to_number: str, reset_code: str):
    return await send_whatsapp(to_number,
        f"Password Reset Code: {reset_code}\nThis code expires in 15 minutes. Do not share it with anyone.")


async def send_task_status_update(to_number: str, task_title: str, new_status: str, updated_by: str):
    return await send_whatsapp(to_number,
        f"Task Update: {task_title}\nStatus: {new_status}\nUpdated by: {updated_by}")


async def send_indent_notification(to_number: str, indent_id: str, action: str):
    return await send_whatsapp(to_number,
        f"Indent {action}: {indent_id}\nPlease review and take action on your dashboard.")


async def send_invoice_notification(to_number: str, invoice_number: str, amount: float, partner_name: str):
    return await send_whatsapp(to_number,
        f"Invoice {invoice_number}\nAmount: INR {amount:,.2f}\nPartner: {partner_name}\nPlease review on your accounting dashboard.")


async def send_low_stock_alert(to_number: str, product_name: str, current_qty: float, reorder_point: float):
    return await send_whatsapp(to_number,
        f"Low Stock Alert: {product_name}\nCurrent: {current_qty} | Reorder Point: {reorder_point}\nPlease arrange restocking.")
