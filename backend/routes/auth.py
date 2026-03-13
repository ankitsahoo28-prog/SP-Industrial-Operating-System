from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
import uuid
import logging

from database import db
from models import (User, UserCreate, UserLogin, UserRole, SelfRegisterRequest,
                    ForgotPasswordRequest, ResetPasswordRequest, DirectorChangePassword)
from deps import (get_current_user, hash_password, verify_password, create_jwt_token,
                  log_audit, notify_user)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/auth/register")
async def register(user_data: UserCreate):
    existing = await db.users.find_one({'email': user_data.email}, {'_id': 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    password_hash = hash_password(user_data.password)
    user_dict = user_data.model_dump(exclude={'password'})
    user = User(**user_dict)
    doc = user.model_dump()
    doc['password_hash'] = password_hash
    doc['created_at'] = doc['created_at'].isoformat()
    await db.users.insert_one(doc)
    token = create_jwt_token(user.id, user.role.value)
    return {'user': user, 'token': token}


async def _get_user_permissions(user_doc: dict) -> list:
    """Resolve permissions for a user based on their job_role_id or system role."""
    # Directors get all permissions
    if user_doc.get('role') == 'director':
        return ["all"]
    # Check if user has a custom job role assigned
    job_role_id = user_doc.get('job_role_id')
    if job_role_id:
        role_doc = await db.job_roles.find_one({"id": job_role_id}, {"_id": 0})
        if role_doc and role_doc.get("permissions"):
            return role_doc["permissions"]
    # Default permissions for managers and ground staff (if no custom role)
    if user_doc.get('role') == 'manager':
        return ["view_dashboard", "view_inventory", "edit_inventory", "view_accounting",
                "edit_accounting", "manage_tasks", "manage_indents", "view_reports", "create_reports"]
    # Ground staff defaults
    return ["view_dashboard", "manage_tasks", "view_reports"]


@router.post("/auth/login")
async def login(credentials: UserLogin):
    user_doc = await db.users.find_one({'email': credentials.email}, {'_id': 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(credentials.password, user_doc['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if user_doc.get('status') == 'pending':
        raise HTTPException(status_code=403, detail="Your account is pending approval by the Director")
    if user_doc.get('status') == 'rejected':
        raise HTTPException(status_code=403, detail="Your account request was rejected")
    if isinstance(user_doc['created_at'], str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    user = User(**{k: v for k, v in user_doc.items() if k != 'password_hash'})
    token = create_jwt_token(user.id, user.role.value)
    permissions = await _get_user_permissions(user_doc)
    user_resp = user.model_dump()
    user_resp['permissions'] = permissions
    user_resp['job_role_id'] = user_doc.get('job_role_id')
    if isinstance(user_resp.get('created_at'), datetime):
        user_resp['created_at'] = user_resp['created_at'].isoformat()
    return {'user': user_resp, 'token': token}


@router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    user_doc = await db.users.find_one({'id': current_user['user_id']}, {'_id': 0, 'password_hash': 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    if isinstance(user_doc.get('created_at'), str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    user = User(**user_doc)
    permissions = await _get_user_permissions(user_doc)
    user_resp = user.model_dump()
    user_resp['permissions'] = permissions
    user_resp['job_role_id'] = user_doc.get('job_role_id')
    if isinstance(user_resp.get('created_at'), datetime):
        user_resp['created_at'] = user_resp['created_at'].isoformat()
    return user_resp


@router.post("/auth/self-register")
async def self_register(data: SelfRegisterRequest):
    existing = await db.users.find_one({'email': data.email}, {'_id': 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    password_hash = hash_password(data.password)
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        'id': user_id, 'email': data.email, 'name': data.name,
        'role': data.role.value if data.role else 'ground_staff',
        'phone': data.phone, 'business_type': data.business_type.value if data.business_type else None,
        'manager_id': None, 'shift_start': None, 'shift_end': None,
        'status': 'pending', 'password_hash': password_hash, 'created_at': now,
    }
    await db.users.insert_one(doc)
    return {"message": "Account created. Awaiting Director approval.", "user_id": user_id}


@router.patch("/auth/approve/{user_id}")
async def approve_user(user_id: str, action: str = "approved", current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Only directors can approve users")
    if action not in ('approved', 'rejected'):
        raise HTTPException(status_code=400, detail="Action must be 'approved' or 'rejected'")
    await db.users.update_one({'id': user_id}, {'$set': {'status': action}})
    await notify_user(user_id, "Account Update", f"Your account has been {action} by the director.", "user", "/")
    return {"message": f"User {action}"}


@router.get("/auth/pending-users")
async def get_pending_users(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Only directors can view pending users")
    users = await db.users.find({'status': 'pending'}, {'_id': 0, 'password_hash': 0}).to_list(500)
    for u in users:
        if isinstance(u.get('created_at'), str):
            u['created_at'] = datetime.fromisoformat(u['created_at'])
    return users


@router.post("/auth/forgot-password")
async def forgot_password(data: ForgotPasswordRequest):
    user_doc = await db.users.find_one({'email': data.email}, {'_id': 0})
    if not user_doc:
        return {"message": "If the email exists, a reset link has been sent"}
    reset_token = str(uuid.uuid4())
    await db.users.update_one({'email': data.email}, {'$set': {'reset_token': reset_token}})
    logger.info(f"Password reset token for {data.email}: {reset_token}")
    return {"message": "If the email exists, a reset link has been sent", "reset_token": reset_token}


@router.post("/auth/reset-password")
async def reset_password(data: ResetPasswordRequest):
    user_doc = await db.users.find_one({'reset_token': data.token}, {'_id': 0})
    if not user_doc:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    new_hash = hash_password(data.new_password)
    await db.users.update_one({'reset_token': data.token}, {'$set': {'password_hash': new_hash, 'reset_token': None}})
    return {"message": "Password reset successfully"}


@router.post("/auth/director-change-password")
async def director_change_password(data: DirectorChangePassword, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Directors only")
    user_doc = await db.users.find_one({'id': data.user_id}, {'_id': 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    new_hash = hash_password(data.new_password)
    await db.users.update_one({'id': data.user_id}, {'$set': {'password_hash': new_hash}})
    await log_audit('update', 'user_password', data.user_id, current_user['user_id'])
    return {"message": f"Password changed for {user_doc.get('name', user_doc.get('email'))}"}
