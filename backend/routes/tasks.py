from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import logging

from database import db
from models import (Task, TaskCreate, TaskUpdate, UserRole, TaskStatus, Location, LocationCreate,
                    Report, ReportCreate, ReportType, Indent, IndentCreate, IndentAuthorize, IndentStatus,
                    InventoryItem)
from deps import (get_current_user, require_company_access, resolve_company_id,
                  log_audit, notify_user, notify_directors)
from email_service import (send_task_assignment_email, send_indent_approval_email,
                           send_task_update_email, send_indent_update_email)

logger = logging.getLogger(__name__)
router = APIRouter()


# --- Helper ---

async def update_inventory_stock(item_name: str, quantity: float, business_type: Optional[str]):
    item = await db.inventory.find_one({'item_name': item_name, 'business_type': business_type}, {'_id': 0})
    if item:
        new_stock = item['current_stock'] + quantity
        await db.inventory.update_one(
            {'id': item['id']},
            {'$set': {'current_stock': new_stock, 'updated_at': datetime.now(timezone.utc).isoformat()}}
        )
    else:
        new_item = InventoryItem(
            item_name=item_name, category='General', opening_stock=max(0, quantity),
            current_stock=max(0, quantity), unit='units', business_type=business_type
        )
        doc = new_item.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        doc['updated_at'] = doc['updated_at'].isoformat()
        await db.inventory.insert_one(doc)


# --- Tasks ---

@router.get("/tasks", response_model=List[Task])
async def get_tasks(business_type: Optional[str] = None, company_id: Optional[str] = None,
                    current_user: dict = Depends(get_current_user)):
    resolved_cid = await resolve_company_id(current_user['user_id'], current_user['role'], company_id)
    query = {}
    if current_user['role'] == UserRole.GROUND_STAFF:
        query['assigned_to'] = current_user['user_id']
    elif current_user['role'] == UserRole.MANAGER:
        team_ids = [doc['id'] for doc in await db.users.find({'manager_id': current_user['user_id']}, {'_id': 0, 'id': 1}).to_list(1000)]
        team_ids.append(current_user['user_id'])
        query['assigned_to'] = {'$in': team_ids}
    elif current_user['role'] == UserRole.DIRECTOR:
        if resolved_cid:
            query['company_id'] = resolved_cid
        elif business_type and business_type != 'all':
            query['business_type'] = business_type

    tasks = await db.tasks.find(query, {'_id': 0}).to_list(1000)
    for task in tasks:
        for field in ['created_at', 'updated_at', 'deadline']:
            if task.get(field) and isinstance(task[field], str):
                task[field] = datetime.fromisoformat(task[field])
    return tasks


