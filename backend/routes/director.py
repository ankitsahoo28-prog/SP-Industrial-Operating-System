from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from collections import defaultdict
import uuid
import os
import logging

from database import db
from models import (UserRole, BusinessType, TaskStatus, IndentStatus, AppSettingsUpdate,
                    JobRoleCreate, JobRoleUpdate, ReconciliationCreate, JournalPostRequest)
from deps import get_current_user, log_audit
from company_engine import get_companies, get_company
from ai_service import generate_business_insights

logger = logging.getLogger(__name__)
router = APIRouter()

AVAILABLE_PERMISSIONS = [
    "view_dashboard", "view_inventory", "edit_inventory", "view_accounting",
    "edit_accounting", "manage_tasks", "manage_users", "manage_indents",
    "view_reports", "create_reports", "manage_companies", "view_audit_log",
]


# --- Dashboard Stats ---

@router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.DIRECTOR:
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
                'business_type': business.value, 'business_name': business.value.replace('_', ' ').title(),
                'total_users': total_users, 'total_tasks': total_tasks, 'pending_tasks': pending_tasks,
                'total_reports': total_reports, 'pending_indents': pending_indents,
                'total_income': total_income, 'total_expense': total_expense, 'net_profit': total_income - total_expense
            })
        total_users = await db.users.count_documents({})
        total_tasks = await db.tasks.count_documents({})
        pending_tasks = await db.tasks.count_documents({'status': TaskStatus.PENDING})
        total_reports = await db.reports.count_documents({})
        pending_indents = await db.indents.count_documents({'status': IndentStatus.PENDING})
        return {
            'total_users': total_users, 'total_tasks': total_tasks, 'pending_tasks': pending_tasks,
            'total_reports': total_reports, 'pending_indents': pending_indents, 'business_stats': business_stats
        }
    else:
        query = {'business_type': current_user.get('business_type')}
        total_users = await db.users.count_documents(query)
        total_tasks = await db.tasks.count_documents(query)
        pending_tasks = await db.tasks.count_documents({**query, 'status': TaskStatus.PENDING})
        total_reports = await db.reports.count_documents(query)
        pending_indents = await db.indents.count_documents({**query, 'status': IndentStatus.PENDING})
        return {
            'total_users': total_users, 'total_tasks': total_tasks, 'pending_tasks': pending_tasks,
            'total_reports': total_reports, 'pending_indents': pending_indents
        }


@router.get("/")
async def root():
    return {"message": "SP Industrial Operating System API"}


# --- Audit Logs ---

