import { NextRequest, NextResponse } from 'next/server';
import { MilestoneStatus, ReasonCategory, Role } from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { classifyTamilFloorNote } from '@/lib/tamil-ai';
import { toUtcMidnightMs } from '@/lib/run-rate';

export async function POST(req: NextRequest) {
  try {
    const authCheck = await requireRole([Role.SUPERVISOR, Role.MERCHANDISER]);
    if (!authCheck.authorized) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: authCheck.status }
      );
    }

    const body = await req.json();
    const clientSubmissionId =
      typeof body.clientSubmissionId === 'string'
        ? body.clientSubmissionId.trim()
        : '';
    const orderId =
      typeof body.orderId === 'string' ? body.orderId.trim() : '';
    const milestoneId =
      typeof body.milestoneId === 'string' ? body.milestoneId.trim() : '';
    const qtyDoneToday = Number(body.qtyDoneToday);
    const photoUrl =
      typeof body.photoUrl === 'string' && body.photoUrl.trim().length > 0
        ? body.photoUrl.trim()
        : null;
    const rawNoteTamil =
      typeof body.rawNoteTamil === 'string' &&
      body.rawNoteTamil.trim().length > 0
        ? body.rawNoteTamil.trim()
        : null;
    const workDateStr =
      typeof body.workDate === 'string' && body.workDate.trim().length > 0
        ? body.workDate.trim()
        : '2026-11-02';

    if (
      !clientSubmissionId ||
      !orderId ||
      !milestoneId ||
      !Number.isInteger(qtyDoneToday) ||
      qtyDoneToday < 0
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid submission: clientSubmissionId, orderId, milestoneId, and non-negative integer qtyDoneToday are required.',
        },
        { status: 400 }
      );
    }

    // 1. Idempotency check for offline mobile queue sync
    const existingUpdate = await prisma.dailyUpdate.findUnique({
      where: { clientSubmissionId },
      include: {
        supervisor: {
          select: { id: true, name: true, assignedUnit: true },
        },
      },
    });

    if (existingUpdate) {
      return NextResponse.json(
        {
          update: existingUpdate,
          alreadySynced: true,
          message:
            'Idempotent replay: This floor update was already synced previously.',
        },
        { status: 200 }
      );
    }

    // 2. Verify order & milestone exist
    const milestone = await prisma.tnaMilestone.findFirst({
      where: { id: milestoneId, orderId },
    });

    if (!milestone) {
      return NextResponse.json(
        { error: 'Milestone not found for the specified order.' },
        { status: 404 }
      );
    }

    // 3. Classify Tamil floor note if present
    let aiEnglishTranslation: string | null = null;
    let aiReasonCategory: ReasonCategory | null = null;
    let aiConfidence: number | null = null;
    let finalReasonCategory: ReasonCategory | null = null;
    let needsManualReview = false;

    if (rawNoteTamil) {
      const aiResult = await classifyTamilFloorNote(rawNoteTamil);
      aiEnglishTranslation = aiResult.englishTranslation;
      aiReasonCategory = aiResult.reasonCategory as ReasonCategory;
      aiConfidence = aiResult.confidence;
      finalReasonCategory = aiResult.reasonCategory as ReasonCategory;
      needsManualReview = aiResult.needsManualReview;
    }

    const workDateMs = toUtcMidnightMs(workDateStr);
    const workDate = Number.isNaN(workDateMs)
      ? new Date('2026-11-02T00:00:00.000Z')
      : new Date(workDateMs);

    // 4. Atomic transaction: create DailyUpdate & increment TnaMilestone.completedQty
    const result = await prisma.$transaction(async (tx) => {
      const createdUpdate = await tx.dailyUpdate.create({
        data: {
          clientSubmissionId,
          orderId,
          milestoneId,
          supervisorId: authCheck.user.id,
          workDate,
          qtyDoneToday,
          photoUrl,
          rawNoteTamil,
          aiEnglishTranslation,
          aiReasonCategory,
          aiConfidence,
          finalReasonCategory,
          wasAiOverridden: false,
          isMerchandiserConfirmed: false,
        },
        include: {
          supervisor: {
            select: { id: true, name: true, assignedUnit: true },
          },
        },
      });

      const newCompletedQty = milestone.completedQty + qtyDoneToday;
      const newStatus =
        newCompletedQty >= milestone.targetQty
          ? MilestoneStatus.COMPLETED
          : MilestoneStatus.IN_PROGRESS;

      const updatedMilestone = await tx.tnaMilestone.update({
        where: { id: milestoneId },
        data: {
          completedQty: newCompletedQty,
          status: newStatus,
        },
      });

      return { createdUpdate, updatedMilestone };
    });

    return NextResponse.json(
      {
        update: {
          ...result.createdUpdate,
          needsManualReview,
        },
        milestone: result.updatedMilestone,
        alreadySynced: false,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/updates error:', error);
    return NextResponse.json(
      { error: 'Failed to record supervisor floor update.' },
      { status: 500 }
    );
  }
}
