from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
import uuid
import logging

logger = logging.getLogger(__name__)

DEFAULT_CHART_OF_ACCOUNTS = [
    {"code": "1000", "name": "Assets", "account_type": "current_asset", "reconcile": False},
    {"code": "1100", "name": "Cash", "account_type": "cash", "reconcile": False, "parent_code": "1000"},
    {"code": "1110", "name": "Petty Cash", "account_type": "cash", "reconcile": False, "parent_code": "1100"},
    {"code": "1200", "name": "Bank", "account_type": "bank", "reconcile": True, "parent_code": "1000"},
    {"code": "1210", "name": "Main Bank Account", "account_type": "bank", "reconcile": True, "parent_code": "1200"},
    {"code": "1300", "name": "Accounts Receivable", "account_type": "receivable", "reconcile": True, "parent_code": "1000"},
    {"code": "1400", "name": "Inventory", "account_type": "current_asset", "reconcile": False, "parent_code": "1000"},
    {"code": "1500", "name": "Prepaid Expenses", "account_type": "current_asset", "reconcile": False, "parent_code": "1000"},
    {"code": "1600", "name": "Fixed Assets", "account_type": "fixed_asset", "reconcile": False, "parent_code": "1000"},
    {"code": "1610", "name": "Property, Plant & Equipment", "account_type": "fixed_asset", "reconcile": False, "parent_code": "1600"},
    {"code": "1620", "name": "Accumulated Depreciation", "account_type": "fixed_asset", "reconcile": False, "parent_code": "1600"},
    {"code": "2000", "name": "Liabilities", "account_type": "current_liability", "reconcile": False},
    {"code": "2100", "name": "Accounts Payable", "account_type": "payable", "reconcile": True, "parent_code": "2000"},
    {"code": "2200", "name": "Taxes Payable", "account_type": "current_liability", "reconcile": False, "parent_code": "2000"},
    {"code": "2210", "name": "GST Output", "account_type": "current_liability", "reconcile": False, "parent_code": "2200"},
    {"code": "2220", "name": "GST Input", "account_type": "current_asset", "reconcile": False, "parent_code": "1000"},
    {"code": "2230", "name": "TDS Payable", "account_type": "current_liability", "reconcile": False, "parent_code": "2200"},
    {"code": "2300", "name": "Salary Payable", "account_type": "current_liability", "reconcile": False, "parent_code": "2000"},
    {"code": "2400", "name": "Short Term Loans", "account_type": "current_liability", "reconcile": False, "parent_code": "2000"},
    {"code": "2500", "name": "Long Term Loans", "account_type": "long_term_liability", "reconcile": False, "parent_code": "2000"},
    {"code": "3000", "name": "Equity", "account_type": "equity", "reconcile": False},
    {"code": "3100", "name": "Owner's Capital", "account_type": "equity", "reconcile": False, "parent_code": "3000"},
    {"code": "3200", "name": "Retained Earnings", "account_type": "equity", "reconcile": False, "parent_code": "3000"},
    {"code": "3300", "name": "Current Year Earnings", "account_type": "equity", "reconcile": False, "parent_code": "3000"},
    {"code": "4000", "name": "Income", "account_type": "income", "reconcile": False},
    {"code": "4100", "name": "Sales Revenue", "account_type": "income", "reconcile": False, "parent_code": "4000"},
    {"code": "4200", "name": "Service Revenue", "account_type": "income", "reconcile": False, "parent_code": "4000"},
    {"code": "4300", "name": "Interest Income", "account_type": "other_income", "reconcile": False, "parent_code": "4000"},
    {"code": "4400", "name": "Other Income", "account_type": "other_income", "reconcile": False, "parent_code": "4000"},
    {"code": "4500", "name": "Discount Received", "account_type": "other_income", "reconcile": False, "parent_code": "4000"},
    {"code": "5000", "name": "Cost of Revenue", "account_type": "cost_of_revenue", "reconcile": False},
    {"code": "5100", "name": "Cost of Goods Sold", "account_type": "cost_of_revenue", "reconcile": False, "parent_code": "5000"},
    {"code": "5200", "name": "Direct Labour", "account_type": "cost_of_revenue", "reconcile": False, "parent_code": "5000"},
    {"code": "6000", "name": "Expenses", "account_type": "expense", "reconcile": False},
    {"code": "6100", "name": "Salary Expense", "account_type": "expense", "reconcile": False, "parent_code": "6000"},
    {"code": "6200", "name": "Rent Expense", "account_type": "expense", "reconcile": False, "parent_code": "6000"},
    {"code": "6300", "name": "Utilities", "account_type": "expense", "reconcile": False, "parent_code": "6000"},
    {"code": "6400", "name": "Office Supplies", "account_type": "expense", "reconcile": False, "parent_code": "6000"},
    {"code": "6500", "name": "Repairs & Maintenance", "account_type": "expense", "reconcile": False, "parent_code": "6000"},
    {"code": "6600", "name": "Fuel & Transport", "account_type": "expense", "reconcile": False, "parent_code": "6000"},
    {"code": "6700", "name": "Insurance", "account_type": "expense", "reconcile": False, "parent_code": "6000"},
    {"code": "6800", "name": "Depreciation Expense", "account_type": "depreciation", "reconcile": False, "parent_code": "6000"},
    {"code": "6900", "name": "Miscellaneous Expense", "account_type": "expense", "reconcile": False, "parent_code": "6000"},
    {"code": "6950", "name": "Discount Given", "account_type": "expense", "reconcile": False, "parent_code": "6000"},
]

