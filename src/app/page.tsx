'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Calculator,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  Languages,
  Loader2,
  Package,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  Sparkles,
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
  status: 'GREEN' | 'AMBER' | 'RED';
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

  // KPI aggregations across all orders
  const kpis = useMemo(() => {
    const totalOrders = orders.length;
    const totalPieces = orders.reduce((acc, o) => acc + o.totalQty, 0);
    const redCount = orders.filter((o) => o.runRate.status === 'RED').length;
    const amberCount = orders.filter(
      (o) => o.runRate.status === 'AMBER'
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
      amberCount,
      atRiskCount: redCount + amberCount,
      earlyWarningOrders,
      pendingAiCount,
    };
  }, [orders]);

  return (
    <div className="space-y-6">
      {/* Page Title & Action Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            Merchandiser Export Order Board
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
            Real-time TNA milestone tracking, 3-day floor run-rate delay
            projection, and Tamil-to-English AI blocker verification.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {userRole === 'MERCHANDISER' ? (
            <button
              type="button"
              onClick={() => setIsNewOrderOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white shadow-xs transition hover:bg-slate-800"
            >
              <Plus className="h-3.5 w-3.5" />
              New Production Order
            </button>
          ) : (
            <Link
              href="/supervisor"
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white shadow-xs transition hover:bg-blue-700"
            >
              Open Supervisor Floor Input
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* 1. Early Delay Warning Banner (Top Alert Strip) */}
      {!loading && kpis.atRiskCount > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
          <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-900">
                    2-Week Early Delay Radar Active
                  </span>
                  <span className="rounded bg-rose-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-rose-800">
                    {kpis.redCount} Critical (RED)
                  </span>
                  <span className="rounded bg-amber-200/70 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-900">
                    {kpis.amberCount} Early Warning (AMBER)
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-700">
                  Run-rate engine detected{' '}
                  <strong>{kpis.earlyWarningOrders.length} orders</strong>{' '}
                  slipping behind daily floor targets{' '}
                  <strong>10–18 days before Ex-Factory</strong> — giving
                  merchandisers time to add lines or shifts before air-freight
                  penalties occur.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {kpis.earlyWarningOrders.map((ew) => (
                <Link
                  key={ew.id}
                  href={`/orders/${ew.id}`}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-xs font-medium transition ${
                    ew.runRate.status === 'RED'
                      ? 'border-rose-300 bg-white text-rose-700 hover:bg-rose-50'
                      : 'border-amber-300 bg-white text-amber-800 hover:bg-amber-50'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      ew.runRate.status === 'RED'
                        ? 'animate-pulse bg-rose-600'
                        : 'bg-amber-500'
                    }`}
                  />
                  {ew.poNumber} ({ew.runRate.dailyShortfallOrSurplus} pcs/d)
                  <ArrowRight className="h-3 w-3" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. KPI Summary Cards (4 clean metric cards) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Active Export Orders</span>
            <Package className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">
              {kpis.totalOrders}
            </span>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              ({kpis.totalPieces.toLocaleString()} pcs total)
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Across {units.length || 3} Tiruppur production units
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>At-Risk Orders (Red / Amber)</span>
            <ShieldAlert className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold text-rose-600 tabular-nums">
              {kpis.atRiskCount}
            </span>
            <span className="font-mono text-xs text-slate-500">
              of {kpis.totalOrders} POs
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {kpis.redCount} projected past Ex-Factory · {kpis.amberCount}{' '}
            stage-slip risk
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>2-Week Early Warnings</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold text-amber-700 tabular-nums">
              {kpis.earlyWarningOrders.length}
            </span>
            <span className="rounded bg-amber-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-amber-800">
              ≥10d before ship
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Surfaced early via 3-day floor run-rate delta
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Pending AI Floor Notes</span>
            <Languages className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">
              {kpis.pendingAiCount}
            </span>
            <span className="font-mono text-xs text-slate-500">
              awaiting review
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Gatekept from Buyer Portal until confirmed
          </p>
        </div>
      </div>

      {/* 3. Filter Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mr-1">
              <Filter className="h-3.5 w-3.5" />
              <span>Filters:</span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search PO or Style..."
                className="w-44 rounded-lg border border-slate-200 bg-slate-50/60 py-1.5 pl-8 pr-2.5 text-xs text-slate-900 focus:border-slate-900 focus:bg-white focus:outline-none sm:w-52"
              />
            </div>

            {/* Buyer Filter */}
            <select
              value={selectedBuyer}
              onChange={(e) => setSelectedBuyer(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-slate-900 focus:outline-none"
            >
              <option value="ALL">All Buyers</option>
              {buyers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            {/* Unit Filter */}
            <select
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-slate-900 focus:outline-none"
            >
              <option value="ALL">All Production Units</option>
              {units.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>

            {/* Status Filter Pills */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              {(['ALL', 'RED', 'AMBER', 'GREEN'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setSelectedStatus(st)}
                  className={`rounded-md px-2.5 py-1 font-mono text-[11px] font-medium transition ${
                    selectedStatus === st
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Ship Week Filter */}
            <select
              value={selectedShipWeek}
              onChange={(e) => setSelectedShipWeek(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-700 focus:border-slate-900 focus:outline-none"
            >
              <option value="ALL">All Ship Weeks</option>
              {shipWeeks.map((wk) => (
                <option key={wk} value={wk}>
                  Week of {formatDate(wk)}
                </option>
              ))}
            </select>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              <RotateCcw className="h-3 w-3" />
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* 4. Loading / Error / Empty / Order Cards */}
      {loading ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
          <p className="mt-2 text-xs font-medium text-slate-500">
            Calculating live 3-day floor run-rates across active TNA stages...
          </p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center">
          <p className="text-sm font-medium text-rose-800">{error}</p>
          <button
            type="button"
            onClick={fetchBoardData}
            className="mt-3 rounded-lg bg-rose-700 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-rose-800"
          >
            Retry
          </button>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-sm font-medium text-slate-800">
            No production orders match the selected filters.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Try clearing your filter criteria or create a new production order.
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const { runRate, latestFloorUpdate } = order;

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

            const statusLabel =
              runRate.status === 'RED'
                ? 'RED · CRITICAL DELAY'
                : runRate.status === 'AMBER'
                ? 'AMBER · AT RISK'
                : 'GREEN · ON TRACK';

            return (
              <div
                key={order.id}
                className="group rounded-xl border border-slate-200 bg-white p-5 shadow-2xs transition hover:border-slate-300 hover:shadow-sm"
              >
                {/* Top Row: PO Info, Buyer, Unit, Ex-Factory & Status Badge */}
                <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-center">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/orders/${order.id}`}
                        className="font-mono text-base font-bold text-slate-900 hover:underline"
                      >
                        {order.poNumber}
                      </Link>
                      <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {order.buyer.name}
                      </span>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">
                        {order.productionUnit}
                      </span>
                      <span className="font-mono text-xs text-slate-500 tabular-nums">
                        {order.totalQty.toLocaleString()} pcs
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-800">
                      {order.styleName}{' '}
                      <span className="text-xs font-normal text-slate-500">
                        · Colour: {order.colour}
                      </span>
                    </p>
                  </div>

                  {/* Right Status Badges & Ex-Factory */}
                  <div className="flex flex-wrap items-center gap-2">
                    {runRate.isTwoWeekEarlyWarning && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100/80 px-2.5 py-1 font-mono text-[11px] font-semibold text-amber-900">
                        <Clock className="h-3 w-3" />
                        2-Week Early Warning ({runRate.daysLeftToExFactory}d to
                        ship)
                      </span>
                    )}

                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs font-semibold ${statusBadgeStyles}`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${statusDotStyles}`}
                      />
                      {statusLabel}
                    </span>

                    <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs text-slate-700 tabular-nums">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <span>Ex-Factory: {formatDate(order.exFactoryDate)}</span>
                    </div>
                  </div>
                </div>

                {/* Middle Row: TNA Mini-Stepper + "Shows Its Maths" Run-Rate Box */}
                <div className="mt-4 grid gap-4 lg:grid-cols-12">
                  {/* Left 5 cols: Active Stage & TNA Milestones Stepper */}
                  <div className="space-y-3 lg:col-span-5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-600">
                        Current Stage:{' '}
                        <strong className="font-mono text-slate-900">
                          {order.currentStage}
                        </strong>
                      </span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">
                        {runRate.completedQty.toLocaleString()} /{' '}
                        {runRate.totalQty.toLocaleString()} pcs (
                        {runRate.completionPercentage}%)
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all ${
                          runRate.status === 'RED'
                            ? 'bg-rose-500'
                            : runRate.status === 'AMBER'
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${runRate.completionPercentage}%` }}
                      />
                    </div>

                    {/* TNA Milestones Mini-Stepper */}
                    <div className="grid grid-cols-2 gap-1.5 pt-1 sm:grid-cols-4">
                      {order.milestones.map((m) => {
                        const isCurrent = m.stageName === order.currentStage;
                        const isDone = m.status === 'COMPLETED';
                        return (
                          <div
                            key={m.id}
                            className={`rounded-lg border p-2 text-[11px] ${
                              isCurrent
                                ? 'border-slate-900 bg-slate-900 text-white'
                                : isDone
                                ? 'border-emerald-200 bg-emerald-50/50 text-emerald-900'
                                : 'border-slate-200 bg-slate-50/60 text-slate-500'
                            }`}
                          >
                            <div className="flex items-center justify-between font-mono text-[10px] font-semibold">
                              <span>{m.stageName}</span>
                              {isDone && (
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              )}
                            </div>
                            <div
                              className={`mt-0.5 font-mono text-[10px] tabular-nums ${
                                isCurrent ? 'text-slate-300' : 'text-slate-500'
                              }`}
                            >
                              {m.completedQty.toLocaleString()} /{' '}
                              {m.targetQty.toLocaleString()}
                            </div>
                            <div
                              className={`font-mono text-[9px] ${
                                isCurrent ? 'text-slate-300' : 'text-slate-400'
                              }`}
                            >
                              Due {formatDate(m.plannedEndDate)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right 7 cols: "Shows Its Maths" Run-Rate Box */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 lg:col-span-7">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                        <Calculator className="h-3.5 w-3.5 text-slate-500" />
                        <span>Run-Rate Projection Engine (“Shows Its Maths”)</span>
                      </div>
                      <span className="font-mono text-[11px] font-medium text-slate-600">
                        {runRate.warningHeadline}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-lg border border-slate-200/80 bg-white p-2.5">
                        <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                          Required Rate
                        </div>
                        <div className="mt-1 font-mono text-sm font-bold text-slate-900 tabular-nums">
                          {runRate.requiredDailyRate.toLocaleString()} pcs/d
                        </div>
                        <div className="font-mono text-[10px] text-slate-500 tabular-nums">
                          {runRate.remainingQty.toLocaleString()} left ÷{' '}
                          {runRate.daysLeftToStageEnd}d
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-200/80 bg-white p-2.5">
                        <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                          Actual (3d Avg)
                        </div>
                        <div className="mt-1 font-mono text-sm font-bold text-slate-900 tabular-nums">
                          {runRate.actualDailyRate.toLocaleString()} pcs/d
                        </div>
                        <div className="font-mono text-[10px] text-slate-500">
                          Last 3 floor shifts
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-200/80 bg-white p-2.5">
                        <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                          Daily Variance
                        </div>
                        <div
                          className={`mt-1 font-mono text-sm font-bold tabular-nums ${
                            runRate.dailyShortfallOrSurplus < 0
                              ? 'text-rose-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          {runRate.dailyShortfallOrSurplus > 0 ? '+' : ''}
                          {runRate.dailyShortfallOrSurplus.toLocaleString()}{' '}
                          pcs/d
                        </div>
                        <div className="font-mono text-[10px] text-slate-500">
                          {runRate.dailyShortfallOrSurplus < 0
                            ? 'Daily shortfall'
                            : 'Daily buffer'}
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-200/80 bg-white p-2.5">
                        <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                          Projected Finish
                        </div>
                        <div
                          className={`mt-1 font-mono text-sm font-bold tabular-nums ${
                            (runRate.projectedSlipDays ?? 0) > 0
                              ? 'text-rose-600'
                              : 'text-emerald-700'
                          }`}
                        >
                          {runRate.projectedDaysNeeded !== null
                            ? `${runRate.projectedDaysNeeded} days`
                            : 'Stalled'}
                        </div>
                        <div className="font-mono text-[10px] text-slate-500 tabular-nums">
                          {(runRate.projectedSlipDays ?? 0) > 0
                            ? `${runRate.projectedSlipDays}d behind stage plan`
                            : 'On / ahead of plan'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2.5 font-mono text-[11px] text-slate-600 tabular-nums">
                      Formula: {runRate.mathSummary}
                    </div>
                  </div>
                </div>

                {/* Bottom Row: Latest Tamil AI Floor Note Preview + Action Link */}
                <div className="mt-4 flex flex-col justify-between gap-3 border-t border-slate-100 pt-3.5 sm:flex-row sm:items-center">
                  {latestFloorUpdate?.rawNoteTamil ? (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-indigo-800">
                        <Sparkles className="h-3 w-3" />
                        AI:{' '}
                        {latestFloorUpdate.finalReasonCategory ||
                          latestFloorUpdate.aiReasonCategory}
                        {latestFloorUpdate.aiConfidence
                          ? ` (${Math.round(
                              latestFloorUpdate.aiConfidence * 100
                            )}%)`
                          : ''}
                      </span>

                      <span className="font-medium text-slate-800">
                        “{latestFloorUpdate.aiEnglishTranslation}”
                      </span>

                      <span className="text-slate-400">·</span>
                      <span className="text-slate-500">
                        Tamil: “{latestFloorUpdate.rawNoteTamil}”
                      </span>

                      {latestFloorUpdate.isMerchandiserConfirmed ? (
                        <span className="rounded bg-emerald-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-800">
                          Confirmed for Buyer Portal
                        </span>
                      ) : (
                        <span className="rounded bg-amber-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-900">
                          Pending Merchandiser Confirmation
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">
                      Latest floor log:{' '}
                      <span className="font-mono font-medium text-slate-700">
                        {latestFloorUpdate
                          ? `${latestFloorUpdate.qtyDoneToday.toLocaleString()} pcs logged on ${formatDate(
                              latestFloorUpdate.workDate
                            )} (No floor blocker reported)`
                          : 'No daily updates logged yet'}
                      </span>
                    </div>
                  )}

                  <Link
                    href={`/orders/${order.id}`}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 transition group-hover:border-slate-900 group-hover:bg-slate-900 group-hover:text-white"
                  >
                    Inspect TNA &amp; Review AI
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Order + TNA Modal */}
      <NewOrderModal
        isOpen={isNewOrderOpen}
        onClose={() => setIsNewOrderOpen(false)}
        buyers={buyers}
        onOrderCreated={fetchBoardData}
      />
    </div>
  );
}

