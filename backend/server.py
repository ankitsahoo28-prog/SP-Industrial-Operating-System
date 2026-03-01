from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
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
from email_service import send_task_assignment_email, send_indent_approval_email
from ai_service import generate_business_insights, categorize_expense
from i18n import get_translation

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
        
        # Get full user details
        user_doc = await db.users.find_one({'id': user_id}, {'_id': 0, 'password_hash': 0})
        if not user_doc:
            raise HTTPException(status_code=401, detail="User not found")
        
        return {'user_id': user_id, 'role': role, 'business_type': user_doc.get('business_type')}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Audit logging helper
async def log_audit(action: str, entity_type: str, entity_id: str, user_id: str, old_data: Optional[Dict] = None, new_data: Optional[Dict] = None):
    \"\"\"Log changes for audit trail\"\"\"
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
async def get_tasks(current_user: dict = Depends(get_current_user)):
    query = {}
    
    if current_user['role'] == UserRole.GROUND_STAFF:
        query = {'assigned_to': current_user['user_id']}
    elif current_user['role'] == UserRole.MANAGER:
        # Manager sees tasks assigned to them AND their team
        team_ids = [doc['id'] for doc in await db.users.find({'manager_id': current_user['user_id']}, {'_id': 0, 'id': 1}).to_list(1000)]
        team_ids.append(current_user['user_id'])  # Include manager's own tasks
        query = {'assigned_to': {'$in': team_ids}}
        # Filter by business type
        if current_user.get('business_type'):
            query['$or'] = [
                {'business_type': current_user['business_type']},
                {'business_type': None}
            ]
    elif current_user['role'] == UserRole.DIRECTOR:
        # Directors see all tasks
        pass
    
    tasks = await db.tasks.find(query, {'_id': 0}).to_list(1000)
    
    for task in tasks:
        for field in ['created_at', 'updated_at', 'deadline']:
            if task.get(field) and isinstance(task[field], str):
                task[field] = datetime.fromisoformat(task[field])
    
    return tasks

@api_router.post("/tasks", response_model=Task)
async def create_task(task_data: TaskCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")
    
    task_dict = task_data.model_dump()
    task_dict['assigned_by'] = current_user['user_id']
    task_dict['business_type'] = current_user.get('business_type')
    task = Task(**task_dict)
    
    doc = task.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    if doc.get('deadline'):
        doc['deadline'] = doc['deadline'].isoformat()
    
    await db.tasks.insert_one(doc)
    
    # Send email notification to assigned user
    try:
        assigned_user = await db.users.find_one({'id': task.assigned_to}, {'_id': 0})
        assigner = await db.users.find_one({'id': current_user['user_id']}, {'_id': 0})
        if assigned_user and assigned_user.get('email'):
            deadline_str = task.deadline.strftime('%Y-%m-%d %H:%M') if task.deadline else None
            await send_task_assignment_email(
                assigned_user['email'],
                task.title,
                assigner.get('name', 'Manager'),
                deadline_str
            )
    except Exception as e:
        logger.error(f"Failed to send task notification email: {str(e)}")
    
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
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if report_type:
        query['type'] = report_type
    
    # Filter by business type for non-directors
    if current_user['role'] != UserRole.DIRECTOR and current_user.get('business_type'):
        query['business_type'] = current_user['business_type']
    
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
async def get_indents(current_user: dict = Depends(get_current_user)):
    query = {}
    
    if current_user['role'] == UserRole.MANAGER:
        query['requested_by'] = current_user['user_id']
    
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
    
    return Indent(**updated_doc)

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
async def get_transactions(current_user: dict = Depends(get_current_user)):
    query = {}
    
    # Filter by business type for non-directors
    if current_user['role'] != UserRole.DIRECTOR and current_user.get('business_type'):
        query['business_type'] = current_user['business_type']
    
    transactions = await db.transactions.find(query, {'_id': 0}).sort('date', -1).to_list(1000)
    
    for transaction in transactions:
        if isinstance(transaction.get('date'), str):
            transaction['date'] = datetime.fromisoformat(transaction['date'])
        if isinstance(transaction.get('created_at'), str):
            transaction['created_at'] = datetime.fromisoformat(transaction['created_at'])
    
    return transactions

@api_router.get("/ledger")
async def get_ledger(current_user: dict = Depends(get_current_user)):
    query = {}
    if current_user['role'] != UserRole.DIRECTOR and current_user.get('business_type'):
        query['business_type'] = current_user['business_type']
    
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
async def get_accounting_summary(current_user: dict = Depends(get_current_user)):
    query = {}
    if current_user['role'] != UserRole.DIRECTOR and current_user.get('business_type'):
        query['business_type'] = current_user['business_type']
    
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

# Get Translations
@api_router.get("/translations/{lang}")
async def get_translations(lang: str):
    from i18n import translations
    return translations.get(lang, translations["en"])

# Include router
app.include_router(api_router)

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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()