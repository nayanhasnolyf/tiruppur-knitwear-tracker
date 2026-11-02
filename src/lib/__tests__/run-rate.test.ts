import { describe, it, expect } from 'vitest';
import { calculateOrderRunRate } from '../run-rate';

describe('Run-Rate Delay Projection Engine (calculateOrderRunRate)', () => {
  const REF_DATE = '2026-11-02T00:00:00.000Z';

  it('1. Sample Order 1 (B-PO-88213 - Navy Crew Neck Tee): surfaces AMBER 2-Week Early Warning with exact math', () => {
    const result = calculateOrderRunRate({
      totalQty: 12000,
      completedQty: 6800,
      stagePlannedEndDate: '2026-11-16',
      exFactoryDate: '2026-11-20',
      recentDailyQuantities: [250, 230, 240],
      referenceDate: REF_DATE,
    });

    expect(result.remainingQty).toBe(5200);
    expect(result.daysLeftToStageEnd).toBe(14);
    expect(result.daysLeftToExFactory).toBe(18);
    expect(result.requiredDailyRate).toBe(372);
    expect(result.actualDailyRate).toBe(240);
    expect(result.dailyShortfallOrSurplus).toBe(-132);
    expect(result.projectedDaysNeeded).toBe(22);
    expect(result.projectedSlipDays).toBe(8);
    expect(result.isTwoWeekEarlyWarning).toBe(true);
    expect(result.status).toBe('AMBER');
    expect(result.mathSummary).toBe(
      'Need 372 pcs/day (5,200 left ÷ 14 days) · Making 240 pcs/day (3-day avg) · Shortfall: 132 pcs/day'
    );
  });

  it('2. Sample Order 2 (B-PO-88240 - White Polo): triggers RED when projected completion misses Ex-Factory by 8 days', () => {
    const result = calculateOrderRunRate({
      totalQty: 8000,
      completedQty: 5200,
      stagePlannedEndDate: '2026-11-10',
      exFactoryDate: '2026-11-12',
      recentDailyQuantities: [170, 150, 160],
      referenceDate: REF_DATE,
    });

    expect(result.remainingQty).toBe(2800);
    expect(result.daysLeftToStageEnd).toBe(8);
    expect(result.daysLeftToExFactory).toBe(10);
    expect(result.requiredDailyRate).toBe(350);
    expect(result.actualDailyRate).toBe(160);
    expect(result.projectedDaysNeeded).toBe(18);
    expect(result.projectedExFactorySlipDays).toBe(8);
    expect(result.status).toBe('RED');
    expect(result.isTwoWeekEarlyWarning).toBe(true);
  });

  it('3. Sample Order 3 (C-PO-0488 - Yellow Kids Printed Tee): classifies GREEN when actual rate exceeds required rate', () => {
    const result = calculateOrderRunRate({
      totalQty: 10000,
      completedQty: 3100,
      stagePlannedEndDate: '2026-11-22',
      exFactoryDate: '2026-11-28',
      recentDailyQuantities: [410, 430, 420],
      referenceDate: REF_DATE,
    });

    expect(result.remainingQty).toBe(6900);
    expect(result.daysLeftToStageEnd).toBe(20);
    expect(result.daysLeftToExFactory).toBe(26);
    expect(result.requiredDailyRate).toBe(345);
    expect(result.actualDailyRate).toBe(420);
    expect(result.dailyShortfallOrSurplus).toBe(75);
    expect(result.status).toBe('GREEN');
    expect(result.isTwoWeekEarlyWarning).toBe(false);
    expect(result.mathSummary).toBe(
      'Need 345 pcs/day (6,900 left ÷ 20 days) · Making 420 pcs/day (3-day avg) · Surplus: +75 pcs/day'
    );
  });

  it('4. Zero-Output / Stalled Floor Edge Case: handles [0, 0, 0] without division-by-zero and flags RED stalled', () => {
    const result = calculateOrderRunRate({
      totalQty: 5000,
      completedQty: 2000,
      stagePlannedEndDate: '2026-11-12',
      exFactoryDate: '2026-11-18',
      recentDailyQuantities: [0, 0, 0],
      referenceDate: REF_DATE,
    });

    expect(result.actualDailyRate).toBe(0);
    expect(result.isStalled).toBe(true);
    expect(result.projectedDaysNeeded).toBeNull();
    expect(result.projectedCompletionDate).toBeNull();
    expect(result.projectedSlipDays).toBeNull();
    expect(result.status).toBe('RED');
  });

  it('5. Empty History Edge Case (New Stage Just Started): handles [] gracefully without NaN', () => {
    const result = calculateOrderRunRate({
      totalQty: 6000,
      completedQty: 0,
      stagePlannedEndDate: '2026-11-14',
      exFactoryDate: '2026-11-20',
      recentDailyQuantities: [],
      referenceDate: REF_DATE,
    });

    expect(Number.isNaN(result.actualDailyRate)).toBe(false);
    expect(result.actualDailyRate).toBe(0);
    expect(result.requiredDailyRate).toBe(500);
    expect(result.isStalled).toBe(true);
    expect(result.status).toBe('RED');
  });

  it('6. Completed Milestone Edge Case: completedQty >= totalQty returns remainingQty = 0, requiredDailyRate = 0, status = GREEN', () => {
    const result = calculateOrderRunRate({
      totalQty: 10000,
      completedQty: 10200, // Even with slight overage in cutting/finishing
      stagePlannedEndDate: '2026-11-05',
      exFactoryDate: '2026-11-10',
      recentDailyQuantities: [500, 520, 480],
      referenceDate: REF_DATE,
    });

    expect(result.remainingQty).toBe(0);
    expect(result.completionPercentage).toBe(100);
    expect(result.requiredDailyRate).toBe(0);
    expect(result.projectedDaysNeeded).toBe(0);
    expect(result.projectedSlipDays).toBe(0);
    expect(result.isStalled).toBe(false);
    expect(result.status).toBe('GREEN');
  });

  it('7. Past Deadline Edge Case: stagePlannedEndDate in the past sets requiredDailyRate = remainingQty', () => {
    const result = calculateOrderRunRate({
      totalQty: 4000,
      completedQty: 2500,
      stagePlannedEndDate: '2026-10-30', // 3 days in the past relative to 2026-11-02
      exFactoryDate: '2026-11-06',
      recentDailyQuantities: [300, 300, 300],
      referenceDate: REF_DATE,
    });

    expect(result.daysLeftToStageEnd).toBe(-3);
    expect(result.remainingQty).toBe(1500);
    expect(result.requiredDailyRate).toBe(1500);
    expect(result.projectedDaysNeeded).toBe(5);
    expect(result.projectedSlipDays).toBe(5);
    expect(result.status).toBe('RED');
  });

  it('8. Exact Boundary Case: actualDailyRate === requiredDailyRate yields GREEN and projectedSlipDays === 0', () => {
    const result = calculateOrderRunRate({
      totalQty: 7000,
      completedQty: 3500,
      stagePlannedEndDate: '2026-11-12', // 10 days left -> 350 pcs/day required
      exFactoryDate: '2026-11-18',
      recentDailyQuantities: [350, 350, 350],
      referenceDate: REF_DATE,
    });

    expect(result.requiredDailyRate).toBe(350);
    expect(result.actualDailyRate).toBe(350);
    expect(result.dailyShortfallOrSurplus).toBe(0);
    expect(result.projectedDaysNeeded).toBe(10);
    expect(result.projectedSlipDays).toBe(0);
    expect(result.status).toBe('GREEN');
    expect(result.isTwoWeekEarlyWarning).toBe(false);
  });

  it('9. Slices only the last 3 daily quantities when 5+ days of floor history are passed', () => {
    const result = calculateOrderRunRate({
      totalQty: 12000,
      completedQty: 6800,
      stagePlannedEndDate: '2026-11-16',
      exFactoryDate: '2026-11-20',
      recentDailyQuantities: [620, 590, 250, 230, 240], // 5-day history from seed
      referenceDate: REF_DATE,
    });

    expect(result.actualDailyRate).toBe(240);
    expect(result.requiredDailyRate).toBe(372);
    expect(result.status).toBe('AMBER');
  });
});

