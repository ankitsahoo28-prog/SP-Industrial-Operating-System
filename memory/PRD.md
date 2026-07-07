# Multi-Business ERP Application — PRD

## Original Problem Statement
Build a comprehensive multi-business ERP application with: Odoo-style accounting & inventory, GST, advance payments, AI assistant, RBAC, location tracking, WhatsApp notifications, GSTR reports, voice commands, data export, and a modern professional interface.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn/UI + Recharts + jsPDF + XLSX
- **Backend**: FastAPI + MongoDB (motor) + Modular Routes
- **Auth**: JWT tokens + RBAC with 19 custom permissions
- **AI**: OpenAI GPT-4o (vision + text + whisper) via Emergent LLM Key
- **Design**: Outfit + IBM Plex Sans fonts, Indigo-600 primary, dark sidebar

## What's Been Implemented (Latest)

### UI/UX Overhaul — Jul 2026
- New design system: Outfit (headings) + IBM Plex Sans (body) + JetBrains Mono (code)
- Dark sidebar with grouped navigation (Overview, Operations, Finance, System)
- Glassmorphism topbar with company selector, theme toggle, notifications
- Modern stat cards with hover animations (translate-y + shadow)
- Stagger entrance animations on page load
- Consistent heading hierarchy (text-2xl max, tracking-tight)
- Clean login page with indigo accent
- Mobile responsive with hamburger menu

### Data Export (Excel + PDF) — Apr 2026
- Export buttons on Journal Entries, Products, Audit Trail
- Backend export endpoints for all data types

### Voice Commands (OpenAI Whisper) — Apr 2026
- Mic button in AI chat, real-time recording indicator

### Duplicate Invoice Detection — Apr 2026
- Auto-check during document processing

### Excel Processing + Batch Entries — Mar 2026
- GPT-4o, improved extraction, batch mode, Approve All/Reject All

### AI Audit Trail + Smart Learning — Mar 2026
- Full audit trail, correction mappings, auto-detection

### Previously Completed
- GST in Accounting, Advance Payments, GSTR-1 & GSTR-3B reports
- Custom RBAC (19 permissions), Location tracking, Role Templates
- Odoo-Style Inventory & Accounting (8 tabs each)
- WhatsApp Integration (scaffolded, awaiting Twilio keys)
- PWA Offline Sync, AI Business Assistant

## Backlog
- P1: WhatsApp activation (awaiting Twilio credentials)
- P2: Advanced OCR, auto GST classification, fraud detection
- P3: Remove legacy inventory code, native mobile app

## Test Credentials
- Director: director@sp.com / password123
- Manager: manager@sp.com / password123
- Ground Staff: staff@sp.com / password123
- Custom Role User: arun@sp.com / password123
