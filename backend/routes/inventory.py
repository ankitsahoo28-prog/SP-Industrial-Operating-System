from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import os
import logging

from database import db
from models import (UserRole, InventoryItem, InventoryItemCreate, InventoryItemCreateNew,
                    StockMovementRequest, ProductionRequest, TransferRequest, LidarScanRequest,
                    AiInventoryRequest)
from deps import get_current_user, require_company_access, resolve_company_id
from inventory_engine import (
    record_stock_movement, record_production, record_transfer, lidar_scan_record,
    get_low_stock_alerts, get_inventory_dashboard, get_petrol_pump_dip_history,
    BUSINESS_ITEM_CATEGORIES
)
from accounting_engine import create_journal_entry

logger = logging.getLogger(__name__)
router = APIRouter()


# --- Legacy Inventory ---

@router.post("/inventory", response_model=InventoryItem)
async def create_inventory_item(item_data: InventoryItemCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Only managers and directors can manage inventory")
    item_dict = item_data.model_dump()
    if not item_dict.get('business_type'):
        item_dict['business_type'] = current_user.get('business_type')
    item_dict['current_stock'] = item_dict['opening_stock']
    item = InventoryItem(**item_dict)
    doc = item.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    await db.inventory.insert_one(doc)
    return item


@router.get("/inventory", response_model=List[InventoryItem])
async def get_inventory(current_user: dict = Depends(get_current_user)):
    query = {}
    if current_user['role'] != UserRole.DIRECTOR and current_user.get('business_type'):
        query['business_type'] = current_user['business_type']
    items = await db.inventory.find(query, {'_id': 0}).sort('item_name', 1).to_list(1000)
    for item in items:
        if isinstance(item.get('created_at'), str):
            item['created_at'] = datetime.fromisoformat(item['created_at'])
        if isinstance(item.get('updated_at'), str):
            item['updated_at'] = datetime.fromisoformat(item['updated_at'])
    return items


# --- Comprehensive Inventory ---

@router.get("/legacy-inv/dashboard")
async def inventory_dashboard(company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")
    resolved_cid = await resolve_company_id(current_user['user_id'], current_user['role'], company_id)
    if resolved_cid:
        await require_company_access(current_user['user_id'], current_user['role'], resolved_cid)
    return await get_inventory_dashboard(db, resolved_cid)


@router.get("/legacy-inv/items")
async def get_inventory_items(business_type: Optional[str] = None, category: Optional[str] = None,
                              company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    resolved_cid = await resolve_company_id(current_user['user_id'], current_user['role'], company_id)
    query = {}
    if resolved_cid:
        await require_company_access(current_user['user_id'], current_user['role'], resolved_cid)
        query['company_id'] = resolved_cid
    else:
        biz = business_type
        if current_user['role'] != UserRole.DIRECTOR and current_user.get('business_type'):
            biz = current_user['business_type']
        if biz and biz != 'all':
            query['business_type'] = biz
    if category and category != 'all':
        query['category'] = category
    items = await db.inventory_items.find(query, {"_id": 0}).sort("name", 1).to_list(5000)
    return items


@router.post("/legacy-inv/items")
async def create_inventory_item_new(data: InventoryItemCreateNew, company_id: Optional[str] = None,
                                    current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")
    resolved_cid = await resolve_company_id(current_user['user_id'], current_user['role'], company_id)
    if resolved_cid:
        await require_company_access(current_user['user_id'], current_user['role'], resolved_cid)
    item = {
        "id": str(uuid.uuid4()), "name": data.name,
        "business_type": data.business_type or current_user.get('business_type'),
        "category": data.category, "unit": data.unit,
        "current_stock": data.opening_stock or 0, "min_stock_level": data.min_stock_level or 10,
        "avg_cost": data.avg_cost or 0, "total_value": (data.opening_stock or 0) * (data.avg_cost or 0),
        "density": data.density, "company_id": resolved_cid,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.inventory_items.insert_one(item)
    item.pop("_id", None)
    return item


@router.get("/legacy-inv/categories")
async def get_inventory_categories(current_user: dict = Depends(get_current_user)):
    return BUSINESS_ITEM_CATEGORIES


@router.post("/legacy-inv/stock-movement")
async def api_stock_movement(data: StockMovementRequest, company_id: Optional[str] = None,
                             current_user: dict = Depends(get_current_user)):
    resolved_cid = await resolve_company_id(current_user['user_id'], current_user['role'], company_id)
    if resolved_cid:
        await require_company_access(current_user['user_id'], current_user['role'], resolved_cid)
    biz = current_user.get('business_type')
    item = await db.inventory_items.find_one({"id": data.item_id}, {"_id": 0})
    if item:
        biz = item.get("business_type", biz)
    try:
        movement = await record_stock_movement(
            db, data.item_id, data.movement_type, data.quantity, data.unit_price,
            data.reference_type, str(uuid.uuid4()), current_user['user_id'], biz,
            data.notes or "", data.batch_number, data.party_name
        )
        movement.pop("_id", None)
        total = round(data.quantity * data.unit_price, 2)
        if total > 0 and data.reference_type in ("purchase", "sale"):
            try:
                if data.reference_type == "purchase":
                    lines = [{"account_name": "Inventory", "debit": total, "credit": 0},
                             {"account_name": data.party_name or "Accounts Payable", "debit": 0, "credit": total}]
                    narration = f"Inventory purchase: {data.quantity} units @ ₹{data.unit_price}"
                else:
                    lines = [{"account_name": data.party_name or "Accounts Receivable", "debit": total, "credit": 0},
                             {"account_name": "Sales", "debit": 0, "credit": total}]
                    narration = f"Inventory sale: {data.quantity} units @ ₹{data.unit_price}"
                await create_journal_entry(db, narration, lines, current_user['user_id'], biz, company_id)
            except Exception as e:
                logger.error(f"Auto journal entry failed: {e}")
        return movement
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/legacy-inv/movements")
async def get_stock_movements(business_type: Optional[str] = None, item_id: Optional[str] = None,
                              reference_type: Optional[str] = None, company_id: Optional[str] = None,
                              limit: int = 200, current_user: dict = Depends(get_current_user)):
    resolved_cid = await resolve_company_id(current_user['user_id'], current_user['role'], company_id)
    query = {}
    if resolved_cid:
        await require_company_access(current_user['user_id'], current_user['role'], resolved_cid)
        query['company_id'] = resolved_cid
    if item_id:
        query['item_id'] = item_id
    if reference_type and reference_type != 'all':
        query['reference_type'] = reference_type
    movements = await db.stock_movements.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return movements


@router.post("/legacy-inv/production")
async def api_production(data: ProductionRequest, current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")
    biz = current_user.get('business_type')
    if current_user['role'] == UserRole.DIRECTOR:
        item = await db.inventory_items.find_one({"id": data.input_item_id}, {"_id": 0})
        if item:
            biz = item.get("business_type", biz)
    try:
        record = await record_production(db, biz, current_user['user_id'],
                                         data.input_item_id, data.input_qty, data.outputs, data.notes or "")
        record.pop("_id", None)
        return record
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/legacy-inv/productions")
async def get_productions(business_type: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    biz = business_type
    if current_user['role'] != UserRole.DIRECTOR and current_user.get('business_type'):
        biz = current_user['business_type']
    if biz and biz != 'all':
        query['business_type'] = biz
    records = await db.production_batches.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return records


@router.post("/legacy-inv/transfer")
async def api_transfer(data: TransferRequest, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Only directors can transfer between businesses")
    try:
        record = await record_transfer(db, data.from_business, data.to_business,
                                       data.item_name, data.quantity, current_user['user_id'], data.notes or "")
        record.pop("_id", None)
        return record
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/legacy-inv/transfers")
async def get_transfers(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Only directors can view transfers")
    records = await db.inventory_transfers.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return records


@router.post("/legacy-inv/lidar-scan")
async def api_lidar_scan(data: LidarScanRequest, current_user: dict = Depends(get_current_user)):
    biz = current_user.get('business_type')
    if current_user['role'] == UserRole.DIRECTOR:
        item = await db.inventory_items.find_one({"id": data.item_id}, {"_id": 0})
        if item:
            biz = item.get("business_type", biz)
    try:
        scan = await lidar_scan_record(db, data.item_id, data.volume_m3, current_user['user_id'], biz, data.notes or "")
        scan.pop("_id", None)
        return scan
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/legacy-inv/lidar-scans")
async def get_lidar_scans(business_type: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    biz = business_type
    if current_user['role'] != UserRole.DIRECTOR and current_user.get('business_type'):
        biz = current_user['business_type']
    if biz and biz != 'all':
        query['business_type'] = biz
    scans = await db.lidar_scans.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return scans


@router.get("/legacy-inv/low-stock")
async def api_low_stock(business_type: Optional[str] = None, company_id: Optional[str] = None,
                        current_user: dict = Depends(get_current_user)):
    resolved_cid = await resolve_company_id(current_user['user_id'], current_user['role'], company_id)
    if resolved_cid:
        items = await db.inventory_items.find({"company_id": resolved_cid}, {"_id": 0}).to_list(5000)
        return [i for i in items if i.get("current_stock", 0) < i.get("min_stock_level", 10)]
    biz = business_type
    if current_user['role'] != UserRole.DIRECTOR and current_user.get('business_type'):
        biz = current_user['business_type']
    return await get_low_stock_alerts(db, biz)


@router.get("/legacy-inv/dip-history")
async def api_dip_history(current_user: dict = Depends(get_current_user)):
    return await get_petrol_pump_dip_history(db)


# --- AI Inventory Assistant ---

@router.post("/legacy-inv/ai-assistant")
async def ai_inventory_assistant(req: AiInventoryRequest, current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    emergent_key = os.environ.get('EMERGENT_LLM_KEY')
    biz = req.business_type or current_user.get('business_type') or 'all'
    items_query = {} if biz == 'all' else {"business_type": biz}
    inv_items = await db.inventory_items.find(items_query, {"_id": 0, "id": 1, "name": 1, "business_type": 1, "category": 1, "current_stock": 1, "unit": 1}).to_list(500)
    items_list = "\n".join([f"- ID:{i['id']} | {i['name']} | {i.get('business_type','')} | {i['category']} | Stock:{i['current_stock']} {i['unit']}" for i in inv_items[:100]])

    system_prompt = f"""You are an expert inventory management AI for SP GROUP industrial businesses.
Parse natural language inventory transactions into structured data.

AVAILABLE INVENTORY ITEMS:
{items_list}

RULES:
1. Match the item to the closest available inventory item by name
2. Determine movement_type: 'in' for purchases/receipts/returns, 'out' for sales/dispatches/wastage/consumption
3. Determine reference_type: purchase, sale, wastage, consumption, return, production
4. Extract quantity, unit_price, party_name if mentioned
5. If item not found, suggest creating it
6. Currency is INR

RESPOND IN THIS EXACT JSON FORMAT:
{{
  "understood": true,
  "summary": "Brief description of what was parsed",
  "movements": [
    {{
      "item_id": "matched item ID or null",
      "item_name": "item name",
      "movement_type": "in or out",
      "reference_type": "purchase/sale/wastage/consumption/return",
      "quantity": number,
      "unit_price": number,
      "party_name": "vendor/customer name or null",
      "notes": "any additional context"
    }}
  ],
  "needs_clarification": false,
  "clarification_question": "",
  "create_new_item": false,
  "new_item_suggestion": null
}}"""

    try:
        chat = LlmChat(api_key=emergent_key,
                        session_id=f"ai-inv-{current_user['user_id']}-{uuid.uuid4().hex[:6]}",
                        system_message=system_prompt).with_model("openai", "gpt-4o-mini")
        user_message = UserMessage(text=f"Parse this inventory transaction: {req.statement}")
        response = await chat.send_message(user_message)
        import json as json_lib
        import re
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', response)
        json_str = json_match.group(1).strip() if json_match else response.strip()
        parsed = json_lib.loads(json_str)
        return parsed
    except Exception as e:
        logger.error(f"AI Inventory Assistant error: {e}")
        return {"understood": False, "summary": "", "movements": [], "needs_clarification": True,
                "clarification_question": "Could not process. Please rephrase your inventory transaction.",
                "create_new_item": False, "new_item_suggestion": None}


@router.post("/legacy-inv/ai-execute")
async def ai_inventory_execute(movements: List[Dict[str, Any]], current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")
    results = []
    biz = current_user.get('business_type')
    for m in movements:
        if not m.get('item_id'):
            results.append({"status": "skipped", "reason": "No item_id"})
            continue
        try:
            item = await db.inventory_items.find_one({"id": m['item_id']}, {"_id": 0})
            if item:
                biz = item.get("business_type", biz)
            movement = await record_stock_movement(
                db, m['item_id'], m['movement_type'], float(m['quantity']),
                float(m.get('unit_price', 0)), m.get('reference_type', 'purchase'),
                str(uuid.uuid4()), current_user['user_id'], biz,
                m.get('notes', ''), None, m.get('party_name')
            )
            movement.pop("_id", None)
            total = round(float(m['quantity']) * float(m.get('unit_price', 0)), 2)
            if total > 0 and m.get('reference_type') in ('purchase', 'sale'):
                try:
                    if m['reference_type'] == 'purchase':
                        lines = [{"account_name": "Inventory", "debit": total, "credit": 0},
                                 {"account_name": m.get('party_name') or "Accounts Payable", "debit": 0, "credit": total}]
                        await create_journal_entry(db, f"AI: Purchase {m['quantity']} {m.get('item_name','')} @ ₹{m.get('unit_price',0)}", lines, current_user['user_id'], biz)
                    else:
                        lines = [{"account_name": m.get('party_name') or "Accounts Receivable", "debit": total, "credit": 0},
                                 {"account_name": "Sales", "debit": 0, "credit": total}]
                        await create_journal_entry(db, f"AI: Sale {m['quantity']} {m.get('item_name','')} @ ₹{m.get('unit_price',0)}", lines, current_user['user_id'], biz)
                except Exception as je:
                    logger.error(f"AI auto journal entry failed: {je}")
            results.append({"status": "success", "movement": movement})
        except ValueError as e:
            results.append({"status": "error", "reason": str(e)})
    return {"results": results}
