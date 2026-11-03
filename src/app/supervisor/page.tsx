'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  CloudOff,
  Loader2,
  Mic,
  MicOff,
  RefreshCw,
  Trash2,
  Wifi,
} from 'lucide-react';

const OFFLINE_QUEUE_STORAGE_KEY = 'tiruppur_offline_floor_queue';

const STAGE_TAMIL_LABELS: Record<string, string> = {
  CUTTING: 'கட்டிங் (Cutting)',
  PRINTING: 'பிரிண்டிங் (Printing)',
  STITCHING: 'தையல் (Stitching)',
  WASHING: 'வாஷிங் (Washing)',
  FINISHING: 'பினிஷிங் (Finishing)',
};

const SAMPLE_TAMIL_CHIPS = [
  {
    id: 'machine',
    badgeEn: 'Machine Breakdown (High Conf)',
    badgeTa: 'இயந்திரப் பழுது (ஊசி உடைந்தது)',
    tamilText:
      'ஊசி தட்டு உடைந்துவிட்டது, 2 தையல் இயந்திரங்கள் இன்று 3 மணி நேரம் வேலை செய்யவில்லை',
  },
  {
    id: 'rework',
    badgeEn: 'Collar Stain Rework (High Conf)',
    badgeTa: 'காலர் எண்ணெய் கறை (ரீ-வாஷிங்)',
    tamilText:
      'காலர் பகுதியில் எண்ணெய் கறை உள்ளது, 120 பீஸ் மறுபடியும் வாஷிங் செய்ய வேண்டும்',
  },
  {
    id: 'power',
    badgeEn: 'Power Cut (High Conf)',
    badgeTa: 'மின்சாரம் தடை (ஜெனரேட்டர் பழுது)',
    tamilText:
      'மின்சாரம் தடைபட்டது, ஜெனரேட்டர் பழுது காரணமாக 2 மணி நேரம் தாமதம்',
  },
  {
    id: 'vague',
    badgeEn: 'Vague Note (<70% Conf Guardrail)',
    badgeTa: 'தெளிவற்ற குறிப்பு (AI சந்தேக சோதனை)',
    tamilText: 'இன்று வேலை சற்று மெதுவாக நடக்கிறது',
  },
];

const SAMPLE_PHOTO_PRESETS = [
  {
    id: 'bundle-tag',
    labelEn: 'Bundle Tag #B88213',
    labelTa: 'பண்டில் டேக் #B88213',
    dataUrl:
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="160" viewBox="0 0 320 160">
          <rect width="320" height="160" fill="#09090b"/>
          <rect x="12" y="12" width="296" height="136" rx="6" fill="#18181b" stroke="#3f3f46" stroke-width="1"/>
          <text x="28" y="46" fill="#fafafa" font-family="monospace" font-size="13" font-weight="bold">TIRUPPUR UNIT 1 · FLOOR TAG</text>
          <text x="28" y="74" fill="#a1a1aa" font-family="monospace" font-size="12">PO: B-PO-88213 · STITCHING</text>
          <text x="28" y="102" fill="#e4e4e7" font-family="monospace" font-size="12">LINE 04 · BUNDLE #19 · 240 PCS</text>
        </svg>`
      ),
  },
  {
    id: 'collar-stain',
    labelEn: 'QC Collar Rework Tag',
    labelTa: 'காலர் கறை ஆய்வு படம்',
    dataUrl:
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="160" viewBox="0 0 320 160">
          <rect width="320" height="160" fill="#18181b"/>
          <rect x="12" y="12" width="296" height="136" rx="6" fill="#27272a" stroke="#71717a" stroke-width="1"/>
          <text x="28" y="46" fill="#fafafa" font-family="monospace" font-size="13" font-weight="bold">UNIT 2 QC · REWORK HOLD</text>
          <text x="28" y="74" fill="#d4d4d8" font-family="monospace" font-size="12">PO: B-PO-88240 · WHITE POLO</text>
          <text x="28" y="102" fill="#fca5a5" font-family="monospace" font-size="12">ISSUE: COLLAR OIL STAIN (RE-WASH)</text>
        </svg>`
      ),
  },
];

