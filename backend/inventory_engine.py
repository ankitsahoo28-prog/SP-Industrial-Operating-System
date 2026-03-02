"""
Multi-Business Inventory Management Engine
Supports: Slag Crusher, Stone Crusher, FL Store, Transport, Petrol Pump
"""
import uuid
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional

# Industry-specific item categories
BUSINESS_ITEM_CATEGORIES = {
    "slag_crushing": {
        "raw_materials": ["Raw Slag"],
        "finished_goods": ["Processed Slag", "Aggregate 10mm", "Aggregate 20mm", "Aggregate 40mm", "Slag Dust"],
        "consumables": ["Crusher Belts", "Lubricant", "Diesel"],
        "units": "MT",
    },
    "stone_crusher": {
        "raw_materials": ["Boulder", "Stone Block"],
        "finished_goods": ["Aggregate 10mm", "Aggregate 20mm", "Aggregate 40mm", "Stone Dust", "Gitti"],
        "consumables": ["Crusher Belts", "Lubricant", "Diesel"],
        "units": "MT",
    },
    "fl_shop": {
        "raw_materials": [],
        "finished_goods": ["Whisky", "Rum", "Vodka", "Beer", "Wine", "Brandy", "Gin", "Other Liquor"],
        "consumables": ["Bags", "Packaging"],
        "units": "Bottles",
    },
    "transport": {
        "raw_materials": [],
        "finished_goods": [],
        "consumables": ["Diesel", "Petrol", "Engine Oil", "Brake Oil", "Coolant"],
        "spare_parts": ["Tyres", "Battery", "Brake Pads", "Filters", "Belts", "Other Spare"],
        "vehicles": True,
        "units": "Units/Litres",
    },
    "petrol_pump": {
        "raw_materials": [],
        "finished_goods": ["Petrol", "Diesel", "CNG"],
        "consumables": ["Lubricants", "Engine Oil", "Gear Oil", "Coolant"],
        "units": "Litres/Units",
    },
    "hotel": {
        "raw_materials": ["Rice", "Wheat Flour", "Cooking Oil", "Vegetables", "Spices", "Dairy", "Meat", "Fish", "Eggs"],
        "finished_goods": ["Ready Meals", "Beverages"],
        "consumables": ["Bed Linen", "Towels", "Toiletries", "Cleaning Supplies", "Disposable Plates", "Tissue Paper"],
        "spare_parts": ["Light Bulbs", "Plumbing Parts", "AC Filters"],
        "units": "Kg/Units",
    },
}

DENSITY_PRESETS = {
    "Raw Slag": 1.8,
    "Processed Slag": 1.6,
    "Boulder": 2.5,
    "Aggregate 10mm": 1.5,
    "Aggregate 20mm": 1.55,
    "Aggregate 40mm": 1.6,
    "Stone Dust": 1.75,
    "Slag Dust": 1.7,
    "Gitti": 1.5,
}


async def seed_inventory_defaults(db: AsyncIOMotorDatabase):
    """Seed default inventory items for each business type if empty"""
    count = await db.inventory_items.count_documents({})
    if count > 0:
        return

    items = []
    for biz_type, categories in BUSINESS_ITEM_CATEGORIES.items():
        for cat_key in ["raw_materials", "finished_goods", "consumables", "spare_parts"]:
            cat_items = categories.get(cat_key, [])
            for item_name in cat_items:
                items.append({
                    "id": str(uuid.uuid4()),
                    "name": item_name,
                    "business_type": biz_type,
                    "category": cat_key,
                    "unit": "MT" if biz_type in ["slag_crushing", "stone_crusher"] else ("Bottles" if biz_type == "fl_shop" else ("Litres" if item_name in ["Petrol", "Diesel", "CNG", "Engine Oil", "Gear Oil", "Coolant", "Brake Oil"] else "Units")),
                    "current_stock": 0,
                    "min_stock_level": 10,
                    "avg_cost": 0,
                    "total_value": 0,
                    "density": DENSITY_PRESETS.get(item_name),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })
    if items:
        await db.inventory_items.insert_many(items)


