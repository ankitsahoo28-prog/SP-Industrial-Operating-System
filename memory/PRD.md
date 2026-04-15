# Multi-Business ERP Application — PRD

## Original Problem Statement
Build a comprehensive multi-business ERP application with: Odoo-style accounting & inventory, GST (IGST/SGST/CGST), advance payments, AI assistant with confirmation, custom role-based access control (director controls what manager/staff can see), always-on location tracking, WhatsApp notifications, GSTR compliance reports, and AI Business Assistant with voice, document processing, batch entries, data export, and duplicate detection.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn/UI + Recharts + jsPDF + XLSX
- **Backend**: FastAPI + MongoDB (motor) + Modular Routes
- **Auth**: JWT tokens + RBAC with custom role permissions (19 permissions)
- **AI**: OpenAI GPT-4o (vision + text + whisper) via Emergent LLM Key
- **WhatsApp**: Twilio (when configured) for notifications, forgot password OTP
- **PWA**: Service worker with offline queue + background sync

## What's Been Implemented (Latest)

### Data Export (Excel + PDF) — Apr 2026
- Reusable ExportButton component with dropdown (Excel/PDF)
- Export buttons on: Journal Entries, Products/Inventory, Audit Trail
- Backend export endpoints: journal-entries, chart-of-accounts, invoices, products, stock-moves, audit-trail
- Client-side PDF generation (jsPDF + autotable) and Excel generation (XLSX)

### Voice Commands (OpenAI Whisper) — Apr 2026
- Mic button in AI chat for voice recording
- Real-time recording indicator (red pulsing dot + timer)
- Audio transcribed via Whisper → sent to AI as text → processed normally
- Supports batch entries from voice commands

### Duplicate Invoice Detection — Apr 2026
- Auto-check when processing uploaded documents
- Checks: exact invoice number match + fuzzy vendor+amount match (5% tolerance)
- Warning shown in preview message if potential duplicate found
- Standalone check-duplicates API endpoint

### Excel Processing Fix + Batch Entries — Mar 2026
- Upgraded to GPT-4o for better file understanding
- Improved Excel extraction: row numbers, key-value format, sheet names
- Batch mode: AI returns multiple entries from single message/file
- BatchPreviewPanel: per-entry approve/reject + Approve All/Reject All
- Backend batch-approve/batch-reject endpoints
- Handles 50+ sheet files with smart truncation

### AI Audit Trail — Mar 2026
- Full audit trail with stats dashboard (approved/rejected/pending)
- Filterable + paginated audit log UI

### AI Smart Learning — Mar 2026
- Correction mappings: AI learns from user edits
- Auto-detection of changes during approve flow

### Previously Completed
- GST in Accounting, Advance Payments, GSTR-1 & GSTR-3B reports
- Custom RBAC (19 permissions), Location tracking, Role Templates
- Odoo-Style Inventory & Accounting
- WhatsApp Integration (scaffolded, awaiting Twilio keys)
- PWA Offline Sync
- AI Business Assistant with Preview → Edit → Approve → Post

## Key API Endpoints
- `/api/ai-assistant/chat` — Main AI chat (single + batch entries)
- `/api/ai-assistant/upload` — File upload processing
- `/api/ai-assistant/voice` — Voice transcription (Whisper)
- `/api/ai-assistant/approve` / `reject` — Single entry actions
- `/api/ai-assistant/batch-approve` / `batch-reject` — Batch actions
- `/api/ai-assistant/check-duplicates` — Duplicate detection
- `/api/ai-assistant/audit-trail` / `audit-stats` — Audit data
- `/api/ai-assistant/learn` / `mappings` — Smart learning
- `/api/acc/export/*` — Accounting data export
- `/api/inv/export/*` — Inventory data export

## Backlog
- P1: WhatsApp activation (awaiting Twilio credentials)
- P2: Advanced OCR for low-quality scans
- P2: Automated GST classification from HSN codes
- P3: Fraud detection alerts
- P3: Remove legacy inventory code
- P3: Native mobile app

## Test Credentials
- Director: director@sp.com / password123
- Manager: manager@sp.com / password123
- Ground Staff: staff@sp.com / password123
- Custom Role User: arun@sp.com / password123
