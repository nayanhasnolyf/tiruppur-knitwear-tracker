'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Download,
  Loader2,
  Plus,
  RotateCcw,
  Search,
} from 'lucide-react';
import NewOrderModal from '@/components/NewOrderModal';

interface BuyerInfo {
  id: string;
  name: string;
  country: string;
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
  workDate: string;
  qtyDoneToday: number;
  rawNoteTamil: string | null;
  aiEnglishTranslation: string | null;
  aiReasonCategory: string | null;
  finalReasonCategory: string | null;
  aiConfidence: number | null;
  isMerchandiserConfirmed: boolean;
  merchandiserBuyerNote: string | null;
  needsManualReview: boolean;
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

interface OrderCardData {
  id: string;
  poNumber: string;
  buyerId: string;
  buyer: BuyerInfo;
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
  unconfirmedAiUpdatesCount: number;
  latestFloorUpdate: FloorUpdateItem | null;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  });
}

export default function MerchandiserOrderBoardPage() {
  const [orders, setOrders] = useState<OrderCardData[]>([]);
  const [buyers, setBuyers] = useState<BuyerInfo[]>([]);
  const [units, setUnits] = useState<string[]>([]);
  const [shipWeeks, setShipWeeks] = useState<string[]>([]);
  const [userRole, setUserRole] = useState<'MERCHANDISER' | 'SUPERVISOR'>(
    'MERCHANDISER'
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);

  // Filters
  const [selectedBuyer, setSelectedBuyer] = useState('ALL');
  const [selectedUnit, setSelectedUnit] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedShipWeek, setSelectedShipWeek] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchBoardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersRes, authRes] = await Promise.all([
        fetch('/api/orders', { cache: 'no-store' }),
        fetch('/api/auth/me', { cache: 'no-store' }),
      ]);

      if (!ordersRes.ok) {
        throw new Error('Failed to load production orders.');
      }

      const ordersData = await ordersRes.json();
      setOrders(ordersData.orders || []);
      setBuyers(ordersData.filters?.buyers || []);
      setUnits(ordersData.filters?.units || []);
      setShipWeeks(ordersData.filters?.shipWeeks || []);

      if (authRes.ok) {
        const authData = await authRes.json();
        if (authData.user?.role) {
          setUserRole(authData.user.role);
        }
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Unable to load order board.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBoardData();
    const onAuthChange = () => fetchBoardData();
    window.addEventListener('tk-auth-changed', onAuthChange);
    return () => window.removeEventListener('tk-auth-changed', onAuthChange);
  }, [fetchBoardData]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (selectedBuyer !== 'ALL' && o.buyerId !== selectedBuyer) return false;
      if (selectedUnit !== 'ALL' && o.productionUnit !== selectedUnit)
        return false;
      if (selectedStatus !== 'ALL' && o.runRate.status !== selectedStatus)
        return false;
      if (selectedShipWeek !== 'ALL' && o.shipWeek !== selectedShipWeek)
        return false;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchPo = o.poNumber.toLowerCase().includes(q);
        const matchStyle = o.styleName.toLowerCase().includes(q);
        const matchBuyer = o.buyer.name.toLowerCase().includes(q);
        if (!matchPo && !matchStyle && !matchBuyer) return false;
      }

      return true;
    });
  }, [
    orders,
    selectedBuyer,
    selectedUnit,
    selectedStatus,
    selectedShipWeek,
    searchQuery,
  ]);

  const hasActiveFilters =
    selectedBuyer !== 'ALL' ||
    selectedUnit !== 'ALL' ||
    selectedStatus !== 'ALL' ||
    selectedShipWeek !== 'ALL' ||
    searchQuery.trim().length > 0;

  const resetFilters = () => {
    setSelectedBuyer('ALL');
    setSelectedUnit('ALL');
    setSelectedStatus('ALL');
    setSelectedShipWeek('ALL');
    setSearchQuery('');
  };

  const handleExportWeeklyCsv = () => {
    const headers = [
      'PO Number',
      'Buyer',
      'Country',
      'Style Name',
      'Colour',
      'Production Unit',
      'Total Qty (pcs)',
      'Active Stage',
      'Stage Completed (pcs)',
      'Stage Completion %',
      'Required Daily Rate (pcs/d)',
      'Actual 3d Avg Rate (pcs/d)',
      'Daily Variance (pcs/d)',
      'Ex-Factory Date',
      'Status',
      'Confirmed Buyer Note',
    ];

    const escapeCell = (val: string | number | null | undefined) => {
      const s = String(val ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const rows = filteredOrders.map((o) => [
      o.poNumber,
      o.buyer.name,
      o.buyer.country,
      o.styleName,
      o.colour,
      o.productionUnit,
      o.totalQty,
      o.currentStage,
      o.runRate.completedQty,
      `${o.runRate.completionPercentage}%`,
      o.runRate.requiredDailyRate,
      o.runRate.actualDailyRate,
      o.runRate.dailyShortfallOrSurplus,
      new Date(o.exFactoryDate).toISOString().slice(0, 10),
      o.runRate.status,
      o.latestFloorUpdate?.isMerchandiserConfirmed
        ? o.latestFloorUpdate.merchandiserBuyerNote ||
          o.latestFloorUpdate.aiEnglishTranslation ||
          ''
        : 'On track / Pending confirmation',
    ]);

    const csvContent =
      '\uFEFF' +
      [headers, ...rows]
        .map((r) => r.map(escapeCell).join(','))
        .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Tiruppur_Weekly_Buyer_Status_2026-11-02.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const kpis = useMemo(() => {
    const totalOrders = orders.length;
    const totalPieces = orders.reduce((acc, o) => acc + o.totalQty, 0);
    const redCount = orders.filter((o) => o.runRate.status === 'RED').length;
    const yellowCount = orders.filter(
      (o) => o.runRate.status === 'YELLOW'
    ).length;
    const earlyWarningOrders = orders.filter(
      (o) => o.runRate.isTwoWeekEarlyWarning
    );
    const pendingAiCount = orders.reduce(
      (acc, o) => acc + o.unconfirmedAiUpdatesCount,
      0
    );

    return {
      totalOrders,
      totalPieces,
      redCount,
      yellowCount,
      atRiskCount: redCount + yellowCount,
      earlyWarningCount: earlyWarningOrders.length,
      pendingAiCount,
    };
  }, [orders]);

  return (
    <div className="space-y-6">
      {/* Minimal Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
            Production Orders
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            3-day rolling floor run-rate vs TNA targets · Anchor date: 02 Nov
            2026
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportWeeklyCsv}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 transition hover:border-zinc-950 hover:text-zinc-950"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>

          {userRole === 'MERCHANDISER' ? (
            <button
              type="button"
              onClick={() => setIsNewOrderOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-zinc-950 px-3.5 text-xs font-medium text-white transition hover:bg-zinc-800"
            >
              <Plus className="h-3.5 w-3.5" />
              New Order
            </button>
          ) : (
            <Link
              href="/supervisor"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-zinc-950 px-3.5 text-xs font-medium text-white transition hover:bg-zinc-800"
            >
              Floor Entry
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* 1. Top Metric Strip: Single 4-Column Hairline Grid */}
      <div className="grid grid-cols-2 divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white lg:grid-cols-4 lg:divide-x lg:divide-y-0">
        <div className="p-5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
            Active Export POs
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-[28px] font-semibold leading-none text-zinc-950 tabular-nums">
              {kpis.totalOrders}
            </span>
            <span className="font-mono text-xs text-zinc-500 tabular-nums">
              {kpis.totalPieces.toLocaleString()} pcs
            </span>
          </div>
        </div>

        <div className="p-5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
            At-Risk Orders
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-[28px] font-semibold leading-none text-zinc-950 tabular-nums">
              {kpis.atRiskCount}
            </span>
            <span className="font-mono text-xs text-zinc-500 tabular-nums">
              {kpis.redCount} red · {kpis.yellowCount} yellow
            </span>
          </div>
        </div>

        <div className="p-5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
            2-Week Early Warnings
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-[28px] font-semibold leading-none text-zinc-950 tabular-nums">
              {kpis.earlyWarningCount}
            </span>
            <span className="font-mono text-xs text-zinc-500">
              ≥10d before Ex-Factory
            </span>
          </div>
        </div>

        <div className="p-5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
            Unconfirmed Tamil Notes
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-[28px] font-semibold leading-none text-zinc-950 tabular-nums">
              {kpis.pendingAiCount}
            </span>
            <span className="font-mono text-xs text-zinc-500">
              awaiting merchandiser gate
            </span>
          </div>
        </div>
      </div>

      {/* 2. Single-Row Clean Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search PO or style..."
              className="h-9 w-48 rounded-md border border-zinc-200 bg-white pl-8 pr-3 text-xs text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-none sm:w-56"
            />
          </div>

          {/* Segmented Status Control */}
          <div className="flex h-9 items-center rounded-md border border-zinc-200 bg-white p-0.5">
            {(['ALL', 'RED', 'YELLOW', 'GREEN'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setSelectedStatus(st)}
                className={`h-full rounded px-2.5 font-mono text-[11px] font-medium transition ${
                  selectedStatus === st
                    ? 'bg-zinc-950 text-white'
                    : 'text-zinc-500 hover:text-zinc-950'
                }`}
              >
                {st === 'ALL' ? 'All' : st}
              </button>
            ))}
          </div>

          <select
            value={selectedBuyer}
            onChange={(e) => setSelectedBuyer(e.target.value)}
            className="h-9 rounded-md border border-zinc-200 bg-white px-2.5 text-xs text-zinc-700 focus:border-zinc-950 focus:outline-none"
          >
            <option value="ALL">All Buyers</option>
            {buyers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <select
            value={selectedUnit}
            onChange={(e) => setSelectedUnit(e.target.value)}
            className="h-9 rounded-md border border-zinc-200 bg-white px-2.5 text-xs text-zinc-700 focus:border-zinc-950 focus:outline-none"
          >
            <option value="ALL">All Units</option>
            {units.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>

          <select
            value={selectedShipWeek}
            onChange={(e) => setSelectedShipWeek(e.target.value)}
            className="h-9 rounded-md border border-zinc-200 bg-white px-2.5 font-mono text-xs text-zinc-700 focus:border-zinc-950 focus:outline-none"
          >
            <option value="ALL">All Ship Weeks</option>
            {shipWeeks.map((wk) => (
              <option key={wk} value={wk}>
                Wk {formatShortDate(wk)}
              </option>
            ))}
          </select>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-600 hover:border-zinc-950 hover:text-zinc-950"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        )}
      </div>

      {/* 3. High-Clarity Order Board (4-Column Hairline Rows — Zero Box-in-Box Clutter) */}
      {loading ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-zinc-200 bg-white py-20">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
          <p className="mt-2 font-mono text-xs text-zinc-500">
            Computing run-rates...
          </p>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-[#FECDD3] bg-[#FFF1F2] p-6 text-center">
          <p className="text-sm font-medium text-[#BE123C]">{error}</p>
          <button
            type="button"
            onClick={fetchBoardData}
            className="mt-3 rounded-md bg-zinc-950 px-3.5 py-1.5 text-xs font-medium text-white"
          >
            Retry
          </button>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-14 text-center">
          <p className="text-sm font-medium text-zinc-950">
            No matching production orders
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Adjust your filter selection or create a new order.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          {/* Column Headers */}
          <div className="hidden grid-cols-12 border-b border-zinc-200 bg-zinc-100/70 px-6 py-2.5 text-[11px] font-medium uppercase tracking-wider text-zinc-400 lg:grid">
            <div className="col-span-3">Order &amp; Style</div>
            <div className="col-span-3">Stage &amp; TNA Progress</div>
            <div className="col-span-4">Run-Rate Math (3-Day Avg vs Need)</div>
            <div className="col-span-2 text-right">Schedule Status</div>
          </div>

          <div className="divide-y divide-zinc-200">
            {filteredOrders.map((order) => {
              const { runRate, latestFloorUpdate } = order;

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

              const statusLabel =
                runRate.status === 'RED'
                  ? `RED · ${runRate.projectedExFactorySlipDays ?? runRate.projectedSlipDays ?? 0}d Late`
                  : runRate.status === 'YELLOW'
                  ? 'YELLOW · 2-Wk Warning'
                  : 'GREEN · On Track';

              return (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="group grid grid-cols-1 items-center gap-5 p-6 transition hover:bg-zinc-50/80 lg:grid-cols-12"
                >
                  {/* Col 1: Identity (Monochrome) */}
                  <div className="lg:col-span-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-zinc-950 group-hover:underline">
                        {order.poNumber}
                      </span>
                      <span className="font-mono text-xs text-zinc-400 tabular-nums">
                        {order.totalQty.toLocaleString()} pcs
                      </span>
                    </div>
                    <div className="mt-1 text-sm font-medium text-zinc-900">
                      {order.styleName}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {order.buyer.name} · {order.productionUnit}
                    </div>
                  </div>

                  {/* Col 2: Stage & Thin Progress Bar + Dot Stepper */}
                  <div className="lg:col-span-3 lg:pr-4">
                    <div className="flex items-baseline justify-between">
                      <span className="font-mono text-xs font-semibold text-zinc-950">
                        {order.currentStage}
                      </span>
                      <span className="font-mono text-xs text-zinc-500 tabular-nums">
                        {runRate.completedQty.toLocaleString()} /{' '}
                        {runRate.totalQty.toLocaleString()} (
                        {runRate.completionPercentage}%)
                      </span>
                    </div>

                    {/* Clean 4px thin monochrome progress bar */}
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className="h-full rounded-full bg-zinc-950 transition-all"
                        style={{ width: `${runRate.completionPercentage}%` }}
                      />
                    </div>

                    {/* Minimal TNA Stage Dots */}
                    <div className="mt-2.5 flex items-center gap-3">
                      {order.milestones.map((m) => {
                        const isDone = m.status === 'COMPLETED';
                        const isCurrent = m.stageName === order.currentStage;
                        return (
                          <div
                            key={m.id}
                            className="flex items-center gap-1 font-mono text-[10px]"
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                isDone
                                  ? 'bg-zinc-950'
                                  : isCurrent
                                  ? 'ring-2 ring-zinc-950 bg-white'
                                  : 'bg-zinc-300'
                              }`}
                            />
                            <span
                              className={
                                isCurrent
                                  ? 'font-semibold text-zinc-950'
                                  : 'text-zinc-400'
                              }
                            >
                              {m.stageName.slice(0, 3)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Col 3: "Shows Its Maths" Run-Rate Column */}
                  <div className="lg:col-span-4">
                    <div className="flex flex-wrap items-baseline gap-2 font-mono text-xs tabular-nums">
                      <span className="text-zinc-500">
                        Need{' '}
                        <strong className="text-zinc-950">
                          {runRate.requiredDailyRate}/d
                        </strong>
                      </span>
                      <span className="text-zinc-300">·</span>
                      <span className="text-zinc-500">
                        Actual{' '}
                        <strong className="text-zinc-950">
                          {runRate.actualDailyRate}/d
                        </strong>
                      </span>
                      <span
                        className={`font-semibold ${
                          runRate.dailyShortfallOrSurplus < 0
                            ? 'text-[#BE123C]'
                            : 'text-[#047857]'
                        }`}
                      >
                        ({runRate.dailyShortfallOrSurplus > 0 ? '+' : ''}
                        {runRate.dailyShortfallOrSurplus}/d)
                      </span>
                    </div>

                    <div className="mt-1 font-mono text-[11px] text-zinc-500 tabular-nums">
                      {runRate.remainingQty.toLocaleString()} left ÷{' '}
                      {runRate.daysLeftToStageEnd}d · Ex-Factory{' '}
                      {formatDate(order.exFactoryDate)} (
                      {runRate.daysLeftToExFactory}d left)
                    </div>

                    {latestFloorUpdate?.rawNoteTamil && (
                      <div className="mt-1.5 truncate text-xs text-zinc-600">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                          {latestFloorUpdate.finalReasonCategory ||
                            latestFloorUpdate.aiReasonCategory}
                          :{' '}
                        </span>
                        “{latestFloorUpdate.aiEnglishTranslation}”
                      </div>
                    )}
                  </div>

                  {/* Col 4: Status Pill (ONLY Colored Element) & Action Arrow */}
                  <div className="flex items-center justify-between gap-3 lg:col-span-2 lg:justify-end">
                    <div className="flex flex-col items-start lg:items-end">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-semibold ${statusPillStyle}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${statusDotStyle}`}
                        />
                        {statusLabel}
                      </span>

                      {order.unconfirmedAiUpdatesCount > 0 && (
                        <span className="mt-1 font-mono text-[10px] text-zinc-500">
                          • Review Tamil note
                        </span>
                      )}
                    </div>

                    <ArrowRight className="h-4 w-4 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-zinc-950" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <NewOrderModal
        isOpen={isNewOrderOpen}
        onClose={() => setIsNewOrderOpen(false)}
        buyers={buyers}
        onOrderCreated={fetchBoardData}
      />
    </div>
  );
}