async def record_stock_movement(db: AsyncIOMotorDatabase, item_id: str, movement_type: str,
                                 quantity: float, unit_price: float, reference_type: str,
                                 reference_id: str, user_id: str, business_type: str,
                                 notes: str = "", batch_number: str = None, party_name: str = None):
    """
    Record a stock movement and update inventory.
    movement_type: 'in' (purchase/production/return) or 'out' (sale/transfer/wastage/consumption)
    reference_type: 'purchase', 'sale', 'production', 'transfer', 'wastage', 'return', 'consumption', 'dip_reading'
    """
    item = await db.inventory_items.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise ValueError(f"Item not found: {item_id}")

    old_stock = item.get("current_stock", 0)
    old_value = item.get("total_value", 0)
    old_avg = item.get("avg_cost", 0)

    if movement_type == "in":
        new_stock = old_stock + quantity
        new_value = old_value + (quantity * unit_price)
        new_avg = new_value / new_stock if new_stock > 0 else 0
    else:
        if quantity > old_stock:
            raise ValueError(f"Insufficient stock. Available: {old_stock}, Requested: {quantity}")
        new_stock = old_stock - quantity
        new_value = new_stock * old_avg
        new_avg = old_avg

    movement = {
        "id": str(uuid.uuid4()),
        "item_id": item_id,
        "item_name": item["name"],
        "business_type": business_type,
        "movement_type": movement_type,
        "reference_type": reference_type,
        "reference_id": reference_id,
        "quantity": quantity,
        "unit_price": unit_price,
        "total_amount": quantity * unit_price,
        "stock_before": old_stock,
        "stock_after": new_stock,
        "batch_number": batch_number,
        "party_name": party_name,
        "notes": notes,
        "created_by": user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.stock_movements.insert_one(movement)

    await db.inventory_items.update_one(
        {"id": item_id},
        {"$set": {
            "current_stock": round(new_stock, 3),
            "avg_cost": round(new_avg, 2),
            "total_value": round(new_value, 2),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    return movement


async def record_production(db: AsyncIOMotorDatabase, business_type: str, user_id: str,
                            input_item_id: str, input_qty: float,
                            outputs: list, notes: str = ""):
    """
    Record production: raw material → finished goods with yield tracking.
    outputs: [{"item_id": str, "quantity": float, "unit_price": float}]
    """
    batch_id = str(uuid.uuid4())

    input_item = await db.inventory_items.find_one({"id": input_item_id}, {"_id": 0})
    if not input_item:
        raise ValueError("Input item not found")
    if input_item["current_stock"] < input_qty:
        raise ValueError(f"Insufficient raw material. Available: {input_item['current_stock']}")

    # Deduct raw material
    await record_stock_movement(db, input_item_id, "out", input_qty,
                                 input_item.get("avg_cost", 0), "production", batch_id,
                                 user_id, business_type, f"Production batch {batch_id[:8]}")

    total_output = 0
    output_records = []
    for out in outputs:
        await record_stock_movement(db, out["item_id"], "in", out["quantity"],
                                     out.get("unit_price", 0), "production", batch_id,
                                     user_id, business_type, f"Production batch {batch_id[:8]}")
        total_output += out["quantity"]
        output_records.append({"item_id": out["item_id"], "quantity": out["quantity"]})

    yield_pct = (total_output / input_qty * 100) if input_qty > 0 else 0
    loss = input_qty - total_output
    loss_pct = (loss / input_qty * 100) if input_qty > 0 else 0

    production_record = {
        "id": batch_id,
        "business_type": business_type,
        "input_item_id": input_item_id,
        "input_item_name": input_item["name"],
        "input_quantity": input_qty,
        "outputs": output_records,
        "total_output": round(total_output, 3),
        "yield_percentage": round(yield_pct, 2),
        "loss_quantity": round(loss, 3),
        "loss_percentage": round(loss_pct, 2),
        "notes": notes,
        "created_by": user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.production_batches.insert_one(production_record)
    return production_record


async def record_transfer(db: AsyncIOMotorDatabase, from_biz: str, to_biz: str,
                           item_name: str, quantity: float, user_id: str, notes: str = ""):
    """Transfer inventory between businesses"""
    transfer_id = str(uuid.uuid4())

    from_item = await db.inventory_items.find_one(
        {"name": {"$regex": f"^{item_name}$", "$options": "i"}, "business_type": from_biz}, {"_id": 0}
    )
    if not from_item:
        raise ValueError(f"Item '{item_name}' not found in {from_biz}")

    to_item = await db.inventory_items.find_one(
        {"name": {"$regex": f"^{item_name}$", "$options": "i"}, "business_type": to_biz}, {"_id": 0}
    )
    if not to_item:
        to_item = {
            "id": str(uuid.uuid4()),
            "name": item_name,
            "business_type": to_biz,
            "category": from_item.get("category", "consumables"),
            "unit": from_item.get("unit", "Units"),
            "current_stock": 0, "min_stock_level": 5,
            "avg_cost": from_item.get("avg_cost", 0),
            "total_value": 0, "density": from_item.get("density"),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.inventory_items.insert_one(to_item)

    await record_stock_movement(db, from_item["id"], "out", quantity,
                                 from_item.get("avg_cost", 0), "transfer", transfer_id,
                                 user_id, from_biz, f"Transfer to {to_biz}")
    await record_stock_movement(db, to_item["id"], "in", quantity,
                                 from_item.get("avg_cost", 0), "transfer", transfer_id,
                                 user_id, to_biz, f"Transfer from {from_biz}")

    record = {
        "id": transfer_id, "from_business": from_biz, "to_business": to_biz,
        "item_name": item_name, "quantity": quantity,
        "unit_price": from_item.get("avg_cost", 0),
        "created_by": user_id, "created_at": datetime.now(timezone.utc).isoformat(), "notes": notes,
    }
    await db.inventory_transfers.insert_one(record)
    return record


async def lidar_scan_record(db: AsyncIOMotorDatabase, item_id: str, volume_m3: float,
                             user_id: str, business_type: str, notes: str = ""):
    """Record a LiDAR scan and compare with system stock"""
    item = await db.inventory_items.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise ValueError("Item not found")

    density = item.get("density") or DENSITY_PRESETS.get(item["name"], 1.5)
    scanned_weight = round(volume_m3 * density, 3)
    system_stock = item.get("current_stock", 0)
    variance = round(scanned_weight - system_stock, 3)
    variance_pct = round((variance / system_stock * 100) if system_stock > 0 else 0, 2)

    scan = {
        "id": str(uuid.uuid4()),
        "item_id": item_id, "item_name": item["name"],
        "business_type": business_type,
        "volume_m3": volume_m3, "density": density,
        "scanned_weight_mt": scanned_weight,
        "system_stock_mt": system_stock,
        "variance_mt": variance, "variance_pct": variance_pct,
        "notes": notes, "created_by": user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.lidar_scans.insert_one(scan)
    return scan


async def get_stock_register(db: AsyncIOMotorDatabase, business_type: Optional[str] = None):
    """Get current stock for all items, optionally filtered by business"""
    query = {}
    if business_type and business_type != "all":
        query["business_type"] = business_type
    items = await db.inventory_items.find(query, {"_id": 0}).sort("name", 1).to_list(5000)
    return items


async def get_low_stock_alerts(db: AsyncIOMotorDatabase, business_type: Optional[str] = None):
    """Items where current_stock < min_stock_level"""
    query = {"$expr": {"$lt": ["$current_stock", "$min_stock_level"]}}
    if business_type and business_type != "all":
        query["business_type"] = business_type
    items = await db.inventory_items.find(query, {"_id": 0}).to_list(500)
    return items


async def get_inventory_dashboard(db: AsyncIOMotorDatabase):
    """Consolidated inventory dashboard for owner"""
    pipeline = [
        {"$group": {
            "_id": "$business_type",
            "total_items": {"$sum": 1},
            "total_value": {"$sum": "$total_value"},
            "total_stock": {"$sum": "$current_stock"},
        }}
    ]
    biz_stats = await db.inventory_items.aggregate(pipeline).to_list(20)

    total_value = sum(b["total_value"] for b in biz_stats)
    total_items = sum(b["total_items"] for b in biz_stats)

    low_stock = await db.inventory_items.count_documents(
        {"$expr": {"$lt": ["$current_stock", "$min_stock_level"]}}
    )

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    today_movements = await db.stock_movements.count_documents({"created_at": {"$gte": today_start}})

    today_sales = await db.stock_movements.aggregate([
        {"$match": {"reference_type": "sale", "created_at": {"$gte": today_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
    ]).to_list(1)
    daily_sales = today_sales[0]["total"] if today_sales else 0

    productions = await db.production_batches.count_documents({"created_at": {"$gte": today_start}})

    return {
        "total_stock_value": round(total_value, 2),
        "total_items": total_items,
        "low_stock_alerts": low_stock,
        "daily_sales": round(daily_sales, 2),
        "daily_movements": today_movements,
        "daily_productions": productions,
        "business_stats": [
            {
                "business_type": b["_id"],
                "total_items": b["total_items"],
                "total_value": round(b["total_value"], 2),
            }
            for b in biz_stats
        ],
    }


async def get_petrol_pump_dip_history(db: AsyncIOMotorDatabase):
    """Get dip reading history for petrol pump"""
    readings = await db.stock_movements.find(
        {"business_type": "petrol_pump", "reference_type": "dip_reading"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return readings
