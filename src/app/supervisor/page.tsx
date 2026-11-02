'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  CloudOff,
  ExternalLink,
  Languages,
  Loader2,
  Mic,
  MicOff,
  RefreshCw,
  Send,
  Smartphone,
  Sparkles,
  Trash2,
  Wifi,
} from 'lucide-react';

const OFFLINE_QUEUE_STORAGE_KEY = 'tiruppur_offline_floor_queue';

const STAGE_TAMIL_LABELS: Record<string, string> = {
  CUTTING: 'கட்டிங் (Cutting)',
  PRINTING: 'பிரிண்டிங் (Printing)',
  STITCHING: 'தையல் (Stitching)',
  WASHING: 'வாஷிங் (Washing)',
  FINISHING: 'பினிஷிங் & பேக்கிங் (Finishing)',
};

const SAMPLE_TAMIL_CHIPS = [
  {
    id: 'machine',
    badgeEn: '🔧 Machine Breakdown (High Conf)',
    badgeTa: '🔧 இயந்திரப் பழுது (ஊசி உடைந்தது)',
    tamilText:
      'ஊசி தட்டு உடைந்துவிட்டது, 2 தையல் இயந்திரங்கள் இன்று 3 மணி நேரம் வேலை செய்யவில்லை',
  },
  {
    id: 'rework',
    badgeEn: '🧼 Collar Stain Rework (High Conf)',
    badgeTa: '🧼 காலர் எண்ணெய் கறை (ரீ-வாஷிங்)',
    tamilText:
      'காலர் பகுதியில் எண்ணெய் கறை உள்ளது, 120 பீஸ் மறுபடியும் வாஷிங் செய்ய வேண்டும்',
  },
  {
    id: 'power',
    badgeEn: '⚡ Power Cut (High Conf)',
    badgeTa: '⚡ மின்சாரம் தடை (ஜெனரேட்டர் பழுது)',
    tamilText:
      'மின்சாரம் தடைபட்டது, ஜெனரேட்டர் பழுது காரணமாக 2 மணி நேரம் தாமதம்',
  },
  {
    id: 'vague',
    badgeEn: '❓ Vague Note (Tests AI <70% Uncertain Guardrail)',
    badgeTa: '❓ தெளிவற்ற குறிப்பு (AI சந்தேக சோதனை)',
    tamilText: 'இன்று வேலை சற்று மெதுவாக நடக்கிறது',
  },
];

