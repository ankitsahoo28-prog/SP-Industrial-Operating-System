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

### Custom Role-Based Access Control — COMPLETED Feb 2026
- Director creates custom roles with granular permissions (19 available permissions)
- Roles assigned to managers and ground staff via Users page
- Navigation items filtered based on user's actual permissions
- Dashboard always visible for all logged-in users
- Custom role users see only permitted sections (e.g., Accounting + Inventory only)
- Location tracking always ON for managers and ground staff (no toggle)

### Odoo-Style Inventory System — COMPLETED Feb 2026
- 8-tab inventory module: Overview, Products, Moves, Adjust, Warehouses, Reorder, Valuation, Config
- Products CRUD with SKU, barcode, categories, UOMs, GST, tracking
- Stock moves (receipt, delivery, internal, adjustment, scrap) with draft→done workflow
- Inventory adjustments with automatic stock level updates
- Warehouse and location management
- Reorder point alerts and suggestions
- Stock valuation by product with method filtering
- Configuration for categories and units of measure
- Auto-seeding of default warehouse, locations, categories, UOMs

### Accounting System (Odoo-Style) — COMPLETED
- Overview Dashboard with Recharts charts
- Invoicing: Create/Post/Cancel invoices & bills (with GST support)
- Payments: Register inbound/outbound payments (with advance payment handling)
- Journal Entries: Manual double-entry
- Reports: 8 report types
- Configuration: Chart of Accounts, Partners, Taxes, Journals, Fiscal Years

### AI Accounting Features — COMPLETED Feb 2026
1. AI Chat Assistant with confirmation before posting
2. Bill Photo Scanner (GPT-4o vision)
3. Smart Invoice Extraction
4. AI Transaction Categorization
5. AI-Powered Reconciliation
6. AI Financial Q&A
7. Predictive Cash Flow
8. Anomaly Detection

### Other Completed Features
- Backend modular architecture, Theme toggle, File uploads, Custom job roles
- Notifications (in-app + email), PWA foundation, Executive Dashboard

## Available Permissions (19)
view_dashboard, view_inventory, edit_inventory, view_accounting, edit_accounting, manage_tasks, manage_users, manage_indents, view_reports, create_reports, manage_companies, view_audit_log, view_tracking, view_reconciliation, manage_roles, view_settings, view_executive, view_daily_summary, view_payroll

## Bug Fixes Applied
- Token key mismatch, Invoice NoneType, ExecutiveReport wrong API, AI auto-post bugs
- Duplicate inventoryApi in api.js, Missing ValuationTab.js and ConfigTab.js
- Route conflict between old/new inventory routers (order swap in server.py)
- Custom role user seeing no nav items (Layout.js permission filtering redesign)

## Backlog
- P0: GST in Accounting (InvoicingTab/PaymentsTab updates) — needs integration testing
- P0: Advance Payment handling — needs integration testing
- P0: AI Chat Confirmation — needs integration testing
- P1: Build native Android/iOS app (PWA ready)
- P2: True AI predictive analytics
- P2: Full PWA offline sync
- P3: Deprecate old inventory system files completely

## 3rd Party Integrations
- OpenAI GPT-4o (Bill Scanner vision) + GPT-4o-mini (text AI) — Emergent LLM Key
- SendGrid (email notifications)

## Test Credentials
- Director: director@sp.com / password123
- Manager: manager@sp.com / password123
- Ground Staff: staff@sp.com / password123
- Custom Role User: arun@sp.com / password123
