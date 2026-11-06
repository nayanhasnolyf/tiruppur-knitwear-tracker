export type ReasonCategoryType =
  | 'MACHINE_BREAKDOWN'
  | 'FABRIC_DEFECT'
  | 'POWER_CUT'
  | 'WORKER_SHORTAGE'
  | 'PRINT_WASH_DELAY'
  | 'QUALITY_REWORK'
  | 'OTHER'
  | 'UNCLASSIFIED';

export interface TamilAiClassificationResult {
  rawNoteTamil: string;
  englishTranslation: string;
  reasonCategory: ReasonCategoryType;
  confidence: number;
  needsManualReview: boolean;
  errorReason?: string;
  source: 'GEMINI_LIVE' | 'AI_ERROR' | 'EMPTY_INPUT';
}

const VALID_REASON_CATEGORIES = new Set<ReasonCategoryType>([
  'MACHINE_BREAKDOWN',
  'FABRIC_DEFECT',
  'POWER_CUT',
  'WORKER_SHORTAGE',
  'PRINT_WASH_DELAY',
  'QUALITY_REWORK',
  'OTHER',
  'UNCLASSIFIED',
]);

export const REASON_CATEGORY_LABELS: Record<ReasonCategoryType, string> = {
  MACHINE_BREAKDOWN: 'Machine Breakdown',
  FABRIC_DEFECT: 'Fabric / Yarn Defect',
  POWER_CUT: 'Power / EB Outage',
  WORKER_SHORTAGE: 'Operator / Tailor Shortage',
  PRINT_WASH_DELAY: 'Printing / Washing Delay',
  QUALITY_REWORK: 'Quality / Stain Rework',
  OTHER: 'Other Floor Issue',
  UNCLASSIFIED: 'Unclassified (Needs Review)',
};

/**
 * Enforces the "When AI is Wrong / Unsure" guardrail:
 * Any classification with confidence < 0.70 or category UNCLASSIFIED / OTHER
 * MUST require manual merchandiser review before confirming or sharing with buyers.
 */
function applyConfidenceGuardrail(
  result: Omit<TamilAiClassificationResult, 'needsManualReview'>
): TamilAiClassificationResult {
  const clampedConfidence = Math.max(
    0,
    Math.min(1, Number(result.confidence) || 0)
  );
  const needsManualReview =
    clampedConfidence < 0.7 ||
    result.reasonCategory === 'UNCLASSIFIED' ||
    result.reasonCategory === 'OTHER';

  return {
    ...result,
    confidence: Number(clampedConfidence.toFixed(2)),
    needsManualReview,
  };
}

/**
 * Translates a Tamil floor note into English and classifies its root-cause category
 * using ONLY the live Google Gemini API (`gemini-2.5-flash`).
 * If `GEMINI_API_KEY` is missing or the API call fails, returns an explicit error
 * reason and flags `needsManualReview = true` rather than guessing with a dictionary.
 */
export async function classifyTamilFloorNote(
  rawNoteTamil: string
): Promise<TamilAiClassificationResult> {
  const trimmed = (rawNoteTamil ?? '').trim();

  if (!trimmed) {
    return {
      rawNoteTamil: '',
      englishTranslation: '',
      reasonCategory: 'UNCLASSIFIED',
      confidence: 0,
      needsManualReview: false,
      source: 'EMPTY_INPUT',
    };
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return {
      rawNoteTamil: trimmed,
      englishTranslation: '[AI Error: GEMINI_API_KEY is not configured in .env]',
      reasonCategory: 'UNCLASSIFIED',
      confidence: 0,
      needsManualReview: true,
      errorReason: 'GEMINI_API_KEY is missing in environment variables.',
      source: 'AI_ERROR',
    };
  }

  try {
    const prompt = `You are an expert production floor translator for a Tiruppur knitwear garment exporter in Tamil Nadu, India.
Translate the following Tamil (or Tanglish) supervisor floor note into concise, professional English and classify the root cause of the production delay into EXACTLY one of these enum values:
- MACHINE_BREAKDOWN (sewing machine, needle, overlock, flatlock, motor issue)
- FABRIC_DEFECT (fabric hole, GSM issue, yarn breakage, dyeing shade variation, shrinkage)
- POWER_CUT (electricity outage, EB cut, voltage fluctuation, generator failure)
- WORKER_SHORTAGE (tailors absent, operator shortage, festival/rain absenteeism)
- PRINT_WASH_DELAY (screen printing delay, curing/drying slow due to rain, washing batch delay)
- QUALITY_REWORK (oil stain, collar/cuff measurement issue, AQL rejection, re-washing/re-stitching)
- OTHER (specific production reason that does not fit the above 6 categories)
- UNCLASSIFIED (the note is vague, ambiguous, or merely says work is slow/delayed without stating a clear root cause, e.g., "வேலை மெதுவாக நடக்கிறது" or "இன்று வேலை சற்று தாமதம்")

IMPORTANT: If the note is vague, ambiguous, or lacks a clear root cause, you MUST set reasonCategory to "UNCLASSIFIED" and confidence <= 0.55.

Respond ONLY with valid JSON matching this schema:
{
  "englishTranslation": "string",
  "reasonCategory": "MACHINE_BREAKDOWN | FABRIC_DEFECT | POWER_CUT | WORKER_SHORTAGE | PRINT_WASH_DELAY | QUALITY_REWORK | OTHER | UNCLASSIFIED",
  "confidence": 0.0 to 1.0
}

Supervisor Note: "${trimmed.replace(/"/g, '\\"')}"`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
        apiKey
      )}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      let apiErrorDetail = `HTTP ${response.status}`;
      try {
        const errBody = await response.json();
        if (errBody?.error?.message) {
          apiErrorDetail = errBody.error.message;
        }
      } catch {
        // Ignore non-JSON error body
      }
      throw new Error(`Gemini API request failed (${apiErrorDetail})`);
    }

    const data = await response.json();
    const textOutput: string | undefined =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textOutput) {
      throw new Error('Gemini API returned an empty candidate response.');
    }

    const parsed = JSON.parse(textOutput);
    const category: ReasonCategoryType = VALID_REASON_CATEGORIES.has(
      parsed.reasonCategory
    )
      ? parsed.reasonCategory
      : 'UNCLASSIFIED';

    const confidence =
      typeof parsed.confidence === 'number' &&
      Number.isFinite(parsed.confidence)
        ? parsed.confidence
        : 0;

    if (
      typeof parsed.englishTranslation !== 'string' ||
      parsed.englishTranslation.trim().length === 0
    ) {
      throw new Error('Gemini API JSON response missing englishTranslation.');
    }

    return applyConfidenceGuardrail({
      rawNoteTamil: trimmed,
      englishTranslation: parsed.englishTranslation.trim(),
      reasonCategory: category,
      confidence,
      source: 'GEMINI_LIVE',
    });
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error
        ? err.message
        : 'Unknown Gemini translation failure.';

    return {
      rawNoteTamil: trimmed,
      englishTranslation: `[AI Translation Unavailable: ${errorMessage}]`,
      reasonCategory: 'UNCLASSIFIED',
      confidence: 0,
      needsManualReview: true,
      errorReason: errorMessage,
      source: 'AI_ERROR',
    };
  }
}
