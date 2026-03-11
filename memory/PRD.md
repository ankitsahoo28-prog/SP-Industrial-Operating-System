# Multi-Business ERP Application — PRD

## Original Problem Statement
Build a comprehensive multi-business ERP application with role-based access control, multi-tenancy, and features including task management, accounting, inventory, tracking, reporting, and AI-powered analytics. Replace the existing accounting system with an Odoo-style comprehensive double-entry bookkeeping system with AI-powered assistance.

## User Personas
- **Director**: Full access across all companies, admin-level controls, accounting management
- **Manager**: Company-specific management, task delegation
- **Ground Staff**: Task execution, daily operations

## Core Requirements
- Multi-company management with "All Companies" view for directors
- Role-based access control (Director, Manager, Ground Staff)
- JWT-based authentication
- Double-entry bookkeeping accounting system (Odoo-inspired)
- AI-powered accounting assistant (7 features)
- Task management, daily summaries, tracking
- File uploads for branding and transaction evidence
- Dark/light theme toggle
- PWA foundation

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn/UI + Recharts
- **Backend**: FastAPI + MongoDB (motor) + Modular Routes
- **Auth**: JWT tokens, RBAC
- **AI**: OpenAI GPT-4o-mini via Emergent LLM Key

## What's Been Implemented

### Accounting System (Odoo-Style) — COMPLETED
- Overview Dashboard with Recharts charts
- Invoicing: Create/Post/Cancel invoices & bills
- Payments: Register inbound/outbound payments
- Journal Entries: Manual double-entry
- Reports: 8 report types
- Configuration: Chart of Accounts, Partners, Taxes, Journals, Fiscal Years (all CRUD)

### AI Accounting Features — COMPLETED Feb 2026
1. **AI Chat Assistant**: Natural language → journal entries with auto-post capability
2. **Smart Invoice Extraction**: Text description → structured invoice data
3. **AI Transaction Categorization**: Description + amount → debit/credit account suggestions
4. **AI-Powered Reconciliation**: Automatic transaction matching suggestions
5. **AI Financial Q&A**: Natural language questions about company finances
6. **Predictive Cash Flow**: 3-month forecast with risk assessment
7. **Anomaly Detection**: Transaction health scoring and issue flagging

### Other Completed Features
- Backend modular architecture (routes/, models/, accounting/)
- Theme toggle (dark/light), File uploads, Custom job roles
- Notifications (in-app + email via SendGrid)
- PWA foundation, Executive Dashboard

## Bug Fixes Applied
- Token key mismatch (`sp_token` vs `token`) — Fixed
- Invoice creation NoneType for payment_terms_days — Fixed
- ExecutiveReport calling wrong API (`companyApi` vs `directorApi`) — Fixed
- AI auto-post missing company_id parameter — Fixed
- AI auto-post missing move_lines collection insert — Fixed

## Backlog
- P1: Build native Android/iOS app (PWA ready)
- P2: True AI predictive analytics
- P2: Full PWA offline sync
- P3: Deprecate old accounting references

## 3rd Party Integrations
- OpenAI GPT-4o-mini (AI Accounting + AI Business Insights) — Emergent LLM Key
- SendGrid (email notifications)

## Test Credentials
- Director: director@sp.com / password123
- Manager: manager@sp.com / password123
- Ground Staff: mike.staff@sp.com / password123
