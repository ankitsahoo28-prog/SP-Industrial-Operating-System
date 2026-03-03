from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
import bcrypt
import jwt
import uuid
import os
import logging

from database import db
from models import AuditLog, UserRole
from company_engine import validate_company_access

logger = logging.getLogger(__name__)

security = HTTPBearer()
JWT_SECRET = os.environ.get('JWT_SECRET', 'sp-industrial-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


def create_jwt_token(user_id: str, role: str) -> str:
    expiration = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    payload = {'user_id': user_id, 'role': role, 'exp': expiration}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get('user_id')
        role = payload.get('role')
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user_doc = await db.users.find_one({'id': user_id}, {'_id': 0, 'password_hash': 0})
        if not user_doc:
            raise HTTPException(status_code=401, detail="User not found")
        return {'user_id': user_id, 'role': role, 'business_type': user_doc.get('business_type'), 'user_doc': user_doc}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def require_company_access(user_id: str, role: str, company_id: str):
    if not company_id:
        return
    if role == "director":
        return
    has_access = await validate_company_access(db, user_id, company_id, role)
    if not has_access:
        raise HTTPException(status_code=403, detail="No access to this company")


async def resolve_company_id(user_id: str, role: str, company_id: Optional[str]) -> Optional[str]:
    if company_id:
        return company_id
    if role == "director":
        return None
    mapping = await db.company_users.find_one({"user_id": user_id}, {"_id": 0})
    if mapping:
        return mapping["company_id"]
    return None


async def log_audit(action: str, entity_type: str, entity_id: str, user_id: str,
                    old_data: Optional[Dict] = None, new_data: Optional[Dict] = None):
    audit_log = AuditLog(action=action, entity_type=entity_type, entity_id=entity_id,
                         user_id=user_id, old_data=old_data, new_data=new_data)
    doc = audit_log.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.audit_logs.insert_one(doc)


async def create_notification(user_id: str, title: str, message: str, category: str = "general", link: str = ""):
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": title,
        "message": message,
        "category": category,
        "link": link,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.notifications.insert_one(doc)
    return doc


async def notify_user(user_id: str, title: str, message: str, category: str = "general", link: str = ""):
    try:
        await create_notification(user_id, title, message, category, link)
    except Exception as e:
        logger.error(f"Notification error: {e}")


async def notify_directors(title: str, message: str, category: str = "general", link: str = ""):
    directors = await db.users.find(
        {"role": "director", "$or": [{"status": "approved"}, {"status": {"$exists": False}}]},
        {"_id": 0, "id": 1}
    ).to_list(50)
    for d in directors:
        await notify_user(d["id"], title, message, category, link)