DEFAULT_JOURNALS = [
    {"name": "Customer Invoices", "code": "INV", "journal_type": "sale"},
    {"name": "Vendor Bills", "code": "BILL", "journal_type": "purchase"},
    {"name": "Cash", "code": "CSH", "journal_type": "cash"},
    {"name": "Bank", "code": "BNK", "journal_type": "bank"},
    {"name": "Miscellaneous", "code": "MISC", "journal_type": "general"},
]

DEFAULT_TAXES = [
    {"name": "GST 5%", "tax_type": "percent", "amount": 5, "tax_group": "GST"},
    {"name": "GST 12%", "tax_type": "percent", "amount": 12, "tax_group": "GST"},
    {"name": "GST 18%", "tax_type": "percent", "amount": 18, "tax_group": "GST"},
    {"name": "GST 28%", "tax_type": "percent", "amount": 28, "tax_group": "GST"},
    {"name": "IGST 5%", "tax_type": "percent", "amount": 5, "tax_group": "IGST"},
    {"name": "IGST 12%", "tax_type": "percent", "amount": 12, "tax_group": "IGST"},
    {"name": "IGST 18%", "tax_type": "percent", "amount": 18, "tax_group": "IGST"},
    {"name": "TDS 1%", "tax_type": "percent", "amount": 1, "tax_group": "TDS"},
    {"name": "TDS 2%", "tax_type": "percent", "amount": 2, "tax_group": "TDS"},
    {"name": "TDS 10%", "tax_type": "percent", "amount": 10, "tax_group": "TDS"},
    {"name": "Exempt", "tax_type": "percent", "amount": 0, "tax_group": "Exempt"},
]