@router.get("/audit-logs")
async def get_audit_logs(entity_type: Optional[str] = None, entity_id: Optional[str] = None,
                         current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Only directors can view audit logs")
    query = {}
    if entity_type:
        query['entity_type'] = entity_type
    if entity_id:
        query['entity_id'] = entity_id
    logs = await db.audit_logs.find(query, {'_id': 0}).sort('timestamp', -1).limit(100).to_list(100)
    for log_entry in logs:
        if isinstance(log_entry.get('timestamp'), str):
            log_entry['timestamp'] = datetime.fromisoformat(log_entry['timestamp'])
    return logs


# --- AI Insights ---

@router.get("/dashboard/ai-insights")
async def get_ai_insights(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Only directors can view AI insights")
    stats = await get_dashboard_stats(current_user)
    insights = await generate_business_insights(stats)
    return {"insights": insights}


# --- AI Predictions ---

@router.get("/dashboard/predictions")
async def get_predictions(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Only directors can view predictions")
    avg_monthly_income = 0
    avg_monthly_expense = 0
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
        avg_monthly_income = total_income / 3 if total_income else 0
        avg_monthly_expense = total_expense / 3 if total_expense else 0
        total_inv_value = sum(i.get('total_value', 0) for i in inv_items)
        low_stock_count = sum(1 for i in inv_items if i.get('current_stock', 0) < i.get('min_stock_level', 10))
        total_purchases = sum(m.get('total_amount', 0) for m in movements if m.get('reference_type') == 'purchase')
        total_sales = sum(m.get('total_amount', 0) for m in movements if m.get('reference_type') == 'sale')

        low_stock_items = [{"name": i["name"], "stock": i.get("current_stock", 0), "min": i.get("min_stock_level", 10), "unit": i.get("unit", "")}
                           for i in inv_items if i.get("current_stock", 0) < i.get("min_stock_level", 10)][:8]

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

TOP LOW STOCK ITEMS: {json_lib.dumps(low_stock_items)}

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

        real_low_stock = [{"item_name": i["name"], "predicted_quantity": i.get("min_stock_level", 10) * 2,
                           "unit": i.get("unit", ""), "current_stock": i.get("current_stock", 0)}
                          for i in inv_items if i.get("current_stock", 0) < i.get("min_stock_level", 10)][:5]
        if real_low_stock:
            predictions['inventory_alerts'] = real_low_stock
        return predictions

    except Exception as e:
        logger.error(f"Failed to generate predictions: {str(e)}")
        return {
            "revenue": avg_monthly_income * 1.05 if avg_monthly_income > 0 else 50000,
            "expenses": avg_monthly_expense * 1.02 if avg_monthly_expense > 0 else 40000,
            "revenue_trend": "Based on 3-month average with 5% growth projection",
            "expense_trend": "Expected 2% increase in operational costs",
            "profit_trend": "Modest profit expected based on current trends",
            "revenue_confidence": 75,
            "expense_breakdown": [{"category": "Salary", "amount": 20000}, {"category": "Raw Materials", "amount": 17500}, {"category": "Utilities", "amount": 12500}],
            "recommendations": ["Monitor expenses closely", "Focus on revenue growth", "Maintain inventory levels"],
            "inventory_alerts": []
        }


# --- Trends ---

@router.get("/dashboard/trends")
async def get_trends(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Only directors can view trends")
    six_months_ago = datetime.now(timezone.utc) - timedelta(days=180)
    transactions = await db.transactions.find({'date': {'$gte': six_months_ago.isoformat()}}, {'_id': 0}).to_list(10000)
    monthly_data = defaultdict(lambda: {'income': 0, 'expense': 0, 'count': 0})
    for trans in transactions:
        date_obj = datetime.fromisoformat(trans['date'])
        month_key = date_obj.strftime('%Y-%m')
        if trans['transaction_type'] == 'income':
            monthly_data[month_key]['income'] += trans['amount']
        else:
            monthly_data[month_key]['expense'] += trans['amount']
        monthly_data[month_key]['count'] += 1
    trends = []
    for month in sorted(monthly_data.keys()):
        data = monthly_data[month]
        trends.append({
            'month': month, 'income': round(data['income'], 2), 'expense': round(data['expense'], 2),
            'profit': round(data['income'] - data['expense'], 2), 'transactions': data['count']
        })
    return trends


# --- Daily Summary ---

@router.get("/director/daily-summary")
async def director_daily_summary(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Directors only")
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    je_today = await db.journal_entries.find({"created_at": {"$gte": today_start}}, {"_id": 0}).to_list(1000)
    total_debit_today = sum(e.get("total_debit", 0) for e in je_today)
    movements_today = await db.stock_movements.find({"created_at": {"$gte": today_start}}, {"_id": 0}).to_list(1000)
    stock_in = sum(m.get("quantity", 0) for m in movements_today if m.get("movement_type") == "in")
    stock_out = sum(m.get("quantity", 0) for m in movements_today if m.get("movement_type") == "out")
    tasks_created = await db.tasks.count_documents({"created_at": {"$gte": today_start}})
    tasks_completed = await db.tasks.count_documents({"updated_at": {"$gte": today_start}, "status": "completed"})
    users_approved = await db.users.count_documents({"status": "approved", "created_at": {"$gte": today_start}})
    pending_users = await db.users.count_documents({"status": "pending"})
    txn_today = await db.transactions.find({"date": {"$gte": today_start}}, {"_id": 0}).to_list(1000)
    income_today = sum(t.get("amount", 0) for t in txn_today if t.get("transaction_type") == "income")
    expense_today = sum(t.get("amount", 0) for t in txn_today if t.get("transaction_type") == "expense")
    all_items = await db.inventory_items.find({}, {"_id": 0}).to_list(5000)
    low_stock_count = sum(1 for i in all_items if i.get("current_stock", 0) < i.get("min_stock_level", 10))
    all_companies = await get_companies(db)
    company_summaries = []
    for comp in all_companies[:10]:
        cid = comp["id"]
        c_je = len([e for e in je_today if e.get("company_id") == cid])
        c_moves = len([m for m in movements_today if m.get("company_id") == cid])
        if c_je > 0 or c_moves > 0:
            company_summaries.append({"company_name": comp["name"], "journal_entries": c_je, "stock_movements": c_moves})
    return {
        "date": now.strftime("%Y-%m-%d"), "journal_entries_count": len(je_today),
        "total_debit_today": round(total_debit_today, 2), "stock_movements": len(movements_today),
        "stock_in": round(stock_in, 2), "stock_out": round(stock_out, 2),
        "tasks_created": tasks_created, "tasks_completed": tasks_completed,
        "income_today": round(income_today, 2), "expense_today": round(expense_today, 2),
        "net_today": round(income_today - expense_today, 2),
        "users_approved": users_approved, "pending_users": pending_users,
        "low_stock_alerts": low_stock_count, "company_activity": company_summaries,
    }


# --- Settings ---

@router.get("/settings")
async def get_app_settings():
    settings = await db.app_settings.find_one({"key": "app_config"}, {"_id": 0})
    if not settings:
        return {"app_name": "SP GROUP", "logo_url": "/sp-logo.png", "bg_video_url": "/bg-video.mp4",
                "primary_color": "#1a1a2e", "tagline": "Industrial Operating System"}
    return settings


@router.put("/settings")
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


# --- Translations ---

@router.get("/translations/{lang}")
async def get_translations(lang: str):
    from i18n import translations
    return translations.get(lang, translations["en"])


# --- Job Role Management ---

@router.get("/job-roles")
async def get_job_roles(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Directors only")
    roles = await db.job_roles.find({}, {"_id": 0}).sort("name", 1).to_list(100)
    return roles


@router.post("/job-roles")
async def create_job_role(data: JobRoleCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Directors only")
    existing = await db.job_roles.find_one({"name": {"$regex": f"^{data.name}$", "$options": "i"}}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Role name already exists")
    role_doc = {
        "id": str(uuid.uuid4()), "name": data.name, "description": data.description or "",
        "permissions": data.permissions, "created_by": current_user['user_id'],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.job_roles.insert_one(role_doc)
    role_doc.pop("_id", None)
    return role_doc


@router.put("/job-roles/{role_id}")
async def update_job_role(role_id: str, data: JobRoleUpdate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Directors only")
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.job_roles.update_one({"id": role_id}, {"$set": updates})
    updated = await db.job_roles.find_one({"id": role_id}, {"_id": 0})
    if not updated:
        raise HTTPException(status_code=404, detail="Role not found")
    return updated


@router.delete("/job-roles/{role_id}")
async def delete_job_role(role_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Directors only")
    result = await db.job_roles.delete_one({"id": role_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Role not found")
    return {"message": "Role deleted"}


@router.get("/job-roles/permissions")
async def get_available_permissions(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Directors only")
    return AVAILABLE_PERMISSIONS


# --- Reconciliation ---

@router.get("/reconciliation")
async def get_reconciliations(status: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Directors only")
    query = {}
    if status and status != "all":
        query["status"] = status
    records = await db.reconciliations.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return records


@router.post("/reconciliation")
async def create_reconciliation(data: ReconciliationCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Directors only")
    from_comp = await get_company(db, data.from_company_id)
    to_comp = await get_company(db, data.to_company_id)
    if not from_comp or not to_comp:
        raise HTTPException(status_code=404, detail="Company not found")
    rec = {
        "id": str(uuid.uuid4()), "from_company_id": data.from_company_id,
        "from_company_name": from_comp["name"], "to_company_id": data.to_company_id,
        "to_company_name": to_comp["name"], "amount": data.amount,
        "description": data.description, "reference": data.reference or "",
        "status": "pending", "created_by": current_user['user_id'],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.reconciliations.insert_one(rec)
    rec.pop("_id", None)
    return rec


@router.patch("/reconciliation/{rec_id}")
async def update_reconciliation_status(rec_id: str, status: str, notes: Optional[str] = None,
                                       current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Directors only")
    if status not in ("pending", "matched", "disputed"):
        raise HTTPException(status_code=400, detail="Invalid status")
    update = {"status": status, "updated_at": datetime.now(timezone.utc).isoformat(),
              "updated_by": current_user['user_id']}
    if notes:
        update["notes"] = notes
    await db.reconciliations.update_one({"id": rec_id}, {"$set": update})
    updated = await db.reconciliations.find_one({"id": rec_id}, {"_id": 0})
    if not updated:
        raise HTTPException(status_code=404, detail="Record not found")
    return updated


@router.delete("/reconciliation/{rec_id}")
async def delete_reconciliation(rec_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Directors only")
    result = await db.reconciliations.delete_one({"id": rec_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Record not found")
    return {"message": "Reconciliation deleted"}


# --- Notifications ---

@router.get("/notifications")
async def get_notifications(limit: int = 50, current_user: dict = Depends(get_current_user)):
    notifs = await db.notifications.find({"user_id": current_user['user_id']}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return notifs


@router.get("/notifications/unread-count")
async def get_unread_count(current_user: dict = Depends(get_current_user)):
    count = await db.notifications.count_documents({"user_id": current_user['user_id'], "read": False})
    return {"count": count}


@router.patch("/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: str, current_user: dict = Depends(get_current_user)):
    await db.notifications.update_one({"id": notif_id, "user_id": current_user['user_id']}, {"$set": {"read": True}})
    return {"message": "Marked as read"}


@router.post("/notifications/mark-all-read")
async def mark_all_notifications_read(current_user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": current_user['user_id'], "read": False}, {"$set": {"read": True}})
    return {"message": "All notifications marked as read"}


@router.delete("/notifications/{notif_id}")
async def delete_notification(notif_id: str, current_user: dict = Depends(get_current_user)):
    await db.notifications.delete_one({"id": notif_id, "user_id": current_user['user_id']})
    return {"message": "Notification deleted"}
