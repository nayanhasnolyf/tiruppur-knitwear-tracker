import { describe, it, expect } from 'vitest';
import {
  scopeOrdersToBuyerToken,
  extractConfirmedBuyerWarnings,
  evaluateIdempotentSubmission,
  validateComplianceDateChange,
} from '../buyer-portal-utils';

describe('Security, Tenant Isolation, Idempotency & Compliance Guardrails', () => {
  const mockBuyers = [
    {
      id: 'buyer-uk-b',
      name: 'Company B (UK)',
      country: 'United Kingdom',
      contactEmail: 'sourcing@companyb.co.uk',
      accessToken: 'uk-company-b-readonly-2026',
    },
    {
      id: 'buyer-de-c',
      name: 'Company C (Germany)',
      country: 'Germany',
      contactEmail: 'buying@companyc.de',
      accessToken: 'de-company-c-readonly-2026',
    },
  ];

  const mockOrders = [
    {
      id: 'ord-1',
      poNumber: 'B-PO-88213',
      buyerId: 'buyer-uk-b',
      styleName: "Men's crew neck tee, navy",
      colour: 'Navy',
      totalQty: 12000,
    },
    {
      id: 'ord-2',
      poNumber: 'B-PO-88240',
      buyerId: 'buyer-uk-b',
      styleName: "Men's polo, white",
      colour: 'White',
      totalQty: 8000,
    },
    {
      id: 'ord-3',
      poNumber: 'C-PO-0488',
      buyerId: 'buyer-de-c',
      styleName: 'Kids printed tee, yellow',
      colour: 'Yellow',
      totalQty: 10000,
    },
  ];

  it('1. Buyer Filter Isolation Logic: scoping by Company B token never leaks Company C orders or volumes', () => {
    const ukScope = scopeOrdersToBuyerToken(
      mockBuyers,
      mockOrders,
      'uk-company-b-readonly-2026'
    );
    expect(ukScope).not.toBeNull();
    expect(ukScope?.buyer.name).toBe('Company B (UK)');
    expect(ukScope?.orders.map((o) => o.poNumber)).toEqual([
      'B-PO-88213',
      'B-PO-88240',
    ]);
    expect(
      ukScope?.orders.some((o) => o.poNumber === 'C-PO-0488')
    ).toBe(false);

    const deScope = scopeOrdersToBuyerToken(
      mockBuyers,
      mockOrders,
      'de-company-c-readonly-2026'
    );
    expect(deScope).not.toBeNull();
    expect(deScope?.buyer.name).toBe('Company C (Germany)');
    expect(deScope?.orders.map((o) => o.poNumber)).toEqual(['C-PO-0488']);

    const invalidScope = scopeOrdersToBuyerToken(
      mockBuyers,
      mockOrders,
      'invalid-forged-token-999'
    );
    expect(invalidScope).toBeNull();
  });

  it('2. Merchandiser Confirmation Gatekeeper: strips unconfirmed Tamil floor notes and exposes only confirmed warnings', () => {
    const rawFloorUpdates = [
      {
        id: 'upd-unconfirmed',
        workDate: '2026-11-02',
        qtyDoneToday: 240,
        photoUrl: null,
        rawNoteTamil:
          'ஊசி தட்டு உடைந்துவிட்டது, 2 தையல் இயந்திரங்கள் 4 மணி நேரம் நின்றன',
        aiEnglishTranslation:
          'Needle plate broke, 2 sewing machines stopped for 4 hours',
        aiReasonCategory: 'MACHINE_BREAKDOWN',
        finalReasonCategory: 'MACHINE_BREAKDOWN',
        aiConfidence: 0.94,
        isMerchandiserConfirmed: false, // Gatekeeper should block this from Buyer Portal!
        merchandiserBuyerNote: null,
      },
      {
        id: 'upd-confirmed',
        workDate: '2026-11-02',
        qtyDoneToday: 160,
        photoUrl: 'data:image/svg+xml;utf8,<svg></svg>',
        rawNoteTamil:
          'காலர் பகுதியில் எண்ணெய் கறை உள்ளது, மறுபடியும் வாஷிங் செய்ய வேண்டும்',
        aiEnglishTranslation:
          'Oil stain found on collar area, requires re-washing before packing',
        aiReasonCategory: 'QUALITY_REWORK',
        finalReasonCategory: 'QUALITY_REWORK',
        aiConfidence: 0.91,
        isMerchandiserConfirmed: true, // Confirmed by merchandiser!
        merchandiserBuyerNote:
          'Collar stain rework in progress; extra evening shift added to recover schedule.',
      },
    ];

    const buyerWarnings = extractConfirmedBuyerWarnings(rawFloorUpdates);

    expect(buyerWarnings).toHaveLength(1);
    expect(buyerWarnings[0].id).toBe('upd-confirmed');
    expect(buyerWarnings[0].reasonCategory).toBe('QUALITY_REWORK');
    expect(buyerWarnings[0].buyerSummaryNote).toBe(
      'Collar stain rework in progress; extra evening shift added to recover schedule.'
    );
    // Ensure raw Tamil text and internal AI confidence are not present on buyer payload
    expect('rawNoteTamil' in buyerWarnings[0]).toBe(false);
    expect('aiConfidence' in buyerWarnings[0]).toBe(false);
  });

  it('3. Offline Sync Idempotency Check: replaying the same clientSubmissionId does not double-increment completedQty', () => {
    const syncedSet = new Set<string>(['seed-b88213-2026-11-01']);

    // First sync of a new offline submission
    const firstAttempt = evaluateIdempotentSubmission(syncedSet, {
      clientSubmissionId: 'floor-offline-uuid-1001',
      currentCompletedQty: 6800,
      qtyDoneToday: 250,
    });

    expect(firstAttempt.alreadySynced).toBe(false);
    expect(firstAttempt.nextCompletedQty).toBe(7050);

    // Second retry of the exact same clientSubmissionId (e.g. flaky 2G retry)
    const duplicateRetry = evaluateIdempotentSubmission(
      firstAttempt.updatedSyncedIds,
      {
        clientSubmissionId: 'floor-offline-uuid-1001',
        currentCompletedQty: firstAttempt.nextCompletedQty,
        qtyDoneToday: 250,
      }
    );

    expect(duplicateRetry.alreadySynced).toBe(true);
    expect(duplicateRetry.nextCompletedQty).toBe(7050); // Not 7300!
  });

  it('4. TNA Date-Change Compliance Validation: rejects blank or trivial changeReason and accepts valid reason', () => {
    const emptyReasonResult = validateComplianceDateChange({
      newDate: '2026-11-18',
      changeReason: '   ',
    });
    expect(emptyReasonResult.valid).toBe(false);

    const tooShortResult = validateComplianceDateChange({
      newDate: '2026-11-18',
      changeReason: 'late',
    });
    expect(tooShortResult.valid).toBe(false);

    const validResult = validateComplianceDateChange({
      newDate: '2026-11-18',
      changeReason:
        'Subcontract washing unit boiler maintenance — 2 day shift agreed with buyer.',
    });
    expect(validResult.valid).toBe(true);
    if (validResult.valid) {
      expect(validResult.parsedDate.toISOString().slice(0, 10)).toBe(
        '2026-11-18'
      );
    }
  });
});

