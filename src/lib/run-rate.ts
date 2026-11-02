export type RunRateStatus = 'GREEN' | 'AMBER' | 'RED';

export interface RunRateInput {
  totalQty: number;
  completedQty: number;
  stagePlannedEndDate: Date | string;
  exFactoryDate: Date | string;
  recentDailyQuantities: number[];
  referenceDate?: Date | string;
  downstreamBufferDays?: number;
}

export interface RunRateResult {
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
  projectedCompletionDate: Date | null;
  projectedSlipDays: number | null;
  projectedExFactorySlipDays: number | null;
  isStalled: boolean;
  status: RunRateStatus;
  isTwoWeekEarlyWarning: boolean;
  mathSummary: string;
  warningHeadline: string;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DEFAULT_REFERENCE_DATE = '2026-11-02T00:00:00.000Z';

/**
 * Normalizes a Date or ISO date string to UTC midnight timestamp (ms)
 * so time-of-day never skews day-count calculations.
 */
export function toUtcMidnightMs(dateInput: Date | string): number {
  const d =
    typeof dateInput === 'string'
      ? new Date(dateInput)
      : new Date(dateInput.getTime());
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Pure, deterministic Run-Rate Delay Projection Engine ("Shows Its Maths").
 * Compares required daily run-rate against recent 3-day actual floor output
 * to surface 2-week early warnings before Ex-Factory dates are breached.
 */
export function calculateOrderRunRate(input: RunRateInput): RunRateResult {
  const {
    totalQty,
    completedQty,
    stagePlannedEndDate,
    exFactoryDate,
    recentDailyQuantities,
    referenceDate = DEFAULT_REFERENCE_DATE,
    downstreamBufferDays = 0,
  } = input;

  const safeTotalQty = Math.max(0, totalQty);
  const safeCompletedQty = Math.max(0, completedQty);

  // 1. Remaining quantity & completion percentage
  const remainingQty = Math.max(0, safeTotalQty - safeCompletedQty);
  const completionPercentage =
    safeTotalQty > 0
      ? Math.min(100, Math.round((safeCompletedQty / safeTotalQty) * 100))
      : 100;

  // 2 & 3. Normalize dates to UTC midnight and compute days left
  const refDateUTC = toUtcMidnightMs(referenceDate);
  const stageEndUTC = toUtcMidnightMs(stagePlannedEndDate);
  const exFactoryUTC = toUtcMidnightMs(exFactoryDate);

  const daysLeftToStageEnd = Math.ceil((stageEndUTC - refDateUTC) / MS_PER_DAY);
  const daysLeftToExFactory = Math.ceil(
    (exFactoryUTC - refDateUTC) / MS_PER_DAY
  );

  // 4. Required Daily Rate (requiredDailyRate)
  let requiredDailyRate = 0;
  if (remainingQty === 0) {
    requiredDailyRate = 0;
  } else if (daysLeftToStageEnd <= 0) {
    requiredDailyRate = remainingQty;
  } else {
    requiredDailyRate = Math.ceil(remainingQty / daysLeftToStageEnd);
  }

  // 5. Actual Daily Rate (actualDailyRate) from up to the last 3 entries
  const last3 = recentDailyQuantities
    .slice(-3)
    .map((q) => (Number.isFinite(q) && q > 0 ? q : 0));

  let actualDailyRate = 0;
  if (last3.length > 0) {
    const sum = last3.reduce((acc, val) => acc + val, 0);
    actualDailyRate = Math.round(sum / last3.length);
  }

  // 6. Daily Delta (dailyShortfallOrSurplus)
  const dailyShortfallOrSurplus = actualDailyRate - requiredDailyRate;

  // 7. Projected Days Needed & Projected Completion Date
  let projectedDaysNeeded: number | null = null;
  let projectedCompletionDate: Date | null = null;
  let projectedSlipDays: number | null = null;
  let projectedExFactorySlipDays: number | null = null;
  let isStalled = false;

  if (remainingQty === 0) {
    projectedDaysNeeded = 0;
    projectedCompletionDate = new Date(refDateUTC);
    projectedSlipDays = 0;
    projectedExFactorySlipDays = 0;
    isStalled = false;
  } else if (actualDailyRate <= 0) {
    projectedDaysNeeded = null;
    projectedCompletionDate = null;
    projectedSlipDays = null;
    projectedExFactorySlipDays = null;
    isStalled = true;
  } else {
    projectedDaysNeeded = Math.ceil(remainingQty / actualDailyRate);
    projectedCompletionDate = new Date(
      refDateUTC + projectedDaysNeeded * MS_PER_DAY
    );
    projectedSlipDays =
      projectedDaysNeeded - Math.max(0, daysLeftToStageEnd);
    projectedExFactorySlipDays =
      projectedDaysNeeded +
      downstreamBufferDays -
      Math.max(0, daysLeftToExFactory);
  }

  // 8. Status Classification ('GREEN' | 'AMBER' | 'RED') & Early Warning Flag
  let status: RunRateStatus = 'GREEN';

  if (remainingQty === 0) {
    status = 'GREEN';
  } else if (
    isStalled ||
    daysLeftToExFactory < 0 ||
    actualDailyRate < requiredDailyRate * 0.55 ||
    (projectedExFactorySlipDays !== null &&
      projectedExFactorySlipDays > 0 &&
      daysLeftToExFactory <= 14)
  ) {
    status = 'RED';
  } else if (
    actualDailyRate < requiredDailyRate ||
    (projectedSlipDays !== null && projectedSlipDays > 0)
  ) {
    status = 'AMBER';
  } else {
    status = 'GREEN';
  }

  const isTwoWeekEarlyWarning =
    (status === 'AMBER' || status === 'RED') && daysLeftToExFactory >= 10;

  // 9. Human-Readable Formula Summary (mathSummary & warningHeadline)
  const fmtRemaining = remainingQty.toLocaleString('en-US');
  const fmtReq = requiredDailyRate.toLocaleString('en-US');
  const fmtAct = actualDailyRate.toLocaleString('en-US');
  const effectiveDaysLabel =
    daysLeftToStageEnd > 0
      ? `${daysLeftToStageEnd} ${daysLeftToStageEnd === 1 ? 'day' : 'days'}`
      : 'past due';

  let mathSummary: string;
  if (remainingQty === 0) {
    mathSummary = `Stage complete (0 left) · Making ${fmtAct} pcs/day (3-day avg) · Target achieved`;
  } else if (isStalled) {
    mathSummary = `Need ${fmtReq} pcs/day (${fmtRemaining} left ÷ ${effectiveDaysLabel}) · Making 0 pcs/day (stalled) · Shortfall: ${fmtReq} pcs/day`;
  } else if (dailyShortfallOrSurplus < 0) {
    const shortfall = Math.abs(dailyShortfallOrSurplus).toLocaleString('en-US');
    mathSummary = `Need ${fmtReq} pcs/day (${fmtRemaining} left ÷ ${effectiveDaysLabel}) · Making ${fmtAct} pcs/day (3-day avg) · Shortfall: ${shortfall} pcs/day`;
  } else if (dailyShortfallOrSurplus > 0) {
    const surplus = dailyShortfallOrSurplus.toLocaleString('en-US');
    mathSummary = `Need ${fmtReq} pcs/day (${fmtRemaining} left ÷ ${effectiveDaysLabel}) · Making ${fmtAct} pcs/day (3-day avg) · Surplus: +${surplus} pcs/day`;
  } else {
    mathSummary = `Need ${fmtReq} pcs/day (${fmtRemaining} left ÷ ${effectiveDaysLabel}) · Making ${fmtAct} pcs/day (3-day avg) · On target (0 pcs/day delta)`;
  }

  let warningHeadline: string;
  if (remainingQty === 0) {
    warningHeadline = 'Stage completed on schedule';
  } else if (isStalled) {
    warningHeadline = `Critical delay: Floor output stalled with ${fmtRemaining} pcs remaining`;
  } else if (status === 'RED') {
    if (
      projectedExFactorySlipDays !== null &&
      projectedExFactorySlipDays > 0
    ) {
      warningHeadline = `Critical delay: Projected ${projectedExFactorySlipDays} days past Ex-Factory (${projectedSlipDays} days behind stage plan)`;
    } else {
      warningHeadline = `Critical delay: Projected ${projectedSlipDays ?? 0} days behind stage plan`;
    }
  } else if (status === 'AMBER') {
    if (isTwoWeekEarlyWarning) {
      warningHeadline = `Projected ${projectedSlipDays} days behind stage plan (${daysLeftToExFactory} days to Ex-Factory — Early Warning)`;
    } else {
      warningHeadline = `At risk: Projected ${projectedSlipDays} days behind stage plan`;
    }
  } else {
    warningHeadline = `On track (+${dailyShortfallOrSurplus} pcs/day buffer)`;
  }

  return {
    totalQty: safeTotalQty,
    completedQty: safeCompletedQty,
    remainingQty,
    completionPercentage,
    daysLeftToStageEnd,
    daysLeftToExFactory,
    requiredDailyRate,
    actualDailyRate,
    dailyShortfallOrSurplus,
    projectedDaysNeeded,
    projectedCompletionDate,
    projectedSlipDays,
    projectedExFactorySlipDays,
    isStalled,
    status,
    isTwoWeekEarlyWarning,
    mathSummary,
    warningHeadline,
  };
}

