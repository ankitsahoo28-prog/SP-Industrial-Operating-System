from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime, timezone, date
import uuid


class AccountType(str, Enum):
    RECEIVABLE = "receivable"
    PAYABLE = "payable"
    BANK = "bank"
    CASH = "cash"
    CURRENT_ASSET = "current_asset"
    FIXED_ASSET = "fixed_asset"
    CURRENT_LIABILITY = "current_liability"
    LONG_TERM_LIABILITY = "long_term_liability"
    EQUITY = "equity"
    INCOME = "income"
    EXPENSE = "expense"
    COST_OF_REVENUE = "cost_of_revenue"
    OTHER_INCOME = "other_income"
    DEPRECIATION = "depreciation"
    OFF_BALANCE = "off_balance"


ACCOUNT_TYPE_GROUPS = {
    "asset": ["receivable", "bank", "cash", "current_asset", "fixed_asset"],
    "liability": ["payable", "current_liability", "long_term_liability"],
    "equity": ["equity"],
    "income": ["income", "other_income"],
    "expense": ["expense", "cost_of_revenue", "depreciation"],
}

DEBIT_TYPES = {"receivable", "bank", "cash", "current_asset", "fixed_asset", "expense", "cost_of_revenue", "depreciation"}
CREDIT_TYPES = {"payable", "current_liability", "long_term_liability", "equity", "income", "other_income"}


class JournalType(str, Enum):
    SALE = "sale"
    PURCHASE = "purchase"
    CASH = "cash"
    BANK = "bank"
    GENERAL = "general"


class MoveType(str, Enum):
    ENTRY = "entry"
    OUT_INVOICE = "out_invoice"       # Customer Invoice
    OUT_REFUND = "out_refund"         # Customer Credit Note
    IN_INVOICE = "in_invoice"         # Vendor Bill
    IN_REFUND = "in_refund"           # Vendor Debit Note


class MoveState(str, Enum):
    DRAFT = "draft"
    POSTED = "posted"
    CANCELLED = "cancelled"


class PaymentType(str, Enum):
    INBOUND = "inbound"    # Customer Payment
    OUTBOUND = "outbound"  # Vendor Payment


class PaymentMethod(str, Enum):
    MANUAL = "manual"
    BANK_TRANSFER = "bank_transfer"
    CHECK = "check"
    CASH = "cash"
    UPI = "upi"


class PartnerType(str, Enum):
    CUSTOMER = "customer"
    VENDOR = "vendor"
    BOTH = "both"


class ReconcileState(str, Enum):
    UNRECONCILED = "unreconciled"
    PARTIAL = "partial"
    RECONCILED = "reconciled"


# ===== Request/Response Models =====

class AccountCreate(BaseModel):
    code: str
    name: str
    account_type: AccountType
    parent_id: Optional[str] = None
    tax_ids: Optional[List[str]] = []
    currency: Optional[str] = "INR"
    reconcile: Optional[bool] = False
    deprecated: Optional[bool] = False
    note: Optional[str] = ""


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    account_type: Optional[AccountType] = None
    tax_ids: Optional[List[str]] = None
    reconcile: Optional[bool] = None
    deprecated: Optional[bool] = None
    note: Optional[str] = None


class JournalCreate(BaseModel):
    name: str
    code: str
    journal_type: JournalType
    default_debit_account_id: Optional[str] = None
    default_credit_account_id: Optional[str] = None
    currency: Optional[str] = "INR"
    sequence_prefix: Optional[str] = None


class PartnerCreate(BaseModel):
    name: str
    partner_type: PartnerType = PartnerType.CUSTOMER
    email: Optional[str] = ""
    phone: Optional[str] = ""
    address: Optional[str] = ""
    gst_number: Optional[str] = ""
    pan_number: Optional[str] = ""
    credit_limit: Optional[float] = 0
    payment_terms_days: Optional[int] = 30
    notes: Optional[str] = ""


