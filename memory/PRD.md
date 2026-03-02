# SP Industrial Operating System - Product Requirements

## Problem Statement
Build a comprehensive, multi-business ERP-like application named "SP" for six business types: petrol pump, hotel, FL shop, transport, slag crushing, and stone crusher. Role-based access (Director, Manager, Ground Staff), task management, geolocation, reporting, accounting, AI assistance, and inventory management.

## Architecture
- **Frontend:** React + Tailwind CSS + Shadcn/UI, served on port 3000
- **Backend:** FastAPI + Python, served on port 8001
- **Database:** MongoDB via motor (async)
- **Auth:** JWT tokens
- **AI:** OpenAI GPT-4o-mini via emergentintegrations (Emergent LLM Key)

## Core Modules

### 1. Authentication & Roles (DONE)
- JWT login/register
- 3 roles: Director, Manager, Ground Staff
- Role-based routing and access control
- **Self-Registration with Director Approval** (Feb 2026)
  - Users can create accounts from login page
  - Accounts start with status=pending
  - Director sees pending users in Users page and can approve/reject
  - Pending/rejected users blocked from login with clear messages
- **Forgot/Reset Password** (Feb 2026)
  - Token-based password reset flow
  - Available from login page

### 2. User Management (DONE)
- Director creates Managers, Manager creates Ground Staff
- Edit/Delete users with audit trail
- Pending user approval section for Director

### 3. Task Management (DONE)
- Create, assign, track tasks
- Email/WebSocket notifications

### 4. Double-Entry Bookkeeping (DONE)
- Chart of Accounts, Journal Entries, Ledger Balances
- Auto financial reports: Trial Balance, P&L, Balance Sheet
- AI Accountant for natural language transaction input

### 5. Comprehensive Inventory Management (DONE - Feb 2026)
- **55+ seeded items** across 6 business types (including hotel F&B)
- **Stock Register:** Real-time stock levels with search & category filters
- **Stock Movements:** Purchase, Sale, Wastage, Consumption, Returns
- **Production Batches:** Raw material to Finished goods with yield/loss tracking
- **Inter-Business Transfers:** Director-only transfer between business units
- **LiDAR Stock Scanning:** Volume measurement with dimension inputs or direct volume, density-based weight estimation, variance analysis
- **Low Stock Alerts:** Auto-detection of items below minimum levels
- **Auto Accounting Integration:** Purchases/Sales auto-create journal entries
- **AI Inventory Assistant** (Feb 2026): Natural language input to structured stock movements with auto-execution and journal entries

### 6. Hotel Inventory Module (DONE - Feb 2026)
- F&B specific categories: Kitchen (rice, wheat, oil, vegetables, spices, dairy, meat, fish, eggs), Housekeeping (linens, towels, toiletries, cleaning), Bar items
- Seeded with default hotel inventory items
- Hotel managers see inventory in same UI

### 7. Language Internationalization - i18n (DONE - Feb 2026)
- 3 languages: English, Hindi, Odia
- Language switcher in sidebar (EN/HI/OD buttons)
- All navigation labels, page titles translated
- Stored in localStorage, persists across sessions

### 8. Real AI Predictive Analytics (DONE - Feb 2026)
- Uses real Emergent LLM Key via emergentintegrations
- Analyzes actual transaction, inventory, and journal entry data
- Returns revenue/expense forecasts, recommendations, inventory alerts
- Enriched with real low-stock items from inventory

### 9. Director App Settings (DONE - Feb 2026)
- Customize app name, logo URL, background video URL, primary color, tagline
- Settings stored in app_settings MongoDB collection
- Login page dynamically reads settings
- Director-only access

### 10. Reports & Exports (DONE)
- PDF/CSV export for transactions, ledger, inventory
- Business-specific filtering for Director

### 11. Indents (DONE)
- Manager creates, Director approves

## Key API Endpoints

### Auth
- `POST /api/auth/login` - Login (blocks pending/rejected)
- `POST /api/auth/self-register` - Self-registration (creates pending user)
- `GET /api/auth/pending-users` - Get pending users (Director only)
- `PATCH /api/auth/approve/{user_id}?action=approved|rejected` - Approve/reject
- `POST /api/auth/forgot-password` - Generate reset token
- `POST /api/auth/reset-password` - Reset with token

### Settings
- `GET /api/settings` - Get app settings (public)
- `PUT /api/settings` - Update settings (Director only)

### Translations
- `GET /api/translations/{lang}` - Get translations (en/hi/od)

### Inventory (/api/inv/*)
- Full CRUD + AI assistant + LiDAR scanning (14 endpoints)

### AI
- `POST /api/inv/ai-assistant` - Natural language inventory parsing
- `POST /api/inv/ai-execute` - Execute AI-parsed movements
- `GET /api/dashboard/predictions` - AI-powered predictive analytics

## DB Collections
- users, tasks, transactions, audit_logs
- accounts, journal_entries, ledger_balances
- inventory_items, stock_movements, production_batches, inventory_transfers, lidar_scans
- app_settings

## Pending / Backlog

### P2 - Future
- Geolocation tracking for ground staff
- Native Android/iOS mobile app
- Full PWA offline synchronization
- Email-based password reset (instead of token display)
- Enhanced LiDAR with actual device camera integration

## Credentials
- Director: director@sp.com / password123
- Manager (PP): manager.pp@sp.com / password123
- Manager (Hotel): manager.hotel@sp.com / password123
- Staff (PP): staff.pp@sp.com / password123
