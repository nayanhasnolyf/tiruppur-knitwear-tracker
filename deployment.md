# Deployment & Reviewer Guide — TiruppurKnit Ops (Company A)

## 1. Project Links
- **GitHub Repository URL**: `https://github.com/nayanhasnolyf/tiruppur-knitwear-tracker`
- **Live Deployed App URL**: `https://tiruppur-knitwear-tracker.vercel.app`

---

## 2. How to Run Locally (Step-by-Step)

### Prerequisites
- **Node.js**: v18.18+ or v20+ (`npm` v9+)
- **PostgreSQL Database**: Neon Serverless PostgreSQL (recommended), Supabase, or local PostgreSQL 15+

### Step 1: Clone the Repository & Install Dependencies
```bash
git clone https://github.com/nayanhasnolyf/tiruppur-knitwear-tracker.git
cd "tiruppur-knitwear-tracker"
npm install
```

### Step 2: Configure Environment Variables (`.env`)
Create a `.env` file in the project root with the required environment variable names listed in Section 3 below (at minimum `DATABASE_URL`).

### Step 3: Push Prisma Schema & Seed Deterministic Tiruppur Sample Data
```bash
npx prisma generate
npx prisma db push
npx prisma db seed
```
This populates the 3 client sample orders (`B-PO-88213`, `B-PO-88240`, `C-PO-0488`), 13 TNA milestones, 15 daily floor updates (5-day history anchored to `2026-11-02`), 2 compliance date-change audit logs, 3 role-based user accounts, and 2 isolated buyer tokens.

### Step 4: Run Automated Tests & Start the Development Server
```bash
# Run the 18 Vitest unit tests (Run-Rate Engine, Tamil AI Classifier, Security & Isolation)
npm test

# Start the Next.js development server on http://localhost:3000
npm run dev
```

---

## 3. Deployment Architecture & Environment Variables (Names Only)

### Cloud Hosting Architecture
- **Application Tier**: Hosted on **Vercel** (Next.js 14 App Router Serverless Functions + Edge Route-Isolation Middleware).
- **Database Tier**: Hosted on **Neon Serverless PostgreSQL** via Prisma ORM (`@prisma/client`).
- **AI Translation & Classification Tier**: Live Google Gemini API (`gemini-2.5-flash` via `GEMINI_API_KEY`). If `GEMINI_API_KEY` is missing or the API fails/times out, the system never blocks floor count saving; instead, it explicitly reports the error in `aiEnglishTranslation`, marks the note `UNCLASSIFIED` (`needsManualReview = true`), and alerts the Merchandiser to read the original Tamil note and classify it manually.

### Required Environment Variable Names (Never Commit Secret Values)
| Variable Name | Required? | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | **Required** | PostgreSQL connection string (Neon / Supabase / local PostgreSQL) used by Prisma ORM. |
| `GEMINI_API_KEY` | **Required for AI** | Google Gemini API key for live `gemini-2.5-flash` Tamil-to-English floor note translation and root-cause classification. If missing or unreachable, the UI surfaces an explicit AI error banner and routes the Tamil note to mandatory Merchandiser manual review. |
| `SESSION_SECRET` | Optional | Secret key used for HTTP-only session cookie management (defaults safely in local/demo environments). |

---

## 4. Demo Login Credentials & 1-Click Reviewer Walkthrough

Unauthenticated visitors to `/`, `/orders/*`, or `/supervisor` are automatically redirected by `src/middleware.ts` to **`/login`**. For zero-friction evaluation while preserving tenant privacy, **`/login`** includes **1-Click Internal Demo Persona Buttons** (Merchandiser, Supervisor Unit 1, Supervisor Unit 2) and an **External Buyer Portal Token Access** input form (with clickable evaluation demo token pills `uk-company-b-readonly-2026` and `de-company-c-readonly-2026` so private buyer names and PO numbers are never listed publicly on the login screen):

### Internal Staff Accounts (Password for all: `demo123`)
| Role | Name | Email | Password | Assigned Unit | Primary View |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **MERCHANDISER** | Karthik Rajan | `merchandiser@tiruppurknit.com` | `demo123` | Head Office (All Units) | `/` (Order Board) & `/orders/[id]` (TNA & AI Review) |
| **SUPERVISOR** | Murugan K | `supervisor1@tiruppurknit.com` | `demo123` | Unit 1 (Stitching/Printing) | `/supervisor` (Mobile Tamil/EN Floor App) |
| **SUPERVISOR** | Senthil V | `supervisor2@tiruppurknit.com` | `demo123` | Unit 2 (Finishing/Packing) | `/supervisor` (Mobile Tamil/EN Floor App) |

### Isolated Read-Only Buyer Portals (Token-Scoped, Print-Redacted, No Login Required)
Each buyer portal link is strictly isolated by `accessToken` so one buyer can never see another buyer's orders, styles, or volumes, and **only** Merchandiser-confirmed warnings are visible. Furthermore, when exporting or printing the portal to PDF (`Print PDF` or `Ctrl+P`), a two-layer defense (`@page { size: A4; margin: 0mm; }` in `src/app/globals.css` plus `beforeprint`/`afterprint` `window.history.replaceState` URL path masking to `/buyer/status-report`) ensures the secret `accessToken` is never exposed in printed PDF footers:
1. **Company B · UK Portal** (Demo Token: `uk-company-b-readonly-2026` → `/buyer/uk-company-b-readonly-2026`)
   - Displays **only** `B-PO-88213` (Men's crew neck tee, navy — 12,000 pcs) and `B-PO-88240` (Men's polo, white — 8,000 pcs).
   - Demonstrates the Merchandiser Confirmation Gate: `B-PO-88240`'s confirmed collar stain rework advisory is visible to the buyer, whereas `B-PO-88213`'s unconfirmed needle-plate breakdown note is withheld until the Merchandiser clicks **"Confirm & Share with Buyer"** on `/orders/[id]`.
2. **Company C · Germany Portal** (Demo Token: `de-company-c-readonly-2026` → `/buyer/de-company-c-readonly-2026`)
   - Displays **only** `C-PO-0488` (Kids printed tee, yellow — 10,000 pcs, `GREEN · ON TRACK`).
3. **Invalid Token Test (404 Access Denied)**: `/buyer/invalid-forged-token-test`
   - Verifies that unknown or expired tokens are rejected with a 404 Access Denied boundary.

