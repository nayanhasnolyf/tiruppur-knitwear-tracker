'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Check,
  Edit3,
  ExternalLink,
  EyeOff,
  Loader2,
  X,
} from 'lucide-react';

const REASON_CATEGORIES = [
  { value: 'MACHINE_BREAKDOWN', label: 'MACHINE_BREAKDOWN · Sewing / Needle' },
  { value: 'QUALITY_REWORK', label: 'QUALITY_REWORK · Stain / Rework' },
  { value: 'FABRIC_DEFECT', label: 'FABRIC_DEFECT · Fabric / GSM' },
  { value: 'POWER_CUT', label: 'POWER_CUT · EB Power Outage' },
  { value: 'WORKER_SHORTAGE', label: 'WORKER_SHORTAGE · Operator Absent' },
  { value: 'PRINT_WASH_DELAY', label: 'PRINT_WASH_DELAY · Print / Wash' },
  { value: 'OTHER', label: 'OTHER · Other Issue' },
  { value: 'UNCLASSIFIED', label: 'UNCLASSIFIED · Uncertain Note' },
];

interface BuyerInfo {
  id: string;
  name: string;
  country: string;
  contactEmail: string;
  accessToken: string;
}

interface MilestoneItem {
  id: string;
  stageName: string;
  sequenceOrder: number;
  plannedStartDate: string;
  plannedEndDate: string;
  targetQty: number;
  completedQty: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
}

interface FloorUpdateItem {
  id: string;
  clientSubmissionId: string;
  milestoneId: string;
  workDate: string;
  qtyDoneToday: number;
  photoUrl: string | null;
  rawNoteTamil: string | null;
  aiEnglishTranslation: string | null;
  aiReasonCategory: string | null;
  aiConfidence: number | null;
  finalReasonCategory: string | null;
  wasAiOverridden: boolean;
  isMerchandiserConfirmed: boolean;
  merchandiserBuyerNote: string | null;
  needsManualReview: boolean;
  supervisor?: {
    id: string;
    name: string;
    assignedUnit: string | null;
  };
}

interface AuditEntry {
  id: string;
  fieldChanged: string;
  oldDate: string;
  newDate: string;
  changeReason: string;
  changedAt: string;
  changedByUser?: {
    id: string;
    name: string;
    role: string;
  };
  milestone?: {
    id: string;
    stageName: string;
  } | null;
}

interface RunRateData {
  totalQty: number;
  completedQty: number;
  remainingQty: number;
  completionPercentage: number;
  daysLeftToStageEnd: number;
  daysLeftToExFactory: number;
  requiredDailyRate: number;
  actualDailyRate: number;
  dailyShortfallOrSurplus: number;
  projectedDaysNeeded: number | null;
  projectedCompletionDate: string | null;
  projectedSlipDays: number | null;
  projectedExFactorySlipDays: number | null;
  isStalled: boolean;
  status: 'GREEN' | 'YELLOW' | 'RED';
  isTwoWeekEarlyWarning: boolean;
  mathSummary: string;
  warningHeadline: string;
}

