# Multi-Business ERP Application — PRD

## Original Problem Statement
Build a comprehensive multi-business ERP application with: Odoo-style accounting & inventory, GST (IGST/SGST/CGST), advance payments, AI assistant with confirmation, custom role-based access control (director controls what manager/staff can see), always-on location tracking, WhatsApp notifications, and GSTR compliance reports.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn/UI + Recharts
- **Backend**: FastAPI + MongoDB (motor) + Modular Routes
- **Auth**: JWT tokens + RBAC with custom role permissions (19 permissions)
- **AI**: OpenAI GPT-4o (vision + text) via Emergent LLM Key
- **WhatsApp**: Twilio (when configured) for notifications, forgot password OTP
- **PWA**: Service worker with offline queue + background sync

## What's Been Implemented

### P0: AI Audit Trail — Mar 2026
- Audit trail logging on every approve/reject action in the AI Business Assistant
- Stats endpoint showing total approved, rejected, pending, and total actions
- Full Audit Trail UI tab with stats cards, filterable list, pagination
- Each audit entry records: action, user name, role, timestamp, source, results

### P1: AI Smart Learning — Mar 2026
- Correction mappings system: AI learns from user corrections (original → corrected text)
- Mappings categorized by field type: name, product, partner, account
- Smart Learning UI tab with mapping viewer, add dialog, delete capability
- Auto-detection: when user edits AI entries before approving, system detects changes and offers to save as corrections
- Learned corrections are included in AI prompts for future document processing

### GSTR Compliance Reports — Mar 2026
- GSTR-1: Outward supplies (B2B/B2C breakdown, HSN summary, tax totals)
- GSTR-3B: Monthly return (outward/inward supplies, ITC available, tax payable/refund, net payable)
- Month/Year picker for GST report period selection

### Role Templates — Mar 2026
- 5 pre-built templates: Accountant, Warehouse Manager, Field Supervisor, Sales Manager, Read-Only Auditor
- One-click create role from template

### WhatsApp Integration — Mar 2026
- Forgot password via WhatsApp OTP (6-digit code, 15-min expiry)
- Task assignment & status update notifications
- Low stock alerts, invoice notifications
- Graceful degradation when Twilio not configured
- **STATUS: BLOCKED on Twilio API keys**

### PWA Offline Sync — Mar 2026
- Enhanced service worker with IndexedDB offline queue
- Non-GET requests queued when offline, auto-synced when online
- Background sync for offline form submissions

### Previously Completed
- GST in Accounting (CGST+SGST intra-state, IGST inter-state)
- Advance Payment handling (is_advance, advance_balance, advance_adjustment)
- AI Chat Confirmation (confirm before posting)
- Custom Role-Based Access Control (19 permissions, director controls all)
- Location tracking always ON for manager/ground staff
- Odoo-Style Inventory (8 tabs)
- Odoo-Style Accounting (full double-entry)
- AI Accounting Features (chat, bill scanner, categorization, reconciliation, Q&A, forecast, anomaly)
- AI Business Assistant with Preview → Edit → Approve → Post workflow

## Available Permissions (19)
view_dashboard, view_inventory, edit_inventory, view_accounting, edit_accounting, manage_tasks, manage_users, manage_indents, view_reports, create_reports, manage_companies, view_audit_log, view_tracking, view_reconciliation, manage_roles, view_settings, view_executive, view_daily_summary, view_payroll

## Backlog
- P1: WhatsApp activation (awaiting Twilio credentials)
- P1: Native mobile app (PWA foundation ready)
- P2: Advanced AI features (voice commands, advanced OCR, auto GST classification, duplicate invoice detection, fraud alerts)
- P2: WhatsApp configuration through UI (currently .env only)
- P3: Automated GSTR filing submission
- P3: Remove legacy inventory code

## 3rd Party Integrations
- OpenAI GPT-4o via Emergent LLM Key
- Twilio WhatsApp (optional, env-configurable) — BLOCKED on keys
- SendGrid email (optional)

## Test Credentials
- Director: director@sp.com / password123
- Manager: manager@sp.com / password123
- Ground Staff: staff@sp.com / password123
- Custom Role User: arun@sp.com / password123
