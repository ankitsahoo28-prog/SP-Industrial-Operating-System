# Multi-Business ERP Application — PRD

## Original Problem Statement
Build a comprehensive multi-business ERP application with role-based access control, multi-tenancy, and features including task management, accounting, inventory, tracking, reporting, and AI-powered analytics. Replace the existing accounting system with an Odoo-style comprehensive double-entry bookkeeping system.

## User Personas
- **Director**: Full access across all companies, admin-level controls, accounting management
- **Manager**: Company-specific management, task delegation
- **Ground Staff**: Task execution, daily operations

## Core Requirements
- Multi-company management with "All Companies" view for directors
- Role-based access control (Director, Manager, Ground Staff)
- JWT-based authentication
- Double-entry bookkeeping accounting system (Odoo-inspired)
- Task management, daily summaries, tracking
- File uploads for branding and transaction evidence
- Dark/light theme toggle
- PWA foundation

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn/UI + Recharts
- **Backend**: FastAPI + MongoDB (motor) + Modular Routes
- **Auth**: JWT tokens, RBAC

## What's Been Implemented

### Accounting System (Odoo-Style) — COMPLETED Feb 2026
- **Overview Dashboard**: 8 stat cards (Cash, Bank, Receivable, Payable, Invoices, Bills, Entries, Payments) + Monthly Summary bar chart + Balance Distribution pie chart + Income vs Expenses category chart
- **Invoicing**: Create/Post/Cancel customer invoices and vendor bills, line items with quantity/price, detail view with journal items
- **Payments**: Register inbound/outbound payments, link to invoices, cash/bank journal selection
- **Journal Entries**: Manual double-entry with debit/credit balance validation, auto-post on creation
- **Reports**: 8 report types (Trial Balance, Profit & Loss, Balance Sheet, General Ledger, Aged Receivables, Aged Payables, Cash Flow, Tax Report) with date filtering
- **Configuration**: Chart of Accounts (44+ seeded, CRUD), Partners (CRUD with receivable/payable totals), Taxes (11+ seeded, CRUD), Journals (5 default + CRUD), Fiscal Years (CRUD with lock dates)
- **Backend**: Complete REST API at /api/acc/* with 26+ endpoints

### Other Completed Features
- Backend modular architecture (routes/, models/, accounting/)
- Theme toggle (dark/light)
- File uploads (company branding, transaction evidence)
- Custom job roles
- Notifications (in-app + email via SendGrid)
- PWA foundation (service worker, install prompt, offline indicator)
- Director features (daily summaries, user management, universal edit/delete)

## Bug Fixes Applied
- Token key mismatch (`sp_token` vs `token` in localStorage) — Fixed
- Invoice creation NoneType error for payment_terms_days — Fixed

## Backlog
- P1: Build native Android/iOS app (leveraging PWA)
- P2: Implement true AI predictive analytics
- P2: Full PWA offline synchronization
- P3: Deprecate old AccountingPage/accounting_engine references

## 3rd Party Integrations
- OpenAI GPT-4o (AI Business Insights) — Uses Emergent LLM Key
- SendGrid (email notifications) — Requires user API key

## Test Credentials
- Director: director@sp.com / password123
- Manager: manager@sp.com / password123
- Ground Staff: mike.staff@sp.com / password123
