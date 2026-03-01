import os
import asyncio
import logging
from typing import Optional
import resend

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'noreply@sp-industrial.com')

if RESEND_API_KEY and RESEND_API_KEY != 're_test_key_placeholder':
    resend.api_key = RESEND_API_KEY

async def send_email_async(to_email: str, subject: str, html_content: str) -> dict:
    """Send email using Resend API (async)"""
    if not RESEND_API_KEY or RESEND_API_KEY == 're_test_key_placeholder':
        logger.info(f"Email simulation: To={to_email}, Subject={subject}")
        return {"status": "simulated", "message": "Email service not configured"}
    
    params = {
        "from": SENDER_EMAIL,
        "to": [to_email],
        "subject": subject,
        "html": html_content
    }
    
    try:
        email = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Email sent to {to_email}")
        return {"status": "success", "email_id": email.get("id")}
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        return {"status": "failed", "error": str(e)}

async def send_task_assignment_email(to_email: str, task_title: str, assigned_by: str, deadline: Optional[str] = None):
    """Send task assignment notification email"""
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0F172A;">New Task Assigned</h2>
        <p>You have been assigned a new task:</p>
        <div style="background: #F1F5F9; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #F97316; margin: 0 0 10px 0;">{task_title}</h3>
            <p><strong>Assigned by:</strong> {assigned_by}</p>
            {f'<p><strong>Deadline:</strong> {deadline}</p>' if deadline else ''}
        </div>
        <p>Please log in to the SP Industrial OS to view details and update the task status.</p>
        <p style="color: #64748B; font-size: 12px; margin-top: 30px;">This is an automated notification from SP Industrial Operating System.</p>
    </div>
    """
    return await send_email_async(to_email, f"New Task: {task_title}", html)

async def send_indent_approval_email(to_email: str, indent_id: str, status: str, items_count: int):
    """Send indent approval/rejection notification"""
    status_text = "approved" if status == "approved" else "rejected"
    color = "#10B981" if status == "approved" else "#EF4444"
    
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0F172A;">Indent {status_text.title()}</h2>
        <div style="background: {color}20; padding: 15px; border-radius: 8px; border-left: 4px solid {color}; margin: 20px 0;">
            <p style="margin: 0;"><strong>Your indent request has been {status_text}</strong></p>
            <p style="margin: 10px 0 0 0; color: #64748B;">Items: {items_count}</p>
        </div>
        <p>Log in to view the full details.</p>
    </div>
    """
    return await send_email_async(to_email, f"Indent {status_text.title()}", html)