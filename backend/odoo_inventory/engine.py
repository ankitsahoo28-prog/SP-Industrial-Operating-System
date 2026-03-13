"""Odoo-style Inventory Engine - Core business logic for inventory management."""
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid


async def seed_inventory(db, company_id: str):
    """Seed default inventory data for a company."""
    existing = await db.inv_warehouses.find_one({"company_id": company_id}, {"_id": 0})
    if existing:
        return

    now = datetime.now(timezone.utc).isoformat()
    wh_id = str(uuid.uuid4())

    # Default warehouse with locations
    locations = [
        {"id": str(uuid.uuid4()), "name": "Stock", "code": "WH/Stock", "location_type": "internal", "warehouse_id": wh_id, "company_id": company_id, "parent_id": None, "created_at": now},
        {"id": str(uuid.uuid4()), "name": "Input", "code": "WH/Input", "location_type": "internal", "warehouse_id": wh_id, "company_id": company_id, "parent_id": None, "created_at": now},
        {"id": str(uuid.uuid4()), "name": "Output", "code": "WH/Output", "location_type": "internal", "warehouse_id": wh_id, "company_id": company_id, "parent_id": None, "created_at": now},
        {"id": str(uuid.uuid4()), "name": "Scrap", "code": "WH/Scrap", "location_type": "scrap", "warehouse_id": wh_id, "company_id": company_id, "parent_id": None, "created_at": now},
    ]
    await db.inv_warehouses.insert_one({
        "id": wh_id, "name": "Main Warehouse", "code": "WH", "company_id": company_id,
        "address": "", "active": True, "created_at": now,
    })
    for loc in locations:
        await db.inv_locations.insert_one(loc)

    # Default product categories
    cats = [
        {"id": str(uuid.uuid4()), "name": "All", "parent_id": None, "company_id": company_id, "created_at": now},
        {"id": str(uuid.uuid4()), "name": "Raw Materials", "parent_id": None, "company_id": company_id, "created_at": now},
        {"id": str(uuid.uuid4()), "name": "Finished Goods", "parent_id": None, "company_id": company_id, "created_at": now},
        {"id": str(uuid.uuid4()), "name": "Consumables", "parent_id": None, "company_id": company_id, "created_at": now},
        {"id": str(uuid.uuid4()), "name": "Services", "parent_id": None, "company_id": company_id, "created_at": now},
    ]
    for c in cats:
        await db.inv_categories.insert_one(c)

    # Default UoMs
    uoms = [
        {"id": str(uuid.uuid4()), "name": "Units", "code": "pcs", "category": "Unit", "ratio": 1.0, "company_id": company_id},
        {"id": str(uuid.uuid4()), "name": "Kg", "code": "kg", "category": "Weight", "ratio": 1.0, "company_id": company_id},
        {"id": str(uuid.uuid4()), "name": "Grams", "code": "g", "category": "Weight", "ratio": 0.001, "company_id": company_id},
        {"id": str(uuid.uuid4()), "name": "Liters", "code": "L", "category": "Volume", "ratio": 1.0, "company_id": company_id},
        {"id": str(uuid.uuid4()), "name": "Meters", "code": "m", "category": "Length", "ratio": 1.0, "company_id": company_id},
        {"id": str(uuid.uuid4()), "name": "Dozen", "code": "dz", "category": "Unit", "ratio": 12.0, "company_id": company_id},
        {"id": str(uuid.uuid4()), "name": "Box", "code": "box", "category": "Unit", "ratio": 1.0, "company_id": company_id},
    ]
    for u in uoms:
        await db.inv_uoms.insert_one(u)


async def create_product(db, company_id: str, data: dict) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    prod_id = str(uuid.uuid4())
    sku = data.get("sku") or f"SKU-{prod_id[:8].upper()}"
    product = {
        "id": prod_id, "name": data["name"], "sku": sku,
        "barcode": data.get("barcode", ""),
        "product_type": data.get("product_type", "storable"),  # storable, consumable, service
        "category_id": data.get("category_id", ""),
        "uom_id": data.get("uom_id", ""),
        "cost_price": float(data.get("cost_price", 0)),
        "sale_price": float(data.get("sale_price", 0)),
        "description": data.get("description", ""),
        "min_stock": float(data.get("min_stock", 0)),
        "max_stock": float(data.get("max_stock", 0)),
        "reorder_point": float(data.get("reorder_point", 0)),
        "reorder_qty": float(data.get("reorder_qty", 0)),
        "weight": float(data.get("weight", 0)),
        "volume": float(data.get("volume", 0)),
        "tracking": data.get("tracking", "none"),  # none, lot, serial
        "valuation_method": data.get("valuation_method", "average"),  # average, fifo
        "active": True, "company_id": company_id,
        "qty_on_hand": 0, "qty_reserved": 0, "qty_available": 0,
        "total_value": 0, "image_url": data.get("image_url", ""),
        "hsn_code": data.get("hsn_code", ""),
        "gst_rate": float(data.get("gst_rate", 18)),
        "created_at": now,
    }
    await db.inv_products.insert_one(product)
    product.pop("_id", None)
    return product


