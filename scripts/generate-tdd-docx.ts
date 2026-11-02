import * as fs from 'fs';
import * as path from 'path';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from 'docx';

function heading1(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 140 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 28,
        color: '0F172A',
      }),
    ],
  });
}

function heading2(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 100 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 24,
        color: '1E293B',
      }),
    ],
  });
}

function bodyPara(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 120 },
    children: [
      new TextRun({
        text,
        size: 21,
        color: '1E293B',
      }),
    ],
  });
}

function bulletItem(label: string, text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 90 },
    children: [
      new TextRun({
        text: `${label}: `,
        bold: true,
        size: 21,
        color: '0F172A',
      }),
      new TextRun({
        text,
        size: 21,
        color: '1E293B',
      }),
    ],
  });
}

function cell(text: string, isHeader = false): TableCell {
  return new TableCell({
    shading: isHeader ? { fill: 'F1F5F9' } : undefined,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: isHeader,
            size: 19,
            color: '0F172A',
          }),
        ],
      }),
    ],
  });
}

async function generateDocx() {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: 'TECHNICAL DESIGN DOCUMENT (TDD)',
                bold: true,
                size: 34,
                color: '0F172A',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: 'Production Order-Tracking, 2-Week Early Delay Projection & Tamil Floor AI System — Company A (Tiruppur)',
                italics: true,
                size: 22,
                color: '475569',
              }),
            ],
          }),

          // Top Submission Metadata Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
              left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
              right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
            },
            rows: [
              new TableRow({
                children: [
                  cell('GitHub Repository URL', true),
                  cell('https://github.com/nayanpokhriyal/tiruppur-knitwear-tracker'),
                ],
              }),
              new TableRow({
                children: [
                  cell('Live Deployed Application URL', true),
                  cell('[INSERT_YOUR_VERCEL_LIVE_URL_HERE]'),
                ],
              }),
              new TableRow({
                children: [
                  cell('Client Context', true),
                  cell(
                    'Company A, Tiruppur, Tamil Nadu (Knitwear Exporter to UK & EU Buyers — 3 Own Units + Subcontracted Printing/Washing, INR 95–110 Cr Revenue)'
                  ),
                ],
              }),
              new TableRow({
                children: [
                  cell('Stack', true),
                  cell(
                    'Next.js 14 (App Router), TypeScript, Tailwind CSS, Prisma ORM, Neon Serverless PostgreSQL, Gemini 2.5 Flash + Deterministic Tamil Lexicon'
                  ),
                ],
              }),
            ],
          }),

          // Section 1
          heading1('1. Executive Summary & Business Case (The INR 1.08 Crore Problem)'),
          bodyPara(
            'Company A ships ~500 knitwear export purchase orders annually (average order value INR 21 Lakh) across 3 internal units and subcontracted printing/washing units in Tiruppur. Currently, TNA schedules sit in disconnected spreadsheets while daily floor updates arrive as unstructured Tamil WhatsApp texts and voice notes. Merchandisers discover stage slips 2 days before Ex-Factory instead of 2 weeks early.'
          ),
          bulletItem(
            'Emergency Air-Freight Cost (INR 52.50 Lakh/yr)',
            '8% of orders (40 orders/yr) miss sea-freight closing; 15 orders require air-freight at INR 3.5 Lakh extra per order.'
          ),
          bulletItem(
            'Buyer Late-Delivery Discounts (INR 26.25 Lakh/yr)',
            'The remaining 25 late orders suffer a mandatory 5% FOB penalty discount (25 x 0.05 x INR 21 Lakh).'
          ),
          bulletItem(
            'Merchandiser Chasing Overhead (INR 28.80 Lakh/yr)',
            '12 merchandisers x 2 hrs/day x 300 days/yr x INR 400/hr manually chasing floor counts and re-typing buyer sheets.'
          ),
          bulletItem(
            'Total Annual Loss & Target Savings',
            'INR 1.0755 Crore (~INR 1.08 Cr) annual bleed. By flagging run-rate shortfalls 10–18 days before Ex-Factory, our system targets reducing late shipments from 8% to <=5% and cutting status-chasing time in half (~INR 34–45 Lakh/yr saved).'
          ),

          // Section 2
          heading1('2. Explicitly Labeled Engineering Assumptions'),
          bulletItem(
            '[ASSUMPTION-01] Reference "Today" Date Anchored to 2026-11-02',
            'All run-rate projections default to 2026-11-02T00:00:00Z so the 3 client sample orders (Ex-Factory: 2026-11-12, 2026-11-20, 2026-11-28) deterministically exhibit a 10-day RED critical delay (B-PO-88240), an 18-day AMBER 2-week early warning (B-PO-88213), and a 26-day GREEN order (C-PO-0488).'
          ),
          bulletItem(
            '[ASSUMPTION-02] Backward TNA Scheduling Templates',
            'New orders created via SOLID_BASIC (4 stages) or PRINTED_TEE (5 stages) allocate standard garment lead-time windows backwards from exFactoryDate, reserving a final packing/inspection buffer before ship date.'
          ),
          bulletItem(
            '[ASSUMPTION-03] Rolling 3-Day Floor Output Average',
            'actualDailyRate uses the rounded mean of up to the last 3 daily floor submissions for the active milestone to smooth single-shift noise while reacting rapidly to line breakdowns.'
          ),
          bulletItem(
            '[ASSUMPTION-04] Low-Confidence AI Guardrail (< 0.70)',
            'Any Tamil note classified with confidence < 0.70 or category UNCLASSIFIED / OTHER (such as vague notes like "இன்று வேலை சற்று மெதுவாக நடக்கிறது") automatically forces needsManualReview = true.'
          ),
          bulletItem(
            '[ASSUMPTION-05] Low-RAM Android Photo Footprint',
            'Floor bundle/defect photos are stored as compact Data URLs / lightweight vector inspection tags (<150 KB) so offline localStorage queues on 2–3 GB RAM Android phones never exceed browser quota.'
          ),
          bulletItem(
            '[ASSUMPTION-06] Continuous Peak-Season Production Days',
            'November export schedules operate staggered 7-day shifts; daysLeftToStageEnd and daysLeftToExFactory use UTC midnight day differences.'
          ),
          bulletItem(
            '[ASSUMPTION-07] Strict Buyer Gatekeeper & Tenant Isolation',
            'Buyer portals (/buyer/[token]) query strictly by buyer.accessToken and strip all unconfirmed floor notes (isMerchandiserConfirmed === false) and internal AI confidence metrics.'
          ),

          // Section 3
          heading1('3. System Architecture & Data Model'),
          bodyPara(
            'The system is built as a unified Full-Stack Next.js 14 (App Router) TypeScript application backed by Neon Serverless PostgreSQL via Prisma ORM. A single deployable unit eliminates CORS overhead on high-latency factory 3G/4G networks and keeps First Load JS around ~100 kB for low-end Android devices.'
          ),
          bulletItem(
            'User & Buyer Tables',
            'Role-based access (MERCHANDISER, SUPERVISOR) with unit assignment and preferredLang ("en" | "ta"); Buyer records hold unique accessToken strings for read-only portals.'
          ),
          bulletItem(
            'Order & TnaMilestone Tables',
            'Stores PO metadata, JSON sizeBreakdown matrix, currentStage, and sequential milestones (CUTTING, PRINTING, STITCHING, WASHING, FINISHING) with targetQty and completedQty.'
          ),
          bulletItem(
            'DailyUpdate Table (Idempotent + AI Gatekept)',
            'Includes unique clientSubmissionId for offline retry idempotency, rawNoteTamil, aiEnglishTranslation, aiReasonCategory, aiConfidence, finalReasonCategory, wasAiOverridden, and isMerchandiserConfirmed.'
          ),
          bulletItem(
            'DateChangeAudit Table',
            'Immutable compliance log recording oldDate, newDate, changedByUserId, and mandatory changeReason whenever a milestone or Ex-Factory date is modified.'
          ),

          // Section 4
          heading1('4. Core Engines: Run-Rate Math & Tamil AI Error Handling'),
          heading2('4.1 Deterministic Run-Rate Projection Engine (src/lib/run-rate.ts)'),
          bodyPara(
            'For any active milestone, Required Daily Rate = ceil(RemainingQty / DaysLeftToStageEnd), compared against Actual Daily Rate = round(mean(last 3 daily quantities)). Projected Days Needed = ceil(RemainingQty / ActualDailyRate). If ActualDailyRate == 0 while work remains, the engine flags isStalled = true (RED) without division-by-zero.'
          ),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  cell('PO Number', true),
                  cell('Stage & Remaining', true),
                  cell('Required vs Actual (3d)', true),
                  cell('Projected Outcome & Status', true),
                ],
              }),
              new TableRow({
                children: [
                  cell('B-PO-88213 (Company B - UK)'),
                  cell('STITCHING · 5,200 left / 14d'),
                  cell('Need 372 pcs/d · Making 240 pcs/d'),
                  cell('AMBER · 2-Week Early Warning (+8d stage slip, 18d to ship)'),
                ],
              }),
              new TableRow({
                children: [
                  cell('B-PO-88240 (Company B - UK)'),
                  cell('FINISHING · 2,800 left / 8d'),
                  cell('Need 350 pcs/d · Making 160 pcs/d'),
                  cell('RED · Critical Delay (Needs 18d -> Misses Nov 12 Ex-Factory by 8d)'),
                ],
              }),
              new TableRow({
                children: [
                  cell('C-PO-0488 (Company C - DE)'),
                  cell('PRINTING · 6,900 left / 20d'),
                  cell('Need 345 pcs/d · Making 420 pcs/d'),
                  cell('GREEN · On Track (+75 pcs/d buffer)'),
                ],
              }),
            ],
          }),

          heading2('4.2 Tamil-to-English AI Classifier & When It Is Wrong (src/lib/tamil-ai.ts)'),
          bodyPara(
            'Supervisors enter or speak Tamil notes on /supervisor. The backend calls Gemini 2.5 Flash (with automatic fallback to a deterministic Tamil garment-floor lexicon analyzer). Because AI can misclassify factory slang or vague notes, four safeguards are enforced: (1) Original Tamil text is always shown side-by-side with the English translation; (2) Notes with <70% confidence or vague wording are flagged as UNCLASSIFIED / Needs Manual Review; (3) Merchandisers can override the category in 1 click (setting wasAiOverridden = true); and (4) No warning is visible to buyers until isMerchandiserConfirmed is toggled true.'
          ),

          // Section 5
          heading1('5. UI Design System (DESIGN.md) & Scope Cuts'),
          bulletItem(
            '95% Monochrome Hairline System (DESIGN.md)',
            'Adapted from Cal.com and Vercel DESIGN.md tokens: #FAFAFA canvas, #FFFFFF surfaces with 1px solid #E4E4E7 hairlines, #09090B primary ink/CTAs, Inter headings, and JetBrains Mono tabular numerals. Color is reserved strictly for RED, AMBER, and GREEN schedule status pills. The Supervisor screen (/supervisor) features only numbers (36px centered input), a photo row, optional Tamil voice/text note, and a full-width solid black Send button.'
          ),
          bulletItem(
            'Deliberate Scope Cuts',
            'Excluded ERP fabric inventory, GST invoicing, payroll, and raw video uploads to keep the mobile app fast on 2 GB RAM phones and focused strictly on solving the 2-week delay warning problem.'
          ),
          bulletItem(
            'Phase 2 Roadmap',
            '(1) Direct WhatsApp voice-note webhook ingestion via Meta Cloud API; (2) Automated Friday PDF/CSV buyer digest emails; (3) QR bundle gate-pass scanning for subcontracted printing/washing units.'
          ),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const outPath = path.join(process.cwd(), 'Technical_Design_Document.docx');
  fs.writeFileSync(outPath, buffer);
  console.log(`✅ Generated Word document: ${outPath} (${buffer.length} bytes)`);
}

generateDocx().catch((err) => {
  console.error('Failed to generate DOCX:', err);
  process.exit(1);
});

