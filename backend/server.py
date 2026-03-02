from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import socketio
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Import custom services
from accounting_engine import (
    seed_chart_of_accounts, create_journal_entry,
    get_trial_balance, get_profit_and_loss, get_balance_sheet,
    get_or_create_party_account
)
from inventory_engine import (
    seed_inventory_defaults, record_stock_movement, record_production,
    record_transfer, lidar_scan_record, get_stock_register,
    get_low_stock_alerts, get_inventory_dashboard, get_petrol_pump_dip_history,
    BUSINESS_ITEM_CATEGORIES
)
from company_engine import (
    create_company, get_companies, get_company, update_company,
    delete_company, restore_company, assign_user_to_company,
    remove_user_from_company, get_user_companies, get_company_users,
    validate_company_access, seed_default_companies
)
from email_service import send_task_assignment_email, send_indent_approval_email
from ai_service import generate_business_insights, categorize_expense
from i18n import get_translation
from websocket_service import sio, notify_user
from export_service import generate_transaction_pdf, generate_ledger_csv, generate_inventory_pdf

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'sp-industrial-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

security = HTTPBearer()

# Create the main app
app = FastAPI(title="SP Industrial Operating System")
api_router = APIRouter(prefix="/api")

# Enums
class UserRole(str, Enum):
    DIRECTOR = "director"
    MANAGER = "manager"
    GROUND_STAFF = "ground_staff"

class TaskStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    OVERDUE = "overdue"

class ReportType(str, Enum):
    FEEDING = "feeding"
    DIESEL = "diesel"
    PETROL = "petrol"
    LUBRICANT = "lubricant"
    DISPATCH = "dispatch"
    INCOMING_STOCK = "incoming_stock"
    RUNNING_HOURS = "running_hours"

class IndentStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

class BusinessType(str, Enum):
    PETROL_PUMP = "petrol_pump"
    HOTEL = "hotel"
    FL_SHOP = "fl_shop"
    TRANSPORT = "transport"
    SLAG_CRUSHING = "slag_crushing"
    STONE_CRUSHER = "stone_crusher"

class TransactionType(str, Enum):
    EXPENSE = "expense"
    INCOME = "income"

class PaymentMode(str, Enum):
    CASH = "cash"
    BANK = "bank"

class AccountType(str, Enum):
    ASSET = "asset"
    LIABILITY = "liability"
    EQUITY = "equity"
    INCOME = "income"
    EXPENSE = "expense"

# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    role: UserRole
    phone: Optional[str] = None
    business_type: Optional[BusinessType] = None
    manager_id: Optional[str] = None
    shift_start: Optional[str] = None
    shift_end: Optional[str] = None
    status: Optional[str] = "approved"  # pending, approved, rejected
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: UserRole
    phone: Optional[str] = None
    business_type: Optional[BusinessType] = None
    manager_id: Optional[str] = None
    shift_start: Optional[str] = None
    shift_end: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Task(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: Optional[str] = None
    assigned_by: str
    assigned_to: str
    status: TaskStatus = TaskStatus.PENDING
    deadline: Optional[datetime] = None
    business_type: Optional[BusinessType] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    assigned_to: str
    deadline: Optional[datetime] = None

class TaskUpdate(BaseModel):
    status: Optional[TaskStatus] = None
    description: Optional[str] = None

class Location(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    within_work_hours: bool = True

class LocationCreate(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = None

class Report(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: ReportType
    user_id: str
    business_type: Optional[BusinessType] = None
    data: Dict[str, Any]
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReportCreate(BaseModel):
    type: ReportType
    business_type: Optional[BusinessType] = None
    data: Dict[str, Any]

class Indent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    requested_by: str
    items: List[Dict[str, Any]]
    status: IndentStatus = IndentStatus.PENDING
    authorized_by: Optional[str] = None
    notes: Optional[str] = None
    business_type: Optional[BusinessType] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class IndentCreate(BaseModel):
    items: List[Dict[str, Any]]
    notes: Optional[str] = None

class IndentAuthorize(BaseModel):
    status: IndentStatus
    notes: Optional[str] = None

# Accounting Models
class Transaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    transaction_type: TransactionType
    payment_mode: PaymentMode
    amount: float
    description: str
    category: str
    created_by: str
    business_type: Optional[BusinessType] = None
    date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TransactionCreate(BaseModel):
    transaction_type: TransactionType
    payment_mode: PaymentMode
    amount: float
    description: str
    category: str
    date: Optional[datetime] = None

# Inventory Models
class InventoryItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    item_name: str
    category: str
    opening_stock: float
    current_stock: float
    unit: str
    business_type: Optional[BusinessType] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class InventoryItemCreate(BaseModel):
    item_name: str
    category: str
    opening_stock: float
    unit: str
    business_type: Optional[BusinessType] = None

# Audit Log Model
class AuditLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    action: str  # 'create', 'update', 'delete'
    entity_type: str  # 'transaction', 'user', 'task', etc.
    entity_id: str
    user_id: str
    old_data: Optional[Dict[str, Any]] = None
    new_data: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Self-Registration Model
class SelfRegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: Optional[str] = None
    role: Optional[UserRole] = UserRole.GROUND_STAFF
    business_type: Optional[BusinessType] = None

# Forgot/Reset Password
class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

# App Settings
class AppSettingsUpdate(BaseModel):
    app_name: Optional[str] = None
    logo_url: Optional[str] = None
    bg_video_url: Optional[str] = None
    primary_color: Optional[str] = None
    tagline: Optional[str] = None

# AI Inventory Request
class AiInventoryRequest(BaseModel):
    statement: str
    business_type: Optional[str] = None

# Company Models
class CompanyCreate(BaseModel):
    name: str
    business_type: str
    fy_start: Optional[str] = "April"
    gst_number: Optional[str] = None
    currency: Optional[str] = "INR"

class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    business_type: Optional[str] = None
    fy_start: Optional[str] = None
    gst_number: Optional[str] = None
    currency: Optional[str] = None
    status: Optional[str] = None

class CompanyUserAssign(BaseModel):
    user_id: str
    company_id: str

# Helper Functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_jwt_token(user_id: str, role: str) -> str:
    expiration = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    payload = {
        'user_id': user_id,
        'role': role,
        'exp': expiration
    }
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
    """Validate user has access to the given company. Raise 403 if not."""
    if not company_id:
        return
    if role == "director":
        return
    has_access = await validate_company_access(db, user_id, company_id, role)
    if not has_access:
        raise HTTPException(status_code=403, detail="No access to this company")

# Audit logging helper
async def log_audit(action: str, entity_type: str, entity_id: str, user_id: str, old_data: Optional[Dict] = None, new_data: Optional[Dict] = None):
    """Log changes for audit trail"""
    audit_log = AuditLog(
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        user_id=user_id,
        old_data=old_data,
        new_data=new_data
    )
    doc = audit_log.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.audit_logs.insert_one(doc)

# Auth Routes
@api_router.post("/auth/register")
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

@api_router.post("/auth/login")
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
    
    return {'user': user, 'token': token}

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    user_doc = await db.users.find_one({'id': current_user['user_id']}, {'_id': 0, 'password_hash': 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    if isinstance(user_doc.get('created_at'), str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    
    return User(**user_doc)

# Self-Registration (pending approval)
@api_router.post("/auth/self-register")
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

# Approve/Reject user (Director)
@api_router.patch("/auth/approve/{user_id}")
async def approve_user(user_id: str, action: str = "approved", current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Only directors can approve users")
    if action not in ('approved', 'rejected'):
        raise HTTPException(status_code=400, detail="Action must be 'approved' or 'rejected'")
    await db.users.update_one({'id': user_id}, {'$set': {'status': action}})
    return {"message": f"User {action}"}

# Get pending users
@api_router.get("/auth/pending-users")
async def get_pending_users(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Only directors can view pending users")
    users = await db.users.find({'status': 'pending'}, {'_id': 0, 'password_hash': 0}).to_list(500)
    for u in users:
        if isinstance(u.get('created_at'), str):
            u['created_at'] = datetime.fromisoformat(u['created_at'])
    return users

# Forgot Password
@api_router.post("/auth/forgot-password")
async def forgot_password(data: ForgotPasswordRequest):
    user_doc = await db.users.find_one({'email': data.email}, {'_id': 0})
    if not user_doc:
        return {"message": "If the email exists, a reset link has been sent"}
    reset_token = str(uuid.uuid4())
    await db.users.update_one({'email': data.email}, {'$set': {'reset_token': reset_token}})
    logger.info(f"Password reset token for {data.email}: {reset_token}")
    return {"message": "If the email exists, a reset link has been sent", "reset_token": reset_token}

# Reset Password
@api_router.post("/auth/reset-password")
async def reset_password(data: ResetPasswordRequest):
    user_doc = await db.users.find_one({'reset_token': data.token}, {'_id': 0})
    if not user_doc:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    new_hash = hash_password(data.new_password)
    await db.users.update_one({'reset_token': data.token}, {'$set': {'password_hash': new_hash, 'reset_token': None}})
    return {"message": "Password reset successfully"}

# ============================================================
# APP SETTINGS (Director customization)
# ============================================================

@api_router.get("/settings")
async def get_app_settings():
    settings = await db.app_settings.find_one({"key": "app_config"}, {"_id": 0})
    if not settings:
        return {"app_name": "SP GROUP", "logo_url": "/sp-logo.png", "bg_video_url": "/bg-video.mp4", "primary_color": "#1a1a2e", "tagline": "Industrial Operating System"}
    return settings

@api_router.put("/settings")
async def update_app_settings(data: AppSettingsUpdate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Only directors can update settings")
    update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
    update_dict["key"] = "app_config"
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_dict["updated_by"] = current_user['user_id']
    await db.app_settings.update_one({"key": "app_config"}, {"$set": update_dict}, upsert=True)
    result = await db.app_settings.find_one({"key": "app_config"}, {"_id": 0})
    return result

# ============================================================
# COMPANY MANAGEMENT
# ============================================================

@api_router.get("/companies")
async def api_get_companies(include_deleted: bool = False, current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.DIRECTOR:
        return await get_companies(db, include_deleted)
    return await get_user_companies(db, current_user['user_id'], current_user['role'])

@api_router.post("/companies")
async def api_create_company(data: CompanyCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Only directors can create companies")
    company = await create_company(
        db, data.name, data.business_type, current_user['user_id'],
        data.fy_start, data.gst_number, data.currency
    )
    company.pop("_id", None)
    await log_audit("create_company", "company", company["id"], current_user['user_id'], new_data={"name": data.name, "business_type": data.business_type})
    return company

@api_router.put("/companies/{company_id}")
async def api_update_company(company_id: str, data: CompanyUpdate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Only directors can edit companies")
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    result = await update_company(db, company_id, updates)
    if result:
        result.pop("_id", None)
    await log_audit("update_company", "company", company_id, current_user['user_id'], new_data=updates)
    return result

@api_router.delete("/companies/{company_id}")
async def api_delete_company(company_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Only directors can delete companies")
    await delete_company(db, company_id)
    await log_audit("delete_company", "company", company_id, current_user['user_id'])
    return {"message": "Company deleted (soft)"}

@api_router.post("/companies/{company_id}/restore")
async def api_restore_company(company_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Only directors can restore companies")
    await restore_company(db, company_id)
    await log_audit("restore_company", "company", company_id, current_user['user_id'])
    return {"message": "Company restored"}

@api_router.post("/companies/{company_id}/activate")
async def api_activate_company(company_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Only directors")
    await update_company(db, company_id, {"status": "active"})
    return {"message": "Company activated"}

@api_router.post("/companies/{company_id}/deactivate")
async def api_deactivate_company(company_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Only directors")
    await update_company(db, company_id, {"status": "inactive"})
    return {"message": "Company deactivated"}

@api_router.post("/companies/assign-user")
async def api_assign_user_to_company(data: CompanyUserAssign, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Only directors can assign users to companies")
    result = await assign_user_to_company(db, data.user_id, data.company_id, current_user['user_id'])
    result.pop("_id", None)
    await log_audit("assign_user_company", "company_user", data.company_id, current_user['user_id'], new_data={"user_id": data.user_id})
    return result

@api_router.post("/companies/remove-user")
async def api_remove_user_from_company(data: CompanyUserAssign, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Only directors can remove users from companies")
    await remove_user_from_company(db, data.user_id, data.company_id)
    return {"message": "User removed from company"}

@api_router.get("/companies/{company_id}/users")
async def api_get_company_users(company_id: str, current_user: dict = Depends(get_current_user)):
    await require_company_access(current_user['user_id'], current_user['role'], company_id)
    users = await get_company_users(db, company_id)
    for u in users:
        if isinstance(u.get('created_at'), str):
            u['created_at'] = datetime.fromisoformat(u['created_at'])
    return users

@api_router.get("/companies/my-companies")
async def api_my_companies(current_user: dict = Depends(get_current_user)):
    return await get_user_companies(db, current_user['user_id'], current_user['role'])

# ============================================================
# DIRECTOR EXECUTIVE REPORTING DASHBOARD
# ============================================================

@api_router.get("/director/executive-report")
async def director_executive_report(company_id: Optional[str] = None, period: str = "monthly", current_user: dict = Depends(get_current_user)):
    """Director executive dashboard with monthly/quarterly/yearly views"""
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Directors only")

    now = datetime.now(timezone.utc)
    if period == "yearly":
        lookback_days = 365
    elif period == "quarterly":
        lookback_days = 90
    else:
        lookback_days = 30
    start_date = (now - timedelta(days=lookback_days)).isoformat()

    # Determine which companies to report on
    if company_id and company_id != "all":
        company_ids = [company_id]
    else:
        all_companies = await get_companies(db)
        company_ids = [c["id"] for c in all_companies]

    report = {"companies": [], "totals": {"revenue": 0, "expenses": 0, "profit": 0, "cash_position": 0}}

    for cid in company_ids:
        comp = await get_company(db, cid)
        if not comp:
            continue

        # Get journal entries for this company in the period
        je_query = {"company_id": cid, "created_at": {"$gte": start_date}}
        entries = await db.journal_entries.find(je_query, {"_id": 0}).to_list(10000)

        revenue = 0
        expenses = 0
        for e in entries:
            for line in e.get("lines", []):
                if line.get("account_type") == "income":
                    revenue += line.get("credit", 0)
                elif line.get("account_type") == "expense":
                    expenses += line.get("debit", 0)

        # Get cash/bank balance
        cash_query = {"company_id": cid, "account_name": {"$in": ["Cash", "Bank"]}}
        cash_ledgers = await db.ledger_balances.find(cash_query, {"_id": 0}).to_list(10)
        cash_position = sum(l.get("balance", 0) for l in cash_ledgers)

        # Inventory value
        inv_items = await db.inventory_items.find({"company_id": cid}, {"_id": 0}).to_list(5000)
        inv_value = sum(i.get("total_value", 0) for i in inv_items)

        comp_report = {
            "company_id": cid,
            "company_name": comp["name"],
            "business_type": comp["business_type"],
            "revenue": round(revenue, 2),
            "expenses": round(expenses, 2),
            "profit": round(revenue - expenses, 2),
            "cash_position": round(cash_position, 2),
            "inventory_value": round(inv_value, 2),
        }
        report["companies"].append(comp_report)
        report["totals"]["revenue"] += revenue
        report["totals"]["expenses"] += expenses
        report["totals"]["profit"] += (revenue - expenses)
        report["totals"]["cash_position"] += cash_position

    report["totals"] = {k: round(v, 2) for k, v in report["totals"].items()}
    report["period"] = period
    report["company_count"] = len(company_ids)
    return report

# User Management Routes
@api_router.get("/users", response_model=List[User])
async def get_users(current_user: dict = Depends(get_current_user)):
    query = {}
    
    if current_user['role'] == UserRole.MANAGER:
        query = {'manager_id': current_user['user_id']}
    elif current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")
    
    users = await db.users.find(query, {'_id': 0, 'password_hash': 0}).to_list(1000)
    
    for user in users:
        if isinstance(user.get('created_at'), str):
            user['created_at'] = datetime.fromisoformat(user['created_at'])
    
    return users

@api_router.post("/users", response_model=User)
async def create_user(user_data: UserCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.DIRECTOR and user_data.role == UserRole.MANAGER:
        pass
    elif current_user['role'] == UserRole.MANAGER and user_data.role == UserRole.GROUND_STAFF:
        user_data.manager_id = current_user['user_id']
        # Inherit business type from manager
        if not user_data.business_type:
            user_data.business_type = current_user['business_type']
    else:
        raise HTTPException(status_code=403, detail="Access denied")
    
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
    return user

# Task Routes
@api_router.get("/tasks", response_model=List[Task])
async def get_tasks(business_type: Optional[str] = None, company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    
    if company_id:
        await require_company_access(current_user['user_id'], current_user['role'], company_id)
        query['company_id'] = company_id

    if current_user['role'] == UserRole.GROUND_STAFF:
        query['assigned_to'] = current_user['user_id']
    elif current_user['role'] == UserRole.MANAGER:
        team_ids = [doc['id'] for doc in await db.users.find({'manager_id': current_user['user_id']}, {'_id': 0, 'id': 1}).to_list(1000)]
        team_ids.append(current_user['user_id'])
        query['assigned_to'] = {'$in': team_ids}
    elif current_user['role'] == UserRole.DIRECTOR:
        if business_type and business_type != 'all':
            query['business_type'] = business_type
    
    tasks = await db.tasks.find(query, {'_id': 0}).to_list(1000)
    
    for task in tasks:
        for field in ['created_at', 'updated_at', 'deadline']:
            if task.get(field) and isinstance(task[field], str):
                task[field] = datetime.fromisoformat(task[field])
    
    return tasks

@api_router.post("/tasks", response_model=Task)
async def create_task(task_data: TaskCreate, company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if company_id:
        await require_company_access(current_user['user_id'], current_user['role'], company_id)

    task_dict = task_data.model_dump()
    task_dict['assigned_by'] = current_user['user_id']
    task_dict['business_type'] = current_user.get('business_type')
    task = Task(**task_dict)
    
    doc = task.model_dump()
    doc['company_id'] = company_id
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    if doc.get('deadline'):
        doc['deadline'] = doc['deadline'].isoformat()
    
    await db.tasks.insert_one(doc)
    
    try:
        assigned_user = await db.users.find_one({'id': task.assigned_to}, {'_id': 0})
        assigner = await db.users.find_one({'id': current_user['user_id']}, {'_id': 0})
        if assigned_user and assigned_user.get('email'):
            deadline_str = task.deadline.strftime('%Y-%m-%d %H:%M') if task.deadline else None
            await send_task_assignment_email(assigned_user['email'], task.title, assigner.get('name', 'Manager'), deadline_str)
        await notify_user(task.assigned_to, 'new_task', {'task_id': task.id, 'title': task.title, 'assigned_by': assigner.get('name', 'Manager'), 'message': f'New task assigned: {task.title}'})
    except Exception as e:
        logger.error(f"Failed to send task notification: {str(e)}")
    
    return task

@api_router.patch("/tasks/{task_id}", response_model=Task)
async def update_task(task_id: str, update_data: TaskUpdate, current_user: dict = Depends(get_current_user)):
    task_doc = await db.tasks.find_one({'id': task_id}, {'_id': 0})
    if not task_doc:
        raise HTTPException(status_code=404, detail="Task not found")
    
    update_dict = update_data.model_dump(exclude_unset=True)
    update_dict['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.tasks.update_one({'id': task_id}, {'$set': update_dict})
    
    updated_doc = await db.tasks.find_one({'id': task_id}, {'_id': 0})
    for field in ['created_at', 'updated_at', 'deadline']:
        if updated_doc.get(field) and isinstance(updated_doc[field], str):
            updated_doc[field] = datetime.fromisoformat(updated_doc[field])
    
    return Task(**updated_doc)

# Location Routes
@api_router.post("/locations", response_model=Location)
async def record_location(location_data: LocationCreate, current_user: dict = Depends(get_current_user)):
    location_dict = location_data.model_dump()
    location_dict['user_id'] = current_user['user_id']
    location = Location(**location_dict)
    
    doc = location.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    await db.locations.insert_one(doc)
    return location

@api_router.get("/locations/{user_id}", response_model=List[Location])
async def get_user_locations(user_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF and user_id != current_user['user_id']:
        raise HTTPException(status_code=403, detail="Access denied")
    
    locations = await db.locations.find({'user_id': user_id}, {'_id': 0}).sort('timestamp', -1).limit(100).to_list(100)
    
    for loc in locations:
        if isinstance(loc.get('timestamp'), str):
            loc['timestamp'] = datetime.fromisoformat(loc['timestamp'])
    
    return locations

# Report Routes
@api_router.post("/reports", response_model=Report)
async def create_report(report_data: ReportCreate, current_user: dict = Depends(get_current_user)):
    report_dict = report_data.model_dump()
    report_dict['user_id'] = current_user['user_id']
    if not report_dict.get('business_type'):
        report_dict['business_type'] = current_user.get('business_type')
    report = Report(**report_dict)
    
    doc = report.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    await db.reports.insert_one(doc)
    
    # Update inventory if it's incoming or dispatch report
    if report.type == ReportType.INCOMING_STOCK:
        item_name = report.data.get('item_name')
        quantity = float(report.data.get('quantity', 0))
        if item_name and quantity:
            await update_inventory_stock(item_name, quantity, current_user.get('business_type'))
    elif report.type == ReportType.DISPATCH:
        item_name = report.data.get('item_name')
        quantity = float(report.data.get('quantity', 0))
        if item_name and quantity:
            await update_inventory_stock(item_name, -quantity, current_user.get('business_type'))
    
    return report

@api_router.get("/reports", response_model=List[Report])
async def get_reports(
    report_type: Optional[ReportType] = None,
    business_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if report_type:
        query['type'] = report_type
    
    # Filter by business type for non-directors
    if current_user['role'] != UserRole.DIRECTOR and current_user.get('business_type'):
        query['business_type'] = current_user['business_type']
    elif current_user['role'] == UserRole.DIRECTOR and business_type and business_type != 'all':
        query['business_type'] = business_type
    
    if current_user['role'] == UserRole.GROUND_STAFF:
        query['user_id'] = current_user['user_id']
    
    reports = await db.reports.find(query, {'_id': 0}).sort('timestamp', -1).to_list(1000)
    
    for report in reports:
        if isinstance(report.get('timestamp'), str):
            report['timestamp'] = datetime.fromisoformat(report['timestamp'])
    
    return reports

# Indent Routes
@api_router.post("/indents", response_model=Indent)
async def create_indent(indent_data: IndentCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Only managers can create indents")
    
    indent_dict = indent_data.model_dump()
    indent_dict['requested_by'] = current_user['user_id']
    indent_dict['business_type'] = current_user.get('business_type')
    indent = Indent(**indent_dict)
    
    doc = indent.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.indents.insert_one(doc)
    return indent

@api_router.get("/indents", response_model=List[Indent])
async def get_indents(business_type: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    
    if current_user['role'] == UserRole.MANAGER:
        query['requested_by'] = current_user['user_id']
    elif current_user['role'] == UserRole.DIRECTOR and business_type and business_type != 'all':
        query['business_type'] = business_type
    
    indents = await db.indents.find(query, {'_id': 0}).sort('created_at', -1).to_list(1000)
    
    for indent in indents:
        if isinstance(indent.get('created_at'), str):
            indent['created_at'] = datetime.fromisoformat(indent['created_at'])
    
    return indents

@api_router.patch("/indents/{indent_id}/authorize", response_model=Indent)
async def authorize_indent(
    indent_id: str,
    auth_data: IndentAuthorize,
    current_user: dict = Depends(get_current_user)
):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Only directors can authorize indents")
    
    update_dict = auth_data.model_dump()
    update_dict['authorized_by'] = current_user['user_id']
    
    await db.indents.update_one({'id': indent_id}, {'$set': update_dict})
    
    updated_doc = await db.indents.find_one({'id': indent_id}, {'_id': 0})
    if isinstance(updated_doc.get('created_at'), str):
        updated_doc['created_at'] = datetime.fromisoformat(updated_doc['created_at'])
    
    # Send email notification to requester
    try:
        requester = await db.users.find_one({'id': updated_doc['requested_by']}, {'_id': 0})
        if requester and requester.get('email'):
            await send_indent_approval_email(
                requester['email'],
                indent_id,
                auth_data.status.value,
                len(updated_doc.get('items', []))
            )
    except Exception as e:
        logger.error(f"Failed to send indent notification email: {str(e)}")
    
    return Indent(**updated_doc)


# ============================================================
# DOUBLE-ENTRY BOOKKEEPING SYSTEM
# ============================================================

class AiAccountantRequest(BaseModel):
    statement: str

class JournalPostRequest(BaseModel):
    narration: str
    lines: List[Dict[str, Any]]

# New Inventory Models
class StockMovementRequest(BaseModel):
    item_id: str
    movement_type: str  # 'in' or 'out'
    quantity: float
    unit_price: float
    reference_type: str  # purchase, sale, wastage, consumption, dip_reading, return
    notes: Optional[str] = ""
    batch_number: Optional[str] = None
    party_name: Optional[str] = None

class ProductionRequest(BaseModel):
    input_item_id: str
    input_qty: float
    outputs: List[Dict[str, Any]]  # [{"item_id": str, "quantity": float, "unit_price": float}]
    notes: Optional[str] = ""

class TransferRequest(BaseModel):
    from_business: str
    to_business: str
    item_name: str
    quantity: float
    notes: Optional[str] = ""

class LidarScanRequest(BaseModel):
    item_id: str
    volume_m3: float
    notes: Optional[str] = ""

class InventoryItemCreateNew(BaseModel):
    name: str
    business_type: Optional[str] = None
    category: str  # raw_materials, finished_goods, consumables, spare_parts
    unit: str
    min_stock_level: Optional[float] = 10
    opening_stock: Optional[float] = 0
    avg_cost: Optional[float] = 0
    density: Optional[float] = None

# --- Chart of Accounts ---
@api_router.get("/accounts")
async def get_accounts(company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")
    query = {}
    if company_id:
        query["company_id"] = company_id
    accounts = await db.accounts.find(query, {"_id": 0}).sort("code", 1).to_list(1000)
    return accounts

# --- AI Analyze ---
@api_router.post("/ai-accountant/analyze")
async def ai_accountant_analyze(req: AiAccountantRequest, current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")

    from emergentintegrations.llm.chat import LlmChat, UserMessage

    emergent_key = os.environ.get('EMERGENT_LLM_KEY')
    accounts = await db.accounts.find({}, {"_id": 0, "name": 1, "type": 1, "code": 1}).to_list(1000)
    account_list = ", ".join([f"{a['name']} ({a['type']})" for a in accounts])

    system_prompt = f"""You are an expert Indian Chartered Accountant and double-entry bookkeeping engine.
Convert natural language business transactions into structured journal entries.

AVAILABLE ACCOUNTS: {account_list}
If a party name (customer/vendor) appears that is not in the list, use their name as the account name and the system will auto-create it.

RULES:
1. Every entry MUST balance: Total Debit = Total Credit.
2. Apply Indian accounting practices and GST when applicable (5%, 12%, 18%, 28%).
3. Use "Cash" for cash payments, "Bank" for bank/cheque payments.
4. For credit sales, debit the customer's name (Accounts Receivable). For credit purchases, credit the vendor's name (Accounts Payable).
5. If information is missing (amount, party, purpose), set needs_clarification=true.
6. Currency is INR.

RESPOND IN THIS EXACT JSON FORMAT:
{{
  "understanding": {{
    "transaction_type": "sale|purchase|expense|receipt|payment|transfer",
    "parties": "description of parties involved",
    "amount": 0,
    "payment_mode": "cash|bank|credit",
    "tax_applicable": true/false,
    "tax_details": "GST details if any"
  }},
  "journal_lines": [
    {{"account_name": "Account Name", "debit": 0, "credit": 0}}
  ],
  "narration": "Journal narration text",
  "ledger_impact": ["Account A - Debited ₹X", "Account B - Credited ₹X"],
  "financial_impact": {{
    "pnl_effect": "Effect on Profit & Loss",
    "balance_sheet_effect": "Effect on Balance Sheet"
  }},
  "assumptions": ["any assumptions made"],
  "needs_clarification": false,
  "clarification_question": ""
}}

CRITICAL: journal_lines must NEVER be empty when needs_clarification is false. Total debits MUST equal total credits."""

    try:
        chat = LlmChat(
            api_key=emergent_key,
            session_id=f"ai-accountant-{current_user['user_id']}-{uuid.uuid4().hex[:6]}",
            system_message=system_prompt
        ).with_model("openai", "gpt-4o-mini")

        user_message = UserMessage(text=f"Parse this transaction: {req.statement}")
        response = await chat.send_message(user_message)

        import json as json_lib
        import re

        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', response)
        json_str = json_match.group(1).strip() if json_match else response.strip()
        parsed = json_lib.loads(json_str)
        return parsed

    except Exception as e:
        logger.error(f"AI Accountant error: {str(e)}")
        return {
            "understanding": {"transaction_type": "Unknown", "parties": "", "amount": 0, "payment_mode": "cash", "tax_applicable": False, "tax_details": ""},
            "journal_lines": [],
            "narration": "",
            "ledger_impact": [],
            "financial_impact": {"pnl_effect": "Unable to determine", "balance_sheet_effect": "Unable to determine"},
            "assumptions": [],
            "needs_clarification": True,
            "clarification_question": f"Could not process. Please rephrase your transaction.",
        }

# --- Post Journal Entry ---
@api_router.post("/journal-entries")
async def post_journal_entry(req: JournalPostRequest, company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")
    if company_id:
        await require_company_access(current_user['user_id'], current_user['role'], company_id)

    try:
        entry = await create_journal_entry(
            db, req.narration, req.lines,
            current_user['user_id'],
            current_user.get('business_type'),
            company_id
        )
        entry.pop('_id', None)
        for line in entry.get('lines', []):
            line.pop('_id', None)
        return {"message": "Journal entry posted successfully", "entry": entry}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# --- Get Journal Entries ---
@api_router.get("/journal-entries")
async def get_journal_entries(company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")
    query = {}
    if company_id:
        await require_company_access(current_user['user_id'], current_user['role'], company_id)
        query["company_id"] = company_id
    entries = await db.journal_entries.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return entries

# --- Get Ledger for a specific account ---
@api_router.get("/account-ledger/{account_id}")
async def get_account_ledger(account_id: str, company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")

    query = {"id": account_id}
    if company_id:
        query["company_id"] = company_id
    account = await db.accounts.find_one(query, {"_id": 0})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    je_query = {"lines.account_id": account_id}
    if company_id:
        je_query["company_id"] = company_id
    entries = await db.journal_entries.find(je_query, {"_id": 0}).sort("date", 1).to_list(1000)

    ledger_rows = []
    running_balance = 0
    for entry in entries:
        for line in entry.get("lines", []):
            if line["account_id"] == account_id:
                running_balance += line["debit"] - line["credit"]
                ledger_rows.append({
                    "date": entry["date"],
                    "narration": entry["narration"],
                    "debit": line["debit"],
                    "credit": line["credit"],
                    "balance": round(running_balance, 2),
                    "journal_entry_id": entry["id"],
                })

    lb_query = {"account_id": account_id}
    if company_id:
        lb_query["company_id"] = company_id
    balance_doc = await db.ledger_balances.find_one(lb_query, {"_id": 0})

    return {
        "account": account,
        "transactions": ledger_rows,
        "summary": balance_doc or {"total_debit": 0, "total_credit": 0, "balance": 0, "opening_balance": 0},
    }

# --- Ledger Balances (all) ---
@api_router.get("/ledger-balances")
async def get_ledger_balances(company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")
    query = {}
    if company_id:
        query["company_id"] = company_id
    balances = await db.ledger_balances.find(query, {"_id": 0}).to_list(1000)
    return balances

# --- Financial Reports ---
@api_router.get("/reports/trial-balance")
async def trial_balance_report(company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")
    return await get_trial_balance(db, company_id)

@api_router.get("/reports/profit-loss")
async def profit_loss_report(company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")
    return await get_profit_and_loss(db, company_id)

@api_router.get("/reports/balance-sheet")
async def balance_sheet_report(company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")
    return await get_balance_sheet(db, company_id)


# Accounting Routes
@api_router.post("/transactions", response_model=Transaction)
async def create_transaction(transaction_data: TransactionCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Only managers and directors can create transactions")
    
    transaction_dict = transaction_data.model_dump()
    transaction_dict['created_by'] = current_user['user_id']
    transaction_dict['business_type'] = current_user.get('business_type')
    
    if not transaction_dict.get('date'):
        transaction_dict['date'] = datetime.now(timezone.utc)
    
    transaction = Transaction(**transaction_dict)
    
    doc = transaction.model_dump()
    doc['date'] = doc['date'].isoformat()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.transactions.insert_one(doc)
    return transaction

@api_router.get("/transactions", response_model=List[Transaction])
async def get_transactions(business_type: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    
    # Filter by business type for non-directors
    if current_user['role'] != UserRole.DIRECTOR and current_user.get('business_type'):
        query['business_type'] = current_user['business_type']
    elif current_user['role'] == UserRole.DIRECTOR and business_type and business_type != 'all':
        query['business_type'] = business_type
    
    transactions = await db.transactions.find(query, {'_id': 0}).sort('date', -1).to_list(1000)
    
    for transaction in transactions:
        if isinstance(transaction.get('date'), str):
            transaction['date'] = datetime.fromisoformat(transaction['date'])
        if isinstance(transaction.get('created_at'), str):
            transaction['created_at'] = datetime.fromisoformat(transaction['created_at'])
    
    return transactions

@api_router.get("/ledger")
async def get_ledger(business_type: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if current_user['role'] != UserRole.DIRECTOR and current_user.get('business_type'):
        query['business_type'] = current_user['business_type']
    elif current_user['role'] == UserRole.DIRECTOR and business_type and business_type != 'all':
        query['business_type'] = business_type
    
    transactions = await db.transactions.find(query, {'_id': 0}).sort('date', 1).to_list(10000)
    
    # Calculate running balance
    balance = 0
    ledger_entries = []
    
    for trans in transactions:
        if isinstance(trans.get('date'), str):
            trans['date'] = datetime.fromisoformat(trans['date'])
        
        if trans['transaction_type'] == 'income':
            balance += trans['amount']
        else:
            balance -= trans['amount']
        
        ledger_entries.append({
            **trans,
            'balance': balance
        })
    
    return ledger_entries

@api_router.get("/accounting/summary")
async def get_accounting_summary(business_type: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if current_user['role'] != UserRole.DIRECTOR and current_user.get('business_type'):
        query['business_type'] = current_user['business_type']
    elif current_user['role'] == UserRole.DIRECTOR and business_type and business_type != 'all':
        query['business_type'] = business_type
    
    transactions = await db.transactions.find(query, {'_id': 0}).to_list(10000)
    
    total_income = sum(t['amount'] for t in transactions if t['transaction_type'] == 'income')
    total_expense = sum(t['amount'] for t in transactions if t['transaction_type'] == 'expense')
    
    cash_income = sum(t['amount'] for t in transactions if t['transaction_type'] == 'income' and t['payment_mode'] == 'cash')
    bank_income = sum(t['amount'] for t in transactions if t['transaction_type'] == 'income' and t['payment_mode'] == 'bank')
    cash_expense = sum(t['amount'] for t in transactions if t['transaction_type'] == 'expense' and t['payment_mode'] == 'cash')
    bank_expense = sum(t['amount'] for t in transactions if t['transaction_type'] == 'expense' and t['payment_mode'] == 'bank')
    
    return {
        'total_income': total_income,
        'total_expense': total_expense,
        'net_profit': total_income - total_expense,
        'cash_balance': cash_income - cash_expense,
        'bank_balance': bank_income - bank_expense,
        'cash_income': cash_income,
        'bank_income': bank_income,
        'cash_expense': cash_expense,
        'bank_expense': bank_expense
    }

# Inventory Routes
async def update_inventory_stock(item_name: str, quantity: float, business_type: Optional[str]):
    """Helper function to update inventory stock"""
    item = await db.inventory.find_one({'item_name': item_name, 'business_type': business_type}, {'_id': 0})
    
    if item:
        new_stock = item['current_stock'] + quantity
        await db.inventory.update_one(
            {'id': item['id']},
            {'$set': {'current_stock': new_stock, 'updated_at': datetime.now(timezone.utc).isoformat()}}
        )
    else:
        # Create new inventory item if it doesn't exist
        new_item = InventoryItem(
            item_name=item_name,
            category='General',
            opening_stock=max(0, quantity),
            current_stock=max(0, quantity),
            unit='units',
            business_type=business_type
        )
        doc = new_item.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        doc['updated_at'] = doc['updated_at'].isoformat()
        await db.inventory.insert_one(doc)

@api_router.post("/inventory", response_model=InventoryItem)
async def create_inventory_item(item_data: InventoryItemCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Only managers and directors can manage inventory")
    
    item_dict = item_data.model_dump()
    if not item_dict.get('business_type'):
        item_dict['business_type'] = current_user.get('business_type')
    
    item_dict['current_stock'] = item_dict['opening_stock']
    item = InventoryItem(**item_dict)
    
    doc = item.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.inventory.insert_one(doc)
    return item

@api_router.get("/inventory", response_model=List[InventoryItem])
async def get_inventory(current_user: dict = Depends(get_current_user)):
    query = {}
    
    # Filter by business type for non-directors
    if current_user['role'] != UserRole.DIRECTOR and current_user.get('business_type'):
        query['business_type'] = current_user['business_type']
    
    items = await db.inventory.find(query, {'_id': 0}).sort('item_name', 1).to_list(1000)
    
    for item in items:
        if isinstance(item.get('created_at'), str):
            item['created_at'] = datetime.fromisoformat(item['created_at'])
        if isinstance(item.get('updated_at'), str):
            item['updated_at'] = datetime.fromisoformat(item['updated_at'])
    
    return items

# Dashboard Routes
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.DIRECTOR:
        # Directors see all data grouped by business
        businesses = list(BusinessType)
        business_stats = []
        
        for business in businesses:
            total_users = await db.users.count_documents({'business_type': business.value})
            total_tasks = await db.tasks.count_documents({'business_type': business.value})
            pending_tasks = await db.tasks.count_documents({'business_type': business.value, 'status': TaskStatus.PENDING})
            total_reports = await db.reports.count_documents({'business_type': business.value})
            pending_indents = await db.indents.count_documents({'business_type': business.value, 'status': IndentStatus.PENDING})
            
            transactions = await db.transactions.find({'business_type': business.value}, {'_id': 0}).to_list(10000)
            total_income = sum(t['amount'] for t in transactions if t['transaction_type'] == 'income')
            total_expense = sum(t['amount'] for t in transactions if t['transaction_type'] == 'expense')
            
            business_stats.append({
                'business_type': business.value,
                'business_name': business.value.replace('_', ' ').title(),
                'total_users': total_users,
                'total_tasks': total_tasks,
                'pending_tasks': pending_tasks,
                'total_reports': total_reports,
                'pending_indents': pending_indents,
                'total_income': total_income,
                'total_expense': total_expense,
                'net_profit': total_income - total_expense
            })
        
        # Overall stats
        total_users = await db.users.count_documents({})
        total_tasks = await db.tasks.count_documents({})
        pending_tasks = await db.tasks.count_documents({'status': TaskStatus.PENDING})
        total_reports = await db.reports.count_documents({})
        pending_indents = await db.indents.count_documents({'status': IndentStatus.PENDING})
        
        return {
            'total_users': total_users,
            'total_tasks': total_tasks,
            'pending_tasks': pending_tasks,
            'total_reports': total_reports,
            'pending_indents': pending_indents,
            'business_stats': business_stats
        }
    else:
        # Managers and ground staff see only their business data
        query = {'business_type': current_user.get('business_type')}
        
        total_users = await db.users.count_documents(query)
        total_tasks = await db.tasks.count_documents(query)
        pending_tasks = await db.tasks.count_documents({**query, 'status': TaskStatus.PENDING})
        total_reports = await db.reports.count_documents(query)
        pending_indents = await db.indents.count_documents({**query, 'status': IndentStatus.PENDING})
        
        return {
            'total_users': total_users,
            'total_tasks': total_tasks,
            'pending_tasks': pending_tasks,
            'total_reports': total_reports,
            'pending_indents': pending_indents
        }

@api_router.get("/")
async def root():
    return {"message": "SP Industrial Operating System API"}

# Delete User (Director only)
@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Only directors can delete users")
    
    user_doc = await db.users.find_one({'id': user_id}, {'_id': 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Log audit
    await log_audit('delete', 'user', user_id, current_user['user_id'], old_data=user_doc)
    
    await db.users.delete_one({'id': user_id})
    return {"message": "User deleted successfully"}

# Update Transaction (Edit wrong entry)
@api_router.put("/transactions/{transaction_id}", response_model=Transaction)
async def update_transaction(
    transaction_id: str,
    transaction_data: TransactionCreate,
    current_user: dict = Depends(get_current_user)
):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")
    
    old_doc = await db.transactions.find_one({'id': transaction_id}, {'_id': 0})
    if not old_doc:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Update transaction
    update_dict = transaction_data.model_dump()
    if not update_dict.get('date'):
        update_dict['date'] = datetime.now(timezone.utc)
    update_dict['date'] = update_dict['date'].isoformat() if isinstance(update_dict['date'], datetime) else update_dict['date']
    
    await db.transactions.update_one({'id': transaction_id}, {'$set': update_dict})
    
    # Log audit
    updated_doc = await db.transactions.find_one({'id': transaction_id}, {'_id': 0})
    await log_audit('update', 'transaction', transaction_id, current_user['user_id'], old_data=old_doc, new_data=updated_doc)
    
    if isinstance(updated_doc.get('date'), str):
        updated_doc['date'] = datetime.fromisoformat(updated_doc['date'])
    if isinstance(updated_doc.get('created_at'), str):
        updated_doc['created_at'] = datetime.fromisoformat(updated_doc['created_at'])
    
    return Transaction(**updated_doc)

# Get Audit Logs (Director only)
@api_router.get("/audit-logs")
async def get_audit_logs(
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Only directors can view audit logs")
    
    query = {}
    if entity_type:
        query['entity_type'] = entity_type
    if entity_id:
        query['entity_id'] = entity_id
    
    logs = await db.audit_logs.find(query, {'_id': 0}).sort('timestamp', -1).limit(100).to_list(100)
    
    for log in logs:
        if isinstance(log.get('timestamp'), str):
            log['timestamp'] = datetime.fromisoformat(log['timestamp'])
    
    return logs

# Get AI Insights
@api_router.get("/dashboard/ai-insights")
async def get_ai_insights(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Only directors can view AI insights")
    
    # Get stats for AI analysis
    stats = await get_dashboard_stats(current_user)
    insights = await generate_business_insights(stats)
    
    return {"insights": insights}

# Get AI Predictions for next month
@api_router.get("/dashboard/predictions")
async def get_predictions(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Only directors can view predictions")
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        import json as json_lib
        import re as re_lib

        emergent_key = os.environ.get('EMERGENT_LLM_KEY')
        three_months_ago = datetime.now(timezone.utc) - timedelta(days=90)
        
        transactions = await db.transactions.find({'date': {'$gte': three_months_ago.isoformat()}}, {'_id': 0}).to_list(10000)
        inv_items = await db.inventory_items.find({}, {'_id': 0}).to_list(5000)
        movements = await db.stock_movements.find({'created_at': {'$gte': three_months_ago.isoformat()}}, {'_id': 0}).to_list(5000)
        journal_entries = await db.journal_entries.find({'created_at': {'$gte': three_months_ago.isoformat()}}, {'_id': 0}).to_list(5000)
        
        total_income = sum(t['amount'] for t in transactions if t.get('transaction_type') == 'income')
        total_expense = sum(t['amount'] for t in transactions if t.get('transaction_type') == 'expense')
        avg_monthly_income = total_income / 3
        avg_monthly_expense = total_expense / 3
        total_inv_value = sum(i.get('total_value', 0) for i in inv_items)
        low_stock_count = sum(1 for i in inv_items if i.get('current_stock', 0) < i.get('min_stock_level', 10))
        total_purchases = sum(m.get('total_amount', 0) for m in movements if m.get('reference_type') == 'purchase')
        total_sales = sum(m.get('total_amount', 0) for m in movements if m.get('reference_type') == 'sale')

        prompt = f"""Based on the following REAL historical data from SP GROUP industrial businesses, generate next month's predictions.

FINANCIAL DATA (Last 3 months):
- Total Income: ₹{total_income:.0f} | Monthly Avg: ₹{avg_monthly_income:.0f}
- Total Expense: ₹{total_expense:.0f} | Monthly Avg: ₹{avg_monthly_expense:.0f}
- Transaction Count: {len(transactions)}
- Journal Entries: {len(journal_entries)}

INVENTORY DATA:
- Total Items: {len(inv_items)} | Total Value: ₹{total_inv_value:.0f}
- Low Stock Items: {low_stock_count}
- Purchase Volume: ₹{total_purchases:.0f} | Sales Volume: ₹{total_sales:.0f}
- Stock Movements: {len(movements)}

TOP LOW STOCK ITEMS: {json_lib.dumps([{{"name": i["name"], "stock": i.get("current_stock",0), "min": i.get("min_stock_level",10), "unit": i.get("unit","")}} for i in inv_items if i.get("current_stock",0) < i.get("min_stock_level",10)][:8])}

RESPOND IN EXACT JSON (no markdown):
{{"revenue": number, "expenses": number, "revenue_trend": "explanation", "expense_trend": "explanation", "profit_trend": "explanation", "revenue_confidence": percentage, "expense_breakdown": [{{"category": "name", "amount": number}}], "recommendations": ["rec1","rec2","rec3"], "inventory_alerts": [{{"item_name": "name", "predicted_quantity": number, "unit": "unit", "current_stock": number}}]}}"""

        chat = LlmChat(
            api_key=emergent_key,
            session_id=f"sp-predictions-{uuid.uuid4().hex[:6]}",
            system_message="You are a financial and inventory forecasting AI for SP GROUP industrial operations. Always respond with valid JSON only, no markdown."
        ).with_model("openai", "gpt-4o-mini")

        response = await chat.send_message(UserMessage(text=prompt))
        json_match = re_lib.search(r'```(?:json)?\s*([\s\S]*?)```', response)
        json_str = json_match.group(1).strip() if json_match else response.strip()
        predictions = json_lib.loads(json_str)

        # Enrich with real low-stock data
        real_low_stock = [{"item_name": i["name"], "predicted_quantity": i.get("min_stock_level", 10) * 2, "unit": i.get("unit", ""), "current_stock": i.get("current_stock", 0)} for i in inv_items if i.get("current_stock", 0) < i.get("min_stock_level", 10)][:5]
        if real_low_stock:
            predictions['inventory_alerts'] = real_low_stock

        return predictions

    except Exception as e:
        logger.error(f"Failed to generate predictions: {str(e)}")
        return {
            "revenue": avg_monthly_income * 1.05 if 'avg_monthly_income' in dir() and avg_monthly_income > 0 else 50000,
            "expenses": avg_monthly_expense * 1.02 if 'avg_monthly_expense' in dir() and avg_monthly_expense > 0 else 40000,
            "revenue_trend": "Based on 3-month average with 5% growth projection",
            "expense_trend": "Expected 2% increase in operational costs",
            "profit_trend": "Modest profit expected based on current trends",
            "revenue_confidence": 75,
            "expense_breakdown": [{"category": "Salary", "amount": 20000}, {"category": "Raw Materials", "amount": 17500}, {"category": "Utilities", "amount": 12500}],
            "recommendations": ["Monitor expenses closely", "Focus on revenue growth", "Maintain inventory levels"],
            "inventory_alerts": []
        }

# Get Translations
@api_router.get("/translations/{lang}")
async def get_translations(lang: str):
    from i18n import translations
    return translations.get(lang, translations["en"])

# Export Endpoints
@api_router.get("/export/transactions/pdf")
async def export_transactions_pdf(current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")
    
    query = {}
    if current_user['role'] != UserRole.DIRECTOR and current_user.get('business_type'):
        query['business_type'] = current_user['business_type']
    
    transactions = await db.transactions.find(query, {'_id': 0}).sort('date', -1).to_list(1000)
    
    # Get summary
    total_income = sum(t['amount'] for t in transactions if t['transaction_type'] == 'income')
    total_expense = sum(t['amount'] for t in transactions if t['transaction_type'] == 'expense')
    
    cash_income = sum(t['amount'] for t in transactions if t['transaction_type'] == 'income' and t['payment_mode'] == 'cash')
    bank_income = sum(t['amount'] for t in transactions if t['transaction_type'] == 'income' and t['payment_mode'] == 'bank')
    cash_expense = sum(t['amount'] for t in transactions if t['transaction_type'] == 'expense' and t['payment_mode'] == 'cash')
    bank_expense = sum(t['amount'] for t in transactions if t['transaction_type'] == 'expense' and t['payment_mode'] == 'bank')
    
    summary = {
        'total_income': total_income,
        'total_expense': total_expense,
        'net_profit': total_income - total_expense,
        'cash_balance': cash_income - cash_expense,
        'bank_balance': bank_income - bank_expense
    }
    
    pdf_bytes = generate_transaction_pdf(transactions, summary)
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=transactions_{datetime.now().strftime('%Y%m%d')}.pdf"}
    )

@api_router.get("/export/ledger/csv")
async def export_ledger_csv(current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")
    
    query = {}
    if current_user['role'] != UserRole.DIRECTOR and current_user.get('business_type'):
        query['business_type'] = current_user['business_type']
    
    transactions = await db.transactions.find(query, {'_id': 0}).sort('date', 1).to_list(10000)
    
    # Calculate running balance
    balance = 0
    ledger_entries = []
    
    for trans in transactions:
        if trans['transaction_type'] == 'income':
            balance += trans['amount']
        else:
            balance -= trans['amount']
        
        ledger_entries.append({
            **trans,
            'balance': balance
        })
    
    csv_content = generate_ledger_csv(ledger_entries)
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=ledger_{datetime.now().strftime('%Y%m%d')}.csv"}
    )

@api_router.get("/export/inventory/pdf")
async def export_inventory_pdf(current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")
    
    query = {}
    if current_user['role'] != UserRole.DIRECTOR and current_user.get('business_type'):
        query['business_type'] = current_user['business_type']
    
    items = await db.inventory.find(query, {'_id': 0}).sort('item_name', 1).to_list(1000)
    
    pdf_bytes = generate_inventory_pdf(items)
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=inventory_{datetime.now().strftime('%Y%m%d')}.pdf"}
    )

# Historical Trend Data
@api_router.get("/dashboard/trends")

# ============================================================
# COMPREHENSIVE INVENTORY MANAGEMENT SYSTEM
# ============================================================

@api_router.get("/inv/dashboard")
async def inventory_dashboard(company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Consolidated inventory dashboard for director"""
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")
    if company_id:
        await require_company_access(current_user['user_id'], current_user['role'], company_id)
    return await get_inventory_dashboard(db, company_id)

@api_router.get("/inv/items")
async def get_inventory_items(business_type: Optional[str] = None, category: Optional[str] = None, company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get all inventory items with optional filters"""
    query = {}
    if company_id:
        await require_company_access(current_user['user_id'], current_user['role'], company_id)
        query['company_id'] = company_id
    else:
        biz = business_type
        if current_user['role'] != UserRole.DIRECTOR and current_user.get('business_type'):
            biz = current_user['business_type']
        if biz and biz != 'all':
            query['business_type'] = biz
    if category and category != 'all':
        query['category'] = category
    items = await db.inventory_items.find(query, {"_id": 0}).sort("name", 1).to_list(5000)
    return items

@api_router.post("/inv/items")
async def create_inventory_item_new(data: InventoryItemCreateNew, company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Create a new inventory item"""
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")
    if company_id:
        await require_company_access(current_user['user_id'], current_user['role'], company_id)
    item = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "business_type": data.business_type or current_user.get('business_type'),
        "category": data.category,
        "unit": data.unit,
        "current_stock": data.opening_stock or 0,
        "min_stock_level": data.min_stock_level or 10,
        "avg_cost": data.avg_cost or 0,
        "total_value": (data.opening_stock or 0) * (data.avg_cost or 0),
        "density": data.density,
        "company_id": company_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.inventory_items.insert_one(item)
    item.pop("_id", None)
    return item

@api_router.get("/inv/categories")
async def get_inventory_categories(current_user: dict = Depends(get_current_user)):
    """Get industry-specific categories"""
    return BUSINESS_ITEM_CATEGORIES

@api_router.post("/inv/stock-movement")
async def api_stock_movement(data: StockMovementRequest, company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Record a stock movement (purchase/sale/wastage/etc) with optional auto journal entry"""
    if company_id:
        await require_company_access(current_user['user_id'], current_user['role'], company_id)
    biz = current_user.get('business_type')
    item = await db.inventory_items.find_one({"id": data.item_id}, {"_id": 0})
    if item:
        biz = item.get("business_type", biz)

    try:
        movement = await record_stock_movement(
            db, data.item_id, data.movement_type, data.quantity,
            data.unit_price, data.reference_type, str(uuid.uuid4()),
            current_user['user_id'], biz,
            data.notes or "", data.batch_number, data.party_name
        )
        movement.pop("_id", None)

        # Auto-create journal entry for purchases and sales
        total = round(data.quantity * data.unit_price, 2)
        if total > 0 and data.reference_type in ("purchase", "sale"):
            try:
                if data.reference_type == "purchase":
                    lines = [
                        {"account_name": "Inventory", "debit": total, "credit": 0},
                        {"account_name": data.party_name or "Accounts Payable", "debit": 0, "credit": total},
                    ]
                    narration = f"Inventory purchase: {data.quantity} units @ ₹{data.unit_price}"
                else:
                    lines = [
                        {"account_name": data.party_name or "Accounts Receivable", "debit": total, "credit": 0},
                        {"account_name": "Sales", "debit": 0, "credit": total},
                    ]
                    narration = f"Inventory sale: {data.quantity} units @ ₹{data.unit_price}"
                await create_journal_entry(db, narration, lines, current_user['user_id'], biz, company_id)
            except Exception as e:
                logger.error(f"Auto journal entry failed: {e}")

        return movement
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/inv/movements")
async def get_stock_movements(business_type: Optional[str] = None, item_id: Optional[str] = None,
                               reference_type: Optional[str] = None, company_id: Optional[str] = None, limit: int = 200,
                               current_user: dict = Depends(get_current_user)):
    """Get stock movement history"""
    query = {}
    if company_id:
        await require_company_access(current_user['user_id'], current_user['role'], company_id)
        query['company_id'] = company_id
    if item_id:
        query['item_id'] = item_id
    if reference_type and reference_type != 'all':
        query['reference_type'] = reference_type
    movements = await db.stock_movements.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return movements

@api_router.post("/inv/production")
async def api_production(data: ProductionRequest, current_user: dict = Depends(get_current_user)):
    """Record a production batch (raw material -> finished goods)"""
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")
    biz = current_user.get('business_type')
    if current_user['role'] == UserRole.DIRECTOR:
        item = await db.inventory_items.find_one({"id": data.input_item_id}, {"_id": 0})
        if item:
            biz = item.get("business_type", biz)
    try:
        record = await record_production(
            db, biz, current_user['user_id'],
            data.input_item_id, data.input_qty, data.outputs, data.notes or ""
        )
        record.pop("_id", None)
        return record
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/inv/productions")
async def get_productions(business_type: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get production batch history"""
    query = {}
    biz = business_type
    if current_user['role'] != UserRole.DIRECTOR and current_user.get('business_type'):
        biz = current_user['business_type']
    if biz and biz != 'all':
        query['business_type'] = biz
    records = await db.production_batches.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return records

@api_router.post("/inv/transfer")
async def api_transfer(data: TransferRequest, current_user: dict = Depends(get_current_user)):
    """Transfer inventory between businesses"""
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Only directors can transfer between businesses")
    try:
        record = await record_transfer(
            db, data.from_business, data.to_business,
            data.item_name, data.quantity, current_user['user_id'], data.notes or ""
        )
        record.pop("_id", None)
        return record
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/inv/transfers")
async def get_transfers(current_user: dict = Depends(get_current_user)):
    """Get transfer history"""
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Only directors can view transfers")
    records = await db.inventory_transfers.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return records

@api_router.post("/inv/lidar-scan")
async def api_lidar_scan(data: LidarScanRequest, current_user: dict = Depends(get_current_user)):
    """Record a LiDAR scan and compare with system stock"""
    biz = current_user.get('business_type')
    if current_user['role'] == UserRole.DIRECTOR:
        item = await db.inventory_items.find_one({"id": data.item_id}, {"_id": 0})
        if item:
            biz = item.get("business_type", biz)
    try:
        scan = await lidar_scan_record(
            db, data.item_id, data.volume_m3,
            current_user['user_id'], biz, data.notes or ""
        )
        scan.pop("_id", None)
        return scan
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/inv/lidar-scans")
async def get_lidar_scans(business_type: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get LiDAR scan history"""
    query = {}
    biz = business_type
    if current_user['role'] != UserRole.DIRECTOR and current_user.get('business_type'):
        biz = current_user['business_type']
    if biz and biz != 'all':
        query['business_type'] = biz
    scans = await db.lidar_scans.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return scans

@api_router.get("/inv/low-stock")
async def api_low_stock(business_type: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get items below minimum stock level"""
    biz = business_type
    if current_user['role'] != UserRole.DIRECTOR and current_user.get('business_type'):
        biz = current_user['business_type']
    return await get_low_stock_alerts(db, biz)

@api_router.get("/inv/dip-history")
async def api_dip_history(current_user: dict = Depends(get_current_user)):
    """Get petrol pump dip reading history"""
    return await get_petrol_pump_dip_history(db)

# ============================================================
# END INVENTORY MANAGEMENT SYSTEM
# ============================================================

# ============================================================
# AI INVENTORY ASSISTANT
# ============================================================

@api_router.post("/inv/ai-assistant")
async def ai_inventory_assistant(req: AiInventoryRequest, current_user: dict = Depends(get_current_user)):
    """AI parses natural language inventory inputs into structured stock movements"""
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")

    from emergentintegrations.llm.chat import LlmChat, UserMessage

    emergent_key = os.environ.get('EMERGENT_LLM_KEY')
    biz = req.business_type or current_user.get('business_type') or 'all'

    items_query = {} if biz == 'all' else {"business_type": biz}
    inv_items = await db.inventory_items.find(items_query, {"_id": 0, "id": 1, "name": 1, "business_type": 1, "category": 1, "current_stock": 1, "unit": 1}).to_list(500)
    items_list = "\n".join([f"- ID:{i['id']} | {i['name']} | {i.get('business_type','')} | {i['category']} | Stock:{i['current_stock']} {i['unit']}" for i in inv_items[:100]])

    system_prompt = f"""You are an expert inventory management AI for SP GROUP industrial businesses.
Parse natural language inventory transactions into structured data.

AVAILABLE INVENTORY ITEMS:
{items_list}

RULES:
1. Match the item to the closest available inventory item by name
2. Determine movement_type: 'in' for purchases/receipts/returns, 'out' for sales/dispatches/wastage/consumption
3. Determine reference_type: purchase, sale, wastage, consumption, return, production
4. Extract quantity, unit_price, party_name if mentioned
5. If item not found, suggest creating it
6. Currency is INR

RESPOND IN THIS EXACT JSON FORMAT:
{{
  "understood": true,
  "summary": "Brief description of what was parsed",
  "movements": [
    {{
      "item_id": "matched item ID or null",
      "item_name": "item name",
      "movement_type": "in or out",
      "reference_type": "purchase/sale/wastage/consumption/return",
      "quantity": number,
      "unit_price": number,
      "party_name": "vendor/customer name or null",
      "notes": "any additional context"
    }}
  ],
  "needs_clarification": false,
  "clarification_question": "",
  "create_new_item": false,
  "new_item_suggestion": null
}}"""

    try:
        chat = LlmChat(
            api_key=emergent_key,
            session_id=f"ai-inv-{current_user['user_id']}-{uuid.uuid4().hex[:6]}",
            system_message=system_prompt
        ).with_model("openai", "gpt-4o-mini")

        user_message = UserMessage(text=f"Parse this inventory transaction: {req.statement}")
        response = await chat.send_message(user_message)

        import json as json_lib
        import re
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', response)
        json_str = json_match.group(1).strip() if json_match else response.strip()
        parsed = json_lib.loads(json_str)
        return parsed
    except Exception as e:
        logger.error(f"AI Inventory Assistant error: {e}")
        return {
            "understood": False, "summary": "", "movements": [],
            "needs_clarification": True,
            "clarification_question": "Could not process. Please rephrase your inventory transaction.",
            "create_new_item": False, "new_item_suggestion": None
        }

@api_router.post("/inv/ai-execute")
async def ai_inventory_execute(movements: List[Dict[str, Any]], current_user: dict = Depends(get_current_user)):
    """Execute AI-parsed movements"""
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")

    results = []
    biz = current_user.get('business_type')
    for m in movements:
        if not m.get('item_id'):
            results.append({"status": "skipped", "reason": "No item_id"})
            continue
        try:
            item = await db.inventory_items.find_one({"id": m['item_id']}, {"_id": 0})
            if item:
                biz = item.get("business_type", biz)
            movement = await record_stock_movement(
                db, m['item_id'], m['movement_type'], float(m['quantity']),
                float(m.get('unit_price', 0)), m.get('reference_type', 'purchase'),
                str(uuid.uuid4()), current_user['user_id'], biz,
                m.get('notes', ''), None, m.get('party_name')
            )
            movement.pop("_id", None)

            # Auto journal entry for purchases/sales
            total = round(float(m['quantity']) * float(m.get('unit_price', 0)), 2)
            if total > 0 and m.get('reference_type') in ('purchase', 'sale'):
                try:
                    if m['reference_type'] == 'purchase':
                        lines = [{"account_name": "Inventory", "debit": total, "credit": 0}, {"account_name": m.get('party_name') or "Accounts Payable", "debit": 0, "credit": total}]
                        await create_journal_entry(db, f"AI: Purchase {m['quantity']} {m.get('item_name','')} @ ₹{m.get('unit_price',0)}", lines, current_user['user_id'], biz)
                    else:
                        lines = [{"account_name": m.get('party_name') or "Accounts Receivable", "debit": total, "credit": 0}, {"account_name": "Sales", "debit": 0, "credit": total}]
                        await create_journal_entry(db, f"AI: Sale {m['quantity']} {m.get('item_name','')} @ ₹{m.get('unit_price',0)}", lines, current_user['user_id'], biz)
                except Exception as je:
                    logger.error(f"AI auto journal entry failed: {je}")

            results.append({"status": "success", "movement": movement})
        except ValueError as e:
            results.append({"status": "error", "reason": str(e)})
    return {"results": results}

@api_router.get("/dashboard/trends")
async def get_trends(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Only directors can view trends")
    
    # Get last 6 months data
    six_months_ago = datetime.now(timezone.utc) - timedelta(days=180)
    
    transactions = await db.transactions.find({
        'date': {'$gte': six_months_ago.isoformat()}
    }, {'_id': 0}).to_list(10000)
    
    # Group by month
    from collections import defaultdict
    monthly_data = defaultdict(lambda: {'income': 0, 'expense': 0, 'count': 0})
    
    for trans in transactions:
        date_obj = datetime.fromisoformat(trans['date'])
        month_key = date_obj.strftime('%Y-%m')
        
        if trans['transaction_type'] == 'income':
            monthly_data[month_key]['income'] += trans['amount']
        else:
            monthly_data[month_key]['expense'] += trans['amount']
        monthly_data[month_key]['count'] += 1
    
    # Convert to list sorted by month
    trends = []
    for month in sorted(monthly_data.keys()):
        data = monthly_data[month]
        trends.append({
            'month': month,
            'income': round(data['income'], 2),
            'expense': round(data['expense'], 2),
            'profit': round(data['income'] - data['expense'], 2),
            'transactions': data['count']
        })
    
    return trends

# Include router
app.include_router(api_router)

# Mount Socket.IO
socket_app = socketio.ASGIApp(sio, app)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_seed():
    await seed_chart_of_accounts(db)
    await seed_inventory_defaults(db)
    # Seed default companies if director exists
    director = await db.users.find_one({"role": "director"}, {"_id": 0})
    if director:
        await seed_default_companies(db, director["id"])


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()