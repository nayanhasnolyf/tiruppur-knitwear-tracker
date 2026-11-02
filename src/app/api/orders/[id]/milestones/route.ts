import { NextRequest, NextResponse } from 'next/server';
import { MilestoneStatus, ProductionStage, Role } from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { enrichOrderWithRunRate } from '@/lib/order-serializer';
import { toUtcMidnightMs } from '@/lib/run-rate';

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

    const body = await req.json();
    const orderId = params.id;
    const milestoneId =
      typeof body.milestoneId === 'string' ? body.milestoneId.trim() : null;
    const newDateStr =
      typeof body.newDate === 'string' ? body.newDate.trim() : '';
    const changeReason =
      typeof body.changeReason === 'string' ? body.changeReason.trim() : '';
    const fieldChanged =
      body.fieldChanged === 'exFactoryDate'
        ? 'exFactoryDate'
        : 'plannedEndDate';
    const newCurrentStage = body.currentStage as ProductionStage | undefined;

    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: { milestones: true },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    // Optional active stage transition by Merchandiser
    if (newCurrentStage && !newDateStr) {
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: orderId },
          data: { currentStage: newCurrentStage },
        });
        if (milestoneId && body.status) {
          await tx.tnaMilestone.update({
            where: { id: milestoneId },
            data: { status: body.status as MilestoneStatus },
          });
        }
      });
    } else {
      // Compliance Constraint: Any date modification requires a non-empty changeReason
      if (!newDateStr || !changeReason || changeReason.length < 5) {
        return NextResponse.json(
          {
            error:
              'Compliance violation: Changing a milestone or Ex-Factory date requires a valid newDate and a detailed changeReason (at least 5 characters) for the audit trail.',
          },
          { status: 400 }
        );
      }

      const parsedNewMs = toUtcMidnightMs(newDateStr);
      if (Number.isNaN(parsedNewMs)) {
        return NextResponse.json(
          { error: 'Invalid date format provided.' },
          { status: 400 }
        );
      }
      const newDate = new Date(parsedNewMs);

      await prisma.$transaction(async (tx) => {
        if (fieldChanged === 'exFactoryDate') {
          const oldDate = existingOrder.exFactoryDate;
          await tx.order.update({
            where: { id: orderId },
            data: { exFactoryDate: newDate },
          });
          await tx.dateChangeAudit.create({
            data: {
              orderId,
              milestoneId: null,
              fieldChanged: 'exFactoryDate',
              oldDate,
              newDate,
              changedByUserId: authCheck.user.id,
              changeReason,
            },
          });
        } else {
          const targetMilestone = existingOrder.milestones.find(
            (m) => m.id === milestoneId
          );
          if (!targetMilestone) {
            throw new Error('MILESTONE_NOT_FOUND');
          }
          const oldDate = targetMilestone.plannedEndDate;
          await tx.tnaMilestone.update({
            where: { id: targetMilestone.id },
            data: { plannedEndDate: newDate },
          });
          await tx.dateChangeAudit.create({
            data: {
              orderId,
              milestoneId: targetMilestone.id,
              fieldChanged: 'plannedEndDate',
              oldDate,
              newDate,
              changedByUserId: authCheck.user.id,
              changeReason,
            },
          });
        }
      });
    }

    const updatedOrder = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        buyer: true,
        milestones: { orderBy: { sequenceOrder: 'asc' } },
        dailyUpdates: {
          include: {
            supervisor: {
              select: { id: true, name: true, assignedUnit: true },
            },
          },
          orderBy: { workDate: 'desc' },
        },
        dateChangeAudits: {
          include: {
            changedByUser: {
              select: { id: true, name: true, role: true },
            },
            milestone: {
              select: { id: true, stageName: true },
            },
          },
          orderBy: { changedAt: 'desc' },
        },
      },
    });

    return NextResponse.json({
      order: enrichOrderWithRunRate(updatedOrder),
      message: 'Schedule updated and compliance audit logged.',
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'MILESTONE_NOT_FOUND') {
      return NextResponse.json(
        { error: 'Target TNA milestone not found on this order.' },
        { status: 404 }
      );
    }
    console.error('PATCH /api/orders/[id]/milestones error:', error);
    return NextResponse.json(
      { error: 'Failed to update schedule.' },
      { status: 500 }
    );
  }
}
