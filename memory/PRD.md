# SP Industrial Operations - Product Requirements Document

## Original Problem Statement
Multi-business ERP application "SP" for managing multiple companies (Petrol Pump, Hotel, FL Shop, Transport, Slag Crushing, Stone Crusher). Role-based access control (Director, Manager, Ground Staff), double-entry bookkeeping, inventory management, task management, AI-powered tools, and cross-company reporting.

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
- [x] Company selector: Directors default to "All Companies", managers scoped to assigned company
- [x] i18n (English, Hindi, Odia)

### Accounting & Finance
- [x] Double-entry bookkeeping (journal entries, accounts, ledger balances)
- [x] Trial Balance, P&L, Balance Sheet
- [x] Company-scoped data isolation via resolve_company_id
- [x] AI Accountant (OpenAI GPT-4o via Emergent LLM key)

### Inventory
- [x] Full inventory system with stock movements, production, transfers
- [x] LiDAR scanner with camera integration
- [x] Low stock alerts, stock register

### Director Features (March 2026)
- [x] Daily Summary - cross-company daily activity overview
- [x] Executive Report - cross-company performance dashboard
- [x] Director Creation - directors can create other directors
- [x] Director Edit-All - universal edit/delete on journal entries and tasks
- [x] Role Management - custom job roles with granular permissions
- [x] Inter-Company Reconciliation - match/dispute transactions between companies

### Bug Fixes (March 2026)
- [x] Manager Permissions - auto-assign to company on creation + resolve_company_id
- [x] Data Isolation - ALL endpoints (accounting, inventory, tasks, reports, indents, transactions) filter by company_id
- [x] Director Dashboard - aggregates all company data correctly
- [x] Company Selector - "All Companies" default for directors, scoped for managers

### Test Results
- Backend: 28/28 (100%)
- Frontend: 100%
- Data isolation verified: Director P&L ₹3,25,625 vs Manager P&L ₹2,600

## Prioritized Backlog
- P2: Native Android/iOS app
- P2: True AI predictive analytics
- P2: Full PWA offline sync
- P2: Geolocation tracking

## Credentials
- Director: director@sp.com / password123
- Manager: manager@sp.com / password123
