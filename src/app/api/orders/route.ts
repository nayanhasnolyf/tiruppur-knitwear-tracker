import { NextRequest, NextResponse } from 'next/server';
import {
  MilestoneStatus,
  ProductionStage,
  Role,
} from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { enrichOrderWithRunRate } from '@/lib/order-serializer';
import { toUtcMidnightMs } from '@/lib/run-rate';

export const dynamic = 'force-dynamic';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const buyerId = searchParams.get('buyerId') || '';
    const unit = searchParams.get('unit') || '';
    const statusFilter = searchParams.get('status') || '';
    const shipWeek = searchParams.get('shipWeek') || '';

    const whereClause: Record<string, unknown> = {};
    if (buyerId && buyerId !== 'ALL') {
      whereClause.buyerId = buyerId;
    }
    if (unit && unit !== 'ALL') {
      whereClause.productionUnit = unit;
    }

    const [ordersRaw, buyers, allOrdersForMeta] = await Promise.all([
      prisma.order.findMany({
        where: whereClause,
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
        orderBy: { exFactoryDate: 'asc' },
      }),
      prisma.buyer.findMany({
        orderBy: { name: 'asc' },
      }),
      prisma.order.findMany({
        select: { productionUnit: true, exFactoryDate: true },
      }),
    ]);

    let enrichedOrders = ordersRaw.map((o) => enrichOrderWithRunRate(o));

    if (statusFilter && statusFilter !== 'ALL') {
      enrichedOrders = enrichedOrders.filter(
        (o) => o.runRate.status === statusFilter
      );
    }

    if (shipWeek && shipWeek !== 'ALL') {
      enrichedOrders = enrichedOrders.filter((o) => o.shipWeek === shipWeek);
    }

    const uniqueUnits = Array.from(
      new Set(allOrdersForMeta.map((o) => o.productionUnit))
    ).sort();

    const uniqueShipWeeks = Array.from(
      new Set(
        ordersRaw.map((o) => enrichOrderWithRunRate(o).shipWeek)
      )
    ).sort();

    return NextResponse.json({
      orders: enrichedOrders,
      filters: {
        buyers,
        units: uniqueUnits,
        shipWeeks: uniqueShipWeeks,
      },
    });
  } catch (error) {
    console.error('GET /api/orders error:', error);
    return NextResponse.json(
      { error: 'Failed to load orders.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authCheck = await requireRole([Role.MERCHANDISER]);
    if (!authCheck.authorized) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: authCheck.status }
      );
    }

    const body = await req.json();
    const poNumber =
      typeof body.poNumber === 'string' ? body.poNumber.trim() : '';
    const buyerId =
      typeof body.buyerId === 'string' ? body.buyerId.trim() : '';
    const styleName =
      typeof body.styleName === 'string' ? body.styleName.trim() : '';
    const colour =
      typeof body.colour === 'string' ? body.colour.trim() : '';
    const productionUnit =
      typeof body.productionUnit === 'string'
        ? body.productionUnit.trim()
        : '';
    const exFactoryDateStr =
      typeof body.exFactoryDate === 'string' ? body.exFactoryDate.trim() : '';
    const templateType =
      body.templateType === 'PRINTED_TEE' ? 'PRINTED_TEE' : 'SOLID_BASIC';

    const sizeBreakdown =
      body.sizeBreakdown && typeof body.sizeBreakdown === 'object'
        ? body.sizeBreakdown
        : { S: 1000, M: 2000, L: 2000, XL: 1000 };

    const totalQty = Number(body.totalQty);

    if (
      !poNumber ||
      !buyerId ||
      !styleName ||
      !colour ||
      !productionUnit ||
      !exFactoryDateStr ||
      !Number.isInteger(totalQty) ||
      totalQty <= 0
    ) {
      return NextResponse.json(
        {
          error:
            'Missing or invalid required fields (poNumber, buyerId, styleName, colour, totalQty > 0, productionUnit, exFactoryDate).',
        },
        { status: 400 }
      );
    }

    const existingPo = await prisma.order.findUnique({
      where: { poNumber },
    });
    if (existingPo) {
      return NextResponse.json(
        { error: `PO Number "${poNumber}" already exists.` },
        { status: 409 }
      );
    }

    const exFactoryMs = toUtcMidnightMs(exFactoryDateStr);
    if (Number.isNaN(exFactoryMs)) {
      return NextResponse.json(
        { error: 'Invalid exFactoryDate format.' },
        { status: 400 }
      );
    }

    // Build backward TNA milestone schedule from exFactoryDate
    const stages: {
      stageName: ProductionStage;
      startOffsetDays: number;
      endOffsetDays: number;
    }[] =
      templateType === 'PRINTED_TEE'
        ? [
            {
              stageName: ProductionStage.CUTTING,
              startOffsetDays: -26,
              endOffsetDays: -21,
            },
            {
              stageName: ProductionStage.PRINTING,
              startOffsetDays: -20,
              endOffsetDays: -13,
            },
            {
              stageName: ProductionStage.STITCHING,
              startOffsetDays: -12,
              endOffsetDays: -6,
            },
            {
              stageName: ProductionStage.WASHING,
              startOffsetDays: -5,
              endOffsetDays: -3,
            },
            {
              stageName: ProductionStage.FINISHING,
              startOffsetDays: -2,
              endOffsetDays: -1,
            },
          ]
        : [
            {
              stageName: ProductionStage.CUTTING,
              startOffsetDays: -22,
              endOffsetDays: -17,
            },
            {
              stageName: ProductionStage.STITCHING,
              startOffsetDays: -16,
              endOffsetDays: -6,
            },
            {
              stageName: ProductionStage.WASHING,
              startOffsetDays: -5,
              endOffsetDays: -3,
            },
            {
              stageName: ProductionStage.FINISHING,
              startOffsetDays: -2,
              endOffsetDays: -1,
            },
          ];

    const createdOrder = await prisma.order.create({
      data: {
        poNumber,
        buyerId,
        styleName,
        colour,
        sizeBreakdown,
        totalQty,
        productionUnit,
        exFactoryDate: new Date(exFactoryMs),
        currentStage: ProductionStage.CUTTING,
        milestones: {
          create: stages.map((st, idx) => ({
            stageName: st.stageName,
            sequenceOrder: idx + 1,
            plannedStartDate: new Date(
              exFactoryMs + st.startOffsetDays * MS_PER_DAY
            ),
            plannedEndDate: new Date(
              exFactoryMs + st.endOffsetDays * MS_PER_DAY
            ),
            targetQty: totalQty,
            completedQty: 0,
            status:
              idx === 0
                ? MilestoneStatus.IN_PROGRESS
                : MilestoneStatus.PENDING,
          })),
        },
      },
      include: {
        buyer: true,
        milestones: { orderBy: { sequenceOrder: 'asc' } },
        dailyUpdates: true,
        dateChangeAudits: true,
      },
    });

    return NextResponse.json(
      { order: enrichOrderWithRunRate(createdOrder) },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/orders error:', error);
    return NextResponse.json(
      { error: 'Failed to create order and TNA schedule.' },
      { status: 500 }
    );
  }
}
