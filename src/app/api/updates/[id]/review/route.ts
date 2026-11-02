import { NextRequest, NextResponse } from 'next/server';
import { ReasonCategory, Role } from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

const VALID_CATEGORIES = new Set<string>([
  'MACHINE_BREAKDOWN',
  'FABRIC_DEFECT',
  'POWER_CUT',
  'WORKER_SHORTAGE',
  'PRINT_WASH_DELAY',
  'QUALITY_REWORK',
  'OTHER',
  'UNCLASSIFIED',
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authCheck = await requireRole([Role.MERCHANDISER]);
    if (!authCheck.authorized) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: authCheck.status }
      );
    }

    const updateId = params.id;
    const existing = await prisma.dailyUpdate.findUnique({
      where: { id: updateId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Daily floor update not found.' },
        { status: 404 }
      );
    }

    const body = await req.json();

    let finalReasonCategory = existing.finalReasonCategory;
    let wasAiOverridden = existing.wasAiOverridden;

    if (
      typeof body.finalReasonCategory === 'string' &&
      VALID_CATEGORIES.has(body.finalReasonCategory)
    ) {
      finalReasonCategory = body.finalReasonCategory as ReasonCategory;
      if (
        existing.aiReasonCategory &&
        finalReasonCategory !== existing.aiReasonCategory
      ) {
        wasAiOverridden = true;
      }
    }

    const aiEnglishTranslation =
      typeof body.aiEnglishTranslation === 'string'
        ? body.aiEnglishTranslation.trim()
        : existing.aiEnglishTranslation;

    const merchandiserBuyerNote =
      typeof body.merchandiserBuyerNote === 'string'
        ? body.merchandiserBuyerNote.trim() || null
        : existing.merchandiserBuyerNote;

    const isMerchandiserConfirmed =
      typeof body.isMerchandiserConfirmed === 'boolean'
        ? body.isMerchandiserConfirmed
        : existing.isMerchandiserConfirmed;

    const updated = await prisma.dailyUpdate.update({
      where: { id: updateId },
      data: {
        finalReasonCategory,
        wasAiOverridden,
        aiEnglishTranslation,
        merchandiserBuyerNote,
        isMerchandiserConfirmed,
      },
      include: {
        supervisor: {
          select: { id: true, name: true, assignedUnit: true },
        },
      },
    });

    return NextResponse.json({
      update: updated,
      message: isMerchandiserConfirmed
        ? 'Floor update verified and published to Buyer Portal.'
        : 'Floor update review saved (hidden from Buyer Portal).',
    });
  } catch (error) {
    console.error('PATCH /api/updates/[id]/review error:', error);
    return NextResponse.json(
      { error: 'Failed to update merchandiser review.' },
      { status: 500 }
    );
  }
}
