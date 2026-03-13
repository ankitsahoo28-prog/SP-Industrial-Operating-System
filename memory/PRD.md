# Multi-Business ERP Application — PRD

## Original Problem Statement
Build a comprehensive multi-business ERP application with: Odoo-style accounting & inventory, GST (IGST/SGST/CGST), advance payments, AI assistant with confirmation, custom role-based access control (director controls what manager/staff can see), always-on location tracking, WhatsApp notifications, and GSTR compliance reports.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn/UI + Recharts
- **Backend**: FastAPI + MongoDB (motor) + Modular Routes
- **Auth**: JWT tokens + RBAC with custom role permissions (19 permissions)
- **AI**: OpenAI GPT-4o (vision + text) via Emergent LLM Key
- **WhatsApp**: Twilio (when configured) for notifications, forgot password OTP
- **PWA**: Service worker with offline queue + background sync

## What's Been Implemented

### Excel Processing & Batch Entries — Mar 2026
- Upgraded AI model from gpt-4o-mini to gpt-4o for better file understanding
- Improved Excel extraction: preserves sheet names, row numbers, column headers, structured key-value format
- Multi-entry (batch) support: AI can return multiple entries from a single message or file
- Batch Preview UI: shows all entries in scrollable list with per-entry approve/reject
- "Approve All" and "Reject All" batch actions
- Backend batch-approve/batch-reject endpoints
- Handles large multi-sheet Excel files (50+ sheets) with smart truncation
- Increased upload timeout to 120s for large files

### AI Audit Trail — Mar 2026
- Audit trail logging on every approve/reject action
- Stats endpoint: total approved, rejected, pending, total actions
- Full Audit Trail UI tab with stats cards, filterable list, pagination

### AI Smart Learning — Mar 2026
- Correction mappings system: AI learns from user corrections
- Auto-detection: when user edits entries before approving, system detects changes and offers to save
- Smart Learning UI tab with mapping viewer, add dialog, delete capability
- Learned corrections included in AI prompts

### Previously Completed
- GST in Accounting (CGST+SGST intra-state, IGST inter-state)
- Advance Payment handling
- Custom RBAC (19 permissions, director controls all)
- Location tracking always ON for manager/ground staff
- Odoo-Style Inventory (8 tabs) & Accounting (full double-entry)
- GSTR-1 & GSTR-3B reports
- Role Templates (5 prebuilt)
- WhatsApp Integration (scaffolded, awaiting Twilio keys)
- PWA Offline Sync
- AI Business Assistant with Preview → Edit → Approve → Post workflow

## Backlog
- P1: WhatsApp activation (awaiting Twilio credentials)
- P1: Native mobile app (PWA foundation ready)
- P2: Advanced AI features (voice commands, advanced OCR, auto GST classification, duplicate invoice detection, fraud alerts)
- P3: Automated GSTR filing submission
- P3: Remove legacy inventory code

## Test Credentials
- Director: director@sp.com / password123
- Manager: manager@sp.com / password123
- Ground Staff: staff@sp.com / password123
- Custom Role User: arun@sp.com / password123