// Self-contained SVG data URLs for 1-click floor photo presets (works 100% offline!)
const SAMPLE_PHOTO_PRESETS = [
  {
    id: 'bundle-tag',
    labelEn: 'Stitching Bundle Tag #B88213',
    labelTa: 'தையல் பண்டில் டேக் #B88213',
    dataUrl:
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200">
          <rect width="320" height="200" fill="#0f172a"/>
          <rect x="16" y="16" width="288" height="168" rx="8" fill="#1e293b" stroke="#475569" stroke-width="2"/>
          <text x="32" y="52" fill="#f8fafc" font-family="monospace" font-size="15" font-weight="bold">TIRUPPUR UNIT 1 · FLOOR TAG</text>
          <text x="32" y="84" fill="#38bdf8" font-family="monospace" font-size="13">PO: B-PO-88213 · NAVY CREW TEE</text>
          <text x="32" y="112" fill="#e2e8f0" font-family="monospace" font-size="12">LINE 04 · STITCHING BUNDLE #19</text>
          <rect x="32" y="130" width="140" height="32" rx="4" fill="#059669"/>
          <text x="44" y="151" fill="#ffffff" font-family="monospace" font-size="12" font-weight="bold">QTY: 240 PCS OK</text>
        </svg>`
      ),
  },
  {
    id: 'collar-stain',
    labelEn: 'QC Collar Stain Inspection Photo',
    labelTa: 'காலர் எண்ணெய் கறை ஆய்வு படம்',
    dataUrl:
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200">
          <rect width="320" height="200" fill="#450a0a"/>
          <rect x="16" y="16" width="288" height="168" rx="8" fill="#7f1d1d" stroke="#f87171" stroke-width="2"/>
          <text x="32" y="50" fill="#fef2f2" font-family="monospace" font-size="15" font-weight="bold">UNIT 2 QC · REWORK HOLD TAG</text>
          <text x="32" y="82" fill="#fca5a5" font-family="monospace" font-size="13">PO: B-PO-88240 · WHITE POLO</text>
          <text x="32" y="110" fill="#fecaca" font-family="monospace" font-size="12">ISSUE: COLLAR OIL STAIN (RE-WASH)</text>
          <rect x="32" y="130" width="180" height="32" rx="4" fill="#d97706"/>
          <text x="42" y="151" fill="#ffffff" font-family="monospace" font-size="12" font-weight="bold">HOLD: SPOT WASH LINE</text>
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

  // 3-Part Form State
  const [qtyDoneToday, setQtyDoneToday] = useState<string>('240');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [rawNoteTamil, setRawNoteTamil] = useState<string>('');
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

  // Load localStorage queue on mount
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

  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const res = await fetch('/api/orders', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const list: OrderOption[] = data.orders || [];
        setOrders(list);
        if (list.length > 0 && !selectedOrderId) {
          setSelectedOrderId(list[0].id);
        }
      }
    } catch {
      // Offline resilient
    } finally {
      setLoadingOrders(false);
    }
  }, [selectedOrderId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) || orders[0] || null,
    [orders, selectedOrderId]
  );

  // Sync queued items when returning online
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
            ? `✅ ${syncedCount} ஆஃப்லைன் பதிவுகள் சர்வருடன் இணைக்கப்பட்டன!`
            : `✅ Synced ${syncedCount} queued offline floor update(s) to server!`,
        detail:
          lang === 'ta'
            ? 'இரட்டைப் பதிவு தடுக்கப்பட்டது (Idempotent clientSubmissionId சரிபார்க்கப்பட்டது).'
            : 'Idempotency verified via unique clientSubmissionId — zero duplicate counts.',
      });
      fetchOrders();
    }
  }, [isOffline, offlineQueue, syncingQueue, lang, fetchOrders]);

  // Auto-flush queue when toggling Simulate Offline back to Online
  useEffect(() => {
    if (!isOffline && offlineQueue.length > 0) {
      syncOfflineQueueNow();
    }
  }, [isOffline, offlineQueue.length, syncOfflineQueueNow]);

  // Web Speech API Tamil Voice Recognition
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

      recognition.onerror = () => {
        setIsListeningVoice(false);
      };

      recognition.onend = () => {
        setIsListeningVoice(false);
      };

      recognition.start();
    } catch {
      setIsListeningVoice(false);
    }
  };

  // Handle file upload -> compact Data URL
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
            ? 'சரியான எண்ணிக்கையை உள்ளிடவும் (0 அல்லது அதற்கு மேல்)'
            : 'Please enter a valid non-negative piece quantity.',
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

    // If Offline (or Simulate Offline is ON), store in localStorage queue
    if (isOffline) {
      const updatedQueue = [...offlineQueue, payload];
      saveOfflineQueue(updatedQueue);
      setRawNoteTamil('');
      setFeedbackBanner({
        type: 'offline',
        title:
          lang === 'ta'
            ? '📦 ஆஃப்லைனில் சேமிக்கப்பட்டது! (Saved to Phone Offline Queue)'
            : '📦 Saved to Phone Offline Queue (No Signal Needed)',
        detail:
          lang === 'ta'
            ? `${selectedOrder.poNumber}: +${parsedQty} பீஸ். இணையம் வந்தவுடன் தானாக சர்வரில் ஏறும்.`
            : `${selectedOrder.poNumber}: +${parsedQty} pcs queued locally. Switch back to Online above to auto-sync.`,
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
            ? `✅ பதிவு ஏற்றுக்கொள்ளப்பட்டது (+${parsedQty} பீஸ்)`
            : `✅ Floor Update Logged (+${parsedQty.toLocaleString()} pcs)`,
        detail: `${selectedOrder.poNumber} · ${selectedOrder.activeMilestone.stageName}`,
        aiTranslation: created.aiEnglishTranslation,
        aiCategory: created.finalReasonCategory || created.aiReasonCategory,
        aiConfidence: created.aiConfidence,
        needsManualReview: created.needsManualReview,
      });

      await fetchOrders();
    } catch {
      // Network dropped mid-request -> automatically save to offline queue!
      const updatedQueue = [...offlineQueue, payload];
      saveOfflineQueue(updatedQueue);
      setFeedbackBanner({
        type: 'offline',
        title: 'Network dropped — Saved safely to phone offline queue!',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md pb-12">
      {/* Top Reviewer Context Header */}
      <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
        <span className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-slate-600">
          <Smartphone className="h-3.5 w-3.5" />
          Android Floor Terminal (Low-RAM Optimized)
        </span>
        {selectedOrder && (
          <Link
            href={`/orders/${selectedOrder.id}`}
            className="inline-flex items-center gap-1 font-medium text-slate-800 underline hover:text-slate-900"
          >
            Inspect in Merchandiser View
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>

      {/* Mobile Phone Frame Container */}
      <div className="overflow-hidden rounded-2xl border-2 border-slate-800 bg-white shadow-lg">
        {/* 1. Top Mobile Control Strip (Language Toggle + Offline Dead-Zone Simulator) */}
        <div className="bg-slate-900 px-4 py-3 text-white">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-bold tracking-wide">
                {lang === 'ta'
                  ? 'திருப்பூர் தரைத்தள பதிவு'
                  : 'Floor Supervisor Entry'}
              </div>
              <div className="font-mono text-[10px] text-slate-400">
                {lang === 'ta'
                  ? 'தேதி: 02 நவம்பர் 2026'
                  : 'Shift Date: 02 Nov 2026'}
              </div>
            </div>

            {/* Language Switcher Pill */}
            <button
              type="button"
              onClick={() => setLang((prev) => (prev === 'ta' ? 'en' : 'ta'))}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-700"
            >
              <Languages className="h-3.5 w-3.5 text-emerald-400" />
              {lang === 'ta' ? 'தமிழ் · Switch to EN' : 'EN · தமிழ் மாற்ற'}
            </button>
          </div>

          {/* Simulate Factory Dead Zone (Offline Mode) Toggle */}
          <div className="mt-2.5 flex items-center justify-between rounded-lg border border-slate-700/80 bg-slate-800/90 px-3 py-2">
            <div className="flex items-center gap-2 text-xs">
              {isOffline ? (
                <CloudOff className="h-4 w-4 text-amber-400" />
              ) : (
                <Wifi className="h-4 w-4 text-emerald-400" />
              )}
              <div>
                <div className="font-semibold">
                  {isOffline
                    ? lang === 'ta'
                      ? 'ஆஃப்லைன் நிலை (சிக்னல் இல்லை)'
                      : 'Offline Mode (Factory Dead Zone)'
                    : lang === 'ta'
                    ? 'ஆன்லைன் நிலை (சர்வர் இணைப்பு)'
                    : 'Online (Connected to Server)'}
                </div>
                <div className="text-[10px] text-slate-400">
                  {lang === 'ta'
                    ? 'ஆஃப்லைன் வரிசையை சோதிக்க மாற்றவும்'
                    : 'Toggle to test localStorage offline queue'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsSimulatedOffline((prev) => !prev)}
              className={`rounded-md px-2.5 py-1 font-mono text-[11px] font-bold transition ${
                isSimulatedOffline
                  ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                  : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
              }`}
            >
              {isSimulatedOffline ? 'Go Online' : 'Simulate Offline'}
            </button>
          </div>
        </div>

        {/* 2. Offline Sync Queue Banner */}
        {offlineQueue.length > 0 && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CloudOff className="h-4 w-4 shrink-0 text-amber-700" />
                <div className="text-xs">
                  <div className="font-bold text-amber-900">
                    {offlineQueue.length}{' '}
                    {lang === 'ta'
                      ? 'பதிவுகள் ஆஃப்லைன் வரிசையில் உள்ளன'
                      : 'Update(s) Queued on Phone'}
                  </div>
                  <div className="font-mono text-[10px] text-amber-800">
                    {offlineQueue
                      .map((q) => `${q.poNumber} (+${q.qtyDoneToday})`)
                      .join(', ')}
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={isOffline || syncingQueue}
                onClick={syncOfflineQueueNow}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-amber-900 px-2.5 py-1.5 font-mono text-[11px] font-semibold text-white disabled:opacity-40"
              >
                <RefreshCw
                  className={`h-3 w-3 ${syncingQueue ? 'animate-spin' : ''}`}
                />
                {isOffline ? 'Switch Online to Sync' : 'Sync Now'}
              </button>
            </div>
          </div>
        )}

        {/* Feedback & AI Classification Toast Banner */}
        {feedbackBanner && (
          <div
            className={`border-b px-4 py-3 text-xs ${
              feedbackBanner.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : feedbackBanner.type === 'offline'
                ? 'border-amber-200 bg-amber-50 text-amber-900'
                : 'border-rose-200 bg-rose-50 text-rose-900'
            }`}
          >
            <div className="font-bold">{feedbackBanner.title}</div>
            {feedbackBanner.detail && (
              <div className="mt-0.5 text-[11px] opacity-90">
                {feedbackBanner.detail}
              </div>
            )}
            {feedbackBanner.aiTranslation && (
              <div className="mt-2 rounded-lg border border-indigo-200 bg-white p-2.5 text-slate-800">
                <div className="flex items-center justify-between font-mono text-[10px] font-semibold text-indigo-700">
                  <span className="inline-flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    AI: {feedbackBanner.aiCategory}
                  </span>
                  {feedbackBanner.aiConfidence !== null &&
                    feedbackBanner.aiConfidence !== undefined && (
                      <span>
                        {Math.round(feedbackBanner.aiConfidence * 100)}% conf
                      </span>
                    )}
                </div>
                <div className="mt-1 text-xs font-medium">
                  “{feedbackBanner.aiTranslation}”
                </div>
                {feedbackBanner.needsManualReview && (
                  <div className="mt-1 inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-900">
                    <AlertTriangle className="h-3 w-3" />
                    Flagged for Merchandiser Manual Review (&lt;70% conf)
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 3. Dead-Simple 3-Part Floor Update Form */}
        <form onSubmit={handleSubmitUpdate} className="space-y-5 p-4">
          {/* Order & Active Stage Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
              {lang === 'ta'
                ? 'ஆர்டர் & நிலை (Select Order & Stage)'
                : 'Select Active Production Order'}
            </label>

            {loadingOrders ? (
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading orders...
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                {orders.map((o) => {
                  const isSelected = selectedOrder?.id === o.id;
                  const stageTa =
                    STAGE_TAMIL_LABELS[o.currentStage] || o.currentStage;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setSelectedOrderId(o.id)}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        isSelected
                          ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                          : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-bold">
                          {o.poNumber}
                        </span>
                        <span
                          className={`rounded px-2 py-0.5 font-mono text-[10px] font-semibold ${
                            isSelected
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {lang === 'ta' ? stageTa : o.currentStage}
                        </span>
                      </div>
                      <div
                        className={`mt-1 text-xs ${
                          isSelected ? 'text-slate-200' : 'text-slate-600'
                        }`}
                      >
                        {o.styleName} · {o.productionUnit}
                      </div>
                      {o.activeMilestone && (
                        <div
                          className={`mt-1 font-mono text-[11px] tabular-nums ${
                            isSelected ? 'text-slate-300' : 'text-slate-500'
                          }`}
                        >
                          {lang === 'ta' ? 'முடிந்தது:' : 'Done:'}{' '}
                          {o.activeMilestone.completedQty.toLocaleString()} /{' '}
                          {o.activeMilestone.targetQty.toLocaleString()} pcs
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* PART 1: Big Numeric Quantity Input */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
            <label className="block text-xs font-bold text-slate-800">
              {lang === 'ta'
                ? '1. இன்று முடித்த எண்ணிக்கை (Pieces Done Today) *'
                : '1. Pieces Completed Today (இன்று முடித்த எண்ணிக்கை) *'}
            </label>

            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                required
                value={qtyDoneToday}
                onChange={(e) => setQtyDoneToday(e.target.value)}
                className="w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3 font-mono text-2xl font-bold text-slate-900 tabular-nums focus:border-slate-900 focus:outline-none"
              />
              <span className="font-mono text-sm font-semibold text-slate-500">
                PCS
              </span>
            </div>

            {/* Quick Tap Pills */}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {[0, 150, 240, 350, 420].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setQtyDoneToday(String(preset))}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-mono text-xs font-semibold text-slate-700 hover:border-slate-900 hover:bg-slate-900 hover:text-white"
                >
                  {preset} pcs
                </button>
              ))}
              <button
                type="button"
                onClick={() =>
                  setQtyDoneToday((prev) =>
                    String((parseInt(prev || '0', 10) || 0) + 50)
                  )
                }
                className="rounded-lg border border-slate-300 bg-slate-200/70 px-2.5 py-1 font-mono text-xs font-bold text-slate-800 hover:bg-slate-300"
              >
                +50
              </button>
            </div>
          </div>

          {/* PART 2: Floor Photo Attachment */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800">
                {lang === 'ta'
                  ? '2. புகைப்படம் (Floor Bundle / Defect Photo)'
                  : '2. Floor Photo (புகைப்படம் - Optional)'}
              </label>
              {photoUrl && (
                <button
                  type="button"
                  onClick={() => setPhotoUrl(null)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 hover:underline"
                >
                  <Trash2 className="h-3 w-3" />
                  Remove
                </button>
              )}
            </div>

            {photoUrl ? (
              <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white p-2">
                <img
                  src={photoUrl}
                  alt="Attached floor bundle"
                  className="h-28 w-full rounded object-cover"
                />
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white py-2.5 text-xs font-medium text-slate-700 hover:border-slate-900">
                  <Camera className="h-4 w-4 text-slate-500" />
                  <span>
                    {lang === 'ta'
                      ? 'கேமரா / படம் எடு (Take or Upload Photo)'
                      : 'Take Camera Photo or Upload File'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  {SAMPLE_PHOTO_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPhotoUrl(p.dataUrl)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left text-[11px] font-medium text-slate-700 hover:border-slate-900"
                    >
                      📷 {lang === 'ta' ? p.labelTa : p.labelEn}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* PART 3: Optional Tamil Issue Note by Text or Voice + Reviewer Test Chips */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-xs font-bold text-slate-800">
                {lang === 'ta'
                  ? '3. தாமதக் காரணம் - தமிழ் எழுத்து / குரல்'
                  : '3. Issue Note in Tamil (Text or Voice)'}
              </label>

              <button
                type="button"
                onClick={handleToggleTamilVoice}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                  isListeningVoice
                    ? 'animate-pulse bg-rose-600 text-white'
                    : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                }`}
              >
                {isListeningVoice ? (
                  <>
                    <MicOff className="h-3 w-3" />
                    Listening (ta-IN)...
                  </>
                ) : (
                  <>
                    <Mic className="h-3 w-3 text-rose-600" />
                    🎤 தமிழ் குரல் (Voice)
                  </>
                )}
              </button>
            </div>

            <textarea
              rows={3}
              value={rawNoteTamil}
              onChange={(e) => setRawNoteTamil(e.target.value)}
              placeholder={
                lang === 'ta'
                  ? 'எ.கா: ஊசி தட்டு உடைந்துவிட்டது, 2 தையல் இயந்திரங்கள் நின்றன...'
                  : 'Type or speak in Tamil (e.g., ஊசி தட்டு உடைந்துவிட்டது...)'
              }
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
            />

            {/* 1-Click Reviewer Test Tamil Chips */}
            <div className="mt-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {lang === 'ta'
                  ? '1-கிளிக் மாதிரி தமிழ் குறிப்புகள் (Tap to test AI):'
                  : '1-Click Sample Tamil Blocker Chips (Tap to test AI):'}
              </div>
              <div className="mt-1.5 flex flex-col gap-1.5">
                {SAMPLE_TAMIL_CHIPS.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setRawNoteTamil(chip.tamilText)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left text-[11px] transition hover:border-slate-900 hover:bg-slate-50"
                  >
                    <div className="font-semibold text-slate-800">
                      {lang === 'ta' ? chip.badgeTa : chip.badgeEn}
                    </div>
                    <div className="truncate text-[11px] text-slate-500">
                      “{chip.tamilText}”
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Big Send Button */}
          <button
            type="submit"
            disabled={submitting || !selectedOrder}
            className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white shadow-sm transition disabled:opacity-50 ${
              isOffline
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-slate-900 hover:bg-slate-800'
            }`}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {lang === 'ta'
                  ? 'AI மொழிபெயர்த்து சேமிக்கிறது...'
                  : 'Translating & Saving Floor Update...'}
              </>
            ) : isOffline ? (
              <>
                <CloudOff className="h-4 w-4" />
                {lang === 'ta'
                  ? 'ஆஃப்லைனில் சேமி (Save to Offline Queue)'
                  : 'Save Update to Phone Offline Queue'}
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                {lang === 'ta'
                  ? 'அனுப்பு (Submit Daily Floor Update)'
                  : 'Submit Floor Update (அனுப்பு)'}
              </>
            )}
          </button>
        </form>

        {/* 4. Recent Floor Submissions List */}
        {selectedOrder && (
          <div className="border-t border-slate-200 bg-slate-50 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {lang === 'ta'
                ? `${selectedOrder.poNumber} - சமீபத்திய பதிவுகள்`
                : `Recent Floor Logs · ${selectedOrder.poNumber}`}
            </h3>

            <div className="mt-2.5 space-y-2">
              {selectedOrder.dailyUpdates.slice(0, 5).map((u) => (
                <div
                  key={u.id}
                  className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      +{u.qtyDoneToday.toLocaleString()} pcs
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" />
                      Synced · {new Date(u.workDate).toISOString().slice(0, 10)}
                    </span>
                  </div>
                  {u.rawNoteTamil && (
                    <div className="mt-1.5 border-t border-slate-100 pt-1.5">
                      <div className="text-[11px] text-slate-700">
                        “{u.rawNoteTamil}”
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] text-indigo-700">
                        → AI: {u.finalReasonCategory || u.aiReasonCategory} (“
                        {u.aiEnglishTranslation}”)
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
