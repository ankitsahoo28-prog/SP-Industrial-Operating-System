# SP Industrial Operating System - PRD

## Problem Statement
Build a comprehensive business operations web application named "SP" for managing six business types: petrol pump, hotel, FL shop, transport, slag crushing unit, and stone crusher. Three user roles: Director, Manager, Ground Staff with role-based access.

## Tech Stack
- **Frontend:** React, Tailwind CSS, Shadcn/UI, Recharts
- **Backend:** FastAPI, Python, MongoDB (motor)
- **Auth:** JWT
- **Real-time:** Socket.IO (WebSockets)
- **Exports:** ReportLab (PDF), CSV
- **AI:** OpenAI (Emergent LLM key, currently fallback/mock)

## Architecture
```
/app/backend/server.py       - Monolithic FastAPI (all routes, models)
/app/backend/ai_service.py   - AI insights (OpenAI, fallback mock)
/app/backend/export_service.py - PDF/CSV generation
/app/backend/websocket_service.py - Socket.IO real-time
/app/frontend/src/App.js     - Routes & auth
/app/frontend/src/context/AuthContext.js - Auth state, WS init
/app/frontend/src/lib/api.js - API helpers
/app/frontend/src/components/Layout.js - Sidebar nav
```

## Credentials
- Director: director@sp.com / password123
- Manager: manager@sp.com / password123
- Ground Staff: staff@sp.com / password123

## Completed Features
- [x] User auth with JWT (login/register)
- [x] Role-based dashboards (Director, Manager, Ground Staff)
- [x] Task management (create, assign, update status)
- [x] Report submission (multiple types)
- [x] Indent system (create, approve/reject)
- [x] Accounting (transactions, ledger, summary) - INR currency
- [x] Inventory management
- [x] AI insights & predictions (mocked/fallback)
- [x] WebSocket real-time notifications
- [x] PDF/CSV export buttons on accounting pages
- [x] Edit transaction UI (Manager & Director) with audit logging
- [x] Delete user UI (Director) with confirmation dialog
- [x] Audit Trail page (Director) with entity filter
- [x] PWA service worker scaffold
- [x] Logo integration on login page
- [x] Historical trend data endpoint

- [x] Business type filters on Director pages (Tasks, Reports, Indents, Accounting)
- [x] Removed SP heading from sidebar

- [x] Login page: background video + SP GROUP logo (replaced SP Industrial OS text)

## In Progress
(none)

## Upcoming Tasks (P0-P1)
1. **Business-Specific Customization (P0)** - Filter Manager/Ground Staff data by assigned business
2. **Language Internationalization i18n (P1)** - English, Hindi, Odia support
3. **Backend Refactoring (P1)** - Break server.py into modular routers

## Future/Backlog (P2+)
1. Real AI Predictive Analytics (replace mock with OpenAI)
2. Geolocation Tracking (GPS for ground staff attendance)
3. Full PWA Offline Sync (IndexedDB + sync)
4. Native Android App (clarify: PWA wrapper vs React Native)

## Known Issues
- AI insights/predictions return fallback mock data (OpenAI integration not active)
- Console hydration warning in Director Accounting (cosmetic, non-breaking)
