import {
  PrismaClient,
  Role,
  ProductionStage,
  MilestoneStatus,
  ReasonCategory,
} from '@prisma/client';

const prisma = new PrismaClient();

// Anchor date: 2026-11-02 ("Today")
const d = (dateStr: string) => new Date(`${dateStr}T00:00:00.000Z`);

async function main() {
  console.log('🌱 Starting deterministic seed for Tiruppur Knitwear Production Tracker...');

  // Clean existing records in reverse dependency order
  await prisma.dateChangeAudit.deleteMany();
  await prisma.dailyUpdate.deleteMany();
  await prisma.tnaMilestone.deleteMany();
  await prisma.order.deleteMany();
  await prisma.buyer.deleteMany();
  await prisma.user.deleteMany();

  // 1. Seed 3 Users
  const merchandiser = await prisma.user.create({
    data: {
      name: 'Karthik Rajan',
      email: 'merchandiser@tiruppurknit.com',
      passwordHash: 'demo123',
      role: Role.MERCHANDISER,
      assignedUnit: null,
      preferredLang: 'en',
    },
  });

  const supervisor1 = await prisma.user.create({
    data: {
      name: 'Murugan K',
      email: 'supervisor1@tiruppurknit.com',
      passwordHash: 'demo123',
      role: Role.SUPERVISOR,
      assignedUnit: 'Unit 1',
      preferredLang: 'ta',
    },
  });

  const supervisor2 = await prisma.user.create({
    data: {
      name: 'Senthil V',
      email: 'supervisor2@tiruppurknit.com',
      passwordHash: 'demo123',
      role: Role.SUPERVISOR,
      assignedUnit: 'Unit 2',
      preferredLang: 'ta',
    },
  });

  console.log('✅ Seeded 3 users (Karthik Rajan, Murugan K, Senthil V)');

  // 2. Seed 2 Buyers with deterministic accessToken strings
  const buyerB = await prisma.buyer.create({
    data: {
      name: 'Company B · UK',
      country: 'United Kingdom',
      contactEmail: 'sourcing@companyb.co.uk',
      accessToken: 'uk-company-b-readonly-2026',
    },
  });

  const buyerC = await prisma.buyer.create({
    data: {
      name: 'Company C · Germany',
      country: 'Germany',
      contactEmail: 'buying@companyc.de',
      accessToken: 'de-company-c-readonly-2026',
    },
  });

  console.log('✅ Seeded 2 buyers with deterministic read-only tokens');

  // =========================================================================
  // 3. Seed 3 Exact Orders with TNA Milestones & 5-Day Floor History
  // =========================================================================

  // -------------------------------------------------------------------------
  // ORDER 1: B-PO-88213 (YELLOW — 2-week early warning)
  // Buyer: Company B (UK), Style: "Men's crew neck tee, navy", Total Qty: 12000
  // Unit: "Unit 1", Ex-Factory: 2026-11-20, Current Stage: STITCHING
  // STITCHING completedQty: 6800, plannedEndDate: 2026-11-16 (14 days left -> 372 pcs/day needed)
  // Last 3 daily updates: 250, 230, 240 (avg = 240 pcs/day)
  // -------------------------------------------------------------------------
  const order1 = await prisma.order.create({
    data: {
      poNumber: 'B-PO-88213',
      buyerId: buyerB.id,
      styleName: "Men's crew neck tee, navy",
      colour: 'Navy',
      sizeBreakdown: { S: 2000, M: 4000, L: 4000, XL: 2000 },
      totalQty: 12000,
      productionUnit: 'Unit 1',
      exFactoryDate: d('2026-11-20'),
      currentStage: ProductionStage.STITCHING,
      createdAt: d('2026-10-15'),
    },
  });

  await prisma.tnaMilestone.create({
    data: {
      orderId: order1.id,
      stageName: ProductionStage.CUTTING,
      sequenceOrder: 1,
      plannedStartDate: d('2026-10-18'),
      plannedEndDate: d('2026-10-24'),
      targetQty: 12000,
      completedQty: 12000,
      status: MilestoneStatus.COMPLETED,
    },
  });

  const o1Stitching = await prisma.tnaMilestone.create({
    data: {
      orderId: order1.id,
      stageName: ProductionStage.STITCHING,
      sequenceOrder: 2,
      plannedStartDate: d('2026-10-25'),
      plannedEndDate: d('2026-11-16'),
      targetQty: 12000,
      completedQty: 6800,
      status: MilestoneStatus.IN_PROGRESS,
    },
  });

  await prisma.tnaMilestone.create({
    data: {
      orderId: order1.id,
      stageName: ProductionStage.WASHING,
      sequenceOrder: 3,
      plannedStartDate: d('2026-11-14'),
      plannedEndDate: d('2026-11-17'),
      targetQty: 12000,
      completedQty: 0,
      status: MilestoneStatus.PENDING,
    },
  });

  await prisma.tnaMilestone.create({
    data: {
      orderId: order1.id,
      stageName: ProductionStage.FINISHING,
      sequenceOrder: 4,
      plannedStartDate: d('2026-11-17'),
      plannedEndDate: d('2026-11-19'),
      targetQty: 12000,
      completedQty: 0,
      status: MilestoneStatus.PENDING,
    },
  });

  // 5-day floor history for B-PO-88213 (2026-10-29 to 2026-11-02)
  // Last 3 days: 250, 230, 240
  const o1Updates = [
    {
      clientSubmissionId: 'seed-b88213-2026-10-29',
      workDate: d('2026-10-29'),
      qtyDoneToday: 620,
    },
    {
      clientSubmissionId: 'seed-b88213-2026-10-30',
      workDate: d('2026-10-30'),
      qtyDoneToday: 590,
    },
    {
      clientSubmissionId: 'seed-b88213-2026-10-31',
      workDate: d('2026-10-31'),
      qtyDoneToday: 250,
    },
    {
      clientSubmissionId: 'seed-b88213-2026-11-01',
      workDate: d('2026-11-01'),
      qtyDoneToday: 230,
    },
    {
      clientSubmissionId: 'seed-b88213-2026-11-02',
      workDate: d('2026-11-02'),
      qtyDoneToday: 240,
      rawNoteTamil: 'ஊசி தட்டு உடைந்துவிட்டது, 2 தையல் இயந்திரங்கள் 4 மணி நேரம் நின்றன',
      aiEnglishTranslation: 'Needle plate broke, 2 sewing machines stopped for 4 hours',
      aiReasonCategory: ReasonCategory.MACHINE_BREAKDOWN,
      finalReasonCategory: ReasonCategory.MACHINE_BREAKDOWN,
      aiConfidence: 0.94,
      wasAiOverridden: false,
      isMerchandiserConfirmed: false,
    },
  ];

  for (const u of o1Updates) {
    await prisma.dailyUpdate.create({
      data: {
        ...u,
        orderId: order1.id,
        milestoneId: o1Stitching.id,
        supervisorId: supervisor1.id,
      },
    });
  }

  // -------------------------------------------------------------------------
  // ORDER 2: B-PO-88240 (RED — Critical Delay, projected past Ex-Factory Date)
  // Buyer: Company B (UK), Style: "Men's polo, white", Total Qty: 8000
  // Unit: "Unit 2", Ex-Factory: 2026-11-12, Current Stage: FINISHING
  // FINISHING completedQty: 5200, plannedEndDate: 2026-11-10 (8 days left -> 350 pcs/day needed)
  // Last 3 daily updates: 170, 150, 160 (avg = 160 pcs/day)
  // -------------------------------------------------------------------------
  const order2 = await prisma.order.create({
    data: {
      poNumber: 'B-PO-88240',
      buyerId: buyerB.id,
      styleName: "Men's polo, white",
      colour: 'White',
      sizeBreakdown: { S: 1500, M: 2500, L: 2500, XL: 1500 },
      totalQty: 8000,
      productionUnit: 'Unit 2',
      exFactoryDate: d('2026-11-12'),
      currentStage: ProductionStage.FINISHING,
      createdAt: d('2026-10-10'),
    },
  });

  await prisma.tnaMilestone.create({
    data: {
      orderId: order2.id,
      stageName: ProductionStage.CUTTING,
      sequenceOrder: 1,
      plannedStartDate: d('2026-10-12'),
      plannedEndDate: d('2026-10-16'),
      targetQty: 8000,
      completedQty: 8000,
      status: MilestoneStatus.COMPLETED,
    },
  });

  await prisma.tnaMilestone.create({
    data: {
      orderId: order2.id,
      stageName: ProductionStage.STITCHING,
      sequenceOrder: 2,
      plannedStartDate: d('2026-10-17'),
      plannedEndDate: d('2026-10-25'),
      targetQty: 8000,
      completedQty: 8000,
      status: MilestoneStatus.COMPLETED,
    },
  });

  const o2Washing = await prisma.tnaMilestone.create({
    data: {
      orderId: order2.id,
      stageName: ProductionStage.WASHING,
      sequenceOrder: 3,
      plannedStartDate: d('2026-10-26'),
      plannedEndDate: d('2026-10-28'),
      targetQty: 8000,
      completedQty: 8000,
      status: MilestoneStatus.COMPLETED,
    },
  });

  const o2Finishing = await prisma.tnaMilestone.create({
    data: {
      orderId: order2.id,
      stageName: ProductionStage.FINISHING,
      sequenceOrder: 4,
      plannedStartDate: d('2026-10-29'),
      plannedEndDate: d('2026-11-10'),
      targetQty: 8000,
      completedQty: 5200,
      status: MilestoneStatus.IN_PROGRESS,
    },
  });

  // 5-day floor history for B-PO-88240 (2026-10-29 to 2026-11-02)
  // Last 3 days: 170, 150, 160
  const o2Updates = [
    {
      clientSubmissionId: 'seed-b88240-2026-10-29',
      workDate: d('2026-10-29'),
      qtyDoneToday: 440,
    },
    {
      clientSubmissionId: 'seed-b88240-2026-10-30',
      workDate: d('2026-10-30'),
      qtyDoneToday: 410,
    },
    {
      clientSubmissionId: 'seed-b88240-2026-10-31',
      workDate: d('2026-10-31'),
      qtyDoneToday: 170,
    },
    {
      clientSubmissionId: 'seed-b88240-2026-11-01',
      workDate: d('2026-11-01'),
      qtyDoneToday: 150,
    },
    {
      clientSubmissionId: 'seed-b88240-2026-11-02',
      workDate: d('2026-11-02'),
      qtyDoneToday: 160,
      rawNoteTamil: 'காலர் பகுதியில் எண்ணெய் கறை உள்ளது, மறுபடியும் வாஷிங் செய்ய வேண்டும்',
      aiEnglishTranslation: 'Oil stain found on collar area, requires re-washing before packing',
      aiReasonCategory: ReasonCategory.QUALITY_REWORK,
      finalReasonCategory: ReasonCategory.QUALITY_REWORK,
      aiConfidence: 0.91,
      wasAiOverridden: false,
      isMerchandiserConfirmed: true,
      merchandiserBuyerNote:
        'Collar stain rework in progress; extra evening shift added to recover schedule.',
    },
  ];

  for (const u of o2Updates) {
    await prisma.dailyUpdate.create({
      data: {
        ...u,
        orderId: order2.id,
        milestoneId: o2Finishing.id,
        supervisorId: supervisor2.id,
      },
    });
  }

  // -------------------------------------------------------------------------
  // ORDER 3: C-PO-0488 (GREEN — On Track)
  // Buyer: Company C (Germany), Style: "Kids printed tee, yellow", Total Qty: 10000
  // Unit: "Subcontract - Printing", Ex-Factory: 2026-11-28, Current Stage: PRINTING
  // PRINTING completedQty: 3100, plannedEndDate: 2026-11-22 (20 days left -> 345 pcs/day needed)
  // Last 3 daily updates: 410, 430, 420 (avg = 420 pcs/day)
  // -------------------------------------------------------------------------
  const order3 = await prisma.order.create({
    data: {
      poNumber: 'C-PO-0488',
      buyerId: buyerC.id,
      styleName: 'Kids printed tee, yellow',
      colour: 'Yellow',
      sizeBreakdown: { '4Y': 2500, '6Y': 2500, '8Y': 2500, '10Y': 2500 },
      totalQty: 10000,
      productionUnit: 'Subcontract - Printing',
      exFactoryDate: d('2026-11-28'),
      currentStage: ProductionStage.PRINTING,
      createdAt: d('2026-10-20'),
    },
  });

  await prisma.tnaMilestone.create({
    data: {
      orderId: order3.id,
      stageName: ProductionStage.CUTTING,
      sequenceOrder: 1,
      plannedStartDate: d('2026-10-22'),
      plannedEndDate: d('2026-10-27'),
      targetQty: 10000,
      completedQty: 10000,
      status: MilestoneStatus.COMPLETED,
    },
  });

  const o3Printing = await prisma.tnaMilestone.create({
    data: {
      orderId: order3.id,
      stageName: ProductionStage.PRINTING,
      sequenceOrder: 2,
      plannedStartDate: d('2026-10-28'),
      plannedEndDate: d('2026-11-22'),
      targetQty: 10000,
      completedQty: 3100,
      status: MilestoneStatus.IN_PROGRESS,
    },
  });

  await prisma.tnaMilestone.create({
    data: {
      orderId: order3.id,
      stageName: ProductionStage.STITCHING,
      sequenceOrder: 3,
      plannedStartDate: d('2026-11-18'),
      plannedEndDate: d('2026-11-24'),
      targetQty: 10000,
      completedQty: 0,
      status: MilestoneStatus.PENDING,
    },
  });

  await prisma.tnaMilestone.create({
    data: {
      orderId: order3.id,
      stageName: ProductionStage.WASHING,
      sequenceOrder: 4,
      plannedStartDate: d('2026-11-24'),
      plannedEndDate: d('2026-11-26'),
      targetQty: 10000,
      completedQty: 0,
      status: MilestoneStatus.PENDING,
    },
  });

  await prisma.tnaMilestone.create({
    data: {
      orderId: order3.id,
      stageName: ProductionStage.FINISHING,
      sequenceOrder: 5,
      plannedStartDate: d('2026-11-26'),
      plannedEndDate: d('2026-11-27'),
      targetQty: 10000,
      completedQty: 0,
      status: MilestoneStatus.PENDING,
    },
  });

  // 5-day floor history for C-PO-0488 (2026-10-29 to 2026-11-02)
  // Last 3 days: 410, 430, 420
  const o3Updates = [
    {
      clientSubmissionId: 'seed-c0488-2026-10-29',
      workDate: d('2026-10-29'),
      qtyDoneToday: 390,
    },
    {
      clientSubmissionId: 'seed-c0488-2026-10-30',
      workDate: d('2026-10-30'),
      qtyDoneToday: 400,
    },
    {
      clientSubmissionId: 'seed-c0488-2026-10-31',
      workDate: d('2026-10-31'),
      qtyDoneToday: 410,
    },
    {
      clientSubmissionId: 'seed-c0488-2026-11-01',
      workDate: d('2026-11-01'),
      qtyDoneToday: 430,
    },
    {
      clientSubmissionId: 'seed-c0488-2026-11-02',
      workDate: d('2026-11-02'),
      qtyDoneToday: 420,
    },
  ];

  for (const u of o3Updates) {
    await prisma.dailyUpdate.create({
      data: {
        ...u,
        orderId: order3.id,
        milestoneId: o3Printing.id,
        supervisorId: supervisor1.id,
      },
    });
  }

  console.log('✅ Seeded 3 orders, 13 TNA milestones, and 15 daily updates');

  // -------------------------------------------------------------------------
  // 4. Seed 2 DateChangeAudit entries on B-PO-88240
  // -------------------------------------------------------------------------
  await prisma.dateChangeAudit.create({
    data: {
      orderId: order2.id,
      milestoneId: o2Washing.id,
      fieldChanged: 'plannedEndDate',
      oldDate: d('2026-10-27'),
      newDate: d('2026-10-28'),
      changedByUserId: merchandiser.id,
      changeReason:
        'Softener batch testing took 24h longer at washing unit to meet UK buyer pH 6.5 compliance standard.',
      changedAt: new Date('2026-10-27T11:15:00.000Z'),
    },
  });

  await prisma.dateChangeAudit.create({
    data: {
      orderId: order2.id,
      milestoneId: o2Finishing.id,
      fieldChanged: 'plannedEndDate',
      oldDate: d('2026-11-08'),
      newDate: d('2026-11-10'),
      changedByUserId: merchandiser.id,
      changeReason:
        'Shifted finishing completion by 2 days to accommodate collar oil-stain spot re-washing and 100% AQL 1.5 inspection.',
      changedAt: new Date('2026-11-02T09:30:00.000Z'),
    },
  });

  console.log('✅ Seeded 2 DateChangeAudit entries on B-PO-88240');
  console.log('🎉 Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

