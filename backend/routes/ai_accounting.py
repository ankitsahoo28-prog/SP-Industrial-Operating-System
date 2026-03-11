from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from collections import defaultdict
import uuid
import os
import json
import re
import logging

from database import db
from deps import get_current_user, resolve_company_id
from models import UserRole
from odoo_accounting.engine import create_invoice_move, register_payment, post_move

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/acc/ai")

EMERGENT_KEY_ENV = "EMERGENT_LLM_KEY"


async def get_cid(current_user, company_id=None):
    cid = await resolve_company_id(current_user['user_id'], current_user['role'], company_id)
    if not cid:
        comp = await db.companies.find_one({"status": "active"}, {"_id": 0, "id": 1})
        cid = comp["id"] if comp else None
    return cid


async def get_accounts_context(cid):
    accounts = await db.odoo_accounts.find({"company_id": cid}, {"_id": 0, "id": 1, "code": 1, "name": 1, "account_type": 1}).sort("code", 1).to_list(500)
    return accounts


async def get_partners_context(cid):
    partners = await db.odoo_partners.find({"company_id": cid}, {"_id": 0, "id": 1, "name": 1, "partner_type": 1}).to_list(500)
    return partners


async def get_journals_context(cid):
    journals = await db.odoo_journals.find({"company_id": cid}, {"_id": 0, "id": 1, "name": 1, "code": 1, "journal_type": 1}).to_list(50)
    return journals


def parse_ai_json(response_text):
    json_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', response_text)
    json_str = json_match.group(1).strip() if json_match else response_text.strip()
    return json.loads(json_str)


async def call_llm(system_prompt, user_prompt, session_suffix=""):
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    key = os.environ.get(EMERGENT_KEY_ENV)
    if not key:
        raise HTTPException(status_code=500, detail="AI service not configured")
    chat = LlmChat(
        api_key=key,
        session_id=f"acc-ai-{session_suffix}-{uuid.uuid4().hex[:8]}",
        system_message=system_prompt,
    ).with_model("openai", "gpt-4o-mini")
    resp = await chat.send_message(UserMessage(text=user_prompt))
    return resp


# ============ MODELS ============

class AiChatRequest(BaseModel):
    message: str
    company_id: Optional[str] = None
    auto_post: Optional[bool] = False

class AiInvoiceExtract(BaseModel):
    description: str
    company_id: Optional[str] = None

class AiCategorizeRequest(BaseModel):
    description: str
    amount: float
    company_id: Optional[str] = None

class AiReconcileRequest(BaseModel):
    company_id: Optional[str] = None

class AiFinancialQA(BaseModel):
    question: str
    company_id: Optional[str] = None


# ============ 1. AI CHAT ASSISTANT ============