interface OrderDetailData {
  id: string;
  poNumber: string;
  buyer: BuyerInfo;
  styleName: string;
  colour: string;
  sizeBreakdown: Record<string, number>;
  totalQty: number;
  productionUnit: string;
  exFactoryDate: string;
  currentStage: string;
  milestones: MilestoneItem[];
  activeMilestone: MilestoneItem | null;
  dailyUpdates: FloorUpdateItem[];
  dateChangeAudits: AuditEntry[];
  runRate: RunRateData;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function toInputDate(dateStr: string): string {
  return new Date(dateStr).toISOString().slice(0, 10);
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = params.id;

  const [order, setOrder] = useState<OrderDetailData | null>(null);
  const [userRole, setUserRole] = useState<'MERCHANDISER' | 'SUPERVISOR'>(
    'MERCHANDISER'
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date-change compliance modal state
  const [editingDateTarget, setEditingDateTarget] = useState<{
    fieldChanged: 'plannedEndDate' | 'exFactoryDate';
    milestoneId: string | null;
    label: string;
    currentDate: string;
  } | null>(null);
  const [newTargetDate, setNewTargetDate] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [savingDateChange, setSavingDateChange] = useState(false);
  const [dateChangeError, setDateChangeError] = useState<string | null>(null);

  // Per-update review state map
  const [reviewDrafts, setReviewDrafts] = useState<
    Record<
      string,
      {
        finalReasonCategory: string;
        merchandiserBuyerNote: string;
        saving: boolean;
        feedback: string | null;
      }
    >
  >({});

  const fetchOrderDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [orderRes, authRes] = await Promise.all([
        fetch(`/api/orders/${orderId}`, { cache: 'no-store' }),
        fetch('/api/auth/me', { cache: 'no-store' }),
      ]);

      if (!orderRes.ok) {
        const errData = await orderRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Order not found.');
      }

      const data = await orderRes.json();
      const loadedOrder: OrderDetailData = data.order;
      setOrder(loadedOrder);

      const drafts: Record<
        string,
        {
          finalReasonCategory: string;
          merchandiserBuyerNote: string;
          saving: boolean;
          feedback: string | null;
        }
      > = {};
      for (const u of loadedOrder.dailyUpdates) {
        drafts[u.id] = {
          finalReasonCategory:
            u.finalReasonCategory || u.aiReasonCategory || 'UNCLASSIFIED',
          merchandiserBuyerNote:
            u.merchandiserBuyerNote || u.aiEnglishTranslation || '',
          saving: false,
          feedback: null,
        };
      }
      setReviewDrafts(drafts);

      if (authRes.ok) {
        const authData = await authRes.json();
        if (authData.user?.role) {
          setUserRole(authData.user.role);
        }
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to load order details.'
      );
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrderDetail();
    const onAuthChange = () => fetchOrderDetail();
    window.addEventListener('tk-auth-changed', onAuthChange);
    return () => window.removeEventListener('tk-auth-changed', onAuthChange);
  }, [fetchOrderDetail]);

  const openDateEditModal = (target: {
    fieldChanged: 'plannedEndDate' | 'exFactoryDate';
    milestoneId: string | null;
    label: string;
    currentDate: string;
  }) => {
    setEditingDateTarget(target);
    setNewTargetDate(toInputDate(target.currentDate));
    setChangeReason('');
    setDateChangeError(null);
  };

