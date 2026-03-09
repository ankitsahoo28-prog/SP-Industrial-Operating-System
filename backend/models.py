from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
from enum import Enum
from datetime import datetime, timezone
import uuid


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
    RICE_MILL = "rice_mill"


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


# --- Core Models ---

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    role: UserRole
    phone: Optional[str] = None
    business_type: Optional[str] = None
    manager_id: Optional[str] = None
    shift_start: Optional[str] = None
    shift_end: Optional[str] = None
    status: Optional[str] = "approved"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: UserRole
    phone: Optional[str] = None
    business_type: Optional[str] = None
    manager_id: Optional[str] = None
    shift_start: Optional[str] = None
    shift_end: Optional[str] = None
    job_role_id: Optional[str] = None


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
    business_type: Optional[str] = None
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
    business_type: Optional[str] = None
    data: Dict[str, Any]
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ReportCreate(BaseModel):
    type: ReportType
    business_type: Optional[str] = None
    data: Dict[str, Any]


class Indent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    requested_by: str
    items: List[Dict[str, Any]]
    status: IndentStatus = IndentStatus.PENDING
    authorized_by: Optional[str] = None
    notes: Optional[str] = None
    business_type: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class IndentCreate(BaseModel):
    items: List[Dict[str, Any]]
    notes: Optional[str] = None


class IndentAuthorize(BaseModel):
    status: IndentStatus
    notes: Optional[str] = None


class Transaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    transaction_type: TransactionType
    payment_mode: PaymentMode
    amount: float
    description: str
    category: str
    created_by: str
    business_type: Optional[str] = None
    date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TransactionCreate(BaseModel):
    transaction_type: TransactionType
    payment_mode: PaymentMode
    amount: float
    description: str
    category: str
    date: Optional[datetime] = None
    attachments: Optional[List[str]] = None


class InventoryItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    item_name: str
    category: str
    opening_stock: float
    current_stock: float
    unit: str
    business_type: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class InventoryItemCreate(BaseModel):
    item_name: str
    category: str
    opening_stock: float
    unit: str
    business_type: Optional[str] = None


class AuditLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    action: str
    entity_type: str
    entity_id: str
    user_id: str
    old_data: Optional[Dict[str, Any]] = None
    new_data: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SelfRegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: Optional[str] = None
    role: Optional[UserRole] = UserRole.GROUND_STAFF
    business_type: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class DirectorChangePassword(BaseModel):
    user_id: str
    new_password: str


class AppSettingsUpdate(BaseModel):
    app_name: Optional[str] = None
    logo_url: Optional[str] = None
    bg_video_url: Optional[str] = None
    primary_color: Optional[str] = None
    tagline: Optional[str] = None


class AiInventoryRequest(BaseModel):
    statement: str
    business_type: Optional[str] = None


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


class MultiCompanyAssign(BaseModel):
    user_id: str
    company_ids: List[str]


class AiAccountantRequest(BaseModel):
    statement: str


class JournalPostRequest(BaseModel):
    narration: str
    lines: List[Dict[str, Any]]


class StockMovementRequest(BaseModel):
    item_id: str
    movement_type: str
    quantity: float
    unit_price: float
    reference_type: str
    notes: Optional[str] = ""
    batch_number: Optional[str] = None
    party_name: Optional[str] = None


class ProductionRequest(BaseModel):
    input_item_id: str
    input_qty: float
    outputs: List[Dict[str, Any]]
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
    category: str
    unit: str
    min_stock_level: Optional[float] = 10
    opening_stock: Optional[float] = 0
    avg_cost: Optional[float] = 0
    density: Optional[float] = None


class JobRoleCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    permissions: List[str] = []


class JobRoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[List[str]] = None


class ReconciliationCreate(BaseModel):
    from_company_id: str
    to_company_id: str
    amount: float
    description: str
    reference: Optional[str] = ""