async def seed_odoo_accounting(db, company_id: str):
    existing = await db.odoo_accounts.find_one({"company_id": company_id}, {"_id": 0})
    if existing:
        return

    now = datetime.now(timezone.utc).isoformat()
    code_to_id = {}
    for acct in DEFAULT_CHART_OF_ACCOUNTS:
        acct_id = str(uuid.uuid4())
        code_to_id[acct["code"]] = acct_id
        parent_id = code_to_id.get(acct.get("parent_code")) if acct.get("parent_code") else None
        doc = {
            "id": acct_id, "code": acct["code"], "name": acct["name"],
            "account_type": acct["account_type"], "parent_id": parent_id,
            "reconcile": acct.get("reconcile", False), "deprecated": False,
            "tax_ids": [], "currency": "INR", "note": "",
            "company_id": company_id, "balance": 0,
            "created_at": now,
        }
        await db.odoo_accounts.insert_one(doc)

    journal_map = {}
    for j in DEFAULT_JOURNALS:
        j_id = str(uuid.uuid4())
        journal_map[j["code"]] = j_id
        debit_acct = None
        credit_acct = None
        if j["journal_type"] == "cash":
            debit_acct = code_to_id.get("1100")
            credit_acct = code_to_id.get("1100")
        elif j["journal_type"] == "bank":
            debit_acct = code_to_id.get("1210")
            credit_acct = code_to_id.get("1210")
        elif j["journal_type"] == "sale":
            debit_acct = code_to_id.get("1300")
            credit_acct = code_to_id.get("4100")
        elif j["journal_type"] == "purchase":
            debit_acct = code_to_id.get("5100")
            credit_acct = code_to_id.get("2100")
        doc = {
            "id": j_id, "name": j["name"], "code": j["code"],
            "journal_type": j["journal_type"],
            "default_debit_account_id": debit_acct,
            "default_credit_account_id": credit_acct,
            "currency": "INR", "sequence_number": 1,
            "sequence_prefix": f"{j['code']}/%(year)s/",
            "company_id": company_id, "created_at": now,
        }
        await db.odoo_journals.insert_one(doc)

    for t in DEFAULT_TAXES:
        doc = {
            "id": str(uuid.uuid4()), "name": t["name"], "tax_type": t["tax_type"],
            "amount": t["amount"], "tax_group": t["tax_group"],
            "include_in_price": False, "active": True,
            "company_id": company_id, "created_at": now,
        }
        await db.odoo_taxes.insert_one(doc)

    fy_start = datetime.now(timezone.utc).replace(month=4, day=1)
    if datetime.now(timezone.utc).month < 4:
        fy_start = fy_start.replace(year=fy_start.year - 1)
    fy_end = fy_start.replace(year=fy_start.year + 1) - timedelta(days=1)
    fy_doc = {
        "id": str(uuid.uuid4()), "name": f"FY {fy_start.year}-{fy_end.year}",
        "start_date": fy_start.strftime("%Y-%m-%d"), "end_date": fy_end.strftime("%Y-%m-%d"),
        "lock_date": None, "tax_lock_date": None, "state": "open",
        "company_id": company_id, "created_at": now,
    }
    await db.odoo_fiscal_years.insert_one(fy_doc)
    logger.info(f"Seeded Odoo accounting for company {company_id}")


def generate_sequence(prefix: str, number: int) -> str:
    year = datetime.now(timezone.utc).strftime("%Y")
    return f"{prefix.replace('%(year)s', year)}{str(number).zfill(4)}"


async def get_next_sequence(db, journal_id: str) -> str:
    journal = await db.odoo_journals.find_one({"id": journal_id}, {"_id": 0})
    if not journal:
        return f"ENTRY/{datetime.now().year}/0001"
    seq = journal.get("sequence_number", 1)
    name = generate_sequence(journal.get("sequence_prefix", "MISC/%(year)s/"), seq)
    await db.odoo_journals.update_one({"id": journal_id}, {"$set": {"sequence_number": seq + 1}})
    return name


async def compute_account_balance(db, account_id: str, company_id: str, date_from: str = None, date_to: str = None) -> dict:
    query = {"account_id": account_id, "company_id": company_id, "parent_state": "posted"}
    if date_from:
        query["date"] = {"$gte": date_from}
    if date_to:
        query.setdefault("date", {})
        if isinstance(query["date"], dict):
            query["date"]["$lte"] = date_to
        else:
            query["date"] = {"$gte": query["date"], "$lte": date_to}
    lines = await db.odoo_move_lines.find(query, {"_id": 0, "debit": 1, "credit": 1}).to_list(100000)
    total_debit = sum(l.get("debit", 0) for l in lines)
    total_credit = sum(l.get("credit", 0) for l in lines)
    return {"debit": round(total_debit, 2), "credit": round(total_credit, 2), "balance": round(total_debit - total_credit, 2)}


