from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from collections import defaultdict
import uuid
import os
import logging

from database import db
from deps import get_current_user, resolve_company_id, require_company_access, log_audit
from models import UserRole
from odoo_accounting.models import *
from odoo_accounting.engine import (
    seed_odoo_accounting, post_move, cancel_move, create_invoice_move,
    register_payment, compute_account_balance, get_next_sequence,
)
from odoo_accounting.models import ACCOUNT_TYPE_GROUPS, DEBIT_TYPES, CREDIT_TYPES

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/acc")


async def get_cid(current_user, company_id=None):
    cid = await resolve_company_id(current_user['user_id'], current_user['role'], company_id)
    if not cid:
        comp = await db.companies.find_one({"status": "active"}, {"_id": 0, "id": 1})
        cid = comp["id"] if comp else None
    if cid:
        existing = await db.odoo_accounts.find_one({"company_id": cid}, {"_id": 0})
        if not existing:
            await seed_odoo_accounting(db, cid)
    return cid


# ========== CHART OF ACCOUNTS ==========

@router.get("/accounts")
async def list_accounts(company_id: Optional[str] = None, account_type: Optional[str] = None,
                        current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    query = {"company_id": cid}
    if account_type:
        query["account_type"] = account_type
    accounts = await db.odoo_accounts.find(query, {"_id": 0}).sort("code", 1).to_list(5000)
    return accounts


@router.post("/accounts")
async def create_account(data: AccountCreate, company_id: Optional[str] = None,
                         current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    existing = await db.odoo_accounts.find_one({"code": data.code, "company_id": cid}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail=f"Account code {data.code} already exists")
    doc = {
        "id": str(uuid.uuid4()), "code": data.code, "name": data.name,
        "account_type": data.account_type.value, "parent_id": data.parent_id,
        "reconcile": data.reconcile, "deprecated": data.deprecated,
        "tax_ids": data.tax_ids or [], "currency": data.currency or "INR",
        "note": data.note or "", "company_id": cid, "balance": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.odoo_accounts.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/accounts/{account_id}")
async def update_account(account_id: str, data: AccountUpdate, company_id: Optional[str] = None,
                         current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    updates = {k: (v.value if hasattr(v, 'value') else v) for k, v in data.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")
    await db.odoo_accounts.update_one({"id": account_id, "company_id": cid}, {"$set": updates})
    acct = await db.odoo_accounts.find_one({"id": account_id, "company_id": cid}, {"_id": 0})
    return acct


# ========== JOURNALS ==========

@router.get("/journals")
async def list_journals(company_id: Optional[str] = None, journal_type: Optional[str] = None,
                        current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    query = {"company_id": cid}
    if journal_type:
        query["journal_type"] = journal_type
    journals = await db.odoo_journals.find(query, {"_id": 0}).sort("code", 1).to_list(100)
    for j in journals:
        move_count = await db.odoo_moves.count_documents({"journal_id": j["id"], "state": "posted", "company_id": cid})
        j["entry_count"] = move_count
    return journals


@router.post("/journals")
async def create_journal(data: JournalCreate, company_id: Optional[str] = None,
                         current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    doc = {
        "id": str(uuid.uuid4()), "name": data.name, "code": data.code,
        "journal_type": data.journal_type.value,
        "default_debit_account_id": data.default_debit_account_id,
        "default_credit_account_id": data.default_credit_account_id,
        "currency": data.currency or "INR", "sequence_number": 1,
        "sequence_prefix": data.sequence_prefix or f"{data.code}/%(year)s/",
        "company_id": cid, "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.odoo_journals.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ========== PARTNERS ==========

@router.get("/partners")
async def list_partners(company_id: Optional[str] = None, partner_type: Optional[str] = None,
                        current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    query = {"company_id": cid}
    if partner_type and partner_type != "all":
        query["$or"] = [{"partner_type": partner_type}, {"partner_type": "both"}]
    partners = await db.odoo_partners.find(query, {"_id": 0}).sort("name", 1).to_list(5000)
    for p in partners:
        p["total_receivable"] = 0
        p["total_payable"] = 0
        recv_lines = await db.odoo_move_lines.find(
            {"partner_id": p["id"], "company_id": cid, "parent_state": "posted"},
            {"_id": 0, "debit": 1, "credit": 1, "account_id": 1}
        ).to_list(10000)
        for l in recv_lines:
            acct = await db.odoo_accounts.find_one({"id": l["account_id"]}, {"_id": 0, "account_type": 1})
            if acct:
                if acct["account_type"] == "receivable":
                    p["total_receivable"] += l.get("debit", 0) - l.get("credit", 0)
                elif acct["account_type"] == "payable":
                    p["total_payable"] += l.get("credit", 0) - l.get("debit", 0)
        p["total_receivable"] = round(p["total_receivable"], 2)
        p["total_payable"] = round(p["total_payable"], 2)
    return partners


@router.post("/partners")
async def create_partner(data: PartnerCreate, company_id: Optional[str] = None,
                         current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    doc = {
        "id": str(uuid.uuid4()), **data.model_dump(),
        "partner_type": data.partner_type.value,
        "company_id": cid, "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.odoo_partners.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/partners/{partner_id}")
async def update_partner(partner_id: str, data: PartnerUpdate, company_id: Optional[str] = None,
                         current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    updates = {k: (v.value if hasattr(v, 'value') else v) for k, v in data.model_dump().items() if v is not None}
    await db.odoo_partners.update_one({"id": partner_id, "company_id": cid}, {"$set": updates})
    return await db.odoo_partners.find_one({"id": partner_id, "company_id": cid}, {"_id": 0})


@router.delete("/partners/{partner_id}")
async def delete_partner(partner_id: str, company_id: Optional[str] = None,
                         current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    await db.odoo_partners.delete_one({"id": partner_id, "company_id": cid})
    return {"message": "Partner deleted"}


# ========== TAXES ==========

@router.get("/taxes")
async def list_taxes(company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    return await db.odoo_taxes.find({"company_id": cid}, {"_id": 0}).sort("name", 1).to_list(200)


@router.post("/taxes")
async def create_tax(data: TaxCreate, company_id: Optional[str] = None,
                     current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    doc = {"id": str(uuid.uuid4()), **data.model_dump(), "company_id": cid, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.odoo_taxes.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ========== JOURNAL ENTRIES (Moves) ==========

@router.get("/moves")
async def list_moves(company_id: Optional[str] = None, move_type: Optional[str] = None,
                     state: Optional[str] = None, journal_id: Optional[str] = None,
                     date_from: Optional[str] = None, date_to: Optional[str] = None,
                     partner_id: Optional[str] = None, limit: int = 200,
                     current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    query = {"company_id": cid}
    if move_type:
        if move_type == "invoices":
            query["move_type"] = {"$in": ["out_invoice", "out_refund"]}
        elif move_type == "bills":
            query["move_type"] = {"$in": ["in_invoice", "in_refund"]}
        elif move_type != "all":
            query["move_type"] = move_type
    if state and state != "all":
        query["state"] = state
    if journal_id:
        query["journal_id"] = journal_id
    if partner_id:
        query["partner_id"] = partner_id
    if date_from:
        query.setdefault("date", {})["$gte"] = date_from
    if date_to:
        query.setdefault("date", {})["$lte"] = date_to
    moves = await db.odoo_moves.find(query, {"_id": 0}).sort("date", -1).to_list(limit)
    for m in moves:
        if m.get("partner_id"):
            p = await db.odoo_partners.find_one({"id": m["partner_id"]}, {"_id": 0, "name": 1})
            m["partner_name"] = p["name"] if p else "Unknown"
    return moves


@router.get("/moves/{move_id}")
async def get_move(move_id: str, current_user: dict = Depends(get_current_user)):
    move = await db.odoo_moves.find_one({"id": move_id}, {"_id": 0})
    if not move:
        raise HTTPException(status_code=404, detail="Move not found")
    move["lines"] = await db.odoo_move_lines.find({"move_id": move_id}, {"_id": 0}).to_list(1000)
    for line in move["lines"]:
        acct = await db.odoo_accounts.find_one({"id": line.get("account_id")}, {"_id": 0, "name": 1, "code": 1})
        line["account_name"] = f"{acct['code']} - {acct['name']}" if acct else "Unknown"
    if move.get("partner_id"):
        p = await db.odoo_partners.find_one({"id": move["partner_id"]}, {"_id": 0, "name": 1})
        move["partner_name"] = p["name"] if p else "Unknown"
    return move


@router.post("/moves")
async def create_move(data: MoveCreate, company_id: Optional[str] = None,
                      current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    now = datetime.now(timezone.utc)
    move_id = str(uuid.uuid4())
    journal = await db.odoo_journals.find_one({"id": data.journal_id, "company_id": cid}, {"_id": 0})
    if not journal:
        raise HTTPException(status_code=404, detail="Journal not found")

    move_doc = {
        "id": move_id, "name": "Draft", "move_type": data.move_type.value,
        "journal_id": data.journal_id, "journal_name": journal["name"],
        "partner_id": data.partner_id, "ref": data.ref or "",
        "narration": data.narration or "",
        "date": data.date or now.strftime("%Y-%m-%d"),
        "due_date": data.due_date, "state": "draft",
        "amount_total": 0, "total_debit": 0, "total_credit": 0,
        "attachments": data.attachments or [],
        "company_id": cid, "created_by": current_user['user_id'],
        "created_at": now.isoformat(),
    }

    total_debit = 0
    total_credit = 0
    for line_data in data.lines:
        ml = {
            "id": str(uuid.uuid4()), "move_id": move_id,
            "account_id": line_data.account_id, "partner_id": line_data.partner_id or data.partner_id,
            "name": line_data.name or "", "debit": round(line_data.debit, 2),
            "credit": round(line_data.credit, 2), "tax_ids": line_data.tax_ids or [],
            "analytic_account_id": line_data.analytic_account_id,
            "date": move_doc["date"], "parent_state": "draft",
            "company_id": cid, "reconciled": False,
            "created_at": now.isoformat(),
        }
        total_debit += ml["debit"]
        total_credit += ml["credit"]
        await db.odoo_move_lines.insert_one(ml)

    move_doc["total_debit"] = round(total_debit, 2)
    move_doc["total_credit"] = round(total_credit, 2)
    move_doc["amount_total"] = round(total_debit, 2)
    await db.odoo_moves.insert_one(move_doc)
    move_doc.pop("_id", None)
    return move_doc


@router.post("/moves/{move_id}/post")
async def post_move_endpoint(move_id: str, current_user: dict = Depends(get_current_user)):
    move = await db.odoo_moves.find_one({"id": move_id}, {"_id": 0})
    if not move:
        raise HTTPException(status_code=404, detail="Move not found")
    try:
        name = await post_move(db, move_id, move["company_id"])
        return {"message": "Posted", "name": name}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/moves/{move_id}/cancel")
async def cancel_move_endpoint(move_id: str, current_user: dict = Depends(get_current_user)):
    move = await db.odoo_moves.find_one({"id": move_id}, {"_id": 0})
    if not move:
        raise HTTPException(status_code=404, detail="Move not found")
    try:
        await cancel_move(db, move_id, move["company_id"])
        return {"message": "Cancelled"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/moves/{move_id}")
async def delete_move(move_id: str, current_user: dict = Depends(get_current_user)):
    move = await db.odoo_moves.find_one({"id": move_id}, {"_id": 0})
    if not move:
        raise HTTPException(status_code=404, detail="Not found")
    if move["state"] == "posted":
        raise HTTPException(status_code=400, detail="Cannot delete posted entry. Cancel it first.")
    await db.odoo_move_lines.delete_many({"move_id": move_id})
    await db.odoo_moves.delete_one({"id": move_id})
    return {"message": "Deleted"}


# ========== INVOICES ==========

@router.post("/invoices")
async def create_invoice(data: InvoiceCreate, company_id: Optional[str] = None,
                         current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    try:
        invoice = await create_invoice_move(db, data.model_dump(), cid, current_user['user_id'])
        return invoice
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ========== PAYMENTS ==========

@router.get("/payments")
async def list_payments(company_id: Optional[str] = None, payment_type: Optional[str] = None,
                        is_advance: Optional[str] = None,
                        current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    query = {"company_id": cid}
    if payment_type and payment_type != "all":
        query["payment_type"] = payment_type
    if is_advance == "true":
        query["is_advance"] = True
    payments = await db.odoo_payments.find(query, {"_id": 0}).sort("date", -1).to_list(500)
    for p in payments:
        if p.get("partner_id"):
            partner = await db.odoo_partners.find_one({"id": p["partner_id"]}, {"_id": 0, "name": 1})
            p["partner_name"] = partner["name"] if partner else "Unknown"
    return payments


@router.post("/payments")
async def create_payment(data: PaymentCreate, company_id: Optional[str] = None,
                         current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    try:
        payment = await register_payment(db, data.model_dump(), cid, current_user['user_id'])
        return payment
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ========== BANK STATEMENTS ==========

@router.get("/bank-statements")
async def list_bank_statements(company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    stmts = await db.odoo_bank_statements.find({"company_id": cid}, {"_id": 0}).sort("date", -1).to_list(200)
    return stmts


@router.post("/bank-statements")
async def create_bank_statement(data: BankStatementCreate, company_id: Optional[str] = None,
                                current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    doc = {
        "id": str(uuid.uuid4()), "journal_id": data.journal_id,
        "name": data.name or f"Statement {datetime.now(timezone.utc).strftime('%Y-%m-%d')}",
        "date": data.date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "balance_start": data.balance_start, "balance_end": data.balance_end,
        "state": "open", "company_id": cid, "lines": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.odoo_bank_statements.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.post("/bank-statements/{stmt_id}/lines")
async def add_bank_statement_line(stmt_id: str, data: BankStatementLineCreate,
                                  current_user: dict = Depends(get_current_user)):
    line = {
        "id": str(uuid.uuid4()), "statement_id": stmt_id,
        "date": data.date, "name": data.name, "partner_id": data.partner_id,
        "amount": data.amount, "ref": data.ref or "", "reconciled": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.odoo_bank_statements.update_one({"id": stmt_id}, {"$push": {"lines": line}})
    return line


@router.post("/bank-statements/{stmt_id}/reconcile/{line_id}")
async def reconcile_bank_line(stmt_id: str, line_id: str, move_line_id: str,
                              current_user: dict = Depends(get_current_user)):
    await db.odoo_bank_statements.update_one(
        {"id": stmt_id, "lines.id": line_id},
        {"$set": {"lines.$.reconciled": True, "lines.$.matched_move_line_id": move_line_id}}
    )
    await db.odoo_move_lines.update_one({"id": move_line_id}, {"$set": {"reconciled": True}})
    return {"message": "Reconciled"}


# ========== FISCAL YEARS ==========

@router.get("/fiscal-years")
async def list_fiscal_years(company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    return await db.odoo_fiscal_years.find({"company_id": cid}, {"_id": 0}).sort("start_date", -1).to_list(50)


@router.post("/fiscal-years")
async def create_fiscal_year(data: FiscalYearCreate, company_id: Optional[str] = None,
                             current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    doc = {
        "id": str(uuid.uuid4()), "name": data.name,
        "start_date": data.start_date, "end_date": data.end_date,
        "lock_date": data.lock_date, "tax_lock_date": None, "state": "open",
        "company_id": cid, "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.odoo_fiscal_years.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.patch("/fiscal-years/{fy_id}/lock")
async def update_lock_date(fy_id: str, data: LockDateUpdate,
                           current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Directors only")
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    await db.odoo_fiscal_years.update_one({"id": fy_id}, {"$set": updates})
    return await db.odoo_fiscal_years.find_one({"id": fy_id}, {"_id": 0})


# ========== ANALYTIC ACCOUNTS ==========

@router.get("/analytic-accounts")
async def list_analytic_accounts(company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    return await db.odoo_analytic_accounts.find({"company_id": cid}, {"_id": 0}).sort("name", 1).to_list(500)


@router.post("/analytic-accounts")
async def create_analytic_account(data: AnalyticAccountCreate, company_id: Optional[str] = None,
                                  current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    doc = {
        "id": str(uuid.uuid4()), **data.model_dump(), "company_id": cid,
        "balance": 0, "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.odoo_analytic_accounts.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ========== RECURRING ENTRIES ==========

@router.get("/recurring-templates")
async def list_recurring_templates(company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    return await db.odoo_recurring_templates.find({"company_id": cid}, {"_id": 0}).sort("name", 1).to_list(100)


@router.post("/recurring-templates")
async def create_recurring_template(data: RecurringTemplateCreate, company_id: Optional[str] = None,
                                    current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    next_d = data.next_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    doc = {
        "id": str(uuid.uuid4()), "name": data.name, "journal_id": data.journal_id,
        "lines": [l.model_dump() for l in data.lines], "narration": data.narration or "",
        "interval_type": data.interval_type, "interval_count": data.interval_count,
        "next_date": next_d, "end_date": data.end_date, "active": True,
        "company_id": cid, "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.odoo_recurring_templates.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.post("/recurring-templates/{template_id}/execute")
async def execute_recurring(template_id: str, current_user: dict = Depends(get_current_user)):
    tmpl = await db.odoo_recurring_templates.find_one({"id": template_id}, {"_id": 0})
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    move_data = MoveCreate(
        journal_id=tmpl["journal_id"], narration=tmpl.get("narration", ""),
        lines=[MoveLineCreate(**l) for l in tmpl["lines"]]
    )
    cid = tmpl["company_id"]
    result = await create_move(move_data, company_id=cid, current_user=current_user)
    await post_move(db, result["id"], cid)

    next_dt = datetime.strptime(tmpl["next_date"], "%Y-%m-%d")
    if tmpl["interval_type"] == "daily":
        next_dt += timedelta(days=tmpl["interval_count"])
    elif tmpl["interval_type"] == "weekly":
        next_dt += timedelta(weeks=tmpl["interval_count"])
    elif tmpl["interval_type"] == "monthly":
        month = next_dt.month + tmpl["interval_count"]
        year = next_dt.year + (month - 1) // 12
        month = ((month - 1) % 12) + 1
        next_dt = next_dt.replace(year=year, month=month)
    elif tmpl["interval_type"] == "yearly":
        next_dt = next_dt.replace(year=next_dt.year + tmpl["interval_count"])
    await db.odoo_recurring_templates.update_one({"id": template_id}, {"$set": {"next_date": next_dt.strftime("%Y-%m-%d")}})
    return {"message": "Recurring entry created and posted", "move_id": result["id"]}


# ========== REPORTS ==========

@router.get("/reports/general-ledger")
async def general_ledger_report(company_id: Optional[str] = None, date_from: Optional[str] = None,
                                date_to: Optional[str] = None, account_id: Optional[str] = None,
                                current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    acct_query = {"company_id": cid}
    if account_id:
        acct_query["id"] = account_id
    accounts = await db.odoo_accounts.find(acct_query, {"_id": 0}).sort("code", 1).to_list(5000)
    result = []
    for acct in accounts:
        lq = {"account_id": acct["id"], "company_id": cid, "parent_state": "posted"}
        if date_from:
            lq.setdefault("date", {})["$gte"] = date_from
        if date_to:
            lq.setdefault("date", {})["$lte"] = date_to
        lines = await db.odoo_move_lines.find(lq, {"_id": 0}).sort("date", 1).to_list(10000)
        if not lines and not account_id:
            continue
        total_debit = sum(l["debit"] for l in lines)
        total_credit = sum(l["credit"] for l in lines)
        for l in lines:
            move = await db.odoo_moves.find_one({"id": l["move_id"]}, {"_id": 0, "name": 1, "ref": 1})
            l["move_name"] = move.get("name", "") if move else ""
            l["move_ref"] = move.get("ref", "") if move else ""
        result.append({
            "account_id": acct["id"], "account_code": acct["code"], "account_name": acct["name"],
            "account_type": acct["account_type"], "total_debit": round(total_debit, 2),
            "total_credit": round(total_credit, 2), "balance": round(total_debit - total_credit, 2),
            "lines": lines,
        })
    return result


@router.get("/reports/trial-balance")
async def trial_balance_report(company_id: Optional[str] = None, date_from: Optional[str] = None,
                               date_to: Optional[str] = None,
                               current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    accounts = await db.odoo_accounts.find({"company_id": cid}, {"_id": 0}).sort("code", 1).to_list(5000)
    rows = []
    grand_debit = 0
    grand_credit = 0
    for acct in accounts:
        bal = await compute_account_balance(db, acct["id"], cid, date_from, date_to)
        if bal["debit"] == 0 and bal["credit"] == 0:
            continue
        grand_debit += bal["debit"]
        grand_credit += bal["credit"]
        rows.append({
            "account_id": acct["id"], "code": acct["code"], "name": acct["name"],
            "account_type": acct["account_type"],
            "debit": bal["debit"], "credit": bal["credit"], "balance": bal["balance"],
        })
    return {"rows": rows, "total_debit": round(grand_debit, 2), "total_credit": round(grand_credit, 2),
            "is_balanced": abs(grand_debit - grand_credit) < 0.01}


@router.get("/reports/profit-loss")
async def profit_loss_report(company_id: Optional[str] = None, date_from: Optional[str] = None,
                             date_to: Optional[str] = None,
                             current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    income_types = ACCOUNT_TYPE_GROUPS["income"]
    expense_types = ACCOUNT_TYPE_GROUPS["expense"]
    accounts = await db.odoo_accounts.find({"company_id": cid}, {"_id": 0}).sort("code", 1).to_list(5000)
    income_items = []
    expense_items = []
    total_income = 0
    total_expense = 0
    for acct in accounts:
        bal = await compute_account_balance(db, acct["id"], cid, date_from, date_to)
        if bal["debit"] == 0 and bal["credit"] == 0:
            continue
        if acct["account_type"] in income_types:
            amount = bal["credit"] - bal["debit"]
            if amount != 0:
                income_items.append({"code": acct["code"], "name": acct["name"], "amount": round(amount, 2)})
                total_income += amount
        elif acct["account_type"] in expense_types:
            amount = bal["debit"] - bal["credit"]
            if amount != 0:
                expense_items.append({"code": acct["code"], "name": acct["name"], "amount": round(amount, 2)})
                total_expense += amount
    return {
        "income": income_items, "expenses": expense_items,
        "total_income": round(total_income, 2), "total_expense": round(total_expense, 2),
        "net_profit": round(total_income - total_expense, 2),
    }


@router.get("/reports/balance-sheet")
async def balance_sheet_report(company_id: Optional[str] = None, date_to: Optional[str] = None,
                               current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    accounts = await db.odoo_accounts.find({"company_id": cid}, {"_id": 0}).sort("code", 1).to_list(5000)
    assets = []
    liabilities = []
    equity = []
    total_assets = 0
    total_liabilities = 0
    total_equity = 0
    for acct in accounts:
        bal = await compute_account_balance(db, acct["id"], cid, date_to=date_to)
        if bal["balance"] == 0:
            continue
        item = {"code": acct["code"], "name": acct["name"], "account_type": acct["account_type"]}
        if acct["account_type"] in ACCOUNT_TYPE_GROUPS["asset"]:
            item["amount"] = bal["balance"]
            assets.append(item)
            total_assets += bal["balance"]
        elif acct["account_type"] in ACCOUNT_TYPE_GROUPS["liability"]:
            item["amount"] = -bal["balance"]
            liabilities.append(item)
            total_liabilities += -bal["balance"]
        elif acct["account_type"] in ACCOUNT_TYPE_GROUPS["equity"]:
            item["amount"] = -bal["balance"]
            equity.append(item)
            total_equity += -bal["balance"]
    return {
        "assets": assets, "liabilities": liabilities, "equity": equity,
        "total_assets": round(total_assets, 2), "total_liabilities": round(total_liabilities, 2),
        "total_equity": round(total_equity, 2),
        "total_liabilities_equity": round(total_liabilities + total_equity, 2),
    }


@router.get("/reports/aged-receivables")
async def aged_receivables(company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    invoices = await db.odoo_moves.find(
        {"company_id": cid, "move_type": {"$in": ["out_invoice"]}, "state": "posted", "payment_state": {"$ne": "paid"}},
        {"_id": 0}
    ).to_list(10000)
    buckets = {"current": 0, "1_30": 0, "31_60": 0, "61_90": 0, "over_90": 0}
    partner_aging = {}
    for inv in invoices:
        due = inv.get("due_date", inv.get("date", today))
        days = (datetime.strptime(today, "%Y-%m-%d") - datetime.strptime(due, "%Y-%m-%d")).days
        residual = inv.get("amount_residual", 0)
        if days <= 0:
            buckets["current"] += residual
        elif days <= 30:
            buckets["1_30"] += residual
        elif days <= 60:
            buckets["31_60"] += residual
        elif days <= 90:
            buckets["61_90"] += residual
        else:
            buckets["over_90"] += residual
        pid = inv.get("partner_id", "unknown")
        if pid not in partner_aging:
            p = await db.odoo_partners.find_one({"id": pid}, {"_id": 0, "name": 1})
            partner_aging[pid] = {"partner_name": p["name"] if p else "Unknown", "total": 0, "invoices": []}
        partner_aging[pid]["total"] += residual
        partner_aging[pid]["invoices"].append({"id": inv["id"], "name": inv.get("name", ""), "due_date": due, "residual": residual, "days_overdue": max(0, days)})
    return {"buckets": {k: round(v, 2) for k, v in buckets.items()}, "total": round(sum(buckets.values()), 2), "by_partner": list(partner_aging.values())}


@router.get("/reports/aged-payables")
async def aged_payables(company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    bills = await db.odoo_moves.find(
        {"company_id": cid, "move_type": {"$in": ["in_invoice"]}, "state": "posted", "payment_state": {"$ne": "paid"}},
        {"_id": 0}
    ).to_list(10000)
    buckets = {"current": 0, "1_30": 0, "31_60": 0, "61_90": 0, "over_90": 0}
    for bill in bills:
        due = bill.get("due_date", bill.get("date", today))
        days = (datetime.strptime(today, "%Y-%m-%d") - datetime.strptime(due, "%Y-%m-%d")).days
        residual = bill.get("amount_residual", 0)
        if days <= 0:
            buckets["current"] += residual
        elif days <= 30:
            buckets["1_30"] += residual
        elif days <= 60:
            buckets["31_60"] += residual
        elif days <= 90:
            buckets["61_90"] += residual
        else:
            buckets["over_90"] += residual
    return {"buckets": {k: round(v, 2) for k, v in buckets.items()}, "total": round(sum(buckets.values()), 2)}


@router.get("/reports/cash-flow")
async def cash_flow_report(company_id: Optional[str] = None, date_from: Optional[str] = None,
                           date_to: Optional[str] = None,
                           current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    cash_types = ["cash", "bank"]
    cash_accounts = await db.odoo_accounts.find({"company_id": cid, "account_type": {"$in": cash_types}}, {"_id": 0}).to_list(100)
    operating = 0
    investing = 0
    financing = 0
    for acct in cash_accounts:
        lq = {"account_id": acct["id"], "company_id": cid, "parent_state": "posted"}
        if date_from:
            lq.setdefault("date", {})["$gte"] = date_from
        if date_to:
            lq.setdefault("date", {})["$lte"] = date_to
        lines = await db.odoo_move_lines.find(lq, {"_id": 0}).to_list(10000)
        for l in lines:
            net = l["debit"] - l["credit"]
            operating += net
    income_bal = 0
    expense_bal = 0
    all_accounts = await db.odoo_accounts.find({"company_id": cid}, {"_id": 0}).to_list(5000)
    for acct in all_accounts:
        if acct["account_type"] in ACCOUNT_TYPE_GROUPS["income"]:
            bal = await compute_account_balance(db, acct["id"], cid, date_from, date_to)
            income_bal += bal["credit"] - bal["debit"]
        elif acct["account_type"] in ACCOUNT_TYPE_GROUPS["expense"]:
            bal = await compute_account_balance(db, acct["id"], cid, date_from, date_to)
            expense_bal += bal["debit"] - bal["credit"]
    return {
        "operating": round(operating, 2), "investing": round(investing, 2),
        "financing": round(financing, 2), "net_change": round(operating + investing + financing, 2),
        "income_total": round(income_bal, 2), "expense_total": round(expense_bal, 2),
    }


@router.get("/reports/tax-report")
async def tax_report(company_id: Optional[str] = None, date_from: Optional[str] = None,
                     date_to: Optional[str] = None,
                     current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    taxes = await db.odoo_taxes.find({"company_id": cid, "active": True}, {"_id": 0}).to_list(200)
    lq = {"company_id": cid, "parent_state": "posted"}
    if date_from:
        lq.setdefault("date", {})["$gte"] = date_from
    if date_to:
        lq.setdefault("date", {})["$lte"] = date_to
    lines = await db.odoo_move_lines.find(lq, {"_id": 0}).to_list(100000)
    tax_summary = {}
    for tax in taxes:
        tax_summary[tax["id"]] = {"name": tax["name"], "rate": tax["amount"], "tax_group": tax["tax_group"], "base_amount": 0, "tax_amount": 0}
    for line in lines:
        for tid in line.get("tax_ids", []):
            if tid in tax_summary:
                net = line["debit"] - line["credit"]
                tax_summary[tid]["base_amount"] += abs(net)
    for tid, ts in tax_summary.items():
        tax = next((t for t in taxes if t["id"] == tid), None)
        if tax and tax["tax_type"] == "percent" and tax["amount"] > 0:
            ts["tax_amount"] = round(ts["base_amount"] * tax["amount"] / 100, 2)
        ts["base_amount"] = round(ts["base_amount"], 2)
    output_tax = await db.odoo_accounts.find_one({"company_id": cid, "code": "2210"}, {"_id": 0})
    input_tax = await db.odoo_accounts.find_one({"company_id": cid, "code": "2220"}, {"_id": 0})
    output_bal = await compute_account_balance(db, output_tax["id"], cid, date_from, date_to) if output_tax else {"balance": 0}
    input_bal = await compute_account_balance(db, input_tax["id"], cid, date_from, date_to) if input_tax else {"balance": 0}
    return {
        "taxes": list(tax_summary.values()),
        "gst_output": round(abs(output_bal["balance"]), 2),
        "gst_input": round(abs(input_bal["balance"]), 2),
        "net_gst_payable": round(abs(output_bal["balance"]) - abs(input_bal["balance"]), 2),
    }


@router.get("/reports/partner-ledger")
async def partner_ledger_report(partner_id: str, company_id: Optional[str] = None,
                                date_from: Optional[str] = None, date_to: Optional[str] = None,
                                current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    partner = await db.odoo_partners.find_one({"id": partner_id, "company_id": cid}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    lq = {"partner_id": partner_id, "company_id": cid, "parent_state": "posted"}
    if date_from:
        lq.setdefault("date", {})["$gte"] = date_from
    if date_to:
        lq.setdefault("date", {})["$lte"] = date_to
    lines = await db.odoo_move_lines.find(lq, {"_id": 0}).sort("date", 1).to_list(10000)
    running_balance = 0
    entries = []
    for l in lines:
        running_balance += l["debit"] - l["credit"]
        move = await db.odoo_moves.find_one({"id": l["move_id"]}, {"_id": 0, "name": 1, "ref": 1, "move_type": 1})
        acct = await db.odoo_accounts.find_one({"id": l["account_id"]}, {"_id": 0, "code": 1, "name": 1})
        entries.append({
            "date": l["date"], "move_name": move.get("name", "") if move else "",
            "ref": move.get("ref", "") if move else "",
            "account": f"{acct['code']} - {acct['name']}" if acct else "",
            "debit": l["debit"], "credit": l["credit"], "balance": round(running_balance, 2),
        })
    total_debit = sum(l["debit"] for l in lines)
    total_credit = sum(l["credit"] for l in lines)
    return {
        "partner": partner, "entries": entries,
        "total_debit": round(total_debit, 2), "total_credit": round(total_credit, 2),
        "balance": round(total_debit - total_credit, 2),
    }


# ========== DASHBOARD ==========

@router.get("/dashboard")
async def accounting_dashboard(company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1).strftime("%Y-%m-%d")

    total_receivable = 0
    total_payable = 0
    cash_balance = 0
    bank_balance = 0

    accounts = await db.odoo_accounts.find({"company_id": cid}, {"_id": 0}).to_list(5000)
    for acct in accounts:
        if acct["account_type"] == "receivable":
            total_receivable += acct.get("balance", 0)
        elif acct["account_type"] == "payable":
            total_payable += abs(acct.get("balance", 0))
        elif acct["account_type"] == "cash":
            cash_balance += acct.get("balance", 0)
        elif acct["account_type"] == "bank":
            bank_balance += acct.get("balance", 0)

    draft_invoices = await db.odoo_moves.count_documents({"company_id": cid, "move_type": "out_invoice", "state": "draft"})
    overdue_invoices = await db.odoo_moves.count_documents(
        {"company_id": cid, "move_type": "out_invoice", "state": "posted", "payment_state": {"$ne": "paid"}, "due_date": {"$lt": now.strftime("%Y-%m-%d")}}
    )
    draft_bills = await db.odoo_moves.count_documents({"company_id": cid, "move_type": "in_invoice", "state": "draft"})
    total_invoices = await db.odoo_moves.count_documents({"company_id": cid, "move_type": {"$in": ["out_invoice", "out_refund"]}})
    total_bills = await db.odoo_moves.count_documents({"company_id": cid, "move_type": {"$in": ["in_invoice", "in_refund"]}})
    total_entries = await db.odoo_moves.count_documents({"company_id": cid, "move_type": "entry"})
    total_payments = await db.odoo_payments.count_documents({"company_id": cid})

    monthly_income = 0
    monthly_expense = 0
    for acct in accounts:
        bal = await compute_account_balance(db, acct["id"], cid, month_start)
        if acct["account_type"] in ACCOUNT_TYPE_GROUPS["income"]:
            monthly_income += bal["credit"] - bal["debit"]
        elif acct["account_type"] in ACCOUNT_TYPE_GROUPS["expense"]:
            monthly_expense += bal["debit"] - bal["credit"]

    return {
        "total_receivable": round(total_receivable, 2), "total_payable": round(total_payable, 2),
        "cash_balance": round(cash_balance, 2), "bank_balance": round(bank_balance, 2),
        "draft_invoices": draft_invoices, "overdue_invoices": overdue_invoices,
        "draft_bills": draft_bills, "total_invoices": total_invoices,
        "total_bills": total_bills, "total_entries": total_entries,
        "total_payments": total_payments,
        "monthly_income": round(monthly_income, 2), "monthly_expense": round(monthly_expense, 2),
        "monthly_profit": round(monthly_income - monthly_expense, 2),
    }


# ========== GST RETURN REPORTS ==========

@router.get("/reports/gstr1")
async def gstr1_report(company_id: Optional[str] = None, month: Optional[str] = None,
                       year: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """GSTR-1: Outward supplies report - all sales invoices with GST breakdown."""
    cid = await get_cid(current_user, company_id)
    now = datetime.now(timezone.utc)
    m = int(month) if month else now.month
    y = int(year) if year else now.year
    date_from = f"{y}-{m:02d}-01"
    if m == 12:
        date_to = f"{y + 1}-01-01"
    else:
        date_to = f"{y}-{m + 1:02d}-01"

    invoices = await db.odoo_moves.find({
        "company_id": cid,
        "move_type": {"$in": ["out_invoice", "out_refund"]},
        "state": "posted",
        "date": {"$gte": date_from, "$lt": date_to},
    }, {"_id": 0}).to_list(10000)

    b2b = []
    b2c_small = []
    hsn_summary = {}
    total_taxable = 0
    total_cgst = 0
    total_sgst = 0
    total_igst = 0
    total_invoice_value = 0

    for inv in invoices:
        partner = await db.odoo_partners.find_one({"id": inv.get("partner_id")}, {"_id": 0, "name": 1, "gstin": 1}) if inv.get("partner_id") else None
        partner_name = partner["name"] if partner else "Unknown"
        partner_gstin = partner.get("gstin", "") if partner else ""

        inv_taxable = inv.get("amount_untaxed", 0)
        inv_tax = inv.get("amount_tax", 0)
        inv_total = inv.get("amount_total", 0)
        gst_type = inv.get("gst_type", "intra")

        inv_cgst = 0
        inv_sgst = 0
        inv_igst = 0
        if gst_type == "intra":
            inv_cgst = round(inv_tax / 2, 2)
            inv_sgst = round(inv_tax - inv_cgst, 2)
        else:
            inv_igst = inv_tax

        total_taxable += inv_taxable
        total_cgst += inv_cgst
        total_sgst += inv_sgst
        total_igst += inv_igst
        total_invoice_value += inv_total

        entry = {
            "invoice_number": inv.get("name", ""),
            "invoice_date": inv.get("date", ""),
            "partner_name": partner_name,
            "gstin": partner_gstin,
            "taxable_value": round(inv_taxable, 2),
            "cgst": round(inv_cgst, 2),
            "sgst": round(inv_sgst, 2),
            "igst": round(inv_igst, 2),
            "total": round(inv_total, 2),
            "gst_type": gst_type,
            "is_refund": inv.get("move_type") == "out_refund",
        }

        if partner_gstin:
            b2b.append(entry)
        else:
            b2c_small.append(entry)

        for line in inv.get("invoice_lines", []):
            hsn = line.get("hsn_code", "0000")
            rate = line.get("gst_rate", 0)
            key = f"{hsn}_{rate}"
            if key not in hsn_summary:
                hsn_summary[key] = {"hsn_code": hsn, "description": line.get("product_name", ""), "gst_rate": rate,
                                     "quantity": 0, "taxable_value": 0, "cgst": 0, "sgst": 0, "igst": 0, "total": 0}
            line_taxable = line.get("quantity", 0) * line.get("unit_price", 0) * (1 - line.get("discount", 0) / 100)
            line_tax = line_taxable * rate / 100
            hsn_summary[key]["quantity"] += line.get("quantity", 0)
            hsn_summary[key]["taxable_value"] += line_taxable
            if gst_type == "intra":
                hsn_summary[key]["cgst"] += round(line_tax / 2, 2)
                hsn_summary[key]["sgst"] += round(line_tax - round(line_tax / 2, 2), 2)
            else:
                hsn_summary[key]["igst"] += line_tax
            hsn_summary[key]["total"] += line_taxable + line_tax

    for v in hsn_summary.values():
        for k in ["taxable_value", "cgst", "sgst", "igst", "total"]:
            v[k] = round(v[k], 2)

    return {
        "period": f"{y}-{m:02d}",
        "b2b": b2b,
        "b2c_small": b2c_small,
        "hsn_summary": list(hsn_summary.values()),
        "totals": {
            "taxable_value": round(total_taxable, 2),
            "cgst": round(total_cgst, 2),
            "sgst": round(total_sgst, 2),
            "igst": round(total_igst, 2),
            "invoice_value": round(total_invoice_value, 2),
            "total_invoices": len(invoices),
            "b2b_count": len(b2b),
            "b2c_count": len(b2c_small),
        },
    }


@router.get("/reports/gstr3b")
async def gstr3b_report(company_id: Optional[str] = None, month: Optional[str] = None,
                        year: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """GSTR-3B: Monthly summary return with tax liability and input credit."""
    cid = await get_cid(current_user, company_id)
    now = datetime.now(timezone.utc)
    m = int(month) if month else now.month
    y = int(year) if year else now.year
    date_from = f"{y}-{m:02d}-01"
    if m == 12:
        date_to = f"{y + 1}-01-01"
    else:
        date_to = f"{y}-{m + 1:02d}-01"

    # Outward supplies (sales)
    out_invoices = await db.odoo_moves.find({
        "company_id": cid, "move_type": {"$in": ["out_invoice", "out_refund"]},
        "state": "posted", "date": {"$gte": date_from, "$lt": date_to},
    }, {"_id": 0}).to_list(10000)

    out_taxable = 0
    out_cgst = 0
    out_sgst = 0
    out_igst = 0
    for inv in out_invoices:
        tax = inv.get("amount_tax", 0)
        mult = -1 if inv.get("move_type") == "out_refund" else 1
        out_taxable += inv.get("amount_untaxed", 0) * mult
        if inv.get("gst_type") == "inter":
            out_igst += tax * mult
        else:
            out_cgst += round(tax / 2, 2) * mult
            out_sgst += round(tax - round(tax / 2, 2), 2) * mult

    # Inward supplies (purchases)
    in_invoices = await db.odoo_moves.find({
        "company_id": cid, "move_type": {"$in": ["in_invoice", "in_refund"]},
        "state": "posted", "date": {"$gte": date_from, "$lt": date_to},
    }, {"_id": 0}).to_list(10000)

    in_taxable = 0
    in_cgst = 0
    in_sgst = 0
    in_igst = 0
    for bill in in_invoices:
        tax = bill.get("amount_tax", 0)
        mult = -1 if bill.get("move_type") == "in_refund" else 1
        in_taxable += bill.get("amount_untaxed", 0) * mult
        if bill.get("gst_type") == "inter":
            in_igst += tax * mult
        else:
            in_cgst += round(tax / 2, 2) * mult
            in_sgst += round(tax - round(tax / 2, 2), 2) * mult

    net_cgst = round(out_cgst - in_cgst, 2)
    net_sgst = round(out_sgst - in_sgst, 2)
    net_igst = round(out_igst - in_igst, 2)
    net_payable = round(net_cgst + net_sgst + net_igst, 2)

    return {
        "period": f"{y}-{m:02d}",
        "outward_supplies": {
            "taxable_value": round(out_taxable, 2), "cgst": round(out_cgst, 2),
            "sgst": round(out_sgst, 2), "igst": round(out_igst, 2),
            "total_tax": round(out_cgst + out_sgst + out_igst, 2),
            "invoice_count": len(out_invoices),
        },
        "inward_supplies": {
            "taxable_value": round(in_taxable, 2), "cgst": round(in_cgst, 2),
            "sgst": round(in_sgst, 2), "igst": round(in_igst, 2),
            "total_tax": round(in_cgst + in_sgst + in_igst, 2),
            "bill_count": len(in_invoices),
        },
        "itc_available": {
            "cgst": round(in_cgst, 2), "sgst": round(in_sgst, 2), "igst": round(in_igst, 2),
            "total": round(in_cgst + in_sgst + in_igst, 2),
        },
        "tax_payable": {
            "cgst": max(net_cgst, 0), "sgst": max(net_sgst, 0), "igst": max(net_igst, 0),
            "total": max(net_payable, 0),
        },
        "itc_refund": {
            "cgst": abs(min(net_cgst, 0)), "sgst": abs(min(net_sgst, 0)), "igst": abs(min(net_igst, 0)),
            "total": abs(min(net_payable, 0)),
        },
        "net_payable": net_payable,
    }


# ============ DATA EXPORT ENDPOINTS ============

@router.get("/export/journal-entries")
async def export_journal_entries(company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Export all journal entries for a company."""
    cid = await resolve_company_id(current_user['user_id'], current_user['role'], company_id)
    query = {"move_type": "entry"} if not cid else {"company_id": cid, "move_type": "entry"}
    moves = await db.odoo_moves.find(
        query,
        {"_id": 0, "id": 1, "name": 1, "date": 1, "journal_name": 1, "narration": 1,
         "ref": 1, "state": 1, "amount_total": 1, "total_debit": 1, "total_credit": 1,
         "created_at": 1}
    ).sort("date", -1).to_list(10000)
    return moves


@router.get("/export/chart-of-accounts")
async def export_chart_of_accounts(company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Export chart of accounts."""
    cid = await resolve_company_id(current_user['user_id'], current_user['role'], company_id)
    query = {} if not cid else {"company_id": cid}
    accounts = await db.odoo_accounts.find(
        query,
        {"_id": 0, "id": 1, "code": 1, "name": 1, "account_type": 1, "reconcile": 1}
    ).sort("code", 1).to_list(1000)
    # Compute balances
    for acc in accounts:
        debit = await db.odoo_move_lines.find({"account_id": acc["id"]}).to_list(None)
        total_debit = sum(d.get("debit", 0) for d in debit)
        total_credit = sum(d.get("credit", 0) for d in debit)
        acc["balance"] = round(total_debit - total_credit, 2)
    return accounts


@router.get("/export/invoices")
async def export_invoices(company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Export all invoices."""
    cid = await resolve_company_id(current_user['user_id'], current_user['role'], company_id)
    q = {"move_type": {"$in": ["in_invoice", "out_invoice", "in_refund", "out_refund"]}}
    if cid:
        q["company_id"] = cid
    invoices = await db.odoo_moves.find(
        q,
        {"_id": 0, "id": 1, "name": 1, "date": 1, "move_type": 1, "partner_name": 1,
         "state": 1, "amount_total": 1, "amount_untaxed": 1, "amount_tax": 1,
         "payment_state": 1, "ref": 1}
    ).sort("date", -1).to_list(10000)
    return invoices
