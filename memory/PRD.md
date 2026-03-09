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

## Architecture

### Backend (FastAPI + MongoDB)
```
/app/backend/
├── server.py              # Thin entry point (~70 lines)
├── database.py            # MongoDB connection
├── models.py              # All Pydantic models and enums
├── deps.py                # Auth, helpers (JWT, password, audit, notifications)
├── routes/
│   ├── auth.py            # Authentication + password management
│   ├── companies.py       # Company CRUD + user management + executive report
│   ├── tasks.py           # Tasks, Reports, Indents, Locations
│   ├── accounting.py      # Double-entry bookkeeping, transactions, exports
│   ├── inventory.py       # Comprehensive inventory + AI assistant
│   ├── director.py        # Dashboard, predictions, settings, notifications, roles, reconciliation
│   └── uploads.py         # File upload and serving
├── accounting_engine.py, inventory_engine.py, company_engine.py
├── email_service.py, export_service.py, ai_service.py
└── websocket_service.py
```

### Frontend (React + Tailwind + Shadcn/UI)
```
/app/frontend/src/
├── App.js                 # Main app with PWA registration
├── components/
│   ├── Layout.js          # Sidebar + header with ThemeToggle + NotificationBell
│   ├── NotificationBell.js
│   ├── ThemeToggle.js     # Dark/light mode switcher
│   ├── PWAComponents.js   # Install banner, offline indicator, update banner
│   └── CompanySelector.js
├── lib/
│   ├── api.js             # API client (incl. uploadApi)
│   ├── offlineDb.js       # IndexedDB offline storage
│   └── serviceWorkerRegistration.js
└── pages/
    ├── director/
    │   ├── UsersPage.js       # Job role support
    │   ├── SettingsPage.js    # File upload for logo/bg
    │   ├── AccountingPage.js  # Transactions with bill upload
    │   └── ...
    ├── manager/
    └── ground-staff/
```

## What's Been Implemented

### Phase 1-3: Core ERP + Director Features + Notifications (Completed)
- Full authentication, multi-company, RBAC, task management, reports, indents
- Double-entry accounting with AI accountant, inventory management
- Director features: executive report, daily summary, role management, reconciliation
- In-app + email notifications, custom business types

### Phase 4: Refactoring + PWA (Completed - Mar 2026)
- Backend split from 2707-line monolith into 7 modular FastAPI routers
- Enhanced service worker, PWA manifest, offline IndexedDB storage
- Install prompt, offline indicator, update banner

### Phase 5: New Features (Completed - Mar 2026)
- **Job Roles in User Management**: Custom roles from Role Management now appear in Add User form and can be assigned/changed per user via the "Role" button on user cards
- **File Upload for Branding**: Settings page supports uploading logo, background video, and background image with preview
- **Dark/Light Theme**: Theme toggle (sun/moon icon) in header persists preference to localStorage
- **Transaction Bill Upload**: Accounting Transactions tab supports attaching bills, receipts, and photos when recording cash/bank payments. Attachments viewable via paperclip icon

## Prioritized Backlog

### P0 (Critical) - None remaining
### P1 (High) - None remaining

### P2 (Medium)
- Native Android/iOS wrapper (Capacitor)
- Real-time WebSocket notifications (replace polling)
- Geolocation tracking for ground staff

### P3 (Low/Future)
- Enhanced LiDAR scanning with AR overlay
- Automated report scheduling
- Export to Tally/QuickBooks format
- Advanced analytics dashboard with drill-down

## Technical Stack
- **Frontend**: React 18, Tailwind CSS, Shadcn/UI, Recharts, Dexie
- **Backend**: FastAPI, Python 3, MongoDB (motor), Pydantic
- **AI**: OpenAI GPT-4o-mini via Emergent LLM Key
- **Auth**: JWT with bcrypt
- **PWA**: Service Worker, Web App Manifest, IndexedDB

## Test Credentials
- Director: director@sp.com / password123
- Manager: manager@sp.com / password123
- Ground Staff: mike.staff@sp.com / password123
