# TiruppurKnit Ops — Export Production & TNA Delay Projection System

- **GitHub Repository URL**: `[INSERT_YOUR_PUBLIC_GITHUB_URL_HERE]`
- **Live Deployed App URL**: `[INSERT_YOUR_VERCEL_LIVE_URL_HERE]`
- **Submission Documents**:
  - [`deployment.md`](./deployment.md) — Local setup, environment variable names, deployment architecture, and demo credentials.
  - [`TDD.md`](./TDD.md) & [`Technical_Design_Document.docx`](./Technical_Design_Document.docx) — Full Technical Design Document covering the ₹1.08 Cr business case, labeled assumptions, system architecture, run-rate math, and Tamil AI error-handling guardrails.

---

## Overview

**TiruppurKnit Ops** is a full-stack production order-tracking and 2-week early delay warning web application built for **Company A** (a ₹95–110 Cr Tiruppur knitwear exporter supplying UK and EU buyers across 3 internal units and subcontracted printing/washing).

### Key Capabilities
1. **Deterministic Run-Rate Delay Projection Engine (“Shows Its Maths”)**:
   - Compares required daily output ($\text{Remaining Qty} \div \text{Days Left to Stage End}$) against the rolling 3-day actual floor average to flag `AMBER` (2-Week Early Warning) and `RED` (Critical Ex-Factory Delay) orders **10–18 days before ship date**.
2. **Bilingual (`தமிழ் / EN`) Offline-Capable Supervisor Mobile App (`/supervisor`)**:
   - Designed for 2–3 GB RAM Android phones on the factory floor: big numeric quantity input, camera/preset bundle photo attachment, Tamil voice/text blocker notes (`webkitSpeechRecognition` `ta-IN`), and a `localStorage` offline queue with idempotent `clientSubmissionId` sync.
3. **Tamil-to-English AI Reason Classifier & Human-in-the-Loop Gate (`/orders/[id]`)**:
   - Translates Tamil floor blocker notes into English and classifies them into 8 root-cause categories (`MACHINE_BREAKDOWN`, `QUALITY_REWORK`, `FABRIC_DEFECT`, `POWER_CUT`, `WORKER_SHORTAGE`, `PRINT_WASH_DELAY`, `OTHER`, `UNCLASSIFIED`) using Gemini 2.5 Flash + a deterministic Tamil garment-floor lexicon fallback.
   - Displays Original Tamil side-by-side with AI English translation, flags `<70%` low-confidence/vague notes for manual review, lets Merchandisers override the AI category, and **withholds warnings from buyers until explicitly confirmed by a Merchandiser**.
4. **Compliance Date-Change Audit Trail**:
   - Every change to a TNA milestone date or Ex-Factory date requires a mandatory compliance justification and records `oldDate`, `newDate`, `changedByUser`, and `changeReason`.
5. **Isolated Read-Only Buyer Portals (`/buyer/[token]`) & 1-Click Weekly CSV/PDF Export**:
   - Token-scoped portals for `Company B (UK)` and `Company C (Germany)` with strict tenant isolation and 1-click Weekly Status CSV/Excel and Printable PDF export.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Push Prisma schema & seed deterministic sample data (Anchored to 2026-11-02)
npx prisma generate
npx prisma db push
npx prisma db seed

# 3. Run the 19 automated unit tests (Vitest)
npm test

# 4. Start the local dev server on http://localhost:3000
npm run dev
```

See [`deployment.md`](./deployment.md) for demo login credentials and reviewer walkthrough instructions.

