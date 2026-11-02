'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Download, Loader2, Lock, Printer } from 'lucide-react';

interface BuyerMeta {
  id: string;
  name: string;
  country: string;
  contactEmail: string;
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

interface ConfirmedWarning {
  id: string;
  workDate: string;
  qtyDoneToday: number;
  photoUrl: string | null;
  reasonCategory: string | null;
  buyerSummaryNote: string;
}

interface DailyLogItem {
  id: string;
  workDate: string;
  milestoneId: string;
  qtyDoneToday: number;
  photoUrl: string | null;
  confirmedNote: string | null;
  confirmedReasonCategory: string | null;
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

interface BuyerOrderItem {
  id: string;
  poNumber: string;
  styleName: string;
  colour: string;
  sizeBreakdown: Record<string, number>;
  totalQty: number;
  productionUnit: string;
  exFactoryDate: string;
  currentStage: string;
  shipWeek: string;
  milestones: MilestoneItem[];
  activeMilestone: MilestoneItem | null;
  runRate: RunRateData;
  confirmedWarnings: ConfirmedWarning[];
  recentDailyLog: DailyLogItem[];
  dateChangeAudits: AuditEntry[];
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

function escapeCsvCell(val: string | number | null | undefined): string {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export default function BuyerReadOnlyPortalPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [buyer, setBuyer] = useState<BuyerMeta | null>(null);
  const [orders, setOrders] = useState<BuyerOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFoundError, setNotFoundError] = useState<string | null>(null);

