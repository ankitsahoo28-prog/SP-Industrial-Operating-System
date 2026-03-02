"""
Company Management Engine
Handles company CRUD, user assignment, and data isolation.
"""
import uuid
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase
from accounting_engine import seed_chart_of_accounts


async def create_company(db: AsyncIOMotorDatabase, name: str, business_type: str, created_by: str,
                         fy_start: str = "April", gst_number: str = None, currency: str = "INR"):
    company_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    company = {
        "id": company_id,
        "name": name,
        "business_type": business_type,
        "fy_start": fy_start,
        "gst_number": gst_number,
        "currency": currency,
        "status": "active",  # active, inactive, deleted
        "created_by": created_by,
        "created_at": now,
        "updated_at": now,
    }
    await db.companies.insert_one(company)
    # Auto-seed Chart of Accounts for this company
    await seed_chart_of_accounts(db, company_id)
    return company


async def get_companies(db: AsyncIOMotorDatabase, include_deleted: bool = False):
    query = {} if include_deleted else {"status": {"$ne": "deleted"}}
    companies = await db.companies.find(query, {"_id": 0}).sort("name", 1).to_list(500)
    return companies


async def get_company(db: AsyncIOMotorDatabase, company_id: str):
    return await db.companies.find_one({"id": company_id}, {"_id": 0})


async def update_company(db: AsyncIOMotorDatabase, company_id: str, updates: dict):
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.companies.update_one({"id": company_id}, {"$set": updates})
    return await db.companies.find_one({"id": company_id}, {"_id": 0})


async def delete_company(db: AsyncIOMotorDatabase, company_id: str):
    """Soft delete — sets status to 'deleted'"""
    await db.companies.update_one({"id": company_id}, {"$set": {"status": "deleted", "updated_at": datetime.now(timezone.utc).isoformat()}})


async def restore_company(db: AsyncIOMotorDatabase, company_id: str):
    """Restore a deleted company"""
    await db.companies.update_one({"id": company_id}, {"$set": {"status": "active", "updated_at": datetime.now(timezone.utc).isoformat()}})


async def assign_user_to_company(db: AsyncIOMotorDatabase, user_id: str, company_id: str, assigned_by: str):
    existing = await db.company_users.find_one({"user_id": user_id, "company_id": company_id})
    if existing:
        return existing
    mapping = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "company_id": company_id,
        "assigned_by": assigned_by,
        "assigned_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.company_users.insert_one(mapping)
    return mapping


async def remove_user_from_company(db: AsyncIOMotorDatabase, user_id: str, company_id: str):
    await db.company_users.delete_one({"user_id": user_id, "company_id": company_id})


async def get_user_companies(db: AsyncIOMotorDatabase, user_id: str, role: str):
    """Director sees all active companies; others see only assigned."""
    if role == "director":
        return await db.companies.find({"status": {"$ne": "deleted"}}, {"_id": 0}).sort("name", 1).to_list(500)
    mappings = await db.company_users.find({"user_id": user_id}, {"_id": 0}).to_list(500)
    company_ids = [m["company_id"] for m in mappings]
    if not company_ids:
        return []
    return await db.companies.find({"id": {"$in": company_ids}, "status": "active"}, {"_id": 0}).sort("name", 1).to_list(500)


async def get_company_users(db: AsyncIOMotorDatabase, company_id: str):
    mappings = await db.company_users.find({"company_id": company_id}, {"_id": 0}).to_list(500)
    user_ids = [m["user_id"] for m in mappings]
    if not user_ids:
        return []
    return await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "password_hash": 0}).to_list(500)


async def validate_company_access(db: AsyncIOMotorDatabase, user_id: str, company_id: str, role: str):
    """Returns True if user has access to the company."""
    if role == "director":
        return True
    mapping = await db.company_users.find_one({"user_id": user_id, "company_id": company_id})
    return mapping is not None


async def seed_default_companies(db: AsyncIOMotorDatabase, director_id: str):
    """Seed default companies if none exist"""
    count = await db.companies.count_documents({})
    if count > 0:
        return
    businesses = [
        ("SP Petrol Pump", "petrol_pump"),
        ("SP Hotel", "hotel"),
        ("SP FL Shop", "fl_shop"),
        ("SP Transport", "transport"),
        ("SP Slag Crushing", "slag_crushing"),
        ("SP Stone Crusher", "stone_crusher"),
    ]
    for name, btype in businesses:
        await create_company(db, name, btype, director_id)