@router.post("/tasks", response_model=Task)
async def create_task(task_data: TaskCreate, company_id: Optional[str] = None,
                      current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Access denied")
    resolved_cid = await resolve_company_id(current_user['user_id'], current_user['role'], company_id)
    if resolved_cid:
        await require_company_access(current_user['user_id'], current_user['role'], resolved_cid)

    task_dict = task_data.model_dump()
    task_dict['assigned_by'] = current_user['user_id']
    task_dict['business_type'] = current_user.get('business_type')
    task = Task(**task_dict)

    doc = task.model_dump()
    doc['company_id'] = resolved_cid
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    if doc.get('deadline'):
        doc['deadline'] = doc['deadline'].isoformat()
    await db.tasks.insert_one(doc)

    try:
        assigned_user = await db.users.find_one({'id': task.assigned_to}, {'_id': 0})
        assigner = await db.users.find_one({'id': current_user['user_id']}, {'_id': 0})
        if assigned_user and assigned_user.get('email'):
            deadline_str = task.deadline.strftime('%Y-%m-%d %H:%M') if task.deadline else None
            await send_task_assignment_email(assigned_user['email'], task.title, assigner.get('name', 'Manager'), deadline_str)
        await notify_user(task.assigned_to, "New Task Assigned",
                          f"{assigner.get('name','Manager')} assigned you: {task.title}", "task", "/tasks")
        # WhatsApp notification
        if assigned_user and assigned_user.get('phone') and assigned_user.get('whatsapp_notifications', True):
            from services.whatsapp import send_task_notification as wa_task_notify
            await wa_task_notify(assigned_user['phone'], task.title, assigner.get('name', 'Manager'))
    except Exception as e:
        logger.error(f"Failed to send task notification: {str(e)}")
    return task


@router.patch("/tasks/{task_id}", response_model=Task)
async def update_task(task_id: str, update_data: TaskUpdate, current_user: dict = Depends(get_current_user)):
    task_doc = await db.tasks.find_one({'id': task_id}, {'_id': 0})
    if not task_doc:
        raise HTTPException(status_code=404, detail="Task not found")
    if current_user['role'] != UserRole.DIRECTOR:
        if task_doc.get('assigned_to') != current_user['user_id'] and task_doc.get('assigned_by') != current_user['user_id']:
            raise HTTPException(status_code=403, detail="Not authorized to update this task")

    update_dict = update_data.model_dump(exclude_unset=True)
    update_dict['updated_at'] = datetime.now(timezone.utc).isoformat()
    await db.tasks.update_one({'id': task_id}, {'$set': update_dict})

    updated_doc = await db.tasks.find_one({'id': task_id}, {'_id': 0})
    for field in ['created_at', 'updated_at', 'deadline']:
        if updated_doc.get(field) and isinstance(updated_doc[field], str):
            updated_doc[field] = datetime.fromisoformat(updated_doc[field])

    try:
        if 'status' in update_dict and task_doc.get('assigned_by'):
            assigner = await db.users.find_one({'id': task_doc['assigned_by']}, {'_id': 0})
            updater = await db.users.find_one({'id': current_user['user_id']}, {'_id': 0})
            updater_name = updater.get('name', 'User') if updater else 'User'
            new_status = update_dict['status'].replace('_', ' ').title()
            if assigner and assigner.get('email'):
                await send_task_update_email(assigner['email'], task_doc.get('title', 'Task'), updater_name, update_dict['status'])
            await notify_user(task_doc['assigned_by'], "Task Updated",
                              f"{updater_name} changed '{task_doc.get('title','')}' to {new_status}", "task", "/tasks")
            # WhatsApp notification for task status update
            if assigner and assigner.get('phone') and assigner.get('whatsapp_notifications', True):
                from services.whatsapp import send_task_status_update as wa_status
                await wa_status(assigner['phone'], task_doc.get('title', 'Task'), new_status, updater_name)
    except Exception as e:
        logger.error(f"Task update notification failed: {e}")
    return Task(**updated_doc)


@router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Directors only")
    result = await db.tasks.delete_one({'id': task_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    await log_audit('delete', 'task', task_id, current_user['user_id'])
    return {"message": "Task deleted"}


# --- Locations ---

@router.post("/locations", response_model=Location)
async def record_location(location_data: LocationCreate, current_user: dict = Depends(get_current_user)):
    location_dict = location_data.model_dump()
    location_dict['user_id'] = current_user['user_id']
    location = Location(**location_dict)
    doc = location.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.locations.insert_one(doc)
    return location


@router.get("/locations/{user_id}", response_model=List[Location])
async def get_user_locations(user_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF and user_id != current_user['user_id']:
        raise HTTPException(status_code=403, detail="Access denied")
    locations = await db.locations.find({'user_id': user_id}, {'_id': 0}).sort('timestamp', -1).limit(100).to_list(100)
    for loc in locations:
        if isinstance(loc.get('timestamp'), str):
            loc['timestamp'] = datetime.fromisoformat(loc['timestamp'])
    return locations


# --- Reports ---

@router.post("/reports", response_model=Report)
async def create_report(report_data: ReportCreate, company_id: Optional[str] = None,
                        current_user: dict = Depends(get_current_user)):
    resolved_cid = await resolve_company_id(current_user['user_id'], current_user['role'], company_id)
    report_dict = report_data.model_dump()
    report_dict['user_id'] = current_user['user_id']
    if not report_dict.get('business_type'):
        report_dict['business_type'] = current_user.get('business_type')
    report = Report(**report_dict)
    doc = report.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    doc['company_id'] = resolved_cid
    await db.reports.insert_one(doc)

    if report.type == ReportType.INCOMING_STOCK:
        item_name = report.data.get('item_name')
        quantity = float(report.data.get('quantity', 0))
        if item_name and quantity:
            await update_inventory_stock(item_name, quantity, current_user.get('business_type'))
    elif report.type == ReportType.DISPATCH:
        item_name = report.data.get('item_name')
        quantity = float(report.data.get('quantity', 0))
        if item_name and quantity:
            await update_inventory_stock(item_name, -quantity, current_user.get('business_type'))

    try:
        if current_user['role'] == UserRole.GROUND_STAFF and current_user.get('manager_id'):
            reporter = await db.users.find_one({'id': current_user['user_id']}, {'_id': 0, 'name': 1})
            rname = reporter.get('name', 'Staff') if reporter else 'Staff'
            await notify_user(current_user['manager_id'], "New Report",
                              f"{rname} submitted a {report.type.value.replace('_',' ')} report", "report", "/reports")
    except Exception as e:
        logger.error(f"Report notification failed: {e}")
    return report


@router.get("/reports", response_model=List[Report])
async def get_reports(report_type: Optional[ReportType] = None, business_type: Optional[str] = None,
                      company_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    resolved_cid = await resolve_company_id(current_user['user_id'], current_user['role'], company_id)
    query = {}
    if report_type:
        query['type'] = report_type
    if current_user['role'] == UserRole.GROUND_STAFF:
        query['user_id'] = current_user['user_id']
    elif current_user['role'] == UserRole.MANAGER:
        team_ids = [doc['id'] for doc in await db.users.find({'manager_id': current_user['user_id']}, {'_id': 0, 'id': 1}).to_list(1000)]
        team_ids.append(current_user['user_id'])
        query['user_id'] = {'$in': team_ids}
    elif current_user['role'] == UserRole.DIRECTOR:
        if resolved_cid:
            query['company_id'] = resolved_cid
        elif business_type and business_type != 'all':
            query['business_type'] = business_type

    reports = await db.reports.find(query, {'_id': 0}).sort('timestamp', -1).to_list(1000)
    for report in reports:
        if isinstance(report.get('timestamp'), str):
            report['timestamp'] = datetime.fromisoformat(report['timestamp'])
    return reports


@router.delete("/reports/{report_id}")
async def delete_report(report_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Directors only")
    result = await db.reports.delete_one({'id': report_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    await log_audit('delete', 'report', report_id, current_user['user_id'])
    return {"message": "Report deleted"}


@router.put("/reports/{report_id}")
async def update_report(report_id: str, report_data: ReportCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Directors only")
    existing = await db.reports.find_one({'id': report_id}, {'_id': 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Report not found")
    update_fields = {"type": report_data.type.value, "data": report_data.data,
                     "updated_at": datetime.now(timezone.utc).isoformat()}
    await db.reports.update_one({'id': report_id}, {'$set': update_fields})
    await log_audit('update', 'report', report_id, current_user['user_id'])
    updated = await db.reports.find_one({'id': report_id}, {'_id': 0})
    if isinstance(updated.get('timestamp'), str):
        updated['timestamp'] = datetime.fromisoformat(updated['timestamp'])
    return updated


# --- Indents ---

@router.post("/indents", response_model=Indent)
async def create_indent(indent_data: IndentCreate, company_id: Optional[str] = None,
                        current_user: dict = Depends(get_current_user)):
    if current_user['role'] == UserRole.GROUND_STAFF:
        raise HTTPException(status_code=403, detail="Only managers can create indents")
    resolved_cid = await resolve_company_id(current_user['user_id'], current_user['role'], company_id)
    indent_dict = indent_data.model_dump()
    indent_dict['requested_by'] = current_user['user_id']
    indent_dict['business_type'] = current_user.get('business_type')
    indent = Indent(**indent_dict)
    doc = indent.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['company_id'] = resolved_cid
    await db.indents.insert_one(doc)
    return indent


@router.get("/indents", response_model=List[Indent])
async def get_indents(business_type: Optional[str] = None, company_id: Optional[str] = None,
                      current_user: dict = Depends(get_current_user)):
    resolved_cid = await resolve_company_id(current_user['user_id'], current_user['role'], company_id)
    query = {}
    if resolved_cid:
        query['company_id'] = resolved_cid
    elif current_user['role'] == UserRole.MANAGER:
        query['requested_by'] = current_user['user_id']
    elif current_user['role'] == UserRole.DIRECTOR and business_type and business_type != 'all':
        query['business_type'] = business_type
    indents = await db.indents.find(query, {'_id': 0}).sort('created_at', -1).to_list(1000)
    for indent in indents:
        if isinstance(indent.get('created_at'), str):
            indent['created_at'] = datetime.fromisoformat(indent['created_at'])
    return indents


@router.patch("/indents/{indent_id}/authorize", response_model=Indent)
async def authorize_indent(indent_id: str, auth_data: IndentAuthorize,
                           current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Only directors can authorize indents")
    update_dict = auth_data.model_dump()
    update_dict['authorized_by'] = current_user['user_id']
    await db.indents.update_one({'id': indent_id}, {'$set': update_dict})
    updated_doc = await db.indents.find_one({'id': indent_id}, {'_id': 0})
    if isinstance(updated_doc.get('created_at'), str):
        updated_doc['created_at'] = datetime.fromisoformat(updated_doc['created_at'])

    try:
        requester = await db.users.find_one({'id': updated_doc['requested_by']}, {'_id': 0})
        if requester and requester.get('email'):
            await send_indent_approval_email(requester['email'], indent_id, auth_data.status.value,
                                             len(updated_doc.get('items', [])))
    except Exception as e:
        logger.error(f"Failed to send indent notification email: {str(e)}")

    try:
        if current_user['role'] == UserRole.MANAGER:
            directors = await db.users.find({'role': UserRole.DIRECTOR, 'status': 'approved'},
                                            {'_id': 0, 'email': 1, 'name': 1}).to_list(10)
            updater = await db.users.find_one({'id': current_user['user_id']}, {'_id': 0})
            for d in directors:
                if d.get('email'):
                    await send_indent_update_email(d['email'], indent_id, updater.get('name', 'Manager'),
                                                   f"Indent {auth_data.status.value}")
    except Exception as e:
        logger.error(f"Failed to send indent director notification: {str(e)}")

    try:
        updater_name = (await db.users.find_one({'id': current_user['user_id']}, {'_id': 0, 'name': 1}))
        uname = updater_name.get('name', 'User') if updater_name else 'User'
        await notify_user(updated_doc['requested_by'], "Indent Update",
                          f"Your indent was {auth_data.status.value} by {uname}", "indent", "/indents")
        await notify_directors("Indent Authorized",
                               f"Indent {indent_id[:8]}... {auth_data.status.value} by {uname}", "indent", "/indents")
    except Exception as e:
        logger.error(f"In-app notification failed: {e}")
    return Indent(**updated_doc)


@router.delete("/indents/{indent_id}")
async def delete_indent(indent_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Directors only")
    result = await db.indents.delete_one({'id': indent_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Indent not found")
    await log_audit('delete', 'indent', indent_id, current_user['user_id'])
    return {"message": "Indent deleted"}
