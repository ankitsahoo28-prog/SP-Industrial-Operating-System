from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import logging

from database import db
from models import (User, UserCreate, UserRole, CompanyCreate, CompanyUpdate, CompanyUserAssign,
                    MultiCompanyAssign)
from deps import (get_current_user, hash_password, require_company_access, resolve_company_id,
                  log_audit, notify_directors)
from company_engine import (
    create_company, get_companies, get_company, update_company,
    delete_company, restore_company, assign_user_to_company,
    remove_user_from_company, get_user_companies, get_company_users
)

logger = logging.getLogger(__name__)
router = APIRouter()


# --- Company CRUD ---

@router.get("/companies")
async def api_get_companies(include_deleted: bool = False, current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.DIRECTOR:
        return await get_companies(db, include_deleted)
    return await get_user_companies(db, current_user['user_id'], current_user['role'])


@router.post("/companies")
async def api_create_company(data: CompanyCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Only directors can create companies")
    company = await create_company(
        db, data.name, data.business_type, current_user['user_id'],
        data.fy_start, data.gst_number, data.currency
    )
    company.pop("_id", None)
    await log_audit("create_company", "company", company["id"], current_user['user_id'],
                    new_data={"name": data.name, "business_type": data.business_type})
    await notify_directors("New Company", f"Company '{data.name}' ({data.business_type}) has been created",
                           "company", "/companies")
    return company


@router.put("/companies/{company_id}")
async def api_update_company(company_id: str, data: CompanyUpdate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Only directors can edit companies")
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    result = await update_company(db, company_id, updates)
    if result:
        result.pop("_id", None)
    await log_audit("update_company", "company", company_id, current_user['user_id'], new_data=updates)
    return result


@router.delete("/companies/{company_id}")
async def api_delete_company(company_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Only directors can delete companies")
    await delete_company(db, company_id)
    await log_audit("delete_company", "company", company_id, current_user['user_id'])
    return {"message": "Company deleted (soft)"}


@router.post("/companies/{company_id}/restore")
async def api_restore_company(company_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Only directors can restore companies")
    await restore_company(db, company_id)
    await log_audit("restore_company", "company", company_id, current_user['user_id'])
    return {"message": "Company restored"}


@router.post("/companies/{company_id}/activate")
async def api_activate_company(company_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Only directors")
    await update_company(db, company_id, {"status": "active"})
    return {"message": "Company activated"}


@router.post("/companies/{company_id}/deactivate")
async def api_deactivate_company(company_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Only directors")
    await update_company(db, company_id, {"status": "inactive"})
    return {"message": "Company deactivated"}


# --- User-Company Assignment ---

@router.post("/companies/assign-user")
async def api_assign_user_to_company(data: CompanyUserAssign, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Only directors can assign users to companies")
    result = await assign_user_to_company(db, data.user_id, data.company_id, current_user['user_id'])
    result.pop("_id", None)
    await log_audit("assign_user_company", "company_user", data.company_id, current_user['user_id'],
                    new_data={"user_id": data.user_id})
    return result


@router.post("/companies/remove-user")
async def api_remove_user_from_company(data: CompanyUserAssign, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Only directors can remove users from companies")
    await remove_user_from_company(db, data.user_id, data.company_id)
    return {"message": "User removed from company"}


@router.post("/companies/assign-multiple")
async def api_assign_user_to_multiple_companies(data: MultiCompanyAssign, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Only directors can assign users to companies")
    await db.company_users.delete_many({"user_id": data.user_id})
    for cid in data.company_ids:
        company = await db.companies.find_one({"id": cid}, {"_id": 0})
        if company:
            await assign_user_to_company(db, data.user_id, cid, current_user['user_id'])
    await log_audit("assign_user_multi_company", "company_user", data.user_id, current_user['user_id'],
                    new_data={"company_ids": data.company_ids})
    return {"message": f"User assigned to {len(data.company_ids)} companies"}


@router.get("/users/{user_id}/companies")
async def api_get_user_companies(user_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] not in (UserRole.DIRECTOR, UserRole.MANAGER):
        raise HTTPException(status_code=403, detail="Access denied")
    mappings = await db.company_users.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    company_ids = [m["company_id"] for m in mappings]
    companies = []
    for cid in company_ids:
        comp = await db.companies.find_one({"id": cid, "status": "active"}, {"_id": 0})
        if comp:
            companies.append(comp)
    return companies


@router.get("/companies/{company_id}/users")
async def api_get_company_users(company_id: str, current_user: dict = Depends(get_current_user)):
    await require_company_access(current_user['user_id'], current_user['role'], company_id)
    users = await get_company_users(db, company_id)
    for u in users:
        if isinstance(u.get('created_at'), str):
            u['created_at'] = datetime.fromisoformat(u['created_at'])
    return users


@router.get("/companies/my-companies")
async def api_my_companies(current_user: dict = Depends(get_current_user)):
    return await get_user_companies(db, current_user['user_id'], current_user['role'])


# --- User Management ---

@router.get("/users", response_model=List[User])
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


@router.post("/users", response_model=User)
async def create_user(user_data: UserCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.DIRECTOR and user_data.role in (UserRole.MANAGER, UserRole.DIRECTOR, UserRole.GROUND_STAFF):
        pass
    elif current_user['role'] == UserRole.MANAGER and user_data.role == UserRole.GROUND_STAFF:
        user_data.manager_id = current_user['user_id']
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

    if user_data.role != UserRole.DIRECTOR:
        if current_user['role'] == UserRole.MANAGER:
            manager_companies = await db.company_users.find({"user_id": current_user['user_id']}, {"_id": 0}).to_list(100)
            for mc in manager_companies:
                await assign_user_to_company(db, user.id, mc["company_id"], current_user['user_id'])
        elif user_data.business_type:
            matching_company = await db.companies.find_one(
                {"business_type": user_data.business_type, "status": "active"}, {"_id": 0, "id": 1}
            )
            if matching_company:
                await assign_user_to_company(db, user.id, matching_company["id"], current_user['user_id'])
    return user


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Only directors can delete users")
    user_doc = await db.users.find_one({'id': user_id}, {'_id': 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    await log_audit('delete', 'user', user_id, current_user['user_id'], old_data=user_doc)
    await db.users.delete_one({'id': user_id})
    return {"message": "User deleted successfully"}


# --- Executive Report ---

@router.get("/director/executive-report")
async def director_executive_report(company_id: Optional[str] = None, period: str = "monthly",
                                    current_user: dict = Depends(get_current_user)):
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

    if company_id and company_id != "all":
        company_ids = [company_id]
    else:
        all_companies = await get_companies(db)
        company_ids = [c["id"] for c in all_companies]

    report = {"companies": [], "totals": {"revenue": 0, "expenses": 0, "profit": 0, "cash_position": 0, "inventory_value": 0}}

    for cid in company_ids:
        comp = await get_company(db, cid)
        if not comp:
            continue
        je_query = {"company_id": cid}
        entries_all = await db.journal_entries.find(je_query, {"_id": 0}).to_list(10000)
        entries = [e for e in entries_all if e.get("created_at", "") >= start_date or e.get("date", "") >= start_date]

        revenue = 0
        expenses = 0
        for e in entries:
            for line in e.get("lines", []):
                if line.get("account_type") == "income":
                    revenue += line.get("credit", 0)
                elif line.get("account_type") == "expense":
                    expenses += line.get("debit", 0)

        cash_query = {"company_id": cid, "account_name": {"$in": ["Cash", "Bank"]}}
        cash_ledgers = await db.ledger_balances.find(cash_query, {"_id": 0}).to_list(10)
        cash_position = sum(l.get("balance", 0) for l in cash_ledgers)

        inv_items = await db.inventory_items.find({"company_id": cid}, {"_id": 0}).to_list(5000)
        inv_value = sum(i.get("total_value", 0) for i in inv_items)

        txn_query = {"company_id": cid}
        txns = await db.transactions.find(txn_query, {"_id": 0}).to_list(10000)
        for t in txns:
            txn_date = t.get("date", "")
            if isinstance(txn_date, datetime):
                txn_date = txn_date.isoformat()
            if txn_date >= start_date:
                if t.get("transaction_type") == "income":
                    revenue += t.get("amount", 0)
                elif t.get("transaction_type") == "expense":
                    expenses += t.get("amount", 0)

        if revenue == 0 and expenses == 0 and comp.get("business_type"):
            btype = comp["business_type"]
            bt_txns = await db.transactions.find({"business_type": btype, "company_id": None}, {"_id": 0}).to_list(10000)
            for t in bt_txns:
                txn_date = t.get("date", "")
                if isinstance(txn_date, datetime):
                    txn_date = txn_date.isoformat()
                if txn_date >= start_date:
                    if t.get("transaction_type") == "income":
                        revenue += t.get("amount", 0)
                    elif t.get("transaction_type") == "expense":
                        expenses += t.get("amount", 0)

        comp_report = {
            "company_id": cid, "company_name": comp["name"], "business_type": comp["business_type"],
            "revenue": round(revenue, 2), "expenses": round(expenses, 2), "profit": round(revenue - expenses, 2),
            "cash_position": round(cash_position, 2), "inventory_value": round(inv_value, 2),
        }
        report["companies"].append(comp_report)
        report["totals"]["revenue"] += revenue
        report["totals"]["expenses"] += expenses
        report["totals"]["profit"] += (revenue - expenses)
        report["totals"]["cash_position"] += cash_position
        report["totals"]["inventory_value"] += inv_value

    report["totals"] = {k: round(v, 2) for k, v in report["totals"].items()}
    report["period"] = period
    report["company_count"] = len(company_ids)
    return report
