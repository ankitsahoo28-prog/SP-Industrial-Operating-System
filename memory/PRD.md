# SP Industrial Operations - Product Requirements Document

## Original Problem Statement
Multi-business ERP application "SP" for managing multiple companies (Petrol Pump, Hotel, FL Shop, Transport, Slag Crushing, Stone Crusher, Rice Mill). Role-based access control (Director, Manager, Ground Staff), double-entry bookkeeping, inventory management, task management, AI-powered tools, and cross-company reporting.

## Core Architecture
- **Frontend**: React + Tailwind CSS + Shadcn/UI (port 3000)
- **Backend**: FastAPI + Python + MongoDB/motor (port 8001)
- **Auth**: JWT, RBAC
- **Multi-Company**: CompanyContext (frontend) + resolve_company_id (backend)

## Implemented Features

### Foundation
- [x] JWT Auth with RBAC (Director/Manager/Ground Staff)
- [x] Self-registration with director approval
- [x] Multi-company architecture with company_id scoping
- [x] Company selector: Directors default to "All Companies", managers scoped to assigned companies
- [x] i18n (English, Hindi, Odia)

### User Management
- [x] Multi-company assignment: Assign multiple companies when creating users
- [x] Edit company assignments: Edit button on each user card opens multi-select dialog
- [x] Company badges on user cards showing assigned companies
- [x] Director can create directors, managers, ground staff
- [x] Director can change any user's password
- [x] Manager creates ground staff → auto-assigned to all manager's companies
- [x] New users see ALL historical data for their assigned companies

### Accounting & Finance
- [x] Double-entry bookkeeping (journal entries, accounts, ledger balances)
- [x] Trial Balance, P&L, Balance Sheet
- [x] Company-scoped data isolation via resolve_company_id
- [x] AI Accountant (OpenAI GPT-4o via Emergent LLM key)
- [x] Director can edit/delete any journal entry

### Inventory
- [x] Full inventory system with stock movements, production, transfers
- [x] LiDAR scanner with camera integration
- [x] Low stock alerts, stock register

### Task Management
- [x] Create/assign tasks to any user
- [x] Director edit/delete any task (pencil + trash icons)
- [x] Status dropdown (Pending/In Progress/Completed)
- [x] Ground staff can see tasks assigned to them
- [x] Email notification sent to task assigner on status change

### Reports & Indents
- [x] Director can delete any report or indent (trash icon)
- [x] Manager sees ground staff reports in their dashboard
- [x] Email notification on indent authorization to requester + director
- [x] Reports filtered by team for managers (sees own + ground staff reports)

### Director Features
- [x] Daily Summary - cross-company daily activity overview
- [x] Executive Report - cross-company performance dashboard
- [x] Role Management - custom job roles with granular permissions
- [x] Inter-Company Reconciliation - match/dispute transactions between companies
- [x] Edit-All: Delete/edit any task, report, indent, journal entry

### Email Notifications
- [x] Task status update → email to task assigner
- [x] Indent authorization → email to requester + director notification
- [x] Task assignment → email to assigned user (existing)
- [x] Note: Requires SendGrid API key in backend/.env for actual delivery

## Key API Endpoints
| Endpoint | Method | Description |
|---|---|---|
| /api/companies/assign-multiple | POST | Assign user to multiple companies |
| /api/users/{id}/companies | GET | Get user's company assignments |
| /api/tasks/{id} | DELETE | Director delete task |
| /api/reports/{id} | DELETE | Director delete report |
| /api/indents/{id} | DELETE | Director delete indent |
| /api/director/journal-entries/{id} | PUT/DELETE | Director edit/delete entry |
| /api/auth/director-change-password | POST | Director change user password |

## Test Results (Iteration 9)
- Backend: 33/33 (100%)
- Frontend: 100%
- All 15 director pages + 8 manager pages verified

## Credentials
- Director: director@sp.com / password123
- Manager: manager@sp.com / password123
- Ground Staff: staff@sp.com / password123

## Backlog
- P2: Native Android/iOS app
- P2: True AI predictive analytics
- P2: Full PWA offline sync
- P2: Geolocation tracking for ground staff
