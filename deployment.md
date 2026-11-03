# Deployment & Reviewer Guide — TiruppurKnit Ops (Company A)

## 1. Project Links
- **GitHub Repository URL**: `https://github.com/nayanhasnolyf/tiruppur-knitwear-tracker`
- **Live Deployed App URL**: `[INSERT_YOUR_VERCEL_LIVE_URL_HERE]`

---

## 2. How to Run Locally (Step-by-Step)

### Prerequisites
- **Node.js**: v18.18+ or v20+ (`npm` v9+)
- **PostgreSQL Database**: Neon Serverless PostgreSQL (recommended), Supabase, or local PostgreSQL 15+

### Step 1: Clone the Repository & Install Dependencies
```bash
git clone <YOUR_GITHUB_REPO_URL>
cd "Tiruppur Knitware"
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
# Run the 19 Vitest unit tests (Run-Rate Engine, Tamil AI Classifier, Security & Isolation)
npm test

# Start the Next.js development server on http://localhost:3000
npm run dev
```

---

## 3. Deployment Architecture & Environment Variables (Names Only)

### Cloud Hosting Architecture
- **Application Tier**: Hosted on **Vercel** (Next.js 14 App Router Serverless Functions + Static/Edge Assets).
- **Database Tier**: Hosted on **Neon Serverless PostgreSQL** via Prisma ORM (`@prisma/client`).
- **AI Translation & Classification Tier**: Google Gemini API (`gemini-2.5-flash`) with an automatic deterministic Tamil garment-floor lexicon fallback so the system remains 100% functional even offline or without an API key.

### Required Environment Variable Names (Never Commit Secret Values)
| Variable Name | Required? | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | **Required** | PostgreSQL connection string (Neon / Supabase / local PostgreSQL) used by Prisma ORM. |
| `GEMINI_API_KEY` | Optional | Google Gemini API key for live `gemini-2.5-flash` Tamil-to-English floor note translation and root-cause classification. Automatically falls back to the deterministic Tamil garment-floor lexicon analyzer if omitted or unreachable. |
| `SESSION_SECRET` | Optional | Secret key used for HTTP-only session cookie management (defaults safely in local/demo environments). |

---

## 4. Demo Login Credentials & 1-Click Reviewer Walkthrough

For zero-friction evaluation, the top navigation bar includes a **1-Click Demo Switcher** that lets reviewers switch instantaneously between Merchandiser, Floor Supervisor Mobile, and both Isolated Buyer Portals without typing credentials.

You can also sign in manually at **`/login`** using password **`demo123`** for any account:

### Internal Staff Accounts (Password for all: `demo123`)
| Role | Name | Email | Password | Assigned Unit | Primary View |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **MERCHANDISER** | Karthik Rajan | `merchandiser@tiruppurknit.com` | `demo123` | Head Office (All Units) | `/` (Order Board) & `/orders/[id]` (TNA & AI Review) |
| **SUPERVISOR** | Murugan K | `supervisor1@tiruppurknit.com` | `demo123` | Unit 1 (Stitching/Printing) | `/supervisor` (Mobile Tamil/EN Floor App) |
| **SUPERVISOR** | Senthil V | `supervisor2@tiruppurknit.com` | `demo123` | Unit 2 (Finishing/Packing) | `/supervisor` (Mobile Tamil/EN Floor App) |

### Isolated Read-Only Buyer Portals (Token-Scoped, No Login Required)
Each buyer portal link is strictly isolated by `accessToken` so one buyer can never see another buyer's orders, styles, or volumes, and **only** Merchandiser-confirmed warnings are visible:
1. **Company B (UK) Portal**: `/buyer/uk-company-b-readonly-2026`
   - Displays **only** `B-PO-88213` (Men's crew neck tee, navy — 12,000 pcs) and `B-PO-88240` (Men's polo, white — 8,000 pcs).
   - Demonstrates the Merchandiser Confirmation Gate: `B-PO-88240`'s confirmed collar stain rework advisory is visible to the buyer, whereas `B-PO-88213`'s unconfirmed needle-plate breakdown note is withheld until the Merchandiser clicks **"Confirm & Share with Buyer"** on `/orders/[id]`.
2. **Company C (Germany) Portal**: `/buyer/de-company-c-readonly-2026`
   - Displays **only** `C-PO-0488` (Kids printed tee, yellow — 10,000 pcs, `GREEN · ON TRACK`).
3. **Invalid Token Test (404 Access Denied)**: `/buyer/invalid-forged-token-test`
   - Verifies that unknown or expired tokens are rejected with a 404 Access Denied boundary.