class PartnerUpdate(BaseModel):
    name: Optional[str] = None
    partner_type: Optional[PartnerType] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    gst_number: Optional[str] = None
    pan_number: Optional[str] = None
    credit_limit: Optional[float] = None
    payment_terms_days: Optional[int] = None
    notes: Optional[str] = None


class TaxCreate(BaseModel):
    name: str
    tax_type: str = "percent"  # percent or fixed
    amount: float
    tax_group: Optional[str] = "GST"
    include_in_price: Optional[bool] = False
    active: Optional[bool] = True


class MoveLineCreate(BaseModel):
    account_id: str
    partner_id: Optional[str] = None
    name: Optional[str] = ""
    debit: float = 0
    credit: float = 0
    tax_ids: Optional[List[str]] = []
    analytic_account_id: Optional[str] = None
    currency: Optional[str] = "INR"
    amount_currency: Optional[float] = 0


class MoveCreate(BaseModel):
    move_type: MoveType = MoveType.ENTRY
    journal_id: str
    partner_id: Optional[str] = None
    ref: Optional[str] = ""
    narration: Optional[str] = ""
    date: Optional[str] = None
    due_date: Optional[str] = None
    lines: List[MoveLineCreate] = []
    attachments: Optional[List[str]] = []
    currency: Optional[str] = "INR"


class InvoiceLineCreate(BaseModel):
    product_name: str
    description: Optional[str] = ""
    quantity: float = 1
    unit_price: float = 0
    discount: Optional[float] = 0
    tax_ids: Optional[List[str]] = []
    account_id: Optional[str] = None
    analytic_account_id: Optional[str] = None
    gst_rate: Optional[float] = 0
    gst_type: Optional[str] = "intra"


class InvoiceCreate(BaseModel):
    move_type: MoveType
    partner_id: str
    journal_id: Optional[str] = None
    ref: Optional[str] = ""
    narration: Optional[str] = ""
    date: Optional[str] = None
    due_date: Optional[str] = None
    invoice_lines: List[InvoiceLineCreate] = []
    payment_terms_days: Optional[int] = None
    currency: Optional[str] = "INR"
    attachments: Optional[List[str]] = []
    gst_type: Optional[str] = "intra"
    advance_adjustment: Optional[float] = 0
    apply_advance: Optional[bool] = False


class PaymentCreate(BaseModel):
    payment_type: PaymentType
    partner_id: Optional[str] = None
    amount: float
    journal_id: str
    payment_method: PaymentMethod = PaymentMethod.MANUAL
    ref: Optional[str] = ""
    date: Optional[str] = None
    invoice_ids: Optional[List[str]] = []
    currency: Optional[str] = "INR"
    is_advance: Optional[bool] = False


class BankStatementCreate(BaseModel):
    journal_id: str
    name: Optional[str] = ""
    date: Optional[str] = None
    balance_start: float = 0
    balance_end: float = 0


class BankStatementLineCreate(BaseModel):
    date: str
    name: str
    partner_id: Optional[str] = None
    amount: float
    ref: Optional[str] = ""


class ReconcileRequest(BaseModel):
    line_ids: List[str]


class FiscalYearCreate(BaseModel):
    name: str
    start_date: str
    end_date: str
    lock_date: Optional[str] = None


class AnalyticAccountCreate(BaseModel):
    name: str
    code: Optional[str] = ""
    partner_id: Optional[str] = None
    active: Optional[bool] = True


class RecurringTemplateCreate(BaseModel):
    name: str
    journal_id: str
    lines: List[MoveLineCreate]
    narration: Optional[str] = ""
    interval_type: str = "monthly"  # daily, weekly, monthly, yearly
    interval_count: int = 1
    next_date: Optional[str] = None
    end_date: Optional[str] = None


class LockDateUpdate(BaseModel):
    lock_date: Optional[str] = None
    tax_lock_date: Optional[str] = None
