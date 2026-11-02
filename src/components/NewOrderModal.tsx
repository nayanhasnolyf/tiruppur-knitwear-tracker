'use client';

import React, { useMemo, useState } from 'react';
import {
  X,
  Plus,
  Calendar,
  Layers,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface BuyerOption {
  id: string;
  name: string;
  country: string;
}

interface NewOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  buyers: BuyerOption[];
  onOrderCreated: () => void;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function formatShortDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function NewOrderModal({
  isOpen,
  onClose,
  buyers,
  onOrderCreated,
}: NewOrderModalProps) {
  const [poNumber, setPoNumber] = useState('B-PO-88299');
  const [buyerId, setBuyerId] = useState(buyers[0]?.id || '');
  const [styleName, setStyleName] = useState("Men's Raglan Sweatshirt, Heather Grey");
  const [colour, setColour] = useState('Heather Grey');
  const [productionUnit, setProductionUnit] = useState('Unit 1');
  const [exFactoryDate, setExFactoryDate] = useState('2026-11-30');
  const [templateType, setTemplateType] = useState<'SOLID_BASIC' | 'PRINTED_TEE'>(
    'SOLID_BASIC'
  );

  const [sizes, setSizes] = useState<{ S: number; M: number; L: number; XL: number }>({
    S: 1500,
    M: 3000,
    L: 3000,
    XL: 1500,
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!buyerId && buyers.length > 0) {
      setBuyerId(buyers[0].id);
    }
  }, [buyers, buyerId]);

  const totalQty = useMemo(() => {
    return (
      (Number(sizes.S) || 0) +
      (Number(sizes.M) || 0) +
      (Number(sizes.L) || 0) +
      (Number(sizes.XL) || 0)
    );
  }, [sizes]);

  const previewMilestones = useMemo(() => {
    const d = new Date(`${exFactoryDate}T00:00:00.000Z`);
    const baseMs = Number.isNaN(d.getTime())
      ? new Date('2026-11-30T00:00:00.000Z').getTime()
      : d.getTime();

    const offsets =
      templateType === 'PRINTED_TEE'
        ? [
            { stage: 'CUTTING', start: -26, end: -21 },
            { stage: 'PRINTING', start: -20, end: -13 },
            { stage: 'STITCHING', start: -12, end: -6 },
            { stage: 'WASHING', start: -5, end: -3 },
            { stage: 'FINISHING', start: -2, end: -1 },
          ]
        : [
            { stage: 'CUTTING', start: -22, end: -17 },
            { stage: 'STITCHING', start: -16, end: -6 },
            { stage: 'WASHING', start: -5, end: -3 },
            { stage: 'FINISHING', start: -2, end: -1 },
          ];

    return offsets.map((o, idx) => ({
      seq: idx + 1,
      stage: o.stage,
      plannedStart: formatShortDate(baseMs + o.start * MS_PER_DAY),
      plannedEnd: formatShortDate(baseMs + o.end * MS_PER_DAY),
      daysAllocated: o.end - o.start + 1,
    }));
  }, [exFactoryDate, templateType]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (totalQty <= 0) {
      setError('Total order quantity across sizes must be greater than 0.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poNumber,
          buyerId,
          styleName,
          colour,
          productionUnit,
          exFactoryDate,
          templateType,
          sizeBreakdown: sizes,
          totalQty,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create order.');
        return;
      }

      onOrderCreated();
      onClose();
    } catch {
      setError('Network error while creating order.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Create Production Order &amp; Auto-Generate TNA Schedule
            </h2>
            <p className="text-xs text-slate-500">
              Generates backward-scheduled TNA milestones from your Ex-Factory
              ship date.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Row 1: PO Number, Buyer, Production Unit */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                PO Number *
              </label>
              <input
                type="text"
                required
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                placeholder="B-PO-88299"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Buyer *
              </label>
              <select
                required
                value={buyerId}
                onChange={(e) => setBuyerId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
              >
                {buyers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Production Unit *
              </label>
              <select
                value={productionUnit}
                onChange={(e) => setProductionUnit(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
              >
                <option value="Unit 1">Unit 1 (Main Sewing)</option>
                <option value="Unit 2">Unit 2 (Polo &amp; Finishing)</option>
                <option value="Subcontract - Printing">
                  Subcontract - Printing
                </option>
              </select>
            </div>
          </div>

          {/* Row 2: Style Name, Colour, Ex-Factory Date */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-slate-700">
                Style Description *
              </label>
              <input
                type="text"
                required
                value={styleName}
                onChange={(e) => setStyleName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Colourway *
              </label>
              <input
                type="text"
                required
                value={colour}
                onChange={(e) => setColour(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Ex-Factory Date *
              </label>
              <div className="relative mt-1">
                <Calendar className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="date"
                  required
                  value={exFactoryDate}
                  onChange={(e) => setExFactoryDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-2 font-mono text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Row 3: Size Quantities Matrix */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                Size Breakdown Matrix (Pieces)
              </span>
              <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-xs font-semibold text-white tabular-nums">
                Total Order Qty: {totalQty.toLocaleString()} pcs
              </span>
            </div>

            <div className="mt-2.5 grid grid-cols-4 gap-3">
              {(['S', 'M', 'L', 'XL'] as const).map((sz) => (
                <div key={sz}>
                  <label className="block font-mono text-[11px] font-medium text-slate-500">
                    Size {sz}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={sizes[sz]}
                    onChange={(e) =>
                      setSizes((prev) => ({
                        ...prev,
                        [sz]: Math.max(0, parseInt(e.target.value || '0', 10)),
                      }))
                    }
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 tabular-nums focus:border-slate-900 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Row 4: TNA Template Selector & Live Milestone Preview */}
          <div className="space-y-3">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Layers className="h-3.5 w-3.5 text-slate-500" />
              Select TNA Production Route Template
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setTemplateType('SOLID_BASIC')}
                className={`flex flex-col items-start rounded-lg border p-3 text-left transition ${
                  templateType === 'SOLID_BASIC'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-xs font-semibold">
                    Solid / Dyed Knitwear (4 Stages)
                  </span>
                  {templateType === 'SOLID_BASIC' && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  )}
                </div>
                <span
                  className={`mt-1 font-mono text-[11px] ${
                    templateType === 'SOLID_BASIC'
                      ? 'text-slate-300'
                      : 'text-slate-500'
                  }`}
                >
                  CUTTING → STITCHING → WASHING → FINISHING
                </span>
              </button>

              <button
                type="button"
                onClick={() => setTemplateType('PRINTED_TEE')}
                className={`flex flex-col items-start rounded-lg border p-3 text-left transition ${
                  templateType === 'PRINTED_TEE'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-xs font-semibold">
                    Printed Garment Route (5 Stages)
                  </span>
                  {templateType === 'PRINTED_TEE' && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  )}
                </div>
                <span
                  className={`mt-1 font-mono text-[11px] ${
                    templateType === 'PRINTED_TEE'
                      ? 'text-slate-300'
                      : 'text-slate-500'
                  }`}
                >
                  CUTTING → PRINTING → STITCHING → WASHING → FINISHING
                </span>
              </button>
            </div>

            {/* Live Backward Schedule Preview */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between text-[11px] font-medium text-slate-500">
                <span>Auto-Calculated TNA Milestones (Backward from Ship Date)</span>
                <span className="font-mono">
                  Target: {totalQty.toLocaleString()} pcs/stage
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {previewMilestones.map((m) => (
                  <div
                    key={m.stage}
                    className="rounded border border-slate-200 bg-white p-2"
                  >
                    <div className="font-mono text-[10px] font-semibold text-slate-800">
                      {m.seq}. {m.stage}
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-slate-500 tabular-nums">
                      End: {m.plannedEnd}
                    </div>
                    <div className="font-mono text-[10px] text-slate-400">
                      ({m.daysAllocated}d window)
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Creating Order &amp; TNA...
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  Create Order &amp; Generate TNA
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
