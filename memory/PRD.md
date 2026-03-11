# Multi-Business ERP Application — PRD

## Original Problem Statement
Build a comprehensive multi-business ERP application with role-based access control, multi-tenancy, and features including task management, accounting, inventory, tracking, reporting, and AI-powered analytics. Replace the existing accounting system with an Odoo-style comprehensive double-entry bookkeeping system with AI-powered assistance including bill photo scanning.

## User Personas
- **Director**: Full access across all companies, admin-level controls, accounting management
- **Manager**: Company-specific management, task delegation
- **Ground Staff**: Task execution, daily operations

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn/UI + Recharts
- **Backend**: FastAPI + MongoDB (motor) + Modular Routes
- **Auth**: JWT tokens, RBAC
- **AI**: OpenAI GPT-4o (vision) + GPT-4o-mini (text) via Emergent LLM Key

## What's Been Implemented

### Accounting System (Odoo-Style) — COMPLETED
- Overview Dashboard with Recharts charts
- Invoicing: Create/Post/Cancel invoices & bills
- Payments: Register inbound/outbound payments
- Journal Entries: Manual double-entry
- Reports: 8 report types (Trial Balance, P&L, Balance Sheet, General Ledger, Aged Receivables/Payables, Cash Flow, Tax Report)
- Configuration: Chart of Accounts, Partners, Taxes, Journals, Fiscal Years (all CRUD)

### AI Accounting Features — COMPLETED Feb 2026
1. **AI Chat Assistant**: Natural language → journal entries with auto-post
2. **Bill Photo Scanner**: Upload bill photo → AI vision extracts all data (GPT-4o)
3. **Smart Invoice Extraction**: Text description → structured invoice data
4. **AI Transaction Categorization**: Description + amount → debit/credit suggestions
5. **AI-Powered Reconciliation**: Automatic transaction matching suggestions
6. **AI Financial Q&A**: Natural language questions about finances
7. **Predictive Cash Flow**: 3-month forecast with risk assessment
8. **Anomaly Detection**: Transaction health scoring and issue flagging

### Other Completed Features
- Backend modular architecture, Theme toggle, File uploads, Custom job roles
- Notifications (in-app + email), PWA foundation, Executive Dashboard

## Bug Fixes Applied
- Token key mismatch (`sp_token` vs `token`), Invoice NoneType, ExecutiveReport wrong API, AI auto-post bugs

## Backlog
- P1: Build native Android/iOS app (PWA ready)
- P2: True AI predictive analytics
- P2: Full PWA offline sync
- P3: Deprecate old accounting references

## 3rd Party Integrations
- OpenAI GPT-4o (Bill Scanner vision) + GPT-4o-mini (text AI) — Emergent LLM Key
- SendGrid (email notifications)

## Test Credentials
- Director: director@sp.com / password123
- Manager: manager@sp.com / password123
- Ground Staff: mike.staff@sp.com / password123
