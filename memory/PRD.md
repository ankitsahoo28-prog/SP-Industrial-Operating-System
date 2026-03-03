# SP Industrial Operating System - PRD

## Original Problem Statement
Multi-business ERP application "SP" for managing industrial operations across multiple companies. Features role-based access control (Director, Manager, Ground Staff), multi-company support, and comprehensive business management tools.

## Core Requirements
- **Multi-Company Management**: Directors manage multiple companies; users can be assigned to multiple companies
- **Role-Based Access Control (RBAC)**: Director (full access), Manager (team-scoped), Ground Staff (task-scoped)
- **Double-Entry Accounting**: AI-powered accountant with journal entries, ledger, trial balance, P&L, balance sheet
- **Inventory Management**: Comprehensive tracking with stock movements, production batches, LiDAR scanning
- **Task Management**: Create, assign, track tasks with email + in-app notifications
- **Reports & Indents**: Ground staff reports, manager indents with director authorization
- **AI Features**: Business insights, predictive analytics, AI inventory assistant, AI accountant

## User Personas
- **Director**: Full control, multi-company view, user management, analytics
- **Manager**: Team management, reporting, indent creation
- **Ground Staff**: Task execution, report submission, location tracking

## Architecture

### Backend (FastAPI + MongoDB)
```
/app/backend/
├── server.py              # Thin entry point (~65 lines) - FastAPI app, middleware, startup
├── database.py            # MongoDB connection (motor)
├── models.py              # All Pydantic models and enums
├── deps.py                # Auth, helpers (JWT, password, audit, notifications)
├── routes/
│   ├── auth.py            # Authentication + user CRUD
│   ├── companies.py       # Company CRUD + user-company mapping + executive report
│   ├── tasks.py           # Tasks, Reports, Indents, Locations + email notifications
│   ├── accounting.py      # Double-entry bookkeeping, transactions, exports, AI accountant
│   ├── inventory.py       # Comprehensive inventory + AI assistant
│   └── director.py        # Dashboard, predictions, settings, notifications, roles, reconciliation
├── accounting_engine.py   # Double-entry bookkeeping engine
├── inventory_engine.py    # Inventory management engine
├── company_engine.py      # Company management engine
├── email_service.py       # Email notifications (Resend)
├── export_service.py      # PDF/CSV export generation
├── ai_service.py          # AI business insights
├── websocket_service.py   # Socket.IO for real-time
└── i18n.py                # Translations
```

### Frontend (React + Tailwind + Shadcn/UI)
```
/app/frontend/src/
├── App.js                 # Main app with PWA registration
├── components/
│   ├── Layout.js          # Sidebar + header with NotificationBell
│   ├── NotificationBell.js # In-app notification system
│   ├── CompanySelector.js # Company switching for directors
│   └── PWAComponents.js   # PWA install banner, offline indicator, update banner
├── lib/
│   ├── api.js             # API client with all endpoints
│   ├── offlineDb.js       # IndexedDB for offline storage (Dexie)
│   └── serviceWorkerRegistration.js # SW registration + install prompt
└── pages/
    ├── director/          # Director-specific pages
    ├── manager/           # Manager pages
    └── ground-staff/      # Ground staff pages
```

## What's Been Implemented

### Phase 1: Core ERP (Completed)
- User authentication (JWT) with self-registration and director approval
- Multi-company management with CRUD operations
- Role-based access control (Director, Manager, Ground Staff)
- Task management with assignment and status tracking
- Report submission with inventory auto-update
- Indent creation and authorization flow
- Double-entry accounting with AI accountant
- Comprehensive inventory management system
- Dashboard with business statistics

### Phase 2: Director Features (Completed)
- Director "All Companies" view
- Multi-company user assignment
- Director password control for any user
- Director universal edit/delete on tasks, reports, indents, journal entries
- Executive reporting dashboard with period filtering
- Daily summary endpoint
- Role management (custom job roles with permissions)
- Inter-company reconciliation
- AI predictive analytics (GPT-4o-mini powered)
- AI business insights

### Phase 3: Notifications & Communication (Completed)
- In-app notification system (bell icon in header)
- Email notifications for task assignments, updates, indent approvals
- Real-time notification polling (15-second intervals)
- Mark as read/unread, delete, mark all read

### Phase 4: Refactoring & PWA (Completed - Feb 2026)
- **Backend Refactoring**: Monolithic server.py (2707 lines) split into 6 modular FastAPI routers
  - Shared models.py, deps.py, database.py
  - Routes: auth, companies, tasks, accounting, inventory, director
- **PWA Enhancements**:
  - Enhanced service worker with network-first/cache-first strategies
  - Proper manifest.json with app shortcuts
  - IndexedDB offline storage (Dexie v2) with sync queue
  - PWA install prompt banner
  - Offline indicator
  - App update banner
  - Apple mobile web app meta tags

### Other Features (Completed)
- Custom business type support
- PDF/CSV export for transactions, ledger, inventory
- Audit trail logging
- Location tracking
- App settings customization (branding)
- Multi-language support (i18n)
- LiDAR scanning integration (basic)

## Prioritized Backlog

### P0 (Critical) - None remaining

### P1 (High)
- None remaining

### P2 (Medium)
- Build native Android/iOS wrapper (Capacitor/React Native)
- True real-time with WebSocket instead of polling
- Geolocation tracking for ground staff

### P3 (Low/Future)
- Enhanced LiDAR scanning with AR overlay
- Automated report scheduling
- Export to Tally/QuickBooks format
- Advanced analytics dashboard with drill-down

## Technical Stack
- **Frontend**: React 18, Tailwind CSS, Shadcn/UI, Recharts, Dexie (IndexedDB)
- **Backend**: FastAPI, Python 3, MongoDB (motor), Pydantic
- **AI**: OpenAI GPT-4o-mini via Emergent LLM Key
- **Email**: Resend
- **Auth**: JWT with bcrypt
- **PWA**: Service Worker, Web App Manifest, IndexedDB offline storage

## Test Credentials
- Director: director@sp.com / password123
- Manager: manager@sp.com / password123
- Ground Staff: mike.staff@sp.com / password123

## Database Collections
- users, companies, company_users, tasks, reports, indents, transactions
- journal_entries, accounts, ledger_balances, inventory, inventory_items
- stock_movements, production_batches, inventory_transfers, lidar_scans
- notifications, job_roles, reconciliations, audit_logs, app_settings
