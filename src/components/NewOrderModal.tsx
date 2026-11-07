'use client';

import React, { useMemo, useState } from 'react';
import { X, Plus, Loader2 } from 'lucide-react';

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
  const [styleName, setStyleName] = useState(
    "Men's Raglan Sweatshirt, Heather Grey"
  );
  const [colour, setColour] = useState('Heather Grey');
  const [productionUnit, setProductionUnit] = useState('Unit 1');
  const [exFactoryDate, setExFactoryDate] = useState('2026-11-30');
  const [templateType, setTemplateType] = useState<
    'SOLID_BASIC' | 'PRINTED_TEE'
  >('SOLID_BASIC');

  const [sizes, setSizes] = useState<{
    S: number;
    M: number;
    L: number;
    XL: number;
  }>({
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
      plannedEnd: formatShortDate(baseMs + o.end * MS_PER_DAY),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4 backdrop-blur-xs">
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-lg border border-zinc-200 bg-white">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-zinc-950">
              New Production Order
            </h2>
            <p className="text-xs text-zinc-500">
              Backward-schedules TNA milestones from Ex-Factory ship date.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-950"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          {error && (
            <div className="rounded-md border border-[#FECDD3] bg-[#FFF1F2] p-3 text-xs text-[#BE123C]">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700">
                PO Number
              </label>
              <input
                type="text"
                required
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-zinc-200 px-3 py-2 font-mono text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700">
                Buyer
              </label>
              <select
                required
                value={buyerId}
                onChange={(e) => setBuyerId(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
              >
                {buyers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name.replace(/\s*\(([^)]+)\)/g, ' · $1')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700">
                Production Unit
              </label>
              <select
                value={productionUnit}
                onChange={(e) => setProductionUnit(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
              >
                <option value="Unit 1">Unit 1</option>
                <option value="Unit 2">Unit 2</option>
                <option value="Subcontract - Printing">
                  Subcontract - Printing
                </option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-zinc-700">
                Style Name
              </label>
              <input
                type="text"
                required
                value={styleName}
                onChange={(e) => setStyleName(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-zinc-200 px-3 py-2 text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700">
                Colour
              </label>
              <input
                type="text"
                required
                value={colour}
                onChange={(e) => setColour(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-zinc-200 px-3 py-2 text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700">
                Ex-Factory Date
              </label>
              <input
                type="date"
                required
                value={exFactoryDate}
                onChange={(e) => setExFactoryDate(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-zinc-200 px-3 py-2 font-mono text-xs text-zinc-950 focus:border-zinc-950 focus:outline-none"
              />
            </div>
          </div>

          {/* Size Breakdown */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-700">
                Size Breakdown · Pieces
              </span>
              <span className="font-mono text-xs font-semibold text-zinc-950 tabular-nums">
                Total: {totalQty.toLocaleString()} pcs
              </span>
            </div>

            <div className="mt-2 grid grid-cols-4 gap-3">
              {(['S', 'M', 'L', 'XL'] as const).map((sz) => (
                <div key={sz}>
                  <label className="block font-mono text-[11px] text-zinc-400">
                    {sz}
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
                    className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 font-mono text-xs text-zinc-950 tabular-nums focus:border-zinc-950 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* TNA Route Template */}
          <div>
            <label className="block text-xs font-medium text-zinc-700">
              TNA Route Template
            </label>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTemplateType('SOLID_BASIC')}
                className={`rounded-md border p-3 text-left text-xs transition ${
                  templateType === 'SOLID_BASIC'
                    ? 'border-zinc-950 bg-zinc-950 text-white'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                <div className="font-semibold">Solid / Dyed · 4 Stages</div>
                <div
                  className={`mt-0.5 font-mono text-[10px] ${
                    templateType === 'SOLID_BASIC'
                      ? 'text-zinc-300'
                      : 'text-zinc-400'
                  }`}
                >
                  CUT → STITCH → WASH → FINISH
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTemplateType('PRINTED_TEE')}
                className={`rounded-md border p-3 text-left text-xs transition ${
                  templateType === 'PRINTED_TEE'
                    ? 'border-zinc-950 bg-zinc-950 text-white'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                <div className="font-semibold">Printed Tee · 5 Stages</div>
                <div
                  className={`mt-0.5 font-mono text-[10px] ${
                    templateType === 'PRINTED_TEE'
                      ? 'text-zinc-300'
                      : 'text-zinc-400'
                  }`}
                >
                  CUT → PRINT → STITCH → WASH → FINISH
                </div>
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md bg-zinc-100/80 px-3 py-2 font-mono text-[11px] text-zinc-600 tabular-nums">
              {previewMilestones.map((m, idx) => (
                <React.Fragment key={m.stage}>
                  <span>
                    {m.stage} · {m.plannedEnd}
                  </span>
                  {idx < previewMilestones.length - 1 && (
                    <span className="text-zinc-300">→</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-zinc-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-md bg-zinc-950 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Create Order
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
