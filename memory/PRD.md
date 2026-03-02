# SP Industrial Operations - Product Requirements Document

## Original Problem Statement
Build a multi-business ERP application "SP" for managing multiple companies (Petrol Pump, Hotel, FL Shop, Transport, Slag Crushing, Stone Crusher). Features include role-based access control (Director, Manager, Ground Staff), double-entry bookkeeping, inventory management, task management, real-time tracking, AI-powered tools, and cross-company reporting.

## User Personas
- **Director**: Full access, cross-company views, user management, financial oversight
- **Manager**: Company-scoped access, team management, day-to-day operations
- **Ground Staff**: Task execution, basic reporting

## Core Architecture
- **Frontend**: React + Tailwind CSS + Shadcn/UI, served on port 3000
- **Backend**: FastAPI + Python, served on port 8001
- **Database**: MongoDB via motor (async driver)
- **Auth**: JWT-based, role-based access control
- **Multi-Company**: CompanyContext on frontend, company_id filtering + resolve_company_id on backend

## What's Been Implemented (Complete)

### Foundation
- [x] JWT Authentication with role-based access (Director/Manager/Ground Staff)
- [x] Self-registration with director approval workflow
- [x] Forgot password flow
- [x] Multi-company architecture (CompanyContext + company_users mapping)
- [x] Company CRUD management for directors
- [x] Internationalization (i18n) - English, Hindi, Odia

### Accounting & Finance
- [x] Full double-entry bookkeeping (journal entries, accounts, ledger balances)
- [x] Trial Balance, Profit & Loss, Balance Sheet reports
- [x] Company-scoped data isolation (resolve_company_id for all endpoints)
- [x] AI Accountant (OpenAI GPT-4o via Emergent LLM key)
- [x] Transaction management with PDF/CSV exports

### Inventory
- [x] Comprehensive inventory system with categories per business type
- [x] Stock movements (in/out/wastage) with auto-journal entries
- [x] LiDAR volume scanner with camera integration
- [x] Low stock alerts, stock register, movement history

### Director Features (NEW - March 2026)
- [x] **Daily Summary**: Real-time daily activity overview across all companies
- [x] **Executive Report**: Cross-company performance dashboard with period filters
- [x] **Director Creation**: Directors can create other directors
- [x] **Director Edit-All**: Universal edit permissions (update/delete any entity)
- [x] **Role Management**: Custom job roles with granular permissions
- [x] **Inter-Company Reconciliation**: Track, match, dispute transactions between companies

### Bug Fixes (March 2026)
- [x] **Manager Permissions**: Auto-assign managers to companies on creation + resolve_company_id for non-directors
- [x] **Data Isolation**: All accounting/inventory/task endpoints now properly filter by company_id
- [x] **Director Dashboard**: Executive report now aggregates data from all companies correctly

### Other Features
- [x] Task management with email notifications (SendGrid)
- [x] Real-time updates via Socket.IO
- [x] Audit logging
- [x] App customization (logo, name, background)
- [x] Indent management

## Key API Endpoints
| Endpoint | Method | Description |
|---|---|---|
| /api/auth/login | POST | JWT login |
| /api/director/daily-summary | GET | Daily activity summary |
| /api/director/executive-report | GET | Cross-company performance |
| /api/job-roles | GET/POST | Role management CRUD |
| /api/job-roles/{id} | PUT/DELETE | Update/delete role |
| /api/reconciliation | GET/POST | Reconciliation CRUD |
| /api/reconciliation/{id} | PATCH/DELETE | Status update/delete |
| /api/director/journal-entries/{id} | PUT/DELETE | Director edit-all |
| /api/journal-entries | GET/POST | Accounting entries |
| /api/inv/items | GET/POST | Inventory items |
| /api/inv/stock-movement | POST | Record stock movement |
| /api/tasks | GET/POST | Task management |
| /api/users | GET/POST | User management |

## Key Technical Decisions
- `resolve_company_id()`: Auto-resolves company_id for non-director users from company_users collection
- Directors see all data when no company_id filter; managers/staff only see their assigned company
- All new managers are auto-assigned to matching company by business_type on creation

## Prioritized Backlog

### P2 - Future
- Native Android/iOS app
- True AI predictive analytics (currently simplified)
- Full PWA offline synchronization
- Geolocation tracking for ground staff
- Multi-language expansion

## 3rd Party Integrations
- **OpenAI GPT-4o**: AI Accountant (via Emergent LLM key + emergentintegrations)
- **SendGrid**: Email notifications (user API key required)

## Test Credentials
- **Director**: director@sp.com / password123
- **Manager**: manager@sp.com / password123
