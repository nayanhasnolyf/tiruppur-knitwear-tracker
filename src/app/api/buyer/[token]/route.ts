import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { enrichOrderWithRunRate } from '@/lib/order-serializer';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const token = (params.token ?? '').trim();
    if (!token) {
      return NextResponse.json(
        { error: 'Invalid buyer access token.' },
        { status: 400 }
      );
    }

    // 1. Strict Tenant Lookup by accessToken
    const buyer = await prisma.buyer.findUnique({
      where: { accessToken: token },
    });

    if (!buyer) {
      return NextResponse.json(
        { error: 'Buyer portal link not found or expired.' },
        { status: 404 }
      );
    }

    // 2. Fetch ONLY orders belonging to this buyer.id (strict tenant isolation)
    const buyerOrdersRaw = await prisma.order.findMany({
      where: { buyerId: buyer.id },
      include: {
        buyer: true,
        milestones: {
          orderBy: { sequenceOrder: 'asc' },
        },
        dailyUpdates: {
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
    });

    // 3. Sanitize floor updates so Buyer ONLY sees merchandiser-confirmed notes/warnings
    //    and floor photos, never raw unconfirmed Tamil notes or internal AI confidence metrics.
    const sanitizedOrders = buyerOrdersRaw.map((rawOrder) => {
      const enriched = enrichOrderWithRunRate(rawOrder);

      const confirmedWarnings = enriched.dailyUpdates
        .filter((u) => u.isMerchandiserConfirmed)
        .map((u) => ({
          id: u.id,
          workDate: u.workDate,
          qtyDoneToday: u.qtyDoneToday,
          photoUrl: u.photoUrl,
          reasonCategory: u.finalReasonCategory ?? u.aiReasonCategory,
          buyerSummaryNote:
            u.merchandiserBuyerNote ||
            u.aiEnglishTranslation ||
            'Schedule recovery action in progress.',
        }));

      const recentDailyLog = enriched.dailyUpdates.map((u) => ({
        id: u.id,
        workDate: u.workDate,
        milestoneId: u.milestoneId,
        qtyDoneToday: u.qtyDoneToday,
        photoUrl: u.photoUrl,
        // Strictly withhold unconfirmed Tamil notes and unconfirmed AI translations
        confirmedNote: u.isMerchandiserConfirmed
          ? u.merchandiserBuyerNote || u.aiEnglishTranslation
          : null,
        confirmedReasonCategory: u.isMerchandiserConfirmed
          ? u.finalReasonCategory ?? u.aiReasonCategory
          : null,
      }));

      return {
        id: enriched.id,
        poNumber: enriched.poNumber,
        styleName: enriched.styleName,
        colour: enriched.colour,
        sizeBreakdown: enriched.sizeBreakdown,
        totalQty: enriched.totalQty,
        productionUnit: enriched.productionUnit,
        exFactoryDate: enriched.exFactoryDate,
        currentStage: enriched.currentStage,
        shipWeek: enriched.shipWeek,
        milestones: enriched.milestones,
        activeMilestone: enriched.activeMilestone,
        runRate: enriched.runRate,
        confirmedWarnings,
        recentDailyLog,
        dateChangeAudits: enriched.dateChangeAudits ?? [],
      };
    });

    return NextResponse.json({
      buyer: {
        id: buyer.id,
        name: buyer.name,
        country: buyer.country,
        contactEmail: buyer.contactEmail,
      },
      orders: sanitizedOrders,
    });
  } catch (error) {
    console.error('GET /api/buyer/[token] error:', error);
    return NextResponse.json(
      { error: 'Failed to load buyer portal data.' },
      { status: 500 }
    );
  }
}