  const handleSaveDateChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDateTarget || !order) return;

    setDateChangeError(null);
    setSavingDateChange(true);

    try {
      const res = await fetch(`/api/orders/${order.id}/milestones`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldChanged: editingDateTarget.fieldChanged,
          milestoneId: editingDateTarget.milestoneId,
          newDate: newTargetDate,
          changeReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setDateChangeError(data.error || 'Failed to update schedule date.');
        return;
      }

      setOrder(data.order);
      setEditingDateTarget(null);
    } catch {
      setDateChangeError('Network error while saving schedule change.');
    } finally {
      setSavingDateChange(false);
    }
  };

  const handleReviewUpdate = async (
    updateId: string,
    nextConfirmedState: boolean
  ) => {
    const draft = reviewDrafts[updateId];
    if (!draft) return;

    setReviewDrafts((prev) => ({
      ...prev,
      [updateId]: { ...prev[updateId], saving: true, feedback: null },
    }));

    try {
      const res = await fetch(`/api/updates/${updateId}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finalReasonCategory: draft.finalReasonCategory,
          merchandiserBuyerNote: draft.merchandiserBuyerNote,
          isMerchandiserConfirmed: nextConfirmedState,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setReviewDrafts((prev) => ({
          ...prev,
          [updateId]: {
            ...prev[updateId],
            saving: false,
            feedback: data.error || 'Failed to save review.',
          },
        }));
        return;
      }

      await fetchOrderDetail();
      setReviewDrafts((prev) => ({
        ...prev,
        [updateId]: {
          ...prev[updateId],
          saving: false,
          feedback: data.message,
        },
      }));
    } catch {
      setReviewDrafts((prev) => ({
        ...prev,
        [updateId]: {
          ...prev[updateId],
          saving: false,
          feedback: 'Network error while saving review.',
        },
      }));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-zinc-200 bg-white py-20">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
        <p className="mt-2 font-mono text-xs text-zinc-500">
          Loading order details...
        </p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="rounded-lg border border-[#FECDD3] bg-[#FFF1F2] p-8 text-center">
        <p className="text-sm font-medium text-[#BE123C]">
          {error || 'Order not found.'}
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-zinc-950 px-4 py-2 text-xs font-medium text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Orders
        </Link>
      </div>
    );
  }

  const { runRate } = order;
  const statusPillStyle =
    runRate.status === 'RED'
      ? 'border-[#FECDD3] bg-[#FFF1F2] text-[#BE123C]'
      : runRate.status === 'YELLOW'
      ? 'border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]'
      : 'border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]';

  const statusDotStyle =
    runRate.status === 'RED'
      ? 'bg-[#E11D48]'
      : runRate.status === 'YELLOW'
      ? 'bg-[#D97706]'
      : 'bg-[#10B981]';

  const milestoneById = new Map(order.milestones.map((m) => [m.id, m]));

  return (
    <div className="space-y-8">
      {/* Breadcrumb & Buyer Portal Preview Link */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-950"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Orders
        </Link>

        <Link
          href={`/buyer/${order.buyer.accessToken}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 transition hover:border-zinc-950 hover:text-zinc-950"
        >
          Preview{' '}
          {order.buyer.name
            .replace(/\s*\([^)]*\)/g, '')
            .replace(/\s*·\s*.*$/, '')
            .trim()}{' '}
          Portal
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {/* 1. Order Identity + "Shows Its Maths" Hairline Grid */}
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <div className="flex flex-col justify-between gap-4 p-6 lg:flex-row lg:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-2xl font-semibold tracking-tight text-zinc-950">
                {order.poNumber}
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-semibold ${statusPillStyle}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${statusDotStyle}`} />
                {runRate.status}
                {runRate.isTwoWeekEarlyWarning ? ' · 2-Week Early Warning' : ''}
              </span>
            </div>

            <p className="mt-1.5 text-sm font-medium text-zinc-900">
              {order.styleName} · {order.colour}
            </p>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <span>
                {order.buyer.name
                  .replace(/\s*\([^)]*\)/g, '')
                  .replace(/\s*·\s*.*$/, '')
                  .trim()}{' '}
                · {order.buyer.country}
              </span>
              <span>·</span>
              <span>{order.productionUnit}</span>
              <span>·</span>
              <span className="font-mono tabular-nums">
                {order.totalQty.toLocaleString()} pcs total
              </span>
              <span>·</span>
              <span className="font-mono text-zinc-400 tabular-nums">
                {Object.entries(order.sizeBreakdown || {})
                  .map(([sz, q]) => `${sz}:${Number(q).toLocaleString()}`)
                  .join('  ')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs text-zinc-700 tabular-nums">
            <span className="text-zinc-400">Ex-Factory:</span>
            <strong className="text-zinc-950">
              {formatDate(order.exFactoryDate)}
            </strong>
            {userRole === 'MERCHANDISER' && (
              <button
                type="button"
                onClick={() =>
                  openDateEditModal({
                    fieldChanged: 'exFactoryDate',
                    milestoneId: null,
                    label: `Order ${order.poNumber} Ex-Factory Ship Date`,
                    currentDate: order.exFactoryDate,
                  })
                }
                className="ml-1 inline-flex items-center gap-1 rounded border border-zinc-200 px-2 py-0.5 font-sans text-[11px] text-zinc-600 hover:border-zinc-950 hover:text-zinc-950"
              >
                <Edit3 className="h-2.5 w-2.5" />
                Edit
              </button>
            )}
          </div>
        </div>

        {/* Hairline 5-Column Run-Rate Math Strip */}
        <div className="grid grid-cols-2 divide-y divide-zinc-200 border-t border-zinc-200 bg-zinc-50/40 sm:grid-cols-5 sm:divide-x sm:divide-y-0">
          <div className="p-4">
            <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
              Active Stage · {order.currentStage}
            </div>
            <div className="mt-1 font-mono text-lg font-semibold text-zinc-950 tabular-nums">
              {runRate.remainingQty.toLocaleString()} left
            </div>
            <div className="font-mono text-[11px] text-zinc-500 tabular-nums">
              {runRate.completedQty.toLocaleString()} /{' '}
              {runRate.totalQty.toLocaleString()} ·{' '}
              {runRate.completionPercentage}%
            </div>
          </div>

          <div className="p-4">
            <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
              Required Rate
            </div>
            <div className="mt-1 font-mono text-lg font-semibold text-zinc-950 tabular-nums">
              {runRate.requiredDailyRate}/d
            </div>
            <div className="font-mono text-[11px] text-zinc-500 tabular-nums">
              {runRate.daysLeftToStageEnd}d to stage end
            </div>
          </div>

          <div className="p-4">
            <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
              Actual 3D Rate
            </div>
            <div className="mt-1 font-mono text-lg font-semibold text-zinc-950 tabular-nums">
              {runRate.actualDailyRate}/d
            </div>
            <div className="font-mono text-[11px] text-zinc-500">
              Last 3 floor shifts
            </div>
          </div>

          <div className="p-4">
            <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
              Daily Variance
            </div>
            <div
              className={`mt-1 font-mono text-lg font-semibold tabular-nums ${
                runRate.dailyShortfallOrSurplus < 0
                  ? 'text-[#BE123C]'
                  : 'text-[#047857]'
              }`}
            >
              {runRate.dailyShortfallOrSurplus > 0 ? '+' : ''}
              {runRate.dailyShortfallOrSurplus}/d
            </div>
            <div className="font-mono text-[11px] text-zinc-500">
              {runRate.dailyShortfallOrSurplus < 0 ? 'Shortfall' : 'Surplus'}
            </div>
          </div>

          <div className="p-4">
            <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
              Projected Finish
            </div>
            <div className="mt-1 font-mono text-lg font-semibold text-zinc-950 tabular-nums">
              {runRate.projectedCompletionDate
                ? formatDate(runRate.projectedCompletionDate)
                : 'Stalled'}
            </div>
            <div className="font-mono text-[11px] text-zinc-500 tabular-nums">
              {(runRate.projectedSlipDays ?? 0) > 0
                ? `${runRate.projectedSlipDays}d behind stage plan`
                : 'On schedule'}
            </div>
          </div>
        </div>

        {/* Formula Footer Line */}
        <div className="border-t border-zinc-200 bg-zinc-100/60 px-6 py-2.5 font-mono text-xs text-zinc-600 tabular-nums">
          Need {runRate.requiredDailyRate}/d ·{' '}
          {runRate.remainingQty.toLocaleString()} left ÷{' '}
          {runRate.daysLeftToStageEnd}d · Actual {runRate.actualDailyRate}/d ·{' '}
          {runRate.dailyShortfallOrSurplus < 0
            ? `Shortfall ${Math.abs(runRate.dailyShortfallOrSurplus)}/d`
            : `Surplus +${runRate.dailyShortfallOrSurplus}/d`}
        </div>
      </div>

      {/* 2. TNA Milestones Table */}
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-950">
              TNA Schedule &amp; Milestones
            </h2>
            <p className="text-xs text-zinc-500">
              Date modifications require a compliance justification and are
              logged in the audit trail.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-100/60 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                <th className="px-6 py-2.5">Stage</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Planned Window</th>
                <th className="px-4 py-2.5">Completed / Target</th>
                <th className="px-6 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {order.milestones.map((m) => {
                const pct =
                  m.targetQty > 0
                    ? Math.min(
                        100,
                        Math.round((m.completedQty / m.targetQty) * 100)
                      )
                    : 0;
                const isCurrent = m.stageName === order.currentStage;

                return (
                  <tr
                    key={m.id}
                    className={isCurrent ? 'bg-zinc-50/80' : 'hover:bg-zinc-50/40'}
                  >
                    <td className="px-6 py-3.5 font-mono font-semibold text-zinc-950">
                      {m.sequenceOrder}. {m.stageName}
                      {isCurrent && (
                        <span className="ml-2 rounded bg-zinc-950 px-1.5 py-0.5 text-[10px] text-white">
                          CURRENT
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 font-mono text-[11px] text-zinc-500">
                      {m.status}
                    </td>

                    <td className="px-4 py-3.5 font-mono text-zinc-700 tabular-nums">
                      {formatDate(m.plannedStartDate)} →{' '}
                      <strong className="text-zinc-950">
                        {formatDate(m.plannedEndDate)}
                      </strong>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-1 w-24 overflow-hidden rounded-full bg-zinc-100">
                          <div
                            className="h-full rounded-full bg-zinc-950"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs text-zinc-700 tabular-nums">
                          {m.completedQty.toLocaleString()} /{' '}
                          {m.targetQty.toLocaleString()} · {pct}%
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-3.5 text-right">
                      {userRole === 'MERCHANDISER' ? (
                        <button
                          type="button"
                          onClick={() =>
                            openDateEditModal({
                              fieldChanged: 'plannedEndDate',
                              milestoneId: m.id,
                              label: `${m.stageName} Stage Planned End Date`,
                              currentDate: m.plannedEndDate,
                            })
                          }
                          className="inline-flex items-center gap-1 rounded border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:border-zinc-950 hover:text-zinc-950"
                        >
                          <Edit3 className="h-3 w-3" />
                          Edit Date
                        </button>
                      ) : (
                        <span className="font-mono text-[11px] text-zinc-400">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Daily Floor Updates & Editorial Side-by-Side Tamil AI Review */}
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-950">
              Daily Floor Updates &amp; Tamil AI Gatekeeper
            </h2>
            <p className="text-xs text-zinc-500">
              Warnings reach buyers only after a merchandiser confirms them.
            </p>
          </div>
          <Link
            href="/supervisor"
            className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-zinc-950 hover:text-zinc-950"
          >
            + Log Floor Update
          </Link>
        </div>

        <div className="divide-y divide-zinc-200">
          {order.dailyUpdates.map((u) => {
            const stageName =
              milestoneById.get(u.milestoneId)?.stageName || order.currentStage;
            const draft = reviewDrafts[u.id] || {
              finalReasonCategory:
                u.finalReasonCategory || u.aiReasonCategory || 'UNCLASSIFIED',
              merchandiserBuyerNote:
                u.merchandiserBuyerNote || u.aiEnglishTranslation || '',
              saving: false,
              feedback: null,
            };
            const confidencePct =
              u.aiConfidence !== null && u.aiConfidence !== undefined
                ? Math.round(u.aiConfidence * 100)
                : null;

            return (
              <div key={u.id} className="p-6">
                {/* Update Row Header */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2.5 text-xs">
                    <span className="font-mono font-semibold text-zinc-950 tabular-nums">
                      {formatDate(u.workDate)}
                    </span>
                    <span className="text-zinc-300">·</span>
                    <span className="font-mono text-zinc-600">{stageName}</span>
                    <span className="text-zinc-300">·</span>
                    <span className="font-mono font-semibold text-zinc-950 tabular-nums">
                      +{u.qtyDoneToday.toLocaleString()} pcs
                    </span>
                    {u.supervisor && (
                      <>
                        <span className="text-zinc-300">·</span>
                        <span className="text-zinc-500">
                          {u.supervisor.name}
                        </span>
                      </>
                    )}
                  </div>

                  {u.rawNoteTamil && (
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium ${
                        u.isMerchandiserConfirmed
                          ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]'
                          : 'border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]'
                      }`}
                    >
                      {u.isMerchandiserConfirmed
                        ? 'Confirmed for Buyer Portal'
                        : 'Withheld from Buyer · Unconfirmed'}
                    </span>
                  )}
                </div>

                {u.photoUrl && (
                  <div className="mt-3">
                    <img
                      src={u.photoUrl}
                      alt="Floor bundle inspection"
                      className="h-16 w-28 rounded border border-zinc-200 object-cover"
                    />
                  </div>
                )}

                {/* 2-Column Editorial Split for Tamil Note vs AI Translation */}
                {u.rawNoteTamil && (
                  <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200">
                    <div className="grid divide-y divide-zinc-200 md:grid-cols-2 md:divide-x md:divide-y-0">
                      <div className="p-4">
                        <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                          Original Tamil Floor Note
                        </div>
                        <p className="mt-1.5 text-sm text-zinc-950">
                          “{u.rawNoteTamil}”
                        </p>
                      </div>

                      <div className="p-4">
                        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                          <span>AI English Translation</span>
                          <span>
                            {u.aiReasonCategory}
                            {confidencePct !== null ? ` · ${confidencePct}%` : ''}
                            {u.needsManualReview ? ' · Needs Review' : ''}
                            {u.wasAiOverridden ? ' · Overridden' : ''}
                          </span>
                        </div>
                        {u.needsManualReview &&
                        (u.aiEnglishTranslation?.startsWith('[AI Error') ||
                          u.aiEnglishTranslation?.startsWith(
                            '[AI Translation Unavailable'
                          ) ||
                          u.aiConfidence === 0) ? (
                          <div className="mt-2 rounded-md border border-[#FECDD3] bg-[#FFF1F2] p-3 text-xs text-[#BE123C]">
                            <div className="font-semibold">
                              AI translation failed: GEMINI_API_KEY missing or
                              unreachable — Merchandiser must read original
                              Tamil note and select category manually.
                            </div>
                            <div className="mt-1 font-mono text-[11px]">
                              {u.aiEnglishTranslation}
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="mt-1.5 text-sm text-zinc-950">
                              “{u.aiEnglishTranslation}”
                            </p>
                            {u.needsManualReview && (
                              <div className="mt-2 rounded border border-[#FDE68A] bg-[#FFFBEB] px-2.5 py-1.5 font-mono text-[11px] text-[#B45309]">
                                Low AI confidence · {confidencePct ?? 0}% —
                                Merchandiser manual verification required before
                                buyer release.
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Merchandiser Review Controls Bar */}
                    {userRole === 'MERCHANDISER' && (
                      <div className="border-t border-zinc-200 bg-zinc-50/70 p-4">
                        <div className="grid gap-3 md:grid-cols-12">
                          <div className="md:col-span-4">
                            <label className="block text-[11px] font-medium text-zinc-500">
                              Reason Category Override
                            </label>
                            <select
                              value={draft.finalReasonCategory}
                              onChange={(e) =>
                                setReviewDrafts((prev) => ({
                                  ...prev,
                                  [u.id]: {
                                    ...draft,
                                    finalReasonCategory: e.target.value,
                                  },
                                }))
                              }
                              className="mt-1 h-9 w-full rounded-md border border-zinc-200 bg-white px-2.5 font-mono text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
                            >
                              {REASON_CATEGORIES.map((cat) => (
                                <option key={cat.value} value={cat.value}>
                                  {cat.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="md:col-span-5">
                            <label className="block text-[11px] font-medium text-zinc-500">
                              Buyer-Facing Summary Note
                            </label>
                            <input
                              type="text"
                              value={draft.merchandiserBuyerNote}
                              onChange={(e) =>
                                setReviewDrafts((prev) => ({
                                  ...prev,
                                  [u.id]: {
                                    ...draft,
                                    merchandiserBuyerNote: e.target.value,
                                  },
                                }))
                              }
                              className="mt-1 h-9 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
                            />
                          </div>

                          <div className="flex items-end gap-2 md:col-span-3">
                            <button
                              type="button"
                              disabled={draft.saving}
                              onClick={() =>
                                handleReviewUpdate(
                                  u.id,
                                  !u.isMerchandiserConfirmed
                                )
                              }
                              className={`flex h-9 w-full items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium transition disabled:opacity-50 ${
                                u.isMerchandiserConfirmed
                                  ? 'border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-950'
                                  : 'bg-zinc-950 text-white hover:bg-zinc-800'
                              }`}
                            >
                              {draft.saving ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : u.isMerchandiserConfirmed ? (
                                <>
                                  <EyeOff className="h-3.5 w-3.5" />
                                  Withhold
                                </>
                              ) : (
                                <>
                                  <Check className="h-3.5 w-3.5" />
                                  Confirm for Buyer
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {draft.feedback && (
                          <div className="mt-2 font-mono text-[11px] text-zinc-600">
                            {draft.feedback}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Compliance Date-Change Audit Trail */}
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-950">
              Compliance Date-Change Audit Log
            </h2>
            <p className="text-xs text-zinc-500">
              Immutable record of all TNA schedule modifications.
            </p>
          </div>
          <span className="font-mono text-xs text-zinc-400">
            {order.dateChangeAudits.length} entries
          </span>
        </div>

        {order.dateChangeAudits.length === 0 ? (
          <div className="p-6 text-xs text-zinc-500">
            No schedule date changes recorded.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-100/60 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                  <th className="px-6 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Stage / Field</th>
                  <th className="px-4 py-2.5">Revision</th>
                  <th className="px-4 py-2.5">Authorized By</th>
                  <th className="px-6 py-2.5">Compliance Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {order.dateChangeAudits.map((audit) => (
                  <tr key={audit.id}>
                    <td className="px-6 py-3 font-mono text-zinc-500 tabular-nums">
                      {formatDate(audit.changedAt)}
                    </td>
                    <td className="px-4 py-3 font-mono font-medium text-zinc-950">
                      {audit.milestone
                        ? `${audit.milestone.stageName} · ${audit.fieldChanged}`
                        : audit.fieldChanged}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums">
                      <span className="text-zinc-400 line-through">
                        {formatDate(audit.oldDate)}
                      </span>{' '}
                      →{' '}
                      <strong className="text-zinc-950">
                        {formatDate(audit.newDate)}
                      </strong>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {audit.changedByUser?.name || 'Merchandiser'}
                    </td>
                    <td className="px-6 py-3 text-zinc-700">
                      {audit.changeReason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Compliance Date-Change Modal */}
      {editingDateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <h3 className="text-sm font-semibold text-zinc-950">
                Modify Schedule Date
              </h3>
              <button
                type="button"
                onClick={() => setEditingDateTarget(null)}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-950"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDateChange} className="mt-4 space-y-4">
              <div className="text-xs text-zinc-600">
                <div>{editingDateTarget.label}</div>
                <div className="mt-0.5 font-mono text-zinc-400">
                  Current: {formatDate(editingDateTarget.currentDate)}
                </div>
              </div>

              {dateChangeError && (
                <div className="rounded-md border border-[#FECDD3] bg-[#FFF1F2] p-3 text-xs text-[#BE123C]">
                  {dateChangeError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-700">
                  New Target Date
                </label>
                <input
                  type="date"
                  required
                  value={newTargetDate}
                  onChange={(e) => setNewTargetDate(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-zinc-200 px-3 py-2 font-mono text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700">
                  Compliance Reason
                </label>
                <textarea
                  rows={3}
                  required
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="State compliance reason for changing target date..."
                  className="mt-1.5 w-full rounded-md border border-zinc-200 p-2.5 text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingDateTarget(null)}
                  className="rounded-md border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDateChange}
                  className="inline-flex items-center gap-1.5 rounded-md bg-zinc-950 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {savingDateChange && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  Save &amp; Log Audit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
