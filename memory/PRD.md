# SP Industrial Operating System - Product Requirements

## Problem Statement
Build a comprehensive, multi-business, multi-company ERP application named "SP" with role-based access, AI accounting, inventory management, and full data isolation per company.

## Architecture
- **Frontend:** React + Tailwind CSS + Shadcn/UI + Recharts, port 3000
- **Backend:** FastAPI + Python, port 8001
- **Database:** MongoDB via motor (async)
- **Auth:** JWT tokens
- **AI:** OpenAI GPT-4o-mini via emergentintegrations (Emergent LLM Key)

## Core Modules

### 1. Multi-Company Management (DONE - Feb 2026)
- **Company CRUD**: Create, edit, soft-delete, restore, activate/deactivate
- **Auto-seeding**: New company auto-generates Chart of Accounts + default settings
- **User Assignment**: Director assigns managers/staff to companies
- **Company Selector**: Dropdown in header, persists in localStorage
- **Data Isolation**: Every query filters by company_id
- **Executive Dashboard**: Monthly/quarterly/yearly views with bar/pie charts, KPI cards
- **Consolidated vs Single**: Director can view all companies or drill into one

### 2. Role-Based Access Control (DONE)
- **Director**: Full access, create/delete companies, consolidated views, final authority
- **Manager/Accountant**: Select assigned companies only, accounting entries, inventory, tasks
- **Ground Staff**: View own tasks and reports only
- Self-registration with Director approval, forgot/reset password

### 3. Double-Entry Bookkeeping (DONE)
- Company-scoped Chart of Accounts, Journal Entries, Ledger Balances
- Auto financial reports: Trial Balance, P&L, Balance Sheet
- AI Accountant for natural language transaction input
- All entries tied to company_id

### 4. Comprehensive Inventory Management (DONE)
- 55+ seeded items across 6 business types (including hotel F&B)
- Stock movements, production batches, inter-business transfers
- LiDAR stock scanning with dimension-based volume estimation
- AI Inventory Assistant (natural language to stock movements)
- Low stock alerts, auto accounting integration

### 5. Director App Settings (DONE)
- Customize app name, logo, background video, primary color, tagline
- Login page dynamically reads settings

### 6. Internationalization - i18n (DONE)
- English, Hindi, Odia language support
- Language switcher in sidebar

### 7. Real AI Predictive Analytics (DONE)
- Genuine LLM analysis of actual financial + inventory data

### 8. Tasks, Indents, Reports, Exports (DONE)
- All company-scoped with company_id filtering

## Key API Endpoints

### Company Management
- `GET/POST /api/companies` - List/Create companies
- `PUT/DELETE /api/companies/{id}` - Update/Delete
- `POST /api/companies/{id}/restore|activate|deactivate`
- `POST /api/companies/assign-user|remove-user`
- `GET /api/companies/{id}/users`
- `GET /api/companies/my-companies` - Role-scoped
- `GET /api/director/executive-report?period=monthly|quarterly|yearly&company_id=X`

### Accounting (all accept ?company_id=X)
- `/api/journal-entries`, `/api/accounts`, `/api/ledger-balances`
- `/api/reports/trial-balance|profit-loss|balance-sheet`

### Inventory (all accept ?company_id=X)
- `/api/inv/*` - 14 endpoints

## DB Collections
- companies, company_users
- users, tasks, transactions, audit_logs
- accounts, journal_entries, ledger_balances
- inventory_items, stock_movements, production_batches, inventory_transfers, lidar_scans
- app_settings

## Credentials
- Director: director@sp.com / password123
- Manager: manager@sp.com / password123
- Staff: staff@sp.com / password123

## Pending / Backlog
- Geolocation tracking for ground staff
- Native mobile app
- Email-based password reset
- Full PWA offline sync
