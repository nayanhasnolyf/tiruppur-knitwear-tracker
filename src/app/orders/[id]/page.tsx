'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  Calculator,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  FileCheck2,
  History,
  Image as ImageIcon,
  Languages,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';

const REASON_CATEGORIES = [
  { value: 'MACHINE_BREAKDOWN', label: 'MACHINE_BREAKDOWN · Sewing / Needle Breakdown' },
  { value: 'QUALITY_REWORK', label: 'QUALITY_REWORK · Stain / Measurement Rework' },
  { value: 'FABRIC_DEFECT', label: 'FABRIC_DEFECT · Fabric / Yarn / GSM Defect' },
  { value: 'POWER_CUT', label: 'POWER_CUT · EB Power Outage / Generator Issue' },
  { value: 'WORKER_SHORTAGE', label: 'WORKER_SHORTAGE · Operator / Tailor Absenteeism' },
  { value: 'PRINT_WASH_DELAY', label: 'PRINT_WASH_DELAY · Printing / Curing / Wash Delay' },
  { value: 'OTHER', label: 'OTHER · Other Floor Bottleneck' },
  { value: 'UNCLASSIFIED', label: 'UNCLASSIFIED · Uncertain / Vague Note' },
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
  status: 'GREEN' | 'AMBER' | 'RED';
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
  const [userRole, setUserRole] = useState<'MERCHANDISER' | 'SUPERVISOR'>('MERCHANDISER');
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

      // Initialize review drafts for updates with Tamil notes
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
      <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
        <p className="mt-2 text-xs font-medium text-slate-500">
          Loading TNA milestones, run-rate projection &amp; Tamil floor logs...
        </p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-center">
        <p className="text-sm font-semibold text-rose-800">
          {error || 'Order not found.'}
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Order Board
        </Link>
      </div>
    );
  }

  const { runRate } = order;
  const statusBadgeStyles =
    runRate.status === 'RED'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : runRate.status === 'AMBER'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700';

  const statusDotStyles =
    runRate.status === 'RED'
      ? 'animate-pulse bg-rose-600'
      : runRate.status === 'AMBER'
      ? 'bg-amber-500'
      : 'bg-emerald-500';

  const milestoneById = new Map(order.milestones.map((m) => [m.id, m]));

  return (
    <div className="space-y-6">
      {/* 1. Top Header & Breadcrumb */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Merchandiser Order Board
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/buyer/${order.buyer.accessToken}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 shadow-2xs transition hover:border-slate-900 hover:bg-slate-900 hover:text-white"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Preview {order.buyer.name} Read-Only Portal
          </Link>
        </div>
      </div>

      {/* Main Order Summary Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-start">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-mono text-2xl font-bold tracking-tight text-slate-900">
                {order.poNumber}
              </h1>
              <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-800">
                {order.buyer.name} · {order.buyer.country}
              </span>
              <span className="rounded-md bg-slate-100 px-2.5 py-1 font-mono text-xs font-medium text-slate-700">
                {order.productionUnit}
              </span>
            </div>

            <p className="text-base font-medium text-slate-800">
              {order.styleName}{' '}
              <span className="text-sm font-normal text-slate-500">
                · Colour: <strong>{order.colour}</strong> · Total Qty:{' '}
                <strong className="font-mono tabular-nums">
                  {order.totalQty.toLocaleString()} pcs
                </strong>
              </span>
            </p>

            {/* Size Breakdown Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-xs font-medium text-slate-400 mr-1">
                Size Matrix:
              </span>
              {Object.entries(order.sizeBreakdown || {}).map(([sz, qty]) => (
                <span
                  key={sz}
                  className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-700 tabular-nums"
                >
                  <strong>{sz}:</strong> {Number(qty).toLocaleString()}
                </span>
              ))}
            </div>
          </div>

          {/* Right Status & Ex-Factory */}
          <div className="flex flex-col items-start gap-2.5 lg:items-end">
            <div className="flex flex-wrap items-center gap-2">
              {runRate.isTwoWeekEarlyWarning && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-3 py-1 font-mono text-xs font-semibold text-amber-900">
                  <Clock className="h-3.5 w-3.5" />
                  2-Week Early Warning ({runRate.daysLeftToExFactory}d to ship)
                </span>
              )}

              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 font-mono text-xs font-bold ${statusBadgeStyles}`}
              >
                <span className={`h-2 w-2 rounded-full ${statusDotStyles}`} />
                {runRate.status} ·{' '}
                {runRate.status === 'RED'
                  ? 'CRITICAL DELAY'
                  : runRate.status === 'AMBER'
                  ? 'EARLY WARNING'
                  : 'ON TRACK'}
              </span>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-slate-600">Ex-Factory Date:</span>
              <span className="font-mono font-bold text-slate-900 tabular-nums">
                {formatDate(order.exFactoryDate)}
              </span>
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
                  className="ml-1 inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-600 hover:border-slate-900 hover:text-slate-900"
                >
                  <Edit3 className="h-2.5 w-2.5" />
                  Edit
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 2. "Shows Its Maths" Run-Rate Projection Panel */}
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/90 p-5">
          <div className="flex flex-col justify-between gap-2 border-b border-slate-200 pb-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-slate-700" />
              <h2 className="text-sm font-semibold text-slate-900">
                Run-Rate Delay Projection Engine (“Shows Its Maths”)
              </h2>
              <span className="rounded bg-slate-200 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-800">
                Active Stage: {order.currentStage}
              </span>
            </div>
            <span className="font-mono text-xs font-semibold text-slate-700">
              {runRate.warningHeadline}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Stage Remaining
              </div>
              <div className="mt-1 font-mono text-base font-bold text-slate-900 tabular-nums">
                {runRate.remainingQty.toLocaleString()} pcs
              </div>
              <div className="font-mono text-[10px] text-slate-500 tabular-nums">
                {runRate.completedQty.toLocaleString()} /{' '}
                {runRate.totalQty.toLocaleString()} done (
                {runRate.completionPercentage}%)
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Days Remaining
              </div>
              <div className="mt-1 font-mono text-base font-bold text-slate-900 tabular-nums">
                {runRate.daysLeftToStageEnd} days
              </div>
              <div className="font-mono text-[10px] text-slate-500 tabular-nums">
                {runRate.daysLeftToExFactory}d to Ex-Factory
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Required Run-Rate
              </div>
              <div className="mt-1 font-mono text-base font-bold text-slate-900 tabular-nums">
                {runRate.requiredDailyRate.toLocaleString()} pcs/d
              </div>
              <div className="font-mono text-[10px] text-slate-500 tabular-nums">
                {runRate.remainingQty.toLocaleString()} ÷{' '}
                {runRate.daysLeftToStageEnd}d
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Actual (3-Day Avg)
              </div>
              <div className="mt-1 font-mono text-base font-bold text-slate-900 tabular-nums">
                {runRate.actualDailyRate.toLocaleString()} pcs/d
              </div>
              <div className="font-mono text-[10px] text-slate-500">
                Recent floor velocity
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Daily Variance
              </div>
              <div
                className={`mt-1 font-mono text-base font-bold tabular-nums ${
                  runRate.dailyShortfallOrSurplus < 0
                    ? 'text-rose-600'
                    : 'text-emerald-600'
                }`}
              >
                {runRate.dailyShortfallOrSurplus > 0 ? '+' : ''}
                {runRate.dailyShortfallOrSurplus.toLocaleString()} pcs/d
              </div>
              <div className="font-mono text-[10px] text-slate-500">
                {runRate.dailyShortfallOrSurplus < 0
                  ? 'Daily shortfall'
                  : 'Daily surplus'}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Projected Finish
              </div>
              <div
                className={`mt-1 font-mono text-base font-bold tabular-nums ${
                  (runRate.projectedSlipDays ?? 0) > 0
                    ? 'text-rose-600'
                    : 'text-emerald-700'
                }`}
              >
                {runRate.projectedCompletionDate
                  ? formatDate(runRate.projectedCompletionDate)
                  : 'Stalled'}
              </div>
              <div className="font-mono text-[10px] text-slate-500 tabular-nums">
                {runRate.projectedDaysNeeded !== null
                  ? `In ${runRate.projectedDaysNeeded}d (${
                      (runRate.projectedSlipDays ?? 0) > 0
                        ? `+${runRate.projectedSlipDays}d slip`
                        : 'on schedule'
                    })`
                  : '0 output'}
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-slate-200/80 bg-white px-3.5 py-2 font-mono text-xs text-slate-700 tabular-nums">
            <strong>Math Proof:</strong> {runRate.mathSummary}
          </div>
        </div>
      </div>

      {/* 3. Interactive TNA Milestones Timeline */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs">
        <div className="flex flex-col justify-between gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              TNA Production Milestones &amp; Schedule Control
            </h2>
            <p className="text-xs text-slate-500">
              Any target date change requires a mandatory compliance reason and
              is permanently recorded in the audit log.
            </p>
          </div>
          {userRole === 'MERCHANDISER' && (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 font-mono text-[11px] text-slate-600">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              Merchandiser Schedule Edit Enabled
            </span>
          )}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="py-2.5 pr-4">Seq &amp; Stage</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Planned Start</th>
                <th className="px-4 py-2.5">Planned End</th>
                <th className="px-4 py-2.5">Progress (Completed / Target)</th>
                <th className="py-2.5 pl-4 text-right">Schedule Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {order.milestones.map((m) => {
                const pct =
                  m.targetQty > 0
                    ? Math.min(100, Math.round((m.completedQty / m.targetQty) * 100))
                    : 0;
                const isCurrent = m.stageName === order.currentStage;

                return (
                  <tr
                    key={m.id}
                    className={isCurrent ? 'bg-slate-50/90' : 'hover:bg-slate-50/50'}
                  >
                    <td className="py-3.5 pr-4 font-mono font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] text-slate-700">
                          {m.sequenceOrder}
                        </span>
                        <span>{m.stageName}</span>
                        {isCurrent && (
                          <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white">
                            ACTIVE
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      {m.status === 'COMPLETED' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" />
                          COMPLETED
                        </span>
                      ) : m.status === 'IN_PROGRESS' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-blue-700">
                          IN_PROGRESS
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 font-mono text-[11px] font-medium text-slate-500">
                          PENDING
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 font-mono text-slate-600 tabular-nums">
                      {formatDate(m.plannedStartDate)}
                    </td>

                    <td className="px-4 py-3.5 font-mono font-semibold text-slate-900 tabular-nums">
                      {formatDate(m.plannedEndDate)}
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${
                              m.status === 'COMPLETED'
                                ? 'bg-emerald-500'
                                : 'bg-slate-900'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs text-slate-700 tabular-nums">
                          {m.completedQty.toLocaleString()} /{' '}
                          {m.targetQty.toLocaleString()} ({pct}%)
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 pl-4 text-right">
                      {userRole === 'MERCHANDISER' ? (
                        <button
                          type="button"
                          onClick={() =>
                            openDateEditModal({
                              fieldChanged: 'plannedEndDate',
                              milestoneId: m.id,
                              label: `${m.stageName} Stage Target End Date`,
                              currentDate: m.plannedEndDate,
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-slate-900 hover:text-slate-900"
                        >
                          <Edit3 className="h-3 w-3" />
                          Edit Target Date
                        </button>
                      ) : (
                        <span className="font-mono text-[11px] text-slate-400">
                          Read-only
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

      {/* 4. Daily Floor Updates & "When AI Is Wrong" Human-in-the-Loop Review Section */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs">
        <div className="flex flex-col justify-between gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Languages className="h-4 w-4 text-indigo-600" />
              <h2 className="text-base font-semibold text-slate-900">
                Daily Floor Updates &amp; Tamil AI Blocker Review (“When AI Is
                Wrong” Gatekeeper)
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Warnings reach buyers <strong>only after a merchandiser confirms them</strong>.
              Low-confidence (&lt;70%) or ambiguous Tamil notes are automatically
              flagged for manual review.
            </p>
          </div>
          <Link
            href="/supervisor"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            + Log New Floor Update in Supervisor App
          </Link>
        </div>

        <div className="mt-4 space-y-4">
          {order.dailyUpdates.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center text-xs text-slate-500">
              No daily floor updates recorded for this order yet.
            </div>
          ) : (
            order.dailyUpdates.map((u) => {
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
                <div
                  key={u.id}
                  className={`rounded-xl border p-4 transition ${
                    u.rawNoteTamil
                      ? u.needsManualReview && !u.isMerchandiserConfirmed
                        ? 'border-amber-300 bg-amber-50/30'
                        : 'border-slate-200 bg-white'
                      : 'border-slate-200 bg-slate-50/50'
                  }`}
                >
                  {/* Update Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded bg-slate-900 px-2 py-0.5 font-mono font-semibold text-white tabular-nums">
                        {formatDate(u.workDate)}
                      </span>
                      <span className="rounded border border-slate-200 bg-white px-2 py-0.5 font-mono font-medium text-slate-700">
                        Stage: {stageName}
                      </span>
                      <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                        +{u.qtyDoneToday.toLocaleString()} pcs completed
                      </span>
                      {u.supervisor && (
                        <span className="text-slate-500">
                          · Logged by <strong>{u.supervisor.name}</strong> (
                          {u.supervisor.assignedUnit || 'Floor'})
                        </span>
                      )}
                    </div>

                    {/* Buyer Visibility Status Pill */}
                    {u.rawNoteTamil && (
                      <div className="flex items-center gap-2">
                        {u.isMerchandiserConfirmed ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-800">
                            <Eye className="h-3 w-3" />
                            Confirmed &amp; Visible on Buyer Portal
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-amber-900">
                            <EyeOff className="h-3 w-3" />
                            Withheld from Buyer (Pending Merchandiser Confirm)
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Optional Floor Photo Preview */}
                  {u.photoUrl && (
                    <div className="mt-3 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                      <img
                        src={u.photoUrl}
                        alt="Floor bundle inspection"
                        className="h-14 w-20 rounded border border-slate-200 object-cover"
                      />
                      <div className="text-xs">
                        <div className="flex items-center gap-1 font-medium text-slate-700">
                          <ImageIcon className="h-3.5 w-3.5 text-slate-500" />
                          <span>Floor Photo Evidence Attached</span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Uploaded from mobile floor station ({formatDate(u.workDate)})
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Tamil Note + AI Classification + Merchandiser Override Controls */}
                  {u.rawNoteTamil && (
                    <div className="mt-3 space-y-3 border-t border-slate-200/80 pt-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        {/* Original Tamil Floor Note */}
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                            <span>ORIGINAL TAMIL FLOOR NOTE (SUPERVISOR)</span>
                            <span className="font-mono text-[10px]">தமிழ்</span>
                          </div>
                          <p className="mt-1.5 text-sm font-medium text-slate-900">
                            “{u.rawNoteTamil}”
                          </p>
                        </div>

                        {/* AI English Translation & Confidence */}
                        <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-1">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-900">
                              <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                              AI ENGLISH TRANSLATION &amp; CLASSIFICATION
                            </span>

                            <div className="flex items-center gap-1.5">
                              {confidencePct !== null && (
                                <span
                                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                                    confidencePct < 70
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  {confidencePct}% AI Conf
                                </span>
                              )}

                              {u.wasAiOverridden && (
                                <span className="rounded bg-purple-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-purple-800">
                                  Overridden by Merchandiser
                                </span>
                              )}
                            </div>
                          </div>

                          <p className="mt-1.5 text-sm font-medium text-slate-900">
                            “{u.aiEnglishTranslation}”
                          </p>

                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                            <span className="font-mono text-slate-600">
                              AI Suggested:{' '}
                              <strong>{u.aiReasonCategory || 'UNCLASSIFIED'}</strong>
                            </span>
                            {u.needsManualReview && (
                              <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-900">
                                <AlertTriangle className="h-3 w-3" />
                                Low Confidence / Ambiguous — Manual Review Required
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Merchandiser Human-in-the-Loop Gate Controls */}
                      {userRole === 'MERCHANDISER' ? (
                        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3.5">
                          <div className="mb-2.5 flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-800">
                              Merchandiser Review &amp; Buyer Release Controls
                            </span>
                            {draft.feedback && (
                              <span className="font-mono text-[11px] font-medium text-emerald-700">
                                {draft.feedback}
                              </span>
                            )}
                          </div>

                          <div className="grid gap-3 md:grid-cols-12">
                            <div className="md:col-span-4">
                              <label className="block text-[11px] font-medium text-slate-600">
                                Final Root-Cause Category (Override if AI is wrong)
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
                                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                              >
                                {REASON_CATEGORIES.map((cat) => (
                                  <option key={cat.value} value={cat.value}>
                                    {cat.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="md:col-span-5">
                              <label className="block text-[11px] font-medium text-slate-600">
                                Buyer-Facing Summary Note (Shown on Buyer Portal when confirmed)
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
                                placeholder="e.g., Needle plate replaced; evening overtime added to recover schedule."
                                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
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
                                className={`flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${
                                  u.isMerchandiserConfirmed
                                    ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                }`}
                              >
                                {draft.saving ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : u.isMerchandiserConfirmed ? (
                                  <>
                                    <EyeOff className="h-3.5 w-3.5" />
                                    Withhold from Buyer
                                  </>
                                ) : (
                                  <>
                                    <Check className="h-3.5 w-3.5" />
                                    Confirm &amp; Share with Buyer
                                  </>
                                )}
                              </button>

                              {u.isMerchandiserConfirmed && (
                                <button
                                  type="button"
                                  disabled={draft.saving}
                                  onClick={() => handleReviewUpdate(u.id, true)}
                                  className="shrink-0 rounded-lg border border-slate-200 bg-slate-900 px-2.5 py-2 text-xs font-medium text-white hover:bg-slate-800"
                                >
                                  Save Edit
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                          Final Category:{' '}
                          <strong className="font-mono">
                            {u.finalReasonCategory || u.aiReasonCategory}
                          </strong>{' '}
                          · Switch to Merchandiser role in the top bar to
                          override AI classification or confirm for buyer.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 5. Compliance Date-Change Audit History Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-slate-600" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Compliance Date-Change Audit Trail
              </h2>
              <p className="text-xs text-slate-500">
                Immutable log of every TNA milestone or Ex-Factory date revision
                with user attribution and compliance justification.
              </p>
            </div>
          </div>
          <span className="rounded-md bg-slate-100 px-2.5 py-1 font-mono text-xs font-semibold text-slate-700">
            {order.dateChangeAudits.length} Audit Records
          </span>
        </div>

        {order.dateChangeAudits.length === 0 ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
            No schedule date changes have been made on this order. Original TNA
            baseline dates remain intact.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="py-2.5 pr-4">Timestamp</th>
                  <th className="px-4 py-2.5">Stage / Field</th>
                  <th className="px-4 py-2.5">Previous Date</th>
                  <th className="px-4 py-2.5">Revised Date</th>
                  <th className="px-4 py-2.5">Authorized By</th>
                  <th className="py-2.5 pl-4">Compliance Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.dateChangeAudits.map((audit) => (
                  <tr key={audit.id} className="hover:bg-slate-50/60">
                    <td className="py-3 pr-4 font-mono text-slate-500 tabular-nums">
                      {formatDate(audit.changedAt)}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-slate-800">
                      {audit.milestone
                        ? `${audit.milestone.stageName} (${audit.fieldChanged})`
                        : audit.fieldChanged}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500 line-through tabular-nums">
                      {formatDate(audit.oldDate)}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-amber-800 tabular-nums">
                      {formatDate(audit.newDate)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {audit.changedByUser?.name || 'Merchandiser'}
                    </td>
                    <td className="py-3 pl-4 text-slate-700">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileCheck2 className="h-4 w-4 text-slate-800" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Modify Schedule Date (Compliance Logged)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingDateTarget(null)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDateChange} className="mt-4 space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                <div className="font-medium text-slate-700">
                  {editingDateTarget.label}
                </div>
                <div className="mt-1 font-mono text-slate-500">
                  Current Date:{' '}
                  <strong>{formatDate(editingDateTarget.currentDate)}</strong>
                </div>
              </div>

              {dateChangeError && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                  <span>{dateChangeError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  New Target Date *
                </label>
                <input
                  type="date"
                  required
                  value={newTargetDate}
                  onChange={(e) => setNewTargetDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Mandatory Compliance Reason (Logged in Audit Trail) *
                </label>
                <textarea
                  rows={3}
                  required
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="e.g., Subcontract washing unit boiler maintenance — 2 day shift agreed with buyer."
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingDateTarget(null)}
                  className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDateChange}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {savingDateChange ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Saving &amp; Auditing...
                    </>
                  ) : (
                    'Update Date & Log Audit'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

