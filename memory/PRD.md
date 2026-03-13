# Multi-Business ERP Application — PRD

## Original Problem Statement
Build a comprehensive multi-business ERP application with role-based access control, multi-tenancy, and features including task management, accounting, inventory, tracking, reporting, and AI-powered analytics. Replace the existing accounting system with an Odoo-style comprehensive double-entry bookkeeping system with AI-powered assistance including bill photo scanning. Add Odoo-style inventory system, GST in accounting, advance payment handling, AI chat confirmation, and custom role-based access control.

## User Personas
- **Director**: Full access across all companies, admin-level controls, accounting management, role management
- **Manager**: Company-specific management, task delegation, team oversight (permissions controlled by Director via custom roles)
- **Ground Staff**: Task execution, daily operations (permissions controlled by Director via custom roles)

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn/UI + Recharts
- **Backend**: FastAPI + MongoDB (motor) + Modular Routes
- **Auth**: JWT tokens, RBAC with custom role permissions
- **AI**: OpenAI GPT-4o (vision) + GPT-4o-mini (text) via Emergent LLM Key

## What's Been Implemented

### GST in Accounting — COMPLETED Mar 2026
- Intra-State (CGST + SGST) and Inter-State (IGST) GST types
- GST rates: 0%, 5%, 12%, 18%, 28% per line item
- Separate GL accounts: 2210 CGST Output, 2211 SGST Output, 2212 IGST Output, 2220-2222 Input
- Invoice creation auto-generates GST journal lines (CGST/SGST split or IGST)
- Invoice list and detail show GST amounts and type
- Pydantic models updated: InvoiceLineCreate.gst_rate, InvoiceCreate.gst_type
- DB migrated: Added GST accounts to all existing companies

### Advance Payment Handling — COMPLETED Mar 2026
- Register advance payments with is_advance checkbox
- Advance payments tracked with advance_balance field
- Filter advance payments: GET /api/acc/payments?is_advance=true
- Apply advance to invoices: advance_adjustment reduces amount_residual
- Frontend shows advance section, ADV badge, balance tracking
- Accounts: 2250 Advance from Customers, 1350 Advance to Suppliers

### AI Chat Confirmation — COMPLETED Mar 2026
- AI chat returns proposed entries without auto-posting (auto_post=false)
- Frontend shows "Confirm & Post" and "Discard" buttons for transactions
- "AI will always ask for confirmation before posting" badge visible
- Proposed journal entries displayed with account names, debit/credit

### Custom Role-Based Access Control — COMPLETED Mar 2026
- Director creates custom roles with 19 granular permissions
- Roles assigned to managers and ground staff via Users page
- Navigation items filtered based on user's actual permissions
- Dashboard always visible; custom role users see only permitted sections
- Location tracking always ON for managers and ground staff (no toggle)

### Odoo-Style Inventory System — COMPLETED Mar 2026
- 8-tab module: Overview, Products, Moves, Adjust, Warehouses, Reorder, Valuation, Config
- Products CRUD with SKU, barcode, categories, UOMs, GST, tracking
- Stock moves with draft→done workflow
- Inventory adjustments, warehouse/location management
- Reorder alerts, stock valuation, categories, UOMs

### Accounting System (Odoo-Style) — COMPLETED
- Full double-entry bookkeeping with Chart of Accounts
- Invoicing, Payments, Journal Entries, Reports, Configuration

### AI Accounting Features — COMPLETED
- AI Chat, Bill Scanner (GPT-4o vision), Invoice Extraction, Categorization
- Reconciliation, Financial Q&A, Cash Forecast, Anomaly Detection

## Available Permissions (19)
view_dashboard, view_inventory, edit_inventory, view_accounting, edit_accounting, manage_tasks, manage_users, manage_indents, view_reports, create_reports, manage_companies, view_audit_log, view_tracking, view_reconciliation, manage_roles, view_settings, view_executive, view_daily_summary, view_payroll

## Key DB Schema Changes
- **odoo_accounts**: Added 2210-2212 (CGST/SGST/IGST Output), 2220-2222 (Input), 2250 (Advance from Customers), 1350 (Advance to Suppliers)
- **odoo_moves**: Added gst_type, advance_adjustment fields. invoice_lines now have gst_rate, gst_type
- **odoo_payments**: Added is_advance, advance_balance fields

## Backlog
- P1: Build native Android/iOS app (PWA ready)
- P2: True AI predictive analytics
- P2: Full PWA offline sync
- P3: Deprecate old inventory system files

## Test Credentials
- Director: director@sp.com / password123
- Manager: manager@sp.com / password123
- Ground Staff: staff@sp.com / password123
- Custom Role User: arun@sp.com / password123