interface QueuedFloorSubmission {
  clientSubmissionId: string;
  orderId: string;
  poNumber: string;
  milestoneId: string;
  stageName: string;
  qtyDoneToday: number;
  photoUrl: string | null;
  rawNoteTamil: string | null;
  workDate: string;
  queuedAt: string;
}

interface OrderOption {
  id: string;
  poNumber: string;
  styleName: string;
  colour: string;
  productionUnit: string;
  currentStage: string;
  activeMilestone: {
    id: string;
    stageName: string;
    targetQty: number;
    completedQty: number;
  } | null;
  dailyUpdates: {
    id: string;
    workDate: string;
    qtyDoneToday: number;
    rawNoteTamil: string | null;
    aiEnglishTranslation: string | null;
    aiReasonCategory: string | null;
    finalReasonCategory: string | null;
    aiConfidence: number | null;
    isMerchandiserConfirmed: boolean;
    needsManualReview: boolean;
  }[];
}

export default function SupervisorMobilePage() {
  const [lang, setLang] = useState<'ta' | 'en'>('ta');
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 3-Part Minimal Form State
  const [qtyDoneToday, setQtyDoneToday] = useState<string>('240');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [rawNoteTamil, setRawNoteTamil] = useState<string>('');
  const [showPresets, setShowPresets] = useState(false);
  const [isListeningVoice, setIsListeningVoice] = useState(false);

  // Offline & Sync Queue State
  const [isSimulatedOffline, setIsSimulatedOffline] = useState(false);
  const [browserOffline, setBrowserOffline] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState<QueuedFloorSubmission[]>([]);
  const [syncingQueue, setSyncingQueue] = useState(false);

  // Submission Feedback State
  const [submitting, setSubmitting] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'offline' | 'error';
    title: string;
    detail?: string;
    aiTranslation?: string | null;
    aiCategory?: string | null;
    aiConfidence?: number | null;
    needsManualReview?: boolean;
  } | null>(null);

  const isOffline = isSimulatedOffline || browserOffline;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setOfflineQueue(parsed);
        }
      }
    } catch {
      // Ignore storage parse issues
    }

    setBrowserOffline(!navigator.onLine);
    const onOnline = () => setBrowserOffline(false);
    const onOffline = () => setBrowserOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const saveOfflineQueue = (nextQueue: QueuedFloorSubmission[]) => {
    setOfflineQueue(nextQueue);
    try {
      localStorage.setItem(
        OFFLINE_QUEUE_STORAGE_KEY,
        JSON.stringify(nextQueue)
      );
    } catch {
      // Ignore storage quota issues
    }
  };

  // Stable fetchOrders with zero state dependencies so it never loops!
  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true);
    setLoadError(null);
    try {
      const [ordersRes, meRes] = await Promise.all([
        fetch('/api/orders', { cache: 'no-store' }),
        fetch('/api/auth/me', { cache: 'no-store' }),
      ]);

      if (!ordersRes.ok) {
        throw new Error('Unable to load active floor orders.');
      }

      const ordersData = await ordersRes.json();
      const rawList: OrderOption[] = Array.isArray(ordersData)
        ? ordersData
        : Array.isArray(ordersData.orders)
        ? ordersData.orders
        : [];

      let assignedUnit: string | null = null;
      if (meRes.ok) {
        const meData = await meRes.json();
        assignedUnit = meData?.user?.assignedUnit ?? null;
        if (meData?.user?.preferredLang === 'en' || meData?.user?.preferredLang === 'ta') {
          setLang(meData.user.preferredLang);
        }
      }

      // Sort supervisor's assigned unit orders to the top of the list
      const sortedList = [...rawList].sort((a, b) => {
        if (!assignedUnit) return 0;
        const aMatch = a.productionUnit === assignedUnit ? -1 : 0;
        const bMatch = b.productionUnit === assignedUnit ? -1 : 0;
        return aMatch - bMatch;
      });

      setOrders(sortedList);
      setSelectedOrderId((prev) => {
        if (prev && sortedList.some((o) => o.id === prev)) {
          return prev;
        }
        return sortedList[0]?.id || '';
      });
    } catch (err: unknown) {
      setLoadError(
        err instanceof Error ? err.message : 'Failed to load orders.'
      );
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) || orders[0] || null,
    [orders, selectedOrderId]
  );

  const syncOfflineQueueNow = useCallback(async () => {
    if (isOffline || offlineQueue.length === 0 || syncingQueue) return;

    setSyncingQueue(true);
    const remaining: QueuedFloorSubmission[] = [];
    let syncedCount = 0;

    for (const item of offlineQueue) {
      try {
        const res = await fetch('/api/updates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientSubmissionId: item.clientSubmissionId,
            orderId: item.orderId,
            milestoneId: item.milestoneId,
            qtyDoneToday: item.qtyDoneToday,
            photoUrl: item.photoUrl,
            rawNoteTamil: item.rawNoteTamil,
            workDate: item.workDate,
          }),
        });

        if (res.ok) {
          syncedCount += 1;
        } else {
          remaining.push(item);
        }
      } catch {
        remaining.push(item);
      }
    }

    saveOfflineQueue(remaining);
    setSyncingQueue(false);

    if (syncedCount > 0) {
      setFeedbackBanner({
        type: 'success',
        title:
          lang === 'ta'
            ? `${syncedCount} ஆஃப்லைன் பதிவுகள் ஒத்திசைக்கப்பட்டன`
            : `Synced ${syncedCount} offline update(s)`,
        detail:
          lang === 'ta'
            ? 'Idempotent clientSubmissionId சரிபார்க்கப்பட்டது.'
            : 'Idempotency verified via unique clientSubmissionId.',
      });
      fetchOrders();
    }
  }, [isOffline, offlineQueue, syncingQueue, lang, fetchOrders]);

  useEffect(() => {
    if (!isOffline && offlineQueue.length > 0) {
      syncOfflineQueueNow();
    }
  }, [isOffline, offlineQueue.length, syncOfflineQueueNow]);

  const handleToggleTamilVoice = () => {
    const SpeechRecognitionAPI =
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setRawNoteTamil((prev) =>
        prev
          ? `${prev} ஊசி தட்டு உடைந்துவிட்டது, 2 தையல் இயந்திரங்கள் நின்றன`
          : 'ஊசி தட்டு உடைந்துவிட்டது, 2 தையல் இயந்திரங்கள் 4 மணி நேரம் நின்றன'
      );
      return;
    }

    if (isListeningVoice) {
      setIsListeningVoice(false);
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recognition = new (SpeechRecognitionAPI as any)();
      recognition.lang = 'ta-IN';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      setIsListeningVoice(true);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const transcript = event?.results?.[0]?.[0]?.transcript;
        if (transcript) {
          setRawNoteTamil((prev) =>
            prev ? `${prev} ${transcript}` : transcript
          );
        }
        setIsListeningVoice(false);
      };

      recognition.onerror = () => setIsListeningVoice(false);
      recognition.onend = () => setIsListeningVoice(false);
      recognition.start();
    } catch {
      setIsListeningVoice(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !selectedOrder.activeMilestone) return;

    const parsedQty = parseInt(qtyDoneToday, 10);
    if (Number.isNaN(parsedQty) || parsedQty < 0) {
      setFeedbackBanner({
        type: 'error',
        title:
          lang === 'ta'
            ? 'சரியான எண்ணிக்கையை உள்ளிடவும்'
            : 'Please enter a valid quantity.',
      });
      return;
    }

    const clientSubmissionId = `floor-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const payload: QueuedFloorSubmission = {
      clientSubmissionId,
      orderId: selectedOrder.id,
      poNumber: selectedOrder.poNumber,
      milestoneId: selectedOrder.activeMilestone.id,
      stageName: selectedOrder.activeMilestone.stageName,
      qtyDoneToday: parsedQty,
      photoUrl,
      rawNoteTamil: rawNoteTamil.trim() || null,
      workDate: '2026-11-02',
      queuedAt: new Date().toISOString(),
    };

    if (isOffline) {
      const updatedQueue = [...offlineQueue, payload];
      saveOfflineQueue(updatedQueue);
      setRawNoteTamil('');
      setFeedbackBanner({
        type: 'offline',
        title:
          lang === 'ta'
            ? 'ஆஃப்லைனில் சேமிக்கப்பட்டது (Saved to Offline Queue)'
            : 'Saved to Phone Offline Queue',
        detail: `${selectedOrder.poNumber}: +${parsedQty} pcs queued locally.`,
      });
      return;
    }

    setSubmitting(true);
    setFeedbackBanner(null);

    try {
      const res = await fetch('/api/updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedbackBanner({
          type: 'error',
          title: data.error || 'Failed to submit update.',
        });
        return;
      }

      const created = data.update;
      setRawNoteTamil('');
      setFeedbackBanner({
        type: 'success',
        title:
          lang === 'ta'
            ? `பதிவு செய்யப்பட்டது (+${parsedQty} பீஸ்)`
            : `Logged +${parsedQty.toLocaleString()} pcs`,
        detail: `${selectedOrder.poNumber} · ${selectedOrder.activeMilestone.stageName}`,
        aiTranslation: created.aiEnglishTranslation,
        aiCategory: created.finalReasonCategory || created.aiReasonCategory,
        aiConfidence: created.aiConfidence,
        needsManualReview: created.needsManualReview,
      });

      await fetchOrders();
    } catch {
      const updatedQueue = [...offlineQueue, payload];
      saveOfflineQueue(updatedQueue);
      setFeedbackBanner({
        type: 'offline',
        title: 'Saved to phone offline queue',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md py-2">
      {/* Main Minimal Card */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        {/* 1. Compact Header Bar: Title + Language + Offline Pill */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h1 className="text-sm font-semibold text-zinc-950">
              {lang === 'ta' ? 'தரைத்தள தினசரி பதிவு' : 'Floor Daily Entry'}
            </h1>
            <p className="font-mono text-[11px] text-zinc-400">02 Nov 2026</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Offline Simulator Pill */}
            <button
              type="button"
              onClick={() => setIsSimulatedOffline((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] font-medium transition ${
                isOffline
                  ? 'border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]'
                  : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-950'
              }`}
            >
              {isOffline ? (
                <>
                  <CloudOff className="h-3 w-3" />
                  Offline
                </>
              ) : (
                <>
                  <Wifi className="h-3 w-3 text-[#10B981]" />
                  Online
                </>
              )}
            </button>

            {/* Tamil / EN Toggle */}
            <button
              type="button"
              onClick={() => setLang((prev) => (prev === 'ta' ? 'en' : 'ta'))}
              className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 font-mono text-xs font-medium text-zinc-950 hover:bg-zinc-50"
            >
              {lang === 'ta' ? 'EN' : 'தமிழ்'}
            </button>
          </div>
        </div>

        {/* Offline Queue Strip (Only visible when items queued) */}
        {offlineQueue.length > 0 && (
          <div className="flex items-center justify-between border-b border-[#FDE68A] bg-[#FFFBEB] px-6 py-3 text-xs text-[#B45309]">
            <div>
              <span className="font-semibold">
                {offlineQueue.length} queued offline
              </span>
              <span className="ml-2 font-mono text-[11px]">
                ({offlineQueue.map((q) => `+${q.qtyDoneToday}`).join(', ')})
              </span>
            </div>
            <button
              type="button"
              disabled={isOffline || syncingQueue}
              onClick={syncOfflineQueueNow}
              className="inline-flex items-center gap-1 rounded bg-zinc-950 px-2.5 py-1 font-mono text-[11px] font-medium text-white disabled:opacity-40"
            >
              <RefreshCw
                className={`h-3 w-3 ${syncingQueue ? 'animate-spin' : ''}`}
              />
              Sync
            </button>
          </div>
        )}

        {/* Submission Feedback Banner */}
        {feedbackBanner && (
          <div
            className={`border-b px-6 py-3 text-xs ${
              feedbackBanner.type === 'success'
                ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]'
                : feedbackBanner.type === 'offline'
                ? 'border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]'
                : 'border-[#FECDD3] bg-[#FFF1F2] text-[#BE123C]'
            }`}
          >
            <div className="font-semibold">{feedbackBanner.title}</div>
            {feedbackBanner.aiTranslation && (
              <div className="mt-1.5 font-mono text-[11px] text-zinc-800">
                AI ({feedbackBanner.aiCategory}): “{feedbackBanner.aiTranslation}”
              </div>
            )}
          </div>
        )}

        {/* Main Form: Order Select -> Big Number -> Photo -> Note -> Send */}
        <form onSubmit={handleSubmitUpdate} className="space-y-6 p-6">
          {/* Order Selector */}
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                {lang === 'ta' ? 'ஆர்டர் (Order & Stage)' : 'Order & Stage'}
              </label>
              {selectedOrder && (
                <span className="font-mono text-[11px] text-zinc-500">
                  {selectedOrder.productionUnit}
                </span>
              )}
            </div>

            {loadingOrders ? (
              <div className="mt-1.5 flex h-11 items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>
                  {lang === 'ta'
                    ? 'ஆர்டர்கள் ஏற்றப்படுகின்றன...'
                    : 'Loading active orders...'}
                </span>
              </div>
            ) : loadError ? (
              <div className="mt-1.5 flex items-center justify-between rounded-lg border border-[#FECDD3] bg-[#FFF1F2] px-3 py-2 text-xs text-[#BE123C]">
                <span>{loadError}</span>
                <button
                  type="button"
                  onClick={fetchOrders}
                  className="font-mono underline"
                >
                  Retry
                </button>
              </div>
            ) : (
              <select
                value={selectedOrderId}
                onChange={(e) => setSelectedOrderId(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 font-mono text-xs font-medium text-zinc-950 focus:border-zinc-950 focus:outline-none"
              >
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.poNumber} ·{' '}
                    {lang === 'ta'
                      ? STAGE_TAMIL_LABELS[o.currentStage] || o.currentStage
                      : o.currentStage}{' '}
                    ({o.activeMilestone?.completedQty.toLocaleString()}/
                    {o.activeMilestone?.targetQty.toLocaleString()} pcs)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 1. Big Numeric Display Input */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                {lang === 'ta'
                  ? 'இன்று முடித்த எண்ணிக்கை (Pieces Today)'
                  : 'Pieces Completed Today'}
              </label>
              <span className="font-mono text-[11px] text-zinc-400">PCS</span>
            </div>

            <input
              type="number"
              inputMode="numeric"
              min={0}
              required
              value={qtyDoneToday}
              onChange={(e) => setQtyDoneToday(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-zinc-50/50 py-4 text-center font-mono text-4xl font-semibold text-zinc-950 tabular-nums focus:border-zinc-950 focus:bg-white focus:outline-none"
            />

            <div className="mt-2.5 grid grid-cols-4 gap-2">
              {[50, 100, 250].map((inc) => (
                <button
                  key={inc}
                  type="button"
                  onClick={() =>
                    setQtyDoneToday((prev) =>
                      String((parseInt(prev || '0', 10) || 0) + inc)
                    )
                  }
                  className="rounded-md border border-zinc-200 bg-white py-1.5 font-mono text-xs font-medium text-zinc-700 hover:border-zinc-950 hover:text-zinc-950"
                >
                  +{inc}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setQtyDoneToday('0')}
                className="rounded-md border border-zinc-200 bg-zinc-100/70 py-1.5 font-mono text-xs font-medium text-zinc-500 hover:text-zinc-950"
              >
                Clear
              </button>
            </div>
          </div>

          {/* 2. Single Clean Photo Row */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                {lang === 'ta' ? 'புகைப்படம் (Photo)' : 'Photo (Optional)'}
              </label>
              {photoUrl && (
                <button
                  type="button"
                  onClick={() => setPhotoUrl(null)}
                  className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-950"
                >
                  <Trash2 className="h-3 w-3" />
                  Remove
                </button>
              )}
            </div>

            {photoUrl ? (
              <div className="mt-1.5 overflow-hidden rounded-lg border border-zinc-200">
                <img
                  src={photoUrl}
                  alt="Attached floor bundle"
                  className="h-24 w-full object-cover"
                />
              </div>
            ) : (
              <div className="mt-1.5 flex items-center gap-2">
                <label className="flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 hover:border-zinc-950 hover:text-zinc-950">
                  <Camera className="h-3.5 w-3.5 text-zinc-400" />
                  <span>{lang === 'ta' ? 'படம் எடு' : 'Camera / Upload'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                {SAMPLE_PHOTO_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPhotoUrl(p.dataUrl)}
                    className="h-10 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 font-mono text-[11px] text-zinc-600 hover:border-zinc-950 hover:text-zinc-950"
                  >
                    {lang === 'ta' ? p.labelTa : p.labelEn}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 3. Clean Issue Note Field + Collapsible Tamil Test Presets */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                {lang === 'ta'
                  ? 'குறிப்பு - தமிழ் (Optional Note)'
                  : 'Tamil Floor Note (Optional)'}
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPresets((prev) => !prev)}
                  className="inline-flex items-center gap-1 font-mono text-[11px] text-zinc-500 hover:text-zinc-950"
                >
                  <span>{lang === 'ta' ? 'மாதிரி' : 'Presets'}</span>
                  {showPresets ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleToggleTamilVoice}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium transition ${
                    isListeningVoice
                      ? 'border-[#FECDD3] bg-[#FFF1F2] text-[#BE123C]'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-950'
                  }`}
                >
                  {isListeningVoice ? (
                    <>
                      <MicOff className="h-3 w-3" />
                      Listening
                    </>
                  ) : (
                    <>
                      <Mic className="h-3 w-3" />
                      Voice (ta)
                    </>
                  )}
                </button>
              </div>
            </div>

            <textarea
              rows={2}
              value={rawNoteTamil}
              onChange={(e) => setRawNoteTamil(e.target.value)}
              placeholder={
                lang === 'ta'
                  ? 'எ.கா: ஊசி தட்டு உடைந்துவிட்டது...'
                  : 'Optional blocker note in Tamil...'
              }
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-none"
            />

            {showPresets && (
              <div className="mt-2 divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50/70">
                {SAMPLE_TAMIL_CHIPS.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => {
                      setRawNoteTamil(chip.tamilText);
                      setShowPresets(false);
                    }}
                    className="block w-full px-3 py-2 text-left text-xs transition hover:bg-white"
                  >
                    <div className="font-medium text-zinc-900">
                      {lang === 'ta' ? chip.badgeTa : chip.badgeEn}
                    </div>
                    <div className="truncate text-[11px] text-zinc-500">
                      {chip.tamilText}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 4. Full-Width Solid Black Send Button */}
          <button
            type="submit"
            disabled={submitting || !selectedOrder}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-zinc-950 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isOffline ? (
              lang === 'ta' ? (
                'ஆஃப்லைனில் சேமி (Save Offline)'
              ) : (
                'Save to Offline Queue'
              )
            ) : lang === 'ta' ? (
              'அனுப்பு (Send Update)'
            ) : (
              'Send Floor Update'
            )}
          </button>
        </form>

        {/* Minimal Recent Floor Logs Footer */}
        {selectedOrder && (
          <div className="border-t border-zinc-200 bg-zinc-50/60 px-6 py-4">
            <div className="flex items-center justify-between font-mono text-[11px] text-zinc-500">
              <span>
                {lang === 'ta'
                  ? `${selectedOrder.poNumber} சமீபத்திய பதிவுகள்`
                  : `Recent Logs · ${selectedOrder.poNumber}`}
              </span>
              <span>{selectedOrder.dailyUpdates.length} total</span>
            </div>

            <div className="mt-2 space-y-1.5">
              {selectedOrder.dailyUpdates.slice(0, 3).map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between font-mono text-xs text-zinc-700 tabular-nums"
                >
                  <span>+{u.qtyDoneToday.toLocaleString()} pcs</span>
                  <span className="text-[11px] text-zinc-400">
                    {new Date(u.workDate).toISOString().slice(0, 10)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
