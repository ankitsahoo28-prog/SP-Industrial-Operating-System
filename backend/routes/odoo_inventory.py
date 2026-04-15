"""Odoo-style Inventory API Routes."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid

from database import db
from deps import get_current_user, resolve_company_id
from models import UserRole
from odoo_inventory.engine import (
    seed_inventory, create_product, create_stock_move,
    confirm_stock_move, inventory_adjustment, check_reorder_rules,
)

router = APIRouter(prefix="/inv")


async def get_cid(current_user, company_id=None):
    cid = await resolve_company_id(current_user['user_id'], current_user['role'], company_id)
    if not cid:
        comp = await db.companies.find_one({"status": "active"}, {"_id": 0, "id": 1})
        cid = comp["id"] if comp else None
    if cid:
        existing = await db.inv_warehouses.find_one({"company_id": cid}, {"_id": 0})
        if not existing:
            await seed_inventory(db, cid)
    return cid


# ======== DASHBOARD ========
@router.get("/dashboard")
async def inv_dashboard(company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    if not cid:
        return {}

    total_products = await db.inv_products.count_documents({"company_id": cid, "active": True})
    total_value = 0
    low_stock = 0
    out_of_stock = 0

    products = await db.inv_products.find({"company_id": cid, "active": True}, {"_id": 0}).to_list(5000)
    for p in products:
        total_value += p.get("total_value", 0)
        if p.get("product_type") == "storable":
            if p.get("qty_on_hand", 0) <= 0:
                out_of_stock += 1
            elif p.get("reorder_point", 0) > 0 and p.get("qty_on_hand", 0) <= p.get("reorder_point", 0):
                low_stock += 1

    pending_receipts = await db.inv_stock_moves.count_documents({"company_id": cid, "move_type": "receipt", "state": "draft"})
    pending_deliveries = await db.inv_stock_moves.count_documents({"company_id": cid, "move_type": "delivery", "state": "draft"})
    total_moves_today = await db.inv_stock_moves.count_documents({
        "company_id": cid, "state": "done",
        "done_date": {"$gte": datetime.now(timezone.utc).strftime("%Y-%m-%d")}
    })
    warehouses = await db.inv_warehouses.count_documents({"company_id": cid, "active": True})

    return {
        "total_products": total_products, "total_value": round(total_value, 2),
        "low_stock": low_stock, "out_of_stock": out_of_stock,
        "pending_receipts": pending_receipts, "pending_deliveries": pending_deliveries,
        "total_moves_today": total_moves_today, "warehouses": warehouses,
    }


# ======== PRODUCTS ========
@router.get("/products")
async def list_products(company_id: Optional[str] = None, category_id: Optional[str] = None,
                        search: Optional[str] = None, product_type: Optional[str] = None,
                        current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    query = {"company_id": cid, "active": True}
    if category_id:
        query["category_id"] = category_id
    if product_type:
        query["product_type"] = product_type
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"sku": {"$regex": search, "$options": "i"}},
            {"barcode": {"$regex": search, "$options": "i"}},
        ]
    products = await db.inv_products.find(query, {"_id": 0}).sort("name", 1).to_list(2000)
    # Enrich with category/uom names
    cats = {c["id"]: c["name"] for c in await db.inv_categories.find({"company_id": cid}, {"_id": 0, "id": 1, "name": 1}).to_list(100)}
    uoms = {u["id"]: u["name"] for u in await db.inv_uoms.find({"company_id": cid}, {"_id": 0, "id": 1, "name": 1}).to_list(100)}
    for p in products:
        p["category_name"] = cats.get(p.get("category_id"), "")
        p["uom_name"] = uoms.get(p.get("uom_id"), "")
    return products


@router.get("/products/{product_id}")
async def get_product(product_id: str, current_user: dict = Depends(get_current_user)):
    p = await db.inv_products.find_one({"id": product_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Product not found")
    return p


class ProductCreate(BaseModel):
    name: str
    sku: Optional[str] = None
    barcode: Optional[str] = ""
    product_type: Optional[str] = "storable"
    category_id: Optional[str] = ""
    uom_id: Optional[str] = ""
    cost_price: Optional[float] = 0
    sale_price: Optional[float] = 0
    description: Optional[str] = ""
    min_stock: Optional[float] = 0
    max_stock: Optional[float] = 0
    reorder_point: Optional[float] = 0
    reorder_qty: Optional[float] = 0
    tracking: Optional[str] = "none"
    valuation_method: Optional[str] = "average"
    hsn_code: Optional[str] = ""
    gst_rate: Optional[float] = 18
    company_id: Optional[str] = None

@router.post("/products")
async def create_product_endpoint(data: ProductCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] == UserRole.GROUND_STAFF:
        raise HTTPException(403, "Access denied")
    cid = await get_cid(current_user, data.company_id)
    return await create_product(db, cid, data.dict())


@router.put("/products/{product_id}")
async def update_product(product_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    if current_user["role"] == UserRole.GROUND_STAFF:
        raise HTTPException(403, "Access denied")
    data.pop("id", None)
    data.pop("_id", None)
    data.pop("company_id", None)
    await db.inv_products.update_one({"id": product_id}, {"$set": data})
    return await db.inv_products.find_one({"id": product_id}, {"_id": 0})


# ======== WAREHOUSES & LOCATIONS ========
@router.get("/warehouses")
async def list_warehouses(company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    return await db.inv_warehouses.find({"company_id": cid}, {"_id": 0}).to_list(100)


class WarehouseCreate(BaseModel):
    name: str
    code: str
    address: Optional[str] = ""
    company_id: Optional[str] = None

@router.post("/warehouses")
async def create_warehouse(data: WarehouseCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] == UserRole.GROUND_STAFF:
        raise HTTPException(403, "Access denied")
    cid = await get_cid(current_user, data.company_id)
    wh_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    wh = {"id": wh_id, "name": data.name, "code": data.code, "address": data.address, "company_id": cid, "active": True, "created_at": now}
    await db.inv_warehouses.insert_one(wh)
    # Create default locations
    for loc_name in ["Stock", "Input", "Output"]:
        await db.inv_locations.insert_one({
            "id": str(uuid.uuid4()), "name": loc_name, "code": f"{data.code}/{loc_name}",
            "location_type": "internal", "warehouse_id": wh_id, "company_id": cid,
            "parent_id": None, "created_at": now,
        })
    wh.pop("_id", None)
    return wh


@router.get("/locations")
async def list_locations(company_id: Optional[str] = None, warehouse_id: Optional[str] = None,
                         current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    query = {"company_id": cid}
    if warehouse_id:
        query["warehouse_id"] = warehouse_id
    return await db.inv_locations.find(query, {"_id": 0}).to_list(500)


# ======== STOCK MOVES ========
@router.get("/stock-moves")
async def list_stock_moves(company_id: Optional[str] = None, move_type: Optional[str] = None,
                           state: Optional[str] = None, product_id: Optional[str] = None,
                           limit: int = 200, current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    query = {"company_id": cid}
    if move_type:
        query["move_type"] = move_type
    if state:
        query["state"] = state
    if product_id:
        query["product_id"] = product_id
    moves = await db.inv_stock_moves.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    # Enrich
    products = {p["id"]: p for p in await db.inv_products.find({"company_id": cid}, {"_id": 0, "id": 1, "name": 1, "sku": 1}).to_list(5000)}
    locations = {l["id"]: l for l in await db.inv_locations.find({"company_id": cid}, {"_id": 0, "id": 1, "name": 1, "code": 1}).to_list(500)}
    for m in moves:
        prod = products.get(m.get("product_id"), {})
        m["product_name"] = prod.get("name", "")
        m["product_sku"] = prod.get("sku", "")
        m["source_location_name"] = locations.get(m.get("source_location_id"), {}).get("name", "")
        m["dest_location_name"] = locations.get(m.get("dest_location_id"), {}).get("name", "")
    return moves


class StockMoveCreate(BaseModel):
    product_id: str
    quantity: float
    source_location_id: Optional[str] = ""
    dest_location_id: Optional[str] = ""
    move_type: Optional[str] = "internal"
    reference: Optional[str] = ""
    lot_number: Optional[str] = ""
    serial_number: Optional[str] = ""
    unit_cost: Optional[float] = 0
    partner_id: Optional[str] = ""
    scheduled_date: Optional[str] = ""
    company_id: Optional[str] = None

@router.post("/stock-moves")
async def create_stock_move_endpoint(data: StockMoveCreate, current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, data.company_id)
    return await create_stock_move(db, cid, data.dict(), current_user["user_id"])


@router.post("/stock-moves/{move_id}/confirm")
async def confirm_stock_move_endpoint(move_id: str, current_user: dict = Depends(get_current_user)):
    move = await db.inv_stock_moves.find_one({"id": move_id}, {"_id": 0})
    if not move:
        raise HTTPException(404, "Move not found")
    try:
        result = await confirm_stock_move(db, move_id, move["company_id"])
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/stock-moves/{move_id}/cancel")
async def cancel_stock_move(move_id: str, current_user: dict = Depends(get_current_user)):
    await db.inv_stock_moves.update_one({"id": move_id, "state": "draft"}, {"$set": {"state": "cancelled"}})
    return {"status": "cancelled"}


# ======== INVENTORY ADJUSTMENTS ========
class AdjustmentCreate(BaseModel):
    product_id: str
    new_quantity: float
    location_id: Optional[str] = ""
    reason: Optional[str] = "Inventory Adjustment"
    unit_cost: Optional[float] = None
    company_id: Optional[str] = None

@router.post("/adjustments")
async def create_adjustment(data: AdjustmentCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] == UserRole.GROUND_STAFF:
        raise HTTPException(403, "Access denied")
    cid = await get_cid(current_user, data.company_id)
    try:
        result = await inventory_adjustment(db, cid, data.dict(), current_user["user_id"])
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))


# ======== CATEGORIES ========
@router.get("/categories")
async def list_categories(company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    return await db.inv_categories.find({"company_id": cid}, {"_id": 0}).to_list(500)


class CategoryCreate(BaseModel):
    name: str
    parent_id: Optional[str] = None
    company_id: Optional[str] = None

@router.post("/categories")
async def create_category(data: CategoryCreate, current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, data.company_id)
    cat = {"id": str(uuid.uuid4()), "name": data.name, "parent_id": data.parent_id, "company_id": cid, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.inv_categories.insert_one(cat)
    cat.pop("_id", None)
    return cat


# ======== UoMs ========
@router.get("/uoms")
async def list_uoms(company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    return await db.inv_uoms.find({"company_id": cid}, {"_id": 0}).to_list(100)


# ======== REORDER RULES ========
@router.get("/reorder-check")
async def check_reorders(company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    return await check_reorder_rules(db, cid)


# ======== LOT/SERIAL TRACKING ========
@router.get("/lots")
async def list_lots(company_id: Optional[str] = None, product_id: Optional[str] = None,
                    current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    query = {"company_id": cid, "lot_number": {"$ne": ""}}
    if product_id:
        query["product_id"] = product_id
    moves = await db.inv_stock_moves.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    # Group by lot
    lots = {}
    for m in moves:
        key = f"{m['product_id']}:{m.get('lot_number', '')}"
        if key not in lots:
            lots[key] = {"product_id": m["product_id"], "lot_number": m.get("lot_number", ""), "moves": [], "total_qty": 0}
        lots[key]["moves"].append(m)
        if m["state"] == "done":
            if m["move_type"] in ("receipt", "adjustment"):
                lots[key]["total_qty"] += m["quantity"]
            elif m["move_type"] in ("delivery", "scrap"):
                lots[key]["total_qty"] -= m["quantity"]
    return list(lots.values())


# ======== STOCK VALUATION ========
@router.get("/valuation")
async def stock_valuation(company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    if current_user["role"] == UserRole.GROUND_STAFF:
        raise HTTPException(403, "Access denied")
    cid = await get_cid(current_user, company_id)
    products = await db.inv_products.find(
        {"company_id": cid, "active": True, "product_type": "storable"},
        {"_id": 0, "id": 1, "name": 1, "sku": 1, "qty_on_hand": 1, "cost_price": 1, "total_value": 1, "valuation_method": 1, "category_id": 1}
    ).sort("name", 1).to_list(5000)
    cats = {c["id"]: c["name"] for c in await db.inv_categories.find({"company_id": cid}, {"_id": 0, "id": 1, "name": 1}).to_list(100)}
    total = 0
    for p in products:
        p["category_name"] = cats.get(p.get("category_id"), "")
        val = p.get("total_value", 0) or (p.get("qty_on_hand", 0) * p.get("cost_price", 0))
        p["total_value"] = round(val, 2)
        total += val
    return {"products": products, "total_value": round(total, 2)}


# ======== STOCK QUANTS (location-level stock) ========
@router.get("/quants")
async def list_quants(company_id: Optional[str] = None, product_id: Optional[str] = None,
                      location_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    cid = await get_cid(current_user, company_id)
    query = {"company_id": cid}
    if product_id:
        query["product_id"] = product_id
    if location_id:
        query["location_id"] = location_id
    quants = await db.inv_quants.find(query, {"_id": 0}).to_list(5000)
    products = {p["id"]: p for p in await db.inv_products.find({"company_id": cid}, {"_id": 0, "id": 1, "name": 1, "sku": 1}).to_list(5000)}
    locations = {l["id"]: l for l in await db.inv_locations.find({"company_id": cid}, {"_id": 0, "id": 1, "name": 1, "code": 1}).to_list(500)}
    for q in quants:
        q["product_name"] = products.get(q.get("product_id"), {}).get("name", "")
        q["location_name"] = locations.get(q.get("location_id"), {}).get("name", "")
    return quants


# ============ DATA EXPORT ============

@router.get("/export/products")
async def export_products(company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Export all products with stock levels."""
    cid = company_id or await resolve_company_id(current_user['user_id'], current_user['role'], company_id)
    query = {} if not cid else {"company_id": cid}
    products = await db.inv_products.find(
        query,
        {"_id": 0, "id": 1, "name": 1, "sku": 1, "barcode": 1, "product_type": 1,
         "category_name": 1, "cost_price": 1, "sale_price": 1, "qty_on_hand": 1,
         "qty_reserved": 1, "qty_available": 1, "uom_name": 1, "hsn_code": 1,
         "gst_rate": 1, "valuation_method": 1, "min_stock": 1, "reorder_point": 1}
    ).to_list(10000)
    return products


@router.get("/export/stock-moves")
async def export_stock_moves(company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Export stock moves."""
    cid = company_id or await resolve_company_id(current_user['user_id'], current_user['role'], company_id)
    query = {} if not cid else {"company_id": cid}
    moves = await db.inv_stock_moves.find(
        query,
        {"_id": 0, "id": 1, "reference": 1, "product_name": 1, "product_sku": 1,
         "quantity": 1, "uom": 1, "source_location_name": 1, "destination_location_name": 1,
         "state": 1, "move_type": 1, "created_at": 1}
    ).sort("created_at", -1).to_list(10000)
    return moves