async def post_move(db, move_id: str, company_id: str):
    move = await db.odoo_moves.find_one({"id": move_id, "company_id": company_id}, {"_id": 0})
    if not move:
        raise ValueError("Move not found")
    if move["state"] == "posted":
        raise ValueError("Already posted")
    if move["state"] == "cancelled":
        raise ValueError("Cannot post cancelled entry")

    lines = await db.odoo_move_lines.find({"move_id": move_id, "company_id": company_id}, {"_id": 0}).to_list(1000)
    total_debit = sum(l.get("debit", 0) for l in lines)
    total_credit = sum(l.get("credit", 0) for l in lines)
    if abs(total_debit - total_credit) > 0.01:
        raise ValueError(f"Entry does not balance: Debit={total_debit}, Credit={total_credit}")
    if not lines:
        raise ValueError("No journal items")

    lock_fy = await db.odoo_fiscal_years.find_one({"company_id": company_id, "state": "open"}, {"_id": 0})
    if lock_fy and lock_fy.get("lock_date"):
        entry_date = move.get("date", "")
        if entry_date and entry_date <= lock_fy["lock_date"]:
            raise ValueError(f"Cannot post before lock date {lock_fy['lock_date']}")

    name = await get_next_sequence(db, move["journal_id"])
    now = datetime.now(timezone.utc).isoformat()
    await db.odoo_moves.update_one({"id": move_id}, {"$set": {"state": "posted", "name": name, "posted_at": now}})
    await db.odoo_move_lines.update_many({"move_id": move_id}, {"$set": {"parent_state": "posted"}})

    for line in lines:
        if line.get("account_id"):
            bal = await compute_account_balance(db, line["account_id"], company_id)
            await db.odoo_accounts.update_one({"id": line["account_id"]}, {"$set": {"balance": bal["balance"]}})

    return name


async def cancel_move(db, move_id: str, company_id: str):
    move = await db.odoo_moves.find_one({"id": move_id, "company_id": company_id}, {"_id": 0})
    if not move:
        raise ValueError("Move not found")
    if move["state"] != "posted":
        raise ValueError("Only posted entries can be cancelled")
    await db.odoo_moves.update_one({"id": move_id}, {"$set": {"state": "cancelled"}})
    await db.odoo_move_lines.update_many({"move_id": move_id}, {"$set": {"parent_state": "cancelled"}})
    lines = await db.odoo_move_lines.find({"move_id": move_id, "company_id": company_id}, {"_id": 0}).to_list(1000)
    for line in lines:
        if line.get("account_id"):
            bal = await compute_account_balance(db, line["account_id"], company_id)
            await db.odoo_accounts.update_one({"id": line["account_id"]}, {"$set": {"balance": bal["balance"]}})