@router.post("/chat")
async def ai_chat_assistant(req: AiChatRequest, current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")

    cid = await get_cid(current_user, req.company_id)
    accounts = await get_accounts_context(cid)
    partners = await get_partners_context(cid)
    journals = await get_journals_context(cid)

    acct_list = "\n".join([f"- {a['code']} {a['name']} (type: {a['account_type']}, id: {a['id']})" for a in accounts])
    partner_list = "\n".join([f"- {p['name']} ({p['partner_type']}, id: {p['id']})" for p in partners]) or "No partners yet"
    journal_list = "\n".join([f"- {j['name']} ({j['journal_type']}, code: {j['code']}, id: {j['id']})" for j in journals])

    system_prompt = f"""You are an expert AI Accounting Assistant for an Indian business ERP system.
You help users create journal entries, invoices, and payments using natural language.

AVAILABLE ACCOUNTS:
{acct_list}

EXISTING PARTNERS:
{partner_list}

JOURNALS:
{journal_list}

RULES:
1. Every journal entry MUST balance: Total Debit = Total Credit
2. Apply Indian accounting practices and GST (5%, 12%, 18%, 28%) when mentioned
3. Use Cash account (code 1100) for cash, Bank account (code 1200) for bank transactions
4. Currency is INR
5. For sales/invoices: debit Accounts Receivable (1300), credit Sales Revenue (4000)
6. For purchases/bills: debit relevant expense, credit Accounts Payable (2000)
7. For payments received: debit Cash/Bank, credit Accounts Receivable
8. For payments made: debit Accounts Payable, credit Cash/Bank

RESPOND IN THIS EXACT JSON FORMAT:
{{
  "response_text": "Human-readable explanation of what you're doing",
  "action_type": "journal_entry|invoice|payment|info|clarification",
  "journal_entry": {{
    "journal_id": "journal id from list",
    "narration": "description",
    "lines": [
      {{"account_id": "account id", "account_name": "name", "debit": 0, "credit": 0, "name": "line description"}}
    ]
  }},
  "invoice": {{
    "move_type": "out_invoice|in_invoice|out_refund|in_refund",
    "partner_id": "partner id or null if new",
    "partner_name": "partner name",
    "ref": "reference",
    "invoice_lines": [
      {{"product_name": "item", "quantity": 1, "unit_price": 0}}
    ]
  }},
  "payment": {{
    "payment_type": "inbound|outbound",
    "amount": 0,
    "journal_id": "journal id",
    "partner_id": "partner id or null",
    "ref": "reference"
  }},
  "needs_clarification": false,
  "suggestions": ["optional follow-up suggestions"]
}}

Only include the relevant action field (journal_entry, invoice, or payment). Set others to null.
If the user is just asking a question, use action_type "info" and put the answer in response_text.
If you need more info, use action_type "clarification"."""

    try:
        resp = await call_llm(system_prompt, req.message, f"chat-{current_user['user_id']}")
        parsed = parse_ai_json(resp)

        result = parsed
        result["executed"] = False

        if req.auto_post and parsed.get("action_type") in ("journal_entry", "invoice", "payment"):
            try:
                if parsed["action_type"] == "journal_entry" and parsed.get("journal_entry"):
                    je = parsed["journal_entry"]
                    lines = []
                    for l in je["lines"]:
                        lines.append({
                            "account_id": l["account_id"],
                            "debit": float(l.get("debit", 0)),
                            "credit": float(l.get("credit", 0)),
                            "name": l.get("name", ""),
                        })
                    move_id = str(uuid.uuid4())
                    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")
                    seq = await db.odoo_moves.count_documents({"company_id": cid}) + 1
                    move_doc = {
                        "id": move_id, "company_id": cid,
                        "name": f"AI/{seq:04d}", "move_type": "entry",
                        "journal_id": je.get("journal_id", journals[0]["id"] if journals else ""),
                        "date": now, "narration": je.get("narration", "AI-generated entry"),
                        "state": "draft", "lines": [],
                        "amount_total": 0, "amount_untaxed": 0, "amount_tax": 0,
                        "amount_residual": 0, "created_by": current_user["user_id"],
                        "created_at": now, "ref": "AI Assistant",
                    }
                    for l in lines:
                        line_id = str(uuid.uuid4())
                        move_doc["lines"].append({
                            "id": line_id, "account_id": l["account_id"],
                            "debit": l["debit"], "credit": l["credit"],
                            "name": l.get("name", ""), "partner_id": None,
                        })
                        # Insert into odoo_move_lines collection for post_move to work
                        await db.odoo_move_lines.insert_one({
                            "id": line_id, "move_id": move_id, "company_id": cid,
                            "account_id": l["account_id"], "debit": l["debit"],
                            "credit": l["credit"], "name": l.get("name", ""),
                            "partner_id": None, "parent_state": "draft", "date": now,
                        })
                    move_doc["amount_total"] = sum(l["debit"] for l in lines)
                    await db.odoo_moves.insert_one(move_doc)
                    await post_move(db, move_id, cid)
                    result["executed"] = True
                    result["move_id"] = move_id
                    result["response_text"] = parsed.get("response_text", "") + f"\n\nJournal entry {move_doc['name']} created and posted successfully."

                elif parsed["action_type"] == "invoice" and parsed.get("invoice"):
                    inv = parsed["invoice"]
                    partner_id = inv.get("partner_id")
                    if not partner_id and inv.get("partner_name"):
                        pid = str(uuid.uuid4())
                        ptype = "customer" if inv["move_type"] in ("out_invoice", "out_refund") else "vendor"
                        await db.odoo_partners.insert_one({
                            "id": pid, "company_id": cid, "name": inv["partner_name"],
                            "partner_type": ptype, "active": True,
                            "created_at": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                        })
                        partner_id = pid
                    inv_data = {
                        "move_type": inv["move_type"], "partner_id": partner_id,
                        "ref": inv.get("ref", "AI Invoice"),
                        "invoice_lines": inv.get("invoice_lines", []),
                    }
                    move = await create_invoice_move(db, cid, inv_data, current_user["user_id"])
                    result["executed"] = True
                    result["move_id"] = move["id"]
                    result["response_text"] = parsed.get("response_text", "") + f"\n\nInvoice {move['name']} created as draft."

                elif parsed["action_type"] == "payment" and parsed.get("payment"):
                    pay = parsed["payment"]
                    pay_data = {
                        "payment_type": pay["payment_type"],
                        "amount": float(pay["amount"]),
                        "journal_id": pay["journal_id"],
                        "partner_id": pay.get("partner_id"),
                        "ref": pay.get("ref", "AI Payment"),
                    }
                    payment = await register_payment(db, cid, pay_data, current_user["user_id"])
                    result["executed"] = True
                    result["payment_id"] = payment["id"]
                    result["response_text"] = parsed.get("response_text", "") + f"\n\nPayment registered successfully."
            except Exception as exec_err:
                result["executed"] = False
                result["execution_error"] = str(exec_err)

        return result
    except json.JSONDecodeError:
        return {"response_text": resp, "action_type": "info", "executed": False}
    except Exception as e:
        logger.error(f"AI chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ 2. SMART INVOICE EXTRACTION ============

@router.post("/invoice-extract")
async def ai_invoice_extract(req: AiInvoiceExtract, current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")

    cid = await get_cid(current_user, req.company_id)
    partners = await get_partners_context(cid)
    partner_list = ", ".join([f"{p['name']} (id: {p['id']})" for p in partners]) or "None"

    system_prompt = f"""You are an invoice data extraction AI. Extract structured invoice data from natural language descriptions.

EXISTING PARTNERS: {partner_list}

RESPOND IN THIS EXACT JSON FORMAT:
{{
  "move_type": "out_invoice|in_invoice",
  "partner_name": "extracted partner name",
  "partner_id": "matching partner id from list or null",
  "ref": "extracted reference number",
  "date": "YYYY-MM-DD or null",
  "due_date": "YYYY-MM-DD or null",
  "invoice_lines": [
    {{"product_name": "item description", "quantity": 1, "unit_price": 0.0, "discount": 0}}
  ],
  "tax_info": "any tax information extracted",
  "confidence": 0.95,
  "notes": "any assumptions or missing information"
}}"""

    try:
        resp = await call_llm(system_prompt, f"Extract invoice data from: {req.description}", f"inv-{current_user['user_id']}")
        return parse_ai_json(resp)
    except json.JSONDecodeError:
        return {"error": "Could not parse AI response", "raw": resp}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============ 3. AI TRANSACTION CATEGORIZATION ============

@router.post("/categorize")
async def ai_categorize(req: AiCategorizeRequest, current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, req.company_id)
    accounts = await get_accounts_context(cid)
    acct_list = "\n".join([f"- {a['code']} {a['name']} ({a['account_type']})" for a in accounts])

    system_prompt = f"""You are a transaction categorization AI for Indian businesses.
Given a transaction description and amount, suggest the most appropriate debit and credit accounts.

AVAILABLE ACCOUNTS:
{acct_list}

RESPOND IN THIS EXACT JSON FORMAT:
{{
  "debit_account": {{"code": "1100", "name": "Cash", "reason": "why this account"}},
  "credit_account": {{"code": "4000", "name": "Sales Revenue", "reason": "why this account"}},
  "category": "revenue|expense|asset|liability|transfer",
  "confidence": 0.9,
  "tax_applicable": false,
  "suggested_tax_rate": null,
  "alternative_suggestions": [
    {{"debit": "code - name", "credit": "code - name", "reason": "alternative interpretation"}}
  ]
}}"""

    try:
        prompt = f"Categorize: '{req.description}' for amount ₹{req.amount}"
        resp = await call_llm(system_prompt, prompt, f"cat-{current_user['user_id']}")
        return parse_ai_json(resp)
    except json.JSONDecodeError:
        return {"error": "Could not parse", "raw": resp}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============ 4. AI RECONCILIATION ============

@router.post("/reconcile-suggest")
async def ai_reconcile_suggest(req: AiReconcileRequest, current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, req.company_id)

    unreconciled = await db.odoo_move_lines.find({
        "company_id": cid, "reconciled": {"$ne": True},
        "$or": [{"debit": {"$gt": 0}}, {"credit": {"$gt": 0}}]
    }, {"_id": 0, "id": 1, "account_id": 1, "debit": 1, "credit": 1, "name": 1, "move_id": 1, "date": 1}).to_list(200)

    if not unreconciled:
        posted_moves = await db.odoo_moves.find(
            {"company_id": cid, "state": "posted"},
            {"_id": 0, "id": 1, "name": 1, "lines": 1, "date": 1, "narration": 1, "ref": 1}
        ).sort("date", -1).to_list(50)
        lines_data = []
        for m in posted_moves:
            for l in m.get("lines", []):
                lines_data.append({
                    "move_name": m["name"], "date": m["date"],
                    "account_id": l.get("account_id", ""), "debit": l.get("debit", 0),
                    "credit": l.get("credit", 0), "name": l.get("name", m.get("narration", "")),
                })
        unreconciled = lines_data

    if not unreconciled:
        return {"suggestions": [], "message": "No transactions to reconcile"}

    lines_text = "\n".join([
        f"- {l.get('date','?')} | Dr:{l.get('debit',0)} Cr:{l.get('credit',0)} | {l.get('name','?')} | Acct:{l.get('account_id','?')}"
        for l in unreconciled[:50]
    ])

    system_prompt = """You are a reconciliation AI. Analyze transaction lines and suggest which ones match each other.
Look for: same amounts (debit matches credit), related descriptions, matching dates.

RESPOND IN JSON:
{
  "suggestions": [
    {
      "match_type": "exact_amount|partial|related",
      "confidence": 0.95,
      "reason": "why these match",
      "lines": ["line description 1", "line description 2"],
      "action": "recommended action"
    }
  ],
  "summary": "overall reconciliation status",
  "unmatched_count": 0,
  "tips": ["helpful tips for the user"]
}"""

    try:
        resp = await call_llm(system_prompt, f"Analyze these transactions for reconciliation:\n{lines_text}", f"rec-{current_user['user_id']}")
        return parse_ai_json(resp)
    except json.JSONDecodeError:
        return {"suggestions": [], "summary": resp[:500]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============ 5. AI FINANCIAL Q&A ============

@router.post("/financial-qa")
async def ai_financial_qa(req: AiFinancialQA, current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")

    cid = await get_cid(current_user, req.company_id)

    pipeline_income = [
        {"$match": {"company_id": cid, "state": "posted"}},
        {"$unwind": "$lines"},
        {"$lookup": {"from": "odoo_accounts", "localField": "lines.account_id", "foreignField": "id", "as": "acct"}},
        {"$unwind": {"path": "$acct", "preserveNullAndEmptyArrays": True}},
        {"$group": {
            "_id": "$acct.account_type",
            "total_debit": {"$sum": "$lines.debit"},
            "total_credit": {"$sum": "$lines.credit"},
        }},
    ]
    type_totals = await db.odoo_moves.aggregate(pipeline_income).to_list(100)

    inv_count = await db.odoo_moves.count_documents({"company_id": cid, "move_type": {"$in": ["out_invoice", "in_invoice"]}, "state": "posted"})
    pay_count = await db.odoo_moves.count_documents({"company_id": cid, "move_type": "payment", "state": "posted"})

    recent_moves = await db.odoo_moves.find(
        {"company_id": cid, "state": "posted"},
        {"_id": 0, "name": 1, "date": 1, "amount_total": 1, "narration": 1, "move_type": 1, "ref": 1}
    ).sort("date", -1).limit(20).to_list(20)

    context = f"""FINANCIAL DATA:
Account type totals: {json.dumps([{"type": t["_id"], "debit": t["total_debit"], "credit": t["total_credit"]} for t in type_totals])}
Posted invoices: {inv_count}, Posted payments: {pay_count}
Recent transactions: {json.dumps([{"name": m["name"], "date": m["date"], "amount": m.get("amount_total",0), "type": m["move_type"], "desc": m.get("narration","") or m.get("ref","")} for m in recent_moves])}"""

    system_prompt = f"""You are a financial analyst AI for an Indian business. Answer questions about the company's finances using the data provided.
Be specific with numbers. Use INR (₹) currency. Provide actionable insights.

{context}

RESPOND IN JSON:
{{
  "answer": "detailed answer to the question",
  "key_metrics": [{{"label": "metric name", "value": "₹X or number", "trend": "up|down|stable"}}],
  "insights": ["actionable insight 1", "actionable insight 2"],
  "follow_up_questions": ["suggested follow-up question"]
}}"""

    try:
        resp = await call_llm(system_prompt, req.question, f"qa-{current_user['user_id']}")
        return parse_ai_json(resp)
    except json.JSONDecodeError:
        return {"answer": resp, "key_metrics": [], "insights": []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============ 6. PREDICTIVE CASH FLOW ============

@router.get("/cash-forecast")
async def ai_cash_forecast(company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")

    cid = await get_cid(current_user, company_id)

    now = datetime.now(timezone.utc)
    past_90 = (now - timedelta(days=90)).strftime("%Y-%m-%d")

    moves = await db.odoo_moves.find(
        {"company_id": cid, "state": "posted", "date": {"$gte": past_90}},
        {"_id": 0, "date": 1, "amount_total": 1, "move_type": 1, "narration": 1}
    ).sort("date", 1).to_list(500)

    cash_acct = await db.odoo_accounts.find_one({"company_id": cid, "account_type": "cash"}, {"_id": 0, "id": 1})
    bank_acct = await db.odoo_accounts.find_one({"company_id": cid, "account_type": "bank"}, {"_id": 0, "id": 1})

    cash_bal = 0
    bank_bal = 0
    if cash_acct:
        for m in await db.odoo_moves.find({"company_id": cid, "state": "posted"}, {"_id": 0, "lines": 1}).to_list(1000):
            for l in m.get("lines", []):
                if l.get("account_id") == cash_acct["id"]:
                    cash_bal += l.get("debit", 0) - l.get("credit", 0)
    if bank_acct:
        for m in await db.odoo_moves.find({"company_id": cid, "state": "posted"}, {"_id": 0, "lines": 1}).to_list(1000):
            for l in m.get("lines", []):
                if l.get("account_id") == bank_acct["id"]:
                    bank_bal += l.get("debit", 0) - l.get("credit", 0)

    outstanding_recv = await db.odoo_moves.find(
        {"company_id": cid, "move_type": "out_invoice", "state": "posted", "payment_state": {"$ne": "paid"}},
        {"_id": 0, "amount_residual": 1, "due_date": 1, "partner_name": 1}
    ).to_list(100)

    outstanding_pay = await db.odoo_moves.find(
        {"company_id": cid, "move_type": "in_invoice", "state": "posted", "payment_state": {"$ne": "paid"}},
        {"_id": 0, "amount_residual": 1, "due_date": 1, "partner_name": 1}
    ).to_list(100)

    moves_text = json.dumps([{"date": m["date"], "amount": m.get("amount_total",0), "type": m["move_type"]} for m in moves[-50:]])
    recv_text = json.dumps([{"amount": r.get("amount_residual",0), "due": r.get("due_date",""), "partner": r.get("partner_name","")} for r in outstanding_recv])
    pay_text = json.dumps([{"amount": p.get("amount_residual",0), "due": p.get("due_date",""), "partner": p.get("partner_name","")} for p in outstanding_pay])

    system_prompt = f"""You are a cash flow forecasting AI. Analyze historical data and predict future cash position.

CURRENT POSITION: Cash: ₹{round(cash_bal,2)}, Bank: ₹{round(bank_bal,2)}
RECENT TRANSACTIONS (last 90 days): {moves_text}
OUTSTANDING RECEIVABLES: {recv_text}
OUTSTANDING PAYABLES: {pay_text}

RESPOND IN JSON:
{{
  "current_cash": {round(cash_bal + bank_bal, 2)},
  "forecast": [
    {{"period": "Week 1", "inflow": 0, "outflow": 0, "balance": 0}},
    {{"period": "Week 2", "inflow": 0, "outflow": 0, "balance": 0}},
    {{"period": "Week 3", "inflow": 0, "outflow": 0, "balance": 0}},
    {{"period": "Week 4", "inflow": 0, "outflow": 0, "balance": 0}},
    {{"period": "Month 2", "inflow": 0, "outflow": 0, "balance": 0}},
    {{"period": "Month 3", "inflow": 0, "outflow": 0, "balance": 0}}
  ],
  "risk_level": "low|medium|high",
  "insights": ["insight about cash flow trends"],
  "recommendations": ["actionable recommendation"],
  "expected_collections": 0,
  "expected_payments": 0
}}"""

    try:
        resp = await call_llm(system_prompt, "Generate a 3-month cash flow forecast based on the data provided.", f"cf-{current_user['user_id']}")
        return parse_ai_json(resp)
    except json.JSONDecodeError:
        return {
            "current_cash": round(cash_bal + bank_bal, 2),
            "forecast": [], "risk_level": "unknown",
            "insights": [resp[:300] if resp else "Unable to generate forecast"],
            "recommendations": []
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============ 7. ANOMALY DETECTION ============

@router.get("/anomalies")
async def ai_anomaly_detection(company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")

    cid = await get_cid(current_user, company_id)

    recent = await db.odoo_moves.find(
        {"company_id": cid, "state": "posted"},
        {"_id": 0, "id": 1, "name": 1, "date": 1, "amount_total": 1, "move_type": 1,
         "narration": 1, "ref": 1, "partner_name": 1, "lines": 1}
    ).sort("date", -1).limit(100).to_list(100)

    if not recent:
        return {"anomalies": [], "summary": "No transactions to analyze", "health_score": 100}

    txn_text = json.dumps([{
        "name": m["name"], "date": m["date"], "amount": m.get("amount_total", 0),
        "type": m["move_type"], "partner": m.get("partner_name", ""),
        "desc": m.get("narration", "") or m.get("ref", ""),
        "lines_count": len(m.get("lines", [])),
        "total_debit": sum(l.get("debit", 0) for l in m.get("lines", [])),
        "total_credit": sum(l.get("credit", 0) for l in m.get("lines", [])),
    } for m in recent])

    system_prompt = f"""You are a forensic accounting AI. Analyze transactions for anomalies, errors, and suspicious patterns.

Look for:
1. Unusually large/small amounts compared to averages
2. Duplicate transactions (same amount, same date, same partner)
3. Round-number transactions that may indicate estimates
4. Entries at unusual times
5. Imbalanced entries
6. Missing references or descriptions
7. Unusual account combinations
8. Sequential number gaps

TRANSACTIONS: {txn_text}

RESPOND IN JSON:
{{
  "anomalies": [
    {{
      "severity": "high|medium|low",
      "type": "duplicate|unusual_amount|missing_info|imbalanced|suspicious_pattern",
      "description": "what was found",
      "affected_transactions": ["transaction names"],
      "recommendation": "what to do"
    }}
  ],
  "summary": "overall assessment",
  "health_score": 85,
  "patterns": ["observed patterns"],
  "recommendations": ["general recommendations"]
}}"""

    try:
        resp = await call_llm(system_prompt, "Analyze these transactions for anomalies and potential issues.", f"anom-{current_user['user_id']}")
        return parse_ai_json(resp)
    except json.JSONDecodeError:
        return {"anomalies": [], "summary": resp[:500] if resp else "Analysis failed", "health_score": 0}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============ 8. BILL/INVOICE PHOTO SCANNER ============

@router.post("/scan-bill")
async def ai_scan_bill(
    file: UploadFile = File(...),
    company_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    mime = file.content_type or "image/jpeg"
    if mime not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WEBP images supported")

    import base64
    b64 = base64.b64encode(content).decode("utf-8")

    cid = await get_cid(current_user, company_id)
    partners = await get_partners_context(cid)
    partner_list = ", ".join([f"{p['name']} (id: {p['id']})" for p in partners]) or "None"

    system_prompt = f"""You are an expert OCR and invoice extraction AI for Indian businesses.
Analyze the uploaded bill/invoice image and extract all structured data.

EXISTING PARTNERS: {partner_list}

EXTRACT AND RESPOND IN THIS EXACT JSON FORMAT:
{{
  "vendor_name": "name of the vendor/seller",
  "vendor_gstin": "GST number if visible",
  "vendor_address": "address if visible",
  "buyer_name": "name of the buyer if visible",
  "invoice_number": "invoice/bill number",
  "invoice_date": "YYYY-MM-DD",
  "due_date": "YYYY-MM-DD or null",
  "move_type": "in_invoice for purchase bills, out_invoice for sales invoices",
  "partner_id": "matching partner id from list or null",
  "line_items": [
    {{
      "description": "item/service description",
      "hsn_sac": "HSN/SAC code if visible",
      "quantity": 1,
      "unit_price": 0.0,
      "discount": 0,
      "tax_rate": 0,
      "total": 0.0
    }}
  ],
  "subtotal": 0.0,
  "tax_details": {{
    "cgst": 0, "sgst": 0, "igst": 0, "cess": 0, "total_tax": 0
  }},
  "grand_total": 0.0,
  "amount_in_words": "amount in words if visible",
  "payment_terms": "payment terms if visible",
  "bank_details": "bank details if visible",
  "notes": "any additional notes or terms visible on the bill",
  "confidence": 0.95,
  "raw_text": "full OCR text extracted from the image"
}}

Be thorough - extract every detail visible in the image. If something is unclear, provide your best interpretation and note it."""

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        key = os.environ.get(EMERGENT_KEY_ENV)
        if not key:
            raise HTTPException(status_code=500, detail="AI service not configured")

        chat = LlmChat(
            api_key=key,
            session_id=f"acc-ai-scan-{current_user['user_id']}-{uuid.uuid4().hex[:8]}",
            system_message=system_prompt,
        ).with_model("openai", "gpt-4o")

        image_content = ImageContent(image_base64=b64)
        user_message = UserMessage(
            text="Please analyze this bill/invoice image and extract all data into the JSON format specified.",
            file_contents=[image_content],
        )
        resp = await chat.send_message(user_message)
        result = parse_ai_json(resp)

        # Save the uploaded file
        ext = os.path.splitext(file.filename or "scan.jpg")[1] or ".jpg"
        fname = f"bill_scan_{uuid.uuid4().hex[:12]}{ext}"
        fpath = os.path.join("/app/uploads", fname)
        with open(fpath, "wb") as f:
            f.write(content)
        result["scanned_image_url"] = f"/api/files/{fname}"

        return result
    except json.JSONDecodeError:
        return {"error": "Could not parse AI response", "raw_text": resp[:1000] if resp else ""}
    except Exception as e:
        logger.error(f"Bill scan error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