async def create_stock_move(db, company_id: str, data: dict, user_id: str) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    move_id = str(uuid.uuid4())
    move = {
        "id": move_id, "company_id": company_id,
        "product_id": data["product_id"],
        "source_location_id": data.get("source_location_id", ""),
        "dest_location_id": data.get("dest_location_id", ""),
        "quantity": float(data["quantity"]),
        "uom_id": data.get("uom_id", ""),
        "move_type": data.get("move_type", "internal"),  # receipt, delivery, internal, adjustment, scrap
        "reference": data.get("reference", ""),
        "lot_number": data.get("lot_number", ""),
        "serial_number": data.get("serial_number", ""),
        "unit_cost": float(data.get("unit_cost", 0)),
        "state": "draft",  # draft, confirmed, done, cancelled
        "partner_id": data.get("partner_id", ""),
        "scheduled_date": data.get("scheduled_date", now[:10]),
        "done_date": None,
        "created_by": user_id, "created_at": now,
    }
    await db.inv_stock_moves.insert_one(move)
    move.pop("_id", None)
    return move


async def confirm_stock_move(db, move_id: str, company_id: str):
    move = await db.inv_stock_moves.find_one({"id": move_id, "company_id": company_id}, {"_id": 0})
    if not move:
        raise ValueError("Stock move not found")
    if move["state"] != "draft":
        raise ValueError("Only draft moves can be confirmed")

    now = datetime.now(timezone.utc).isoformat()
    qty = move["quantity"]
    product_id = move["product_id"]

    product = await db.inv_products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise ValueError("Product not found")

    new_qty = product.get("qty_on_hand", 0)
    move_type = move["move_type"]

    if move_type in ("receipt", "adjustment") and move.get("dest_location_id"):
        new_qty += qty
    elif move_type == "delivery" and move.get("source_location_id"):
        if new_qty < qty and product.get("product_type") == "storable":
            raise ValueError(f"Insufficient stock. Available: {new_qty}, Requested: {qty}")
        new_qty -= qty
    elif move_type == "scrap":
        new_qty -= qty
    elif move_type == "internal":
        pass  # No change in total qty for internal transfers

    cost = move.get("unit_cost") or product.get("cost_price", 0)
    total_value = new_qty * cost

    await db.inv_products.update_one({"id": product_id}, {"$set": {
        "qty_on_hand": round(new_qty, 4),
        "qty_available": round(new_qty - product.get("qty_reserved", 0), 4),
        "total_value": round(total_value, 2),
    }})

    await db.inv_stock_moves.update_one({"id": move_id}, {"$set": {
        "state": "done", "done_date": now, "unit_cost": cost,
    }})

    # Record stock quant (location-level stock)
    if move.get("dest_location_id") and move_type in ("receipt", "internal", "adjustment"):
        await db.inv_quants.update_one(
            {"product_id": product_id, "location_id": move["dest_location_id"], "company_id": company_id,
             "lot_number": move.get("lot_number", "")},
            {"$inc": {"quantity": qty}, "$set": {"updated_at": now}},
            upsert=True,
        )
    if move.get("source_location_id") and move_type in ("delivery", "internal", "scrap"):
        await db.inv_quants.update_one(
            {"product_id": product_id, "location_id": move["source_location_id"], "company_id": company_id,
             "lot_number": move.get("lot_number", "")},
            {"$inc": {"quantity": -qty}, "$set": {"updated_at": now}},
            upsert=True,
        )

    return {"status": "done", "new_qty": new_qty}


async def inventory_adjustment(db, company_id: str, data: dict, user_id: str) -> dict:
    """Create an inventory adjustment to set stock to a specific quantity."""
    product = await db.inv_products.find_one({"id": data["product_id"], "company_id": company_id}, {"_id": 0})
    if not product:
        raise ValueError("Product not found")

    current_qty = product.get("qty_on_hand", 0)
    new_qty = float(data["new_quantity"])
    diff = new_qty - current_qty

    if abs(diff) < 0.001:
        return {"status": "no_change", "quantity": current_qty}

    move_data = {
        "product_id": data["product_id"],
        "quantity": abs(diff),
        "move_type": "adjustment",
        "reference": data.get("reason", "Inventory Adjustment"),
        "source_location_id": data.get("location_id", ""),
        "dest_location_id": data.get("location_id", ""),
        "unit_cost": data.get("unit_cost") or product.get("cost_price", 0),
    }

    move = await create_stock_move(db, company_id, move_data, user_id)

    # Directly set the quantity
    cost = move_data["unit_cost"]
    await db.inv_products.update_one({"id": data["product_id"]}, {"$set": {
        "qty_on_hand": round(new_qty, 4),
        "qty_available": round(new_qty - product.get("qty_reserved", 0), 4),
        "total_value": round(new_qty * cost, 2),
    }})
    await db.inv_stock_moves.update_one({"id": move["id"]}, {"$set": {"state": "done", "done_date": datetime.now(timezone.utc).isoformat()}})

    return {"status": "adjusted", "old_qty": current_qty, "new_qty": new_qty, "diff": diff, "move_id": move["id"]}


async def check_reorder_rules(db, company_id: str):
    """Check all products for reorder rules and return suggestions."""
    products = await db.inv_products.find(
        {"company_id": company_id, "active": True, "reorder_point": {"$gt": 0}},
        {"_id": 0}
    ).to_list(1000)

    suggestions = []
    for p in products:
        if p.get("qty_on_hand", 0) <= p.get("reorder_point", 0):
            suggestions.append({
                "product_id": p["id"], "product_name": p["name"], "sku": p.get("sku", ""),
                "current_qty": p.get("qty_on_hand", 0),
                "reorder_point": p.get("reorder_point", 0),
                "reorder_qty": p.get("reorder_qty", 0) or p.get("max_stock", 0) - p.get("qty_on_hand", 0),
                "min_stock": p.get("min_stock", 0), "max_stock": p.get("max_stock", 0),
            })
    return suggestions