  const fetchBuyerPortal = useCallback(async () => {
    setLoading(true);
    setNotFoundError(null);
    try {
      const res = await fetch(`/api/buyer/${encodeURIComponent(token)}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setNotFoundError(
          errData.error || 'Access denied: Invalid or expired buyer token.'
        );
        return;
      }

      const data = await res.json();
      setBuyer(data.buyer);
      setOrders(data.orders || []);
    } catch {
      setNotFoundError('Unable to load buyer portal data.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchBuyerPortal();
  }, [fetchBuyerPortal]);

  const handleDownloadWeeklyCsv = () => {
    if (!buyer) return;

    const headers = [
      'PO Number',
      'Buyer',
      'Style Name',
      'Colour',
      'Total Qty (pcs)',
      'Current Stage',
      'Stage Completed Qty (pcs)',
      'Stage Completion %',
      'Ex-Factory Date',
      'Schedule Status',
      'Confirmed Merchandiser Note',
      'Latest Compliance Date Change Reason',
    ];

    const rows = orders.map((o) => {
      const latestWarning =
        o.confirmedWarnings[0]?.buyerSummaryNote ||
        'On track — No active delay alerts';
      const latestAudit = o.dateChangeAudits[0]
        ? `${formatDate(o.dateChangeAudits[0].oldDate)} -> ${formatDate(
            o.dateChangeAudits[0].newDate
          )}: ${o.dateChangeAudits[0].changeReason}`
        : 'Original baseline schedule intact';

      return [
        o.poNumber,
        buyer.name,
        o.styleName,
        o.colour,
        o.totalQty,
        o.currentStage,
        o.runRate.completedQty,
        `${o.runRate.completionPercentage}%`,
        new Date(o.exFactoryDate).toISOString().slice(0, 10),
        o.runRate.status,
        latestWarning,
        latestAudit,
      ];
    });

    const csvContent =
      '\uFEFF' +
      [headers, ...rows]
        .map((row) => row.map(escapeCsvCell).join(','))
        .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const safeBuyerSlug = buyer.name
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `Weekly_Status_${safeBuyerSlug}_2026-11-02.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-zinc-200 bg-white py-20">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
        <p className="mt-2 font-mono text-xs text-zinc-500">
          Loading buyer status portal...
        </p>
      </div>
    );
  }

  if (notFoundError || !buyer) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-zinc-200 bg-white p-8 text-center">
        <Lock className="mx-auto h-5 w-5 text-zinc-400" />
        <h1 className="mt-3 text-base font-semibold text-zinc-950">
          404 · Buyer Portal Access Denied
        </h1>
        <p className="mt-1 text-xs text-zinc-500">{notFoundError}</p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Link
            href="/buyer/uk-company-b-readonly-2026"
            className="rounded-md bg-zinc-950 px-3.5 py-2 text-xs font-medium text-white"
          >
            Company B (UK)
          </Link>
          <Link
            href="/buyer/de-company-c-readonly-2026"
            className="rounded-md border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700"
          >
            Company C (DE)
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Executive Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-zinc-200 pb-6 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-zinc-400">
            <Lock className="h-3 w-3" />
            <span>Read-Only Buyer Status Portal · {buyer.country}</span>
          </div>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-950">
            {buyer.name}
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Supplier: Company A (Tiruppur) · Scoped to {orders.length} active
            purchase order(s) · Report Date: 02 Nov 2026
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={handleDownloadWeeklyCsv}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-zinc-950 px-3.5 text-xs font-medium text-white transition hover:bg-zinc-800"
          >
            <Download className="h-3.5 w-3.5" />
            Download CSV
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 transition hover:border-zinc-950 hover:text-zinc-950"
          >
            <Printer className="h-3.5 w-3.5" />
            Print PDF
          </button>
        </div>
      </div>

      {/* Buyer Orders List */}
      <div className="space-y-6">
        {orders.map((order) => {
          const { runRate } = order;
          const hasConfirmedWarning = order.confirmedWarnings.length > 0;

          const statusPillStyle =
            runRate.status === 'RED'
              ? 'border-[#FECDD3] bg-[#FFF1F2] text-[#BE123C]'
              : runRate.status === 'AMBER'
              ? 'border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]'
              : 'border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]';

          const statusDotStyle =
            runRate.status === 'RED'
              ? 'bg-[#E11D48]'
              : runRate.status === 'AMBER'
              ? 'bg-[#D97706]'
              : 'bg-[#10B981]';

          const statusLabel =
            runRate.status === 'RED'
              ? 'RECOVERY IN PROGRESS'
              : runRate.status === 'AMBER'
              ? 'EARLY STAGE WATCH'
              : 'ON TRACK';

          const photos = order.recentDailyLog.filter((u) => Boolean(u.photoUrl));

          return (
            <div
              key={order.id}
              className="overflow-hidden rounded-lg border border-zinc-200 bg-white"
            >
              {/* Order Header */}
              <div className="flex flex-col justify-between gap-4 p-6 sm:flex-row sm:items-center">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-lg font-semibold text-zinc-950">
                      {order.poNumber}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-semibold ${statusPillStyle}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${statusDotStyle}`}
                      />
                      {statusLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-zinc-900">
                    {order.styleName} · {order.colour}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-zinc-500 tabular-nums">
                    {order.totalQty.toLocaleString()} pcs · {order.productionUnit}
                  </p>
                </div>

                <div className="text-left sm:text-right">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                    Ex-Factory Date
                  </div>
                  <div className="mt-0.5 font-mono text-sm font-semibold text-zinc-950 tabular-nums">
                    {formatDate(order.exFactoryDate)}
                  </div>
                </div>
              </div>

              {/* Confirmed Merchandiser Advisory (Only if confirmed!) */}
              {hasConfirmedWarning && (
                <div className="border-t border-[#FDE68A] bg-[#FFFBEB] px-6 py-3.5 text-xs text-[#B45309]">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-wider">
                    Confirmed Advisory ({order.confirmedWarnings[0].reasonCategory}):{' '}
                  </span>
                  <span className="text-zinc-900">
                    “{order.confirmedWarnings[0].buyerSummaryNote}”
                  </span>
                </div>
              )}

              {/* TNA Milestones Hairline Grid */}
              <div className="grid grid-cols-2 divide-y divide-zinc-200 border-t border-zinc-200 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
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
                    <div
                      key={m.id}
                      className={`p-4 ${isCurrent ? 'bg-zinc-50/80' : ''}`}
                    >
                      <div className="flex items-center justify-between font-mono text-xs">
                        <span
                          className={
                            isCurrent
                              ? 'font-semibold text-zinc-950'
                              : 'text-zinc-600'
                          }
                        >
                          {m.sequenceOrder}. {m.stageName}
                        </span>
                        <span className="text-zinc-500 tabular-nums">
                          {pct}%
                        </span>
                      </div>

                      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className="h-full rounded-full bg-zinc-950"
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      <div className="mt-2 font-mono text-[11px] text-zinc-500 tabular-nums">
                        {m.completedQty.toLocaleString()} /{' '}
                        {m.targetQty.toLocaleString()} pcs
                      </div>
                      <div className="font-mono text-[10px] text-zinc-400 tabular-nums">
                        Due {formatDate(m.plannedEndDate)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Floor Photos (if any) */}
              {photos.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 border-t border-zinc-200 px-6 py-4">
                  <span className="text-xs font-medium text-zinc-400">
                    Floor Photos:
                  </span>
                  {photos.map((p) => (
                    <img
                      key={p.id}
                      src={p.photoUrl!}
                      alt="Floor inspection"
                      className="h-14 w-24 rounded border border-zinc-200 object-cover"
                    />
                  ))}
                </div>
              )}

              {/* Compliance Date-Change History */}
              {order.dateChangeAudits.length > 0 && (
                <div className="border-t border-zinc-200 bg-zinc-50/40 px-6 py-4">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                    Compliance Schedule Revisions ({order.dateChangeAudits.length})
                  </div>
                  <div className="mt-2 space-y-1.5 text-xs">
                    {order.dateChangeAudits.map((a) => (
                      <div
                        key={a.id}
                        className="flex flex-wrap items-baseline gap-2"
                      >
                        <span className="font-mono text-zinc-500 tabular-nums">
                          {formatDate(a.changedAt)}:
                        </span>
                        <span className="font-mono font-medium text-zinc-900">
                          {a.milestone
                            ? a.milestone.stageName
                            : a.fieldChanged}
                        </span>
                        <span className="font-mono text-zinc-400 line-through tabular-nums">
                          {formatDate(a.oldDate)}
                        </span>
                        <span className="font-mono text-zinc-900 tabular-nums">
                          → {formatDate(a.newDate)}
                        </span>
                        <span className="text-zinc-600">
                          — {a.changeReason}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