async def create_invoice_move(db, invoice_data: dict, company_id: str, user_id: str) -> dict:
    now = datetime.now(timezone.utc)
    move_type = invoice_data["move_type"]
    partner_id = invoice_data["partner_id"]
    invoice_lines = invoice_data.get("invoice_lines", [])

    if move_type in ("out_invoice", "out_refund"):
        journal = await db.odoo_journals.find_one({"company_id": company_id, "journal_type": "sale"}, {"_id": 0})
    else:
        journal = await db.odoo_journals.find_one({"company_id": company_id, "journal_type": "purchase"}, {"_id": 0})

    if invoice_data.get("journal_id"):
        journal = await db.odoo_journals.find_one({"id": invoice_data["journal_id"], "company_id": company_id}, {"_id": 0})

    if not journal:
        raise ValueError("No suitable journal found")

    inv_date = invoice_data.get("date") or now.strftime("%Y-%m-%d")
    due_days = invoice_data.get("payment_terms_days") or 30  # Default to 30 if None or 0
    due_date = invoice_data.get("due_date")
    if not due_date:
        due_dt = datetime.strptime(inv_date, "%Y-%m-%d") + timedelta(days=due_days)
        due_date = due_dt.strftime("%Y-%m-%d")

    move_id = str(uuid.uuid4())
    move_doc = {
        "id": move_id, "name": "Draft", "move_type": move_type,
        "journal_id": journal["id"], "journal_name": journal["name"],
        "partner_id": partner_id, "ref": invoice_data.get("ref", ""),
        "narration": invoice_data.get("narration", ""), "date": inv_date,
        "due_date": due_date, "state": "draft",
        "amount_untaxed": 0, "amount_tax": 0, "amount_total": 0,
        "amount_residual": 0, "payment_state": "not_paid",
        "currency": invoice_data.get("currency", "INR"),
        "attachments": invoice_data.get("attachments", []),
        "invoice_lines": [], "company_id": company_id,
        "created_by": user_id, "created_at": now.isoformat(),
    }

    total_untaxed = 0
    total_tax = 0
    move_lines = []
    stored_inv_lines = []

    for idx, line in enumerate(invoice_lines):
        qty = line.get("quantity", 1)
        price = line.get("unit_price", 0)
        discount = line.get("discount", 0)
        subtotal = qty * price * (1 - discount / 100)
        total_untaxed += subtotal

        tax_amount = 0
        gst_rate = line.get("gst_rate", 0)
        gst_type = invoice_data.get("gst_type", "intra")

        # GST calculation from line-level gst_rate
        if gst_rate > 0:
            tax_amount = subtotal * gst_rate / 100
        else:
            # Fallback to tax_ids for backward compatibility
            for tax_id in (line.get("tax_ids") or []):
                tax = await db.odoo_taxes.find_one({"id": tax_id, "company_id": company_id}, {"_id": 0})
                if tax:
                    if tax["tax_type"] == "percent":
                        tax_amount += subtotal * tax["amount"] / 100
                    else:
                        tax_amount += tax["amount"]
        total_tax += tax_amount

        acct_id = line.get("account_id")
        if not acct_id:
            acct_id = journal.get("default_credit_account_id") if move_type in ("out_invoice", "out_refund") else journal.get("default_debit_account_id")

        line_total = subtotal + tax_amount
        ml_id = str(uuid.uuid4())
        is_income_side = move_type in ("out_invoice", "in_refund")

        ml = {
            "id": ml_id, "move_id": move_id, "account_id": acct_id,
            "partner_id": partner_id, "name": line.get("product_name", ""),
            "debit": round(line_total, 2) if not is_income_side else 0,
            "credit": round(line_total, 2) if is_income_side else 0,
            "tax_ids": line.get("tax_ids", []),
            "analytic_account_id": line.get("analytic_account_id"),
            "date": inv_date, "parent_state": "draft",
            "company_id": company_id, "reconciled": False,
            "created_at": now.isoformat(),
        }
        move_lines.append(ml)

        stored_inv_lines.append({
            "sequence": idx + 1, "product_name": line.get("product_name", ""),
            "description": line.get("description", ""), "quantity": qty,
            "unit_price": price, "discount": discount,
            "tax_ids": line.get("tax_ids", []), "subtotal": round(subtotal, 2),
            "tax_amount": round(tax_amount, 2), "total": round(line_total, 2),
            "account_id": acct_id,
            "gst_rate": gst_rate, "gst_type": gst_type,
        })

    total_amount = total_untaxed + total_tax

    if move_type in ("out_invoice", "in_refund"):
        recv_acct = await db.odoo_accounts.find_one({"company_id": company_id, "account_type": "receivable"}, {"_id": 0})
    else:
        recv_acct = await db.odoo_accounts.find_one({"company_id": company_id, "account_type": "payable"}, {"_id": 0})

    if recv_acct:
        is_debit_side = move_type in ("out_invoice", "in_refund")
        ctr_line = {
            "id": str(uuid.uuid4()), "move_id": move_id, "account_id": recv_acct["id"],
            "partner_id": partner_id, "name": move_doc["ref"] or "Invoice",
            "debit": round(total_amount, 2) if is_debit_side else 0,
            "credit": round(total_amount, 2) if not is_debit_side else 0,
            "tax_ids": [], "date": inv_date, "parent_state": "draft",
            "company_id": company_id, "reconciled": False,
            "created_at": now.isoformat(),
        }
        move_lines.append(ctr_line)

    if total_tax > 0:
        gst_type = invoice_data.get("gst_type", "intra")
        is_tax_credit = move_type in ("out_invoice", "in_refund")

        if gst_type == "intra":
            # CGST
            cgst_acct = await db.odoo_accounts.find_one(
                {"company_id": company_id, "code": "2210"}, {"_id": 0})
            if not cgst_acct:
                cgst_acct = await db.odoo_accounts.find_one(
                    {"company_id": company_id, "account_type": "current_liability", "name": {"$regex": "CGST|GST", "$options": "i"}}, {"_id": 0})
            if cgst_acct:
                half_tax = round(total_tax / 2, 2)
                move_lines.append({
                    "id": str(uuid.uuid4()), "move_id": move_id, "account_id": cgst_acct["id"],
                    "partner_id": None, "name": "CGST",
                    "debit": 0 if is_tax_credit else half_tax,
                    "credit": half_tax if is_tax_credit else 0,
                    "tax_ids": [], "date": inv_date, "parent_state": "draft",
                    "company_id": company_id, "reconciled": False, "created_at": now.isoformat(),
                })
            # SGST
            sgst_acct = await db.odoo_accounts.find_one(
                {"company_id": company_id, "code": "2220"}, {"_id": 0})
            if not sgst_acct:
                sgst_acct = cgst_acct  # Use same account if no SGST account
            if sgst_acct:
                half_tax2 = round(total_tax - round(total_tax / 2, 2), 2)
                move_lines.append({
                    "id": str(uuid.uuid4()), "move_id": move_id, "account_id": sgst_acct["id"],
                    "partner_id": None, "name": "SGST",
                    "debit": 0 if is_tax_credit else half_tax2,
                    "credit": half_tax2 if is_tax_credit else 0,
                    "tax_ids": [], "date": inv_date, "parent_state": "draft",
                    "company_id": company_id, "reconciled": False, "created_at": now.isoformat(),
                })
        else:
            # IGST (inter-state)
            igst_acct = await db.odoo_accounts.find_one(
                {"company_id": company_id, "code": {"$in": ["2210", "2220"]}}, {"_id": 0})
            if igst_acct:
                move_lines.append({
                    "id": str(uuid.uuid4()), "move_id": move_id, "account_id": igst_acct["id"],
                    "partner_id": None, "name": "IGST",
                    "debit": 0 if is_tax_credit else round(total_tax, 2),
                    "credit": round(total_tax, 2) if is_tax_credit else 0,
                    "tax_ids": [], "date": inv_date, "parent_state": "draft",
                    "company_id": company_id, "reconciled": False, "created_at": now.isoformat(),
                })

    # Handle advance adjustment
    advance_adjustment = invoice_data.get("advance_adjustment", 0)
    if advance_adjustment > 0:
        total_amount = max(0, total_amount - advance_adjustment)

    move_doc["amount_untaxed"] = round(total_untaxed, 2)
    move_doc["amount_tax"] = round(total_tax, 2)
    move_doc["amount_total"] = round(total_untaxed + total_tax, 2)
    move_doc["amount_residual"] = round(total_amount, 2)
    move_doc["advance_adjustment"] = round(advance_adjustment, 2)
    move_doc["gst_type"] = invoice_data.get("gst_type", "intra")
    move_doc["invoice_lines"] = stored_inv_lines
    move_doc["total_debit"] = round(sum(l["debit"] for l in move_lines), 2)
    move_doc["total_credit"] = round(sum(l["credit"] for l in move_lines), 2)

    await db.odoo_moves.insert_one(move_doc)
    for ml in move_lines:
        await db.odoo_move_lines.insert_one(ml)

    move_doc.pop("_id", None)
    return move_doc


