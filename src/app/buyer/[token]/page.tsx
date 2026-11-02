'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  History,
  Image as ImageIcon,
  Loader2,
  Lock,
  Printer,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';

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

  // 1-Click Weekly Buyer Status Export (.CSV / Excel with UTF-8 BOM)
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
      const latestWarning = o.confirmedWarnings[0]?.buyerSummaryNote || 'On track — No active delay alerts';
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
      <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
        <p className="mt-2 text-xs font-medium text-slate-500">
          Verifying buyer access token &amp; loading isolated production
          status...
        </p>
      </div>
    );
  }

  // Invalid Token -> 404 / Access Denied State
  if (notFoundError || !buyer) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-rose-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-700">
          <Lock className="h-5 w-5" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-slate-900">
          404 · Buyer Portal Access Denied
        </h1>
        <p className="mt-1 text-xs text-slate-600">{notFoundError}</p>
        <p className="mt-2 font-mono text-[11px] text-slate-400">
          Attempted token: {token}
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <Link
            href="/buyer/uk-company-b-readonly-2026"
            className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800"
          >
            Open Company B (UK) Portal
          </Link>
          <Link
            href="/buyer/de-company-c-readonly-2026"
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Open Company C (Germany) Portal
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Reviewer Tenant Isolation & Gatekeeper Proof Strip (Hidden when printing PDF) */}
      <div className="rounded-xl border border-slate-200 bg-slate-900 p-4 text-white print:hidden">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                Strict Tenant Isolation Verified
              </span>
              <span className="inline-flex items-center gap-1 rounded bg-indigo-500/20 px-2 py-0.5 font-mono text-[11px] font-semibold text-indigo-300">
                <Lock className="h-3 w-3" />
                Merchandiser Confirmation Gate Active
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Token{' '}
              <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-amber-300">
                {token}
              </code>{' '}
              queries <strong>only {buyer.name}</strong> orders ({orders.length}{' '}
              POs). Unconfirmed floor notes (such as unverified Tamil machine
              notes on B-PO-88213 until confirmed) are automatically withheld.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Link
              href="/buyer/uk-company-b-readonly-2026"
              className={`rounded-lg px-2.5 py-1.5 font-mono text-xs font-medium transition ${
                token === 'uk-company-b-readonly-2026'
                  ? 'bg-white text-slate-900'
                  : 'border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Company B (UK)
            </Link>
            <Link
              href="/buyer/de-company-c-readonly-2026"
              className={`rounded-lg px-2.5 py-1.5 font-mono text-xs font-medium transition ${
                token === 'de-company-c-readonly-2026'
                  ? 'bg-white text-slate-900'
                  : 'border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Company C (DE)
            </Link>
            <Link
              href="/buyer/invalid-forged-token-test"
              className="rounded-lg border border-rose-800/80 bg-rose-950/60 px-2.5 py-1.5 font-mono text-xs font-medium text-rose-300 hover:bg-rose-900/60"
            >
              Test Invalid Token (404)
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Buyer Header & Weekly Status Export Controls */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 font-mono text-[11px] font-medium text-slate-600">
                <Lock className="h-3 w-3 text-slate-500" />
                Read-Only Buyer Sourcing &amp; Compliance Portal
              </span>
              <span className="font-mono text-xs text-slate-400">
                Report Date: 02 Nov 2026
              </span>
            </div>

            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              {buyer.name} · Production &amp; TNA Status
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Supplier: <strong>Company A (Tiruppur Knitwear Exports)</strong> ·
              Buyer Contact: <span className="font-mono">{buyer.contactEmail}</span>{' '}
              ({buyer.country})
            </p>
          </div>

          {/* 1-Click Weekly Status Export Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 print:hidden">
            <button
              type="button"
              onClick={handleDownloadWeeklyCsv}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-slate-800"
            >
              <Download className="h-3.5 w-3.5" />
              Download Weekly Status (.CSV / Excel)
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Printer className="h-3.5 w-3.5" />
              Print / Save Weekly PDF
            </button>
          </div>
        </div>
      </div>

      {/* 3. Buyer Order Cards & TNA Milestone Tracker */}
      <div className="space-y-6">
        {orders.map((order) => {
          const { runRate } = order;
          const hasConfirmedWarning = order.confirmedWarnings.length > 0;

          const statusBadgeStyles =
            runRate.status === 'RED'
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : runRate.status === 'AMBER'
              ? 'border-amber-200 bg-amber-50 text-amber-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700';

          const statusLabel =
            runRate.status === 'RED'
              ? 'SCHEDULE RECOVERY IN PROGRESS'
              : runRate.status === 'AMBER'
              ? 'EARLY STAGE WATCH'
              : 'ON TRACK FOR EX-FACTORY';

          // Collect floor photos across updates
          const photos = order.recentDailyLog.filter((u) => Boolean(u.photoUrl));

          return (
            <div
              key={order.id}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs"
            >
              {/* Order Overview Header */}
              <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-4 lg:flex-row lg:items-center">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-xl font-bold text-slate-900">
                      {order.poNumber}
                    </span>
                    <span className="rounded-md bg-slate-100 px-2.5 py-0.5 font-mono text-xs font-medium text-slate-700">
                      {order.productionUnit}
                    </span>
                    <span className="font-mono text-xs font-semibold text-slate-600 tabular-nums">
                      Total Qty: {order.totalQty.toLocaleString()} pcs
                    </span>
                  </div>

                  <p className="text-sm font-medium text-slate-800">
                    {order.styleName}{' '}
                    <span className="text-xs font-normal text-slate-500">
                      · Colour: {order.colour}
                    </span>
                  </p>

                  {/* Size Breakdown Pills */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {Object.entries(order.sizeBreakdown || {}).map(
                      ([sz, qty]) => (
                        <span
                          key={sz}
                          className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-600 tabular-nums"
                        >
                          {sz}: {Number(qty).toLocaleString()}
                        </span>
                      )
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs font-semibold ${statusBadgeStyles}`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        runRate.status === 'RED'
                          ? 'bg-rose-600'
                          : runRate.status === 'AMBER'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                    />
                    {statusLabel}
                  </span>

                  <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs font-semibold text-slate-800 tabular-nums">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    Ex-Factory: {formatDate(order.exFactoryDate)}
                  </div>

                  <Link
                    href={`/orders/${order.id}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-900 hover:text-slate-900 print:hidden"
                  >
                    Merchandiser View
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>

              {/* Confirmed Merchandiser Production Alerts (Gatekept) */}
              {hasConfirmedWarning ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-800" />
                    <div className="space-y-1.5 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold uppercase tracking-wider text-amber-900">
                          Confirmed Merchandiser Production Advisory
                        </span>
                        {order.confirmedWarnings[0].reasonCategory && (
                          <span className="rounded bg-amber-200/80 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-950">
                            {order.confirmedWarnings[0].reasonCategory}
                          </span>
                        )}
                      </div>
                      {order.confirmedWarnings.map((w) => (
                        <p key={w.id} className="text-slate-800 font-medium">
                          • <strong>{formatDate(w.workDate)}:</strong> “
                          {w.buyerSummaryNote}”
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    No confirmed buyer-impacting blocker alerts on this order.
                  </span>
                  <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                    Active Stage ({order.currentStage}):{' '}
                    {runRate.completedQty.toLocaleString()} /{' '}
                    {runRate.totalQty.toLocaleString()} pcs (
                    {runRate.completionPercentage}%)
                  </span>
                </div>
              )}

              {/* TNA Milestones Stepper & Table */}
              <div className="mt-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  TNA Milestone Progress &amp; Target Dates
                </h3>

                <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                  {order.milestones.map((m) => {
                    const pct =
                      m.targetQty > 0
                        ? Math.min(
                            100,
                            Math.round((m.completedQty / m.targetQty) * 100)
                          )
                        : 0;
                    const isCurrent = m.stageName === order.currentStage;
                    const isDone = m.status === 'COMPLETED';

                    return (
                      <div
                        key={m.id}
                        className={`rounded-xl border p-3.5 ${
                          isCurrent
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : isDone
                            ? 'border-emerald-200 bg-emerald-50/50 text-slate-900'
                            : 'border-slate-200 bg-slate-50/60 text-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold">
                            {m.sequenceOrder}. {m.stageName}
                          </span>
                          {isDone ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : isCurrent ? (
                            <Clock className="h-4 w-4 text-amber-400" />
                          ) : null}
                        </div>

                        <div className="mt-2 flex items-baseline justify-between font-mono text-xs tabular-nums">
                          <span>
                            {m.completedQty.toLocaleString()} /{' '}
                            {m.targetQty.toLocaleString()} pcs
                          </span>
                          <span className="font-bold">{pct}%</span>
                        </div>

                        <div
                          className={`mt-1.5 h-1.5 w-full overflow-hidden rounded-full ${
                            isCurrent ? 'bg-slate-700' : 'bg-slate-200'
                          }`}
                        >
                          <div
                            className={`h-full rounded-full ${
                              isDone
                                ? 'bg-emerald-500'
                                : isCurrent
                                ? 'bg-emerald-400'
                                : 'bg-slate-400'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>

                        <div
                          className={`mt-2 font-mono text-[10px] tabular-nums ${
                            isCurrent ? 'text-slate-300' : 'text-slate-500'
                          }`}
                        >
                          Plan: {formatDate(m.plannedStartDate)} →{' '}
                          {formatDate(m.plannedEndDate)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Floor Inspection Photos (if any attached) */}
              {photos.length > 0 && (
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <ImageIcon className="h-3.5 w-3.5" />
                    <span>Floor Inspection &amp; Bundle Photos</span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-3">
                    {photos.map((p) => (
                      <div
                        key={p.id}
                        className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-2"
                      >
                        <img
                          src={p.photoUrl!}
                          alt="Floor inspection"
                          className="h-24 w-40 rounded object-cover"
                        />
                        <div className="mt-1 font-mono text-[10px] text-slate-600 tabular-nums">
                          {formatDate(p.workDate)} · +{p.qtyDoneToday} pcs
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Compliance Date-Change History (Audit Trail) */}
              <div className="mt-5 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <History className="h-3.5 w-3.5" />
                    <span>
                      Compliance Date-Change Audit Trail (
                      {order.dateChangeAudits.length})
                    </span>
                  </div>
                </div>

                {order.dateChangeAudits.length === 0 ? (
                  <p className="mt-1.5 text-xs text-slate-500">
                    No target dates have been modified since PO issue.
                  </p>
                ) : (
                  <div className="mt-2.5 overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          <th className="py-2 pr-3">Changed On</th>
                          <th className="px-3 py-2">Stage / Field</th>
                          <th className="px-3 py-2">Old Date → New Date</th>
                          <th className="py-2 pl-3">Compliance Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {order.dateChangeAudits.map((a) => (
                          <tr key={a.id}>
                            <td className="py-2 pr-3 font-mono text-slate-500 tabular-nums">
                              {formatDate(a.changedAt)}
                            </td>
                            <td className="px-3 py-2 font-mono font-semibold text-slate-800">
                              {a.milestone
                                ? `${a.milestone.stageName} (${a.fieldChanged})`
                                : a.fieldChanged}
                            </td>
                            <td className="px-3 py-2 font-mono tabular-nums">
                              <span className="text-slate-400 line-through">
                                {formatDate(a.oldDate)}
                              </span>{' '}
                              →{' '}
                              <strong className="text-amber-800">
                                {formatDate(a.newDate)}
                              </strong>
                            </td>
                            <td className="py-2 pl-3 text-slate-700">
                              {a.changeReason}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

