from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import os
import logging

from database import db
from models import (UserRole, Transaction, TransactionCreate, AiAccountantRequest, JournalPostRequest)
from deps import (get_current_user, require_company_access, resolve_company_id, log_audit)
from accounting_engine import (
    create_journal_entry, get_trial_balance, get_profit_and_loss, get_balance_sheet,
    get_or_create_party_account
)
from export_service import generate_transaction_pdf, generate_ledger_csv

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/accounts")
async def get_accounts(company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")
    resolved_cid = await resolve_company_id(current_user['user_id'], current_user['role'], company_id)
    query = {}
    if resolved_cid:
        query["company_id"] = resolved_cid
    accounts = await db.accounts.find(query, {"_id": 0}).sort("code", 1).to_list(1000)
    return accounts


@router.post("/ai-accountant/analyze")
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
            "understanding": {"transaction_type": "Unknown", "parties": "", "amount": 0, "payment_mode": "cash",
                              "tax_applicable": False, "tax_details": ""},
            "journal_lines": [], "narration": "", "ledger_impact": [],
            "financial_impact": {"pnl_effect": "Unable to determine", "balance_sheet_effect": "Unable to determine"},
            "assumptions": [], "needs_clarification": True,
            "clarification_question": "Could not process. Please rephrase your transaction.",
        }


