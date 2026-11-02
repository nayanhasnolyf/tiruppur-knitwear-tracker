import {
  Order,
  Buyer,
  TnaMilestone,
  DailyUpdate,
  DateChangeAudit,
  User,
} from '@prisma/client';
import { calculateOrderRunRate, RunRateResult, toUtcMidnightMs } from './run-rate';

export type OrderWithRelations = Order & {
  buyer: Buyer;
  milestones: TnaMilestone[];
  dailyUpdates: (DailyUpdate & {
    supervisor?: Pick<User, 'id' | 'name' | 'assignedUnit'>;
  })[];
  dateChangeAudits?: (DateChangeAudit & {
    changedByUser?: Pick<User, 'id' | 'name' | 'role'>;
    milestone?: Pick<TnaMilestone, 'id' | 'stageName'> | null;
  })[];
};

export interface EnrichedOrder extends OrderWithRelations {
  activeMilestone: TnaMilestone | null;
  runRate: RunRateResult;
  shipWeek: string;
  unconfirmedAiUpdatesCount: number;
  latestFloorUpdate:
    | (DailyUpdate & {
        supervisor?: Pick<User, 'id' | 'name' | 'assignedUnit'>;
        needsManualReview: boolean;
      })
    | null;
}

/**
 * Computes the ISO Monday date string (YYYY-MM-DD) of the week containing `dateInput`
 * for deterministic ship-week grouping & filtering.
 */
export function getShipWeekMonday(dateInput: Date | string): string {
  const utcMs = toUtcMidnightMs(dateInput);
  const d = new Date(utcMs);
  const day = d.getUTCDay(); // 0 (Sun) to 6 (Sat)
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(utcMs + diffToMonday * 24 * 60 * 60 * 1000);
  return monday.toISOString().slice(0, 10);
}

export function enrichOrderWithRunRate(
  order: OrderWithRelations,
  referenceDate = '2026-11-02T00:00:00.000Z'
): EnrichedOrder {
  const sortedMilestones = [...order.milestones].sort(
    (a, b) => a.sequenceOrder - b.sequenceOrder
  );

  const activeMilestone =
    sortedMilestones.find((m) => m.stageName === order.currentStage) ??
    sortedMilestones.find((m) => m.status === 'IN_PROGRESS') ??
    sortedMilestones[sortedMilestones.length - 1] ??
    null;

  // Chronological daily updates for the active milestone
  const milestoneUpdatesAsc = [...order.dailyUpdates]
    .filter((u) => !activeMilestone || u.milestoneId === activeMilestone.id)
    .sort(
      (a, b) =>
        new Date(a.workDate).getTime() - new Date(b.workDate).getTime()
    );

  const recentDailyQuantities = milestoneUpdatesAsc.map((u) => u.qtyDoneToday);

  const runRate = calculateOrderRunRate({
    totalQty: activeMilestone ? activeMilestone.targetQty : order.totalQty,
    completedQty: activeMilestone ? activeMilestone.completedQty : 0,
    stagePlannedEndDate: activeMilestone
      ? activeMilestone.plannedEndDate
      : order.exFactoryDate,
    exFactoryDate: order.exFactoryDate,
    recentDailyQuantities,
    referenceDate,
  });

  // Sort dailyUpdates newest-first for UI feeds
  const updatesDesc = [...order.dailyUpdates]
    .sort(
      (a, b) =>
        new Date(b.workDate).getTime() - new Date(a.workDate).getTime() ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .map((u) => {
      const conf = u.aiConfidence ?? 1;
      const cat = u.finalReasonCategory ?? u.aiReasonCategory;
      const needsManualReview =
        Boolean(u.rawNoteTamil) &&
        (conf < 0.7 || cat === 'UNCLASSIFIED' || cat === 'OTHER');
      return {
        ...u,
        needsManualReview,
      };
    });

  const unconfirmedAiUpdatesCount = updatesDesc.filter(
    (u) => Boolean(u.rawNoteTamil) && !u.isMerchandiserConfirmed
  ).length;

  return {
    ...order,
    milestones: sortedMilestones,
    dailyUpdates: updatesDesc,
    activeMilestone,
    runRate,
    shipWeek: getShipWeekMonday(order.exFactoryDate),
    unconfirmedAiUpdatesCount,
    latestFloorUpdate: updatesDesc[0] ?? null,
  };
}