async def register_payment(db, payment_data: dict, company_id: str, user_id: str) -> dict:
    now = datetime.now(timezone.utc)
    journal = await db.odoo_journals.find_one({"id": payment_data["journal_id"], "company_id": company_id}, {"_id": 0})
    if not journal:
        raise ValueError("Journal not found")

    pay_date = payment_data.get("date") or now.strftime("%Y-%m-%d")
    amount = payment_data["amount"]
    payment_type = payment_data["payment_type"]
    partner_id = payment_data.get("partner_id")

    pay_id = str(uuid.uuid4())
    move_id = str(uuid.uuid4())

    liquidity_acct_id = journal.get("default_debit_account_id")
    if payment_type == "inbound":
        counterpart = await db.odoo_accounts.find_one({"company_id": company_id, "account_type": "receivable"}, {"_id": 0})
    else:
        counterpart = await db.odoo_accounts.find_one({"company_id": company_id, "account_type": "payable"}, {"_id": 0})

    if not counterpart:
        raise ValueError("No receivable/payable account found")

    lines = []
    if payment_type == "inbound":
        lines.append({
            "id": str(uuid.uuid4()), "move_id": move_id, "account_id": liquidity_acct_id,
            "partner_id": partner_id, "name": f"Payment received",
            "debit": round(amount, 2), "credit": 0,
            "date": pay_date, "parent_state": "draft", "company_id": company_id,
            "reconciled": False, "created_at": now.isoformat(), "tax_ids": [],
        })
        lines.append({
            "id": str(uuid.uuid4()), "move_id": move_id, "account_id": counterpart["id"],
            "partner_id": partner_id, "name": f"Payment received",
            "debit": 0, "credit": round(amount, 2),
            "date": pay_date, "parent_state": "draft", "company_id": company_id,
            "reconciled": False, "created_at": now.isoformat(), "tax_ids": [],
        })
    else:
        lines.append({
            "id": str(uuid.uuid4()), "move_id": move_id, "account_id": counterpart["id"],
            "partner_id": partner_id, "name": f"Payment sent",
            "debit": round(amount, 2), "credit": 0,
            "date": pay_date, "parent_state": "draft", "company_id": company_id,
            "reconciled": False, "created_at": now.isoformat(), "tax_ids": [],
        })
        lines.append({
            "id": str(uuid.uuid4()), "move_id": move_id, "account_id": liquidity_acct_id,
            "partner_id": partner_id, "name": f"Payment sent",
            "debit": 0, "credit": round(amount, 2),
            "date": pay_date, "parent_state": "draft", "company_id": company_id,
            "reconciled": False, "created_at": now.isoformat(), "tax_ids": [],
        })

    move_doc = {
        "id": move_id, "name": "Draft", "move_type": "entry",
        "journal_id": journal["id"], "journal_name": journal["name"],
        "partner_id": partner_id, "ref": payment_data.get("ref", ""),
        "date": pay_date, "state": "draft",
        "amount_total": round(amount, 2),
        "total_debit": round(amount, 2), "total_credit": round(amount, 2),
        "company_id": company_id, "created_by": user_id,
        "created_at": now.isoformat(), "payment_id": pay_id,
    }
    await db.odoo_moves.insert_one(move_doc)
    for l in lines:
        await db.odoo_move_lines.insert_one(l)

    pay_doc = {
        "id": pay_id, "payment_type": payment_type, "amount": round(amount, 2),
        "partner_id": partner_id, "journal_id": journal["id"],
        "payment_method": payment_data.get("payment_method", "manual"),
        "ref": payment_data.get("ref", ""), "date": pay_date,
        "move_id": move_id, "state": "draft",
        "invoice_ids": payment_data.get("invoice_ids", []),
        "is_advance": payment_data.get("is_advance", False),
        "advance_balance": round(amount, 2) if payment_data.get("is_advance") else 0,
        "company_id": company_id, "created_by": user_id,
        "created_at": now.isoformat(),
    }
    await db.odoo_payments.insert_one(pay_doc)

    name = await post_move(db, move_id, company_id)
    await db.odoo_payments.update_one({"id": pay_id}, {"$set": {"state": "posted"}})

    for inv_id in payment_data.get("invoice_ids", []):
        inv = await db.odoo_moves.find_one({"id": inv_id}, {"_id": 0})
        if inv:
            new_residual = max(0, inv.get("amount_residual", 0) - amount)
            ps = "paid" if new_residual <= 0.01 else "partial"
            await db.odoo_moves.update_one({"id": inv_id}, {"$set": {"amount_residual": round(new_residual, 2), "payment_state": ps}})

    pay_doc.pop("_id", None)
    pay_doc["move_name"] = name
    return pay_doc
