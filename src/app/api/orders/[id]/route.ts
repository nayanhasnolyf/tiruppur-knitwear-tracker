import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { enrichOrderWithRunRate } from '@/lib/order-serializer';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: {
        buyer: true,
        milestones: {
          orderBy: { sequenceOrder: 'asc' },
        },
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

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      order: enrichOrderWithRunRate(order),
    });
  } catch (error) {
    console.error('GET /api/orders/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order details.' },
      { status: 500 }
    );
  }
}
