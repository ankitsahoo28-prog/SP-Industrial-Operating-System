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

### 2. User Management (DONE)
- Director creates Managers, Manager creates Ground Staff
- Edit/Delete users with audit trail

### 3. Task Management (DONE)
- Create, assign, track tasks
- Email/WebSocket notifications

### 4. Double-Entry Bookkeeping (DONE)
- Chart of Accounts, Journal Entries, Ledger Balances
- Auto financial reports: Trial Balance, P&L, Balance Sheet
- AI Accountant for natural language transaction input

### 5. Comprehensive Inventory Management (DONE - Feb 2026)
- **47+ seeded items** across 5 business types with industry-specific categories
- **Stock Register:** Real-time stock levels with search & category filters
- **Stock Movements:** Purchase, Sale, Wastage, Consumption, Returns with full tracking
- **Production Batches:** Raw material → Finished goods with yield/loss tracking
- **Inter-Business Transfers:** Director-only transfer between business units
- **LiDAR Stock Scanning:** Volume-to-weight conversion with variance analysis
- **Low Stock Alerts:** Auto-detection of items below minimum levels
- **Auto Accounting Integration:** Purchases auto-create Inventory Dr / Payable Cr journal entries; Sales auto-create Receivable Dr / Sales Cr entries
- **Industry Categories:** slag_crushing, stone_crusher, fl_shop, transport, petrol_pump with specific items

### 6. Reports & Exports (DONE)
- PDF/CSV export for transactions, ledger, inventory
- Business-specific filtering for Director

### 7. Indents (DONE)
- Manager creates, Director approves

## Key API Endpoints

### Inventory (/api/inv/*)
- `GET /api/inv/dashboard` - Consolidated dashboard
- `GET /api/inv/items` - Stock register (filterable)
- `POST /api/inv/items` - Create item
- `POST /api/inv/stock-movement` - Record movement
- `GET /api/inv/movements` - Movement history
- `POST /api/inv/production` - Record production
- `GET /api/inv/productions` - Production history
- `POST /api/inv/transfer` - Inter-business transfer (Director only)
- `GET /api/inv/transfers` - Transfer history
- `POST /api/inv/lidar-scan` - LiDAR scan
- `GET /api/inv/lidar-scans` - Scan history
- `GET /api/inv/low-stock` - Low stock alerts
- `GET /api/inv/categories` - Industry categories

## DB Collections
- users, tasks, transactions, audit_logs
- accounts, journal_entries, ledger_balances
- inventory_items, stock_movements, production_batches, inventory_transfers, lidar_scans

## Pending / Backlog

### P1 - Upcoming
- Language Internationalization (i18n) - English, Hindi, Odia
- LiDAR mobile app integration (native device scanning)
- AI inventory assistant (natural language inventory inputs)

### P2 - Future
- Geolocation tracking for ground staff
- Native Android/iOS mobile app
- Real AI predictive analytics (replace mocked predictions)
- Full PWA offline synchronization
- Hotel inventory module (F&B specific)

## Credentials
- Director: director@sp.com / password123
- Manager (PP): manager.pp@sp.com / password123
- Manager (Hotel): manager.hotel@sp.com / password123
- Staff (PP): staff.pp@sp.com / password123
