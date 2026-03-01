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
    DISPATCH = "dispatch"
    INCOMING_STOCK = "incoming_stock"

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
    shift_start: Optional[str] = None  # HH:MM format
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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class IndentCreate(BaseModel):
    items: List[Dict[str, Any]]
    notes: Optional[str] = None

class IndentAuthorize(BaseModel):
    status: IndentStatus
    notes: Optional[str] = None

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
        return {'user_id': user_id, 'role': role}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Auth Routes
@api_router.post("/auth/register")
async def register(user_data: UserCreate):
    # Check if email exists
    existing = await db.users.find_one({'email': user_data.email}, {'_id': 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password
    password_hash = hash_password(user_data.password)
    
    # Create user
    user_dict = user_data.model_dump(exclude={'password'})
    user = User(**user_dict)
    
    doc = user.model_dump()
    doc['password_hash'] = password_hash
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.users.insert_one(doc)
    
    # Generate token
    token = create_jwt_token(user.id, user.role.value)
    
    return {'user': user, 'token': token}

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user_doc = await db.users.find_one({'email': credentials.email}, {'_id': 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, user_doc['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Convert ISO string back to datetime
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
    
    # Directors see all, Managers see their team, Ground staff see none
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
    # Only Directors can create Managers, Managers can create Ground Staff
    if current_user['role'] == UserRole.DIRECTOR and user_data.role == UserRole.MANAGER:
        pass
    elif current_user['role'] == UserRole.MANAGER and user_data.role == UserRole.GROUND_STAFF:
        user_data.manager_id = current_user['user_id']
    else:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Check if email exists
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
        # Get tasks assigned to manager or their team
        team_ids = [doc['id'] for doc in await db.users.find({'manager_id': current_user['user_id']}, {'_id': 0, 'id': 1}).to_list(1000)]
        team_ids.append(current_user['user_id'])
        query = {'assigned_to': {'$in': team_ids}}
    
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
    task = Task(**task_dict)
    
    doc = task.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    if doc.get('deadline'):
        doc['deadline'] = doc['deadline'].isoformat()
    
    await db.tasks.insert_one(doc)
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
    report = Report(**report_dict)
    
    doc = report.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    await db.reports.insert_one(doc)
    return report

@api_router.get("/reports", response_model=List[Report])
async def get_reports(
    report_type: Optional[ReportType] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if report_type:
        query['type'] = report_type
    
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

# Dashboard Routes
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Access denied")
    
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
        'pending_indents': pending_indents
    }

@api_router.get("/")
async def root():
    return {"message": "SP Industrial Operating System API"}

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