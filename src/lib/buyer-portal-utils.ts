import { toUtcMidnightMs } from './run-rate';

export interface MinimalBuyerRecord {
  id: string;
  name: string;
  country: string;
  contactEmail: string;
  accessToken: string;
}

export interface MinimalOrderRecord {
  id: string;
  poNumber: string;
  buyerId: string;
  styleName: string;
  colour: string;
  totalQty: number;
}

export interface MinimalDailyUpdateRecord {
  id: string;
  workDate: Date | string;
  qtyDoneToday: number;
  photoUrl: string | null;
  rawNoteTamil: string | null;
  aiEnglishTranslation: string | null;
  aiReasonCategory: string | null;
  finalReasonCategory: string | null;
  aiConfidence: number | null;
  isMerchandiserConfirmed: boolean;
  merchandiserBuyerNote: string | null;
}

export interface BuyerSafeWarning {
  id: string;
  workDate: Date | string;
  qtyDoneToday: number;
  photoUrl: string | null;
  reasonCategory: string | null;
  buyerSummaryNote: string;
}

/**
 * 1. Strict Tenant Isolation Helper:
 * Resolves a buyer by `accessToken` and returns ONLY orders belonging to that `buyer.id`.
 * Returns `null` if the token is empty or does not match any registered buyer.
 */
export function scopeOrdersToBuyerToken<
  B extends MinimalBuyerRecord,
  O extends MinimalOrderRecord
>(
  buyers: B[],
  orders: O[],
  accessToken: string
): { buyer: B; orders: O[] } | null {
  const cleanToken = (accessToken ?? '').trim();
  if (!cleanToken) return null;

  const matchedBuyer = buyers.find((b) => b.accessToken === cleanToken);
  if (!matchedBuyer) return null;

  const scopedOrders = orders.filter((o) => o.buyerId === matchedBuyer.id);
  return {
    buyer: matchedBuyer,
    orders: scopedOrders,
  };
}

/**
 * 2. Merchandiser Confirmation Gatekeeper:
 * Strips unconfirmed floor notes (`isMerchandiserConfirmed === false`), raw Tamil strings,
 * and internal AI confidence scores so buyers ONLY see merchandiser-confirmed warnings.
 */
export function extractConfirmedBuyerWarnings(
  updates: MinimalDailyUpdateRecord[]
): BuyerSafeWarning[] {
  return updates
    .filter((u) => u.isMerchandiserConfirmed === true)
    .map((u) => ({
      id: u.id,
      workDate: u.workDate,
      qtyDoneToday: u.qtyDoneToday,
      photoUrl: u.photoUrl,
      reasonCategory: u.finalReasonCategory ?? u.aiReasonCategory,
      buyerSummaryNote:
        u.merchandiserBuyerNote ||
        u.aiEnglishTranslation ||
        'Schedule recovery action in progress.',
    }));
}

/**
 * 3. Offline Mobile Queue Sync Idempotency Helper:
 * Ensures a retried mobile submission with an existing `clientSubmissionId`
 * never double-counts `completedQty`.
 */
export function evaluateIdempotentSubmission(
  syncedClientSubmissionIds: Set<string>,
  submission: {
    clientSubmissionId: string;
    currentCompletedQty: number;
    qtyDoneToday: number;
  }
): {
  alreadySynced: boolean;
  nextCompletedQty: number;
  updatedSyncedIds: Set<string>;
} {
  const id = submission.clientSubmissionId.trim();
  if (syncedClientSubmissionIds.has(id)) {
    return {
      alreadySynced: true,
      nextCompletedQty: submission.currentCompletedQty,
      updatedSyncedIds: new Set(syncedClientSubmissionIds),
    };
  }

  const nextSet = new Set(syncedClientSubmissionIds);
  nextSet.add(id);

  return {
    alreadySynced: false,
    nextCompletedQty:
      submission.currentCompletedQty + Math.max(0, submission.qtyDoneToday),
    updatedSyncedIds: nextSet,
  };
}

/**
 * 4. TNA Date-Change Compliance Validator:
 * Requires a valid date and a non-empty compliance justification (`>= 5` chars)
 * before allowing any milestone or Ex-Factory date revision.
 */
export function validateComplianceDateChange(input: {
  newDate?: string;
  changeReason?: string;
}): { valid: true; parsedDate: Date } | { valid: false; error: string } {
  const newDateStr = (input.newDate ?? '').trim();
  const reasonStr = (input.changeReason ?? '').trim();

  if (!newDateStr || !reasonStr || reasonStr.length < 5) {
    return {
      valid: false,
      error:
        'Compliance violation: Changing a milestone or Ex-Factory date requires a valid newDate and a detailed changeReason (at least 5 characters) for the audit trail.',
    };
  }

  const ms = toUtcMidnightMs(newDateStr);
  if (Number.isNaN(ms)) {
    return {
      valid: false,
      error: 'Invalid date format provided.',
    };
  }

  return {
    valid: true,
    parsedDate: new Date(ms),
  };
}