@router.post("/journal-entries")
async def post_journal_entry(req: JournalPostRequest, company_id: Optional[str] = None,
                             current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")
    resolved_cid = await resolve_company_id(current_user['user_id'], current_user['role'], company_id)
    if resolved_cid:
        await require_company_access(current_user['user_id'], current_user['role'], resolved_cid)
    try:
        entry = await create_journal_entry(db, req.narration, req.lines, current_user['user_id'],
                                           current_user.get('business_type'), resolved_cid)
        entry.pop('_id', None)
        for line in entry.get('lines', []):
            line.pop('_id', None)
        return {"message": "Journal entry posted successfully", "entry": entry}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/journal-entries")
async def get_journal_entries(company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")
    resolved_cid = await resolve_company_id(current_user['user_id'], current_user['role'], company_id)
    query = {}
    if resolved_cid:
        await require_company_access(current_user['user_id'], current_user['role'], resolved_cid)
        query["company_id"] = resolved_cid
    entries = await db.journal_entries.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return entries


@router.get("/account-ledger/{account_id}")
async def get_account_ledger(account_id: str, company_id: Optional[str] = None,
                             current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")
    resolved_cid = await resolve_company_id(current_user['user_id'], current_user['role'], company_id)
    query = {"id": account_id}
    if resolved_cid:
        query["company_id"] = resolved_cid
    account = await db.accounts.find_one(query, {"_id": 0})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    je_query = {"lines.account_id": account_id}
    if resolved_cid:
        je_query["company_id"] = resolved_cid
    entries = await db.journal_entries.find(je_query, {"_id": 0}).sort("date", 1).to_list(1000)
    ledger_rows = []
    running_balance = 0
    for entry in entries:
        for line in entry.get("lines", []):
            if line["account_id"] == account_id:
                running_balance += line["debit"] - line["credit"]
                ledger_rows.append({
                    "date": entry["date"], "narration": entry["narration"],
                    "debit": line["debit"], "credit": line["credit"],
                    "balance": round(running_balance, 2), "journal_entry_id": entry["id"],
                })
    lb_query = {"account_id": account_id}
    if resolved_cid:
        lb_query["company_id"] = resolved_cid
    balance_doc = await db.ledger_balances.find_one(lb_query, {"_id": 0})
    return {
        "account": account, "transactions": ledger_rows,
        "summary": balance_doc or {"total_debit": 0, "total_credit": 0, "balance": 0, "opening_balance": 0},
    }


@router.get("/ledger-balances")
async def get_ledger_balances(company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")
    resolved_cid = await resolve_company_id(current_user['user_id'], current_user['role'], company_id)
    query = {}
    if resolved_cid:
        query["company_id"] = resolved_cid
    balances = await db.ledger_balances.find(query, {"_id": 0}).to_list(1000)
    return balances


@router.get("/reports/trial-balance")
async def trial_balance_report(company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")
    resolved_cid = await resolve_company_id(current_user['user_id'], current_user['role'], company_id)
    return await get_trial_balance(db, resolved_cid)


@router.get("/reports/profit-loss")
async def profit_loss_report(company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")
    resolved_cid = await resolve_company_id(current_user['user_id'], current_user['role'], company_id)
    return await get_profit_and_loss(db, resolved_cid)


@router.get("/reports/balance-sheet")
async def balance_sheet_report(company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")
    resolved_cid = await resolve_company_id(current_user['user_id'], current_user['role'], company_id)
    return await get_balance_sheet(db, resolved_cid)


# --- Legacy Transactions ---

@router.post("/transactions", response_model=Transaction)
async def create_transaction(transaction_data: TransactionCreate, company_id: Optional[str] = None,
                             current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Only managers and directors can create transactions")
    resolved_cid = await resolve_company_id(current_user['user_id'], current_user['role'], company_id)
    transaction_dict = transaction_data.model_dump()
    transaction_dict['created_by'] = current_user['user_id']
    transaction_dict['business_type'] = current_user.get('business_type')
    if not transaction_dict.get('date'):
        transaction_dict['date'] = datetime.now(timezone.utc)
    transaction = Transaction(**transaction_dict)
    doc = transaction.model_dump()
    doc['date'] = doc['date'].isoformat()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['company_id'] = resolved_cid
    doc['attachments'] = transaction_data.attachments or []
    await db.transactions.insert_one(doc)
    return transaction


@router.get("/transactions", response_model=List[Transaction])
async def get_transactions(business_type: Optional[str] = None, company_id: Optional[str] = None,
                           current_user: dict = Depends(get_current_user)):
    resolved_cid = await resolve_company_id(current_user['user_id'], current_user['role'], company_id)
    query = {}
    if resolved_cid:
        query['company_id'] = resolved_cid
    elif current_user['role'] != UserRole.DIRECTOR and current_user.get('business_type'):
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


@router.put("/transactions/{transaction_id}", response_model=Transaction)
async def update_transaction(transaction_id: str, transaction_data: TransactionCreate,
                             current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")
    old_doc = await db.transactions.find_one({'id': transaction_id}, {'_id': 0})
    if not old_doc:
        raise HTTPException(status_code=404, detail="Transaction not found")
    update_dict = transaction_data.model_dump()
    if not update_dict.get('date'):
        update_dict['date'] = datetime.now(timezone.utc)
    update_dict['date'] = update_dict['date'].isoformat() if isinstance(update_dict['date'], datetime) else update_dict['date']
    await db.transactions.update_one({'id': transaction_id}, {'$set': update_dict})
    updated_doc = await db.transactions.find_one({'id': transaction_id}, {'_id': 0})
    await log_audit('update', 'transaction', transaction_id, current_user['user_id'], old_data=old_doc, new_data=updated_doc)
    if isinstance(updated_doc.get('date'), str):
        updated_doc['date'] = datetime.fromisoformat(updated_doc['date'])
    if isinstance(updated_doc.get('created_at'), str):
        updated_doc['created_at'] = datetime.fromisoformat(updated_doc['created_at'])
    return Transaction(**updated_doc)


@router.get("/ledger")
async def get_ledger(business_type: Optional[str] = None, company_id: Optional[str] = None,
                     current_user: dict = Depends(get_current_user)):
    resolved_cid = await resolve_company_id(current_user['user_id'], current_user['role'], company_id)
    query = {}
    if resolved_cid:
        query['company_id'] = resolved_cid
    elif current_user['role'] != UserRole.DIRECTOR and current_user.get('business_type'):
        query['business_type'] = current_user['business_type']
    elif current_user['role'] == UserRole.DIRECTOR and business_type and business_type != 'all':
        query['business_type'] = business_type
    transactions = await db.transactions.find(query, {'_id': 0}).sort('date', 1).to_list(10000)
    balance = 0
    ledger_entries = []
    for trans in transactions:
        if isinstance(trans.get('date'), str):
            trans['date'] = datetime.fromisoformat(trans['date'])
        if trans['transaction_type'] == 'income':
            balance += trans['amount']
        else:
            balance -= trans['amount']
        ledger_entries.append({**trans, 'balance': balance})
    return ledger_entries


@router.get("/accounting/summary")
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
        'total_income': total_income, 'total_expense': total_expense, 'net_profit': total_income - total_expense,
        'cash_balance': cash_income - cash_expense, 'bank_balance': bank_income - bank_expense,
        'cash_income': cash_income, 'bank_income': bank_income, 'cash_expense': cash_expense, 'bank_expense': bank_expense
    }


# --- Exports ---

@router.get("/export/transactions/pdf")
async def export_transactions_pdf(current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")
    query = {}
    if current_user['role'] != UserRole.DIRECTOR and current_user.get('business_type'):
        query['business_type'] = current_user['business_type']
    transactions = await db.transactions.find(query, {'_id': 0}).sort('date', -1).to_list(1000)
    total_income = sum(t['amount'] for t in transactions if t['transaction_type'] == 'income')
    total_expense = sum(t['amount'] for t in transactions if t['transaction_type'] == 'expense')
    cash_income = sum(t['amount'] for t in transactions if t['transaction_type'] == 'income' and t['payment_mode'] == 'cash')
    bank_income = sum(t['amount'] for t in transactions if t['transaction_type'] == 'income' and t['payment_mode'] == 'bank')
    cash_expense = sum(t['amount'] for t in transactions if t['transaction_type'] == 'expense' and t['payment_mode'] == 'cash')
    bank_expense = sum(t['amount'] for t in transactions if t['transaction_type'] == 'expense' and t['payment_mode'] == 'bank')
    summary = {
        'total_income': total_income, 'total_expense': total_expense, 'net_profit': total_income - total_expense,
        'cash_balance': cash_income - cash_expense, 'bank_balance': bank_income - bank_expense
    }
    pdf_bytes = generate_transaction_pdf(transactions, summary)
    return Response(content=pdf_bytes, media_type="application/pdf",
                    headers={"Content-Disposition": f"attachment; filename=transactions_{datetime.now().strftime('%Y%m%d')}.pdf"})


@router.get("/export/ledger/csv")
async def export_ledger_csv(current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")
    query = {}
    if current_user['role'] != UserRole.DIRECTOR and current_user.get('business_type'):
        query['business_type'] = current_user['business_type']
    transactions = await db.transactions.find(query, {'_id': 0}).sort('date', 1).to_list(10000)
    balance = 0
    ledger_entries = []
    for trans in transactions:
        if trans['transaction_type'] == 'income':
            balance += trans['amount']
        else:
            balance -= trans['amount']
        ledger_entries.append({**trans, 'balance': balance})
    csv_content = generate_ledger_csv(ledger_entries)
    return Response(content=csv_content, media_type="text/csv",
                    headers={"Content-Disposition": f"attachment; filename=ledger_{datetime.now().strftime('%Y%m%d')}.csv"})


@router.get("/export/inventory/pdf")
async def export_inventory_pdf(current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")
    query = {}
    if current_user['role'] != UserRole.DIRECTOR and current_user.get('business_type'):
        query['business_type'] = current_user['business_type']
    items = await db.inventory.find(query, {'_id': 0}).sort('item_name', 1).to_list(1000)
    from export_service import generate_inventory_pdf
    pdf_bytes = generate_inventory_pdf(items)
    return Response(content=pdf_bytes, media_type="application/pdf",
                    headers={"Content-Disposition": f"attachment; filename=inventory_{datetime.now().strftime('%Y%m%d')}.pdf"})


# --- Director Journal Entry Edit/Delete ---

@router.put("/director/journal-entries/{entry_id}")
async def director_update_journal_entry(entry_id: str, req: JournalPostRequest,
                                        current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Directors only")
    existing = await db.journal_entries.find_one({"id": entry_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    await db.journal_entries.update_one({"id": entry_id}, {"$set": {
        "narration": req.narration, "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user['user_id'],
    }})
    await log_audit("update", "journal_entry", entry_id, current_user['user_id'],
                    old_data={"narration": existing.get("narration")}, new_data={"narration": req.narration})
    updated = await db.journal_entries.find_one({"id": entry_id}, {"_id": 0})
    return updated


@router.delete("/director/journal-entries/{entry_id}")
async def director_delete_journal_entry(entry_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Directors only")
    result = await db.journal_entries.delete_one({"id": entry_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    await log_audit("delete", "journal_entry", entry_id, current_user['user_id'])
    return {"message": "Journal entry deleted"}
