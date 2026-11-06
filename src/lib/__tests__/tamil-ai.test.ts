import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { classifyTamilFloorNote } from '../tamil-ai';

describe('Tamil-to-English Gemini AI Classifier & Honest Error Reporting (tamil-ai)', () => {
  const originalEnv = process.env.GEMINI_API_KEY;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalEnv;
    }
    global.fetch = originalFetch;
  });

  it('1. Handles empty or whitespace-only Tamil input cleanly without calling Gemini', async () => {
    const emptyResult = await classifyTamilFloorNote('   ');

    expect(emptyResult.rawNoteTamil).toBe('');
    expect(emptyResult.englishTranslation).toBe('');
    expect(emptyResult.reasonCategory).toBe('UNCLASSIFIED');
    expect(emptyResult.confidence).toBe(0);
    expect(emptyResult.needsManualReview).toBe(false);
    expect(emptyResult.source).toBe('EMPTY_INPUT');
  });

  it('2. Reports explicit AI error when GEMINI_API_KEY is missing in .env (no fake dictionary fallback)', async () => {
    delete process.env.GEMINI_API_KEY;

    const note =
      'ஊசி தட்டு உடைந்துவிட்டது, 2 தையல் இயந்திரங்கள் 4 மணி நேரம் நின்றன';
    const result = await classifyTamilFloorNote(note);

    expect(result.reasonCategory).toBe('UNCLASSIFIED');
    expect(result.confidence).toBe(0);
    expect(result.needsManualReview).toBe(true);
    expect(result.englishTranslation).toBe(
      '[AI Error: GEMINI_API_KEY is not configured in .env]'
    );
    expect(result.errorReason).toBe(
      'GEMINI_API_KEY is missing in environment variables.'
    );
    expect(result.source).toBe('AI_ERROR');
  });

  it('3. Parses high-confidence Gemini 2.5 Flash JSON response (>= 0.70) and sets needsManualReview = false', async () => {
    process.env.GEMINI_API_KEY = 'test-live-gemini-key';

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    englishTranslation:
                      'Needle plate broke, 2 sewing machines stopped for 4 hours',
                    reasonCategory: 'MACHINE_BREAKDOWN',
                    confidence: 0.94,
                  }),
                },
              ],
            },
          },
        ],
      }),
    } as unknown as Response);

    const note =
      'ஊசி தட்டு உடைந்துவிட்டது, 2 தையல் இயந்திரங்கள் 4 மணி நேரம் நின்றன';
    const result = await classifyTamilFloorNote(note);

    expect(result.source).toBe('GEMINI_LIVE');
    expect(result.reasonCategory).toBe('MACHINE_BREAKDOWN');
    expect(result.englishTranslation).toBe(
      'Needle plate broke, 2 sewing machines stopped for 4 hours'
    );
    expect(result.confidence).toBe(0.94);
    expect(result.needsManualReview).toBe(false);
  });

  it('4. Enforces low-confidence (< 0.70) guardrail on ambiguous Tamil floor notes from Gemini', async () => {
    process.env.GEMINI_API_KEY = 'test-live-gemini-key';

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    englishTranslation:
                      'Work is progressing slightly slowly today',
                    reasonCategory: 'UNCLASSIFIED',
                    confidence: 0.42,
                  }),
                },
              ],
            },
          },
        ],
      }),
    } as unknown as Response);

    const vagueNote = 'இன்று வேலை சற்று மெதுவாக நடக்கிறது';
    const result = await classifyTamilFloorNote(vagueNote);

    expect(result.source).toBe('GEMINI_LIVE');
    expect(result.reasonCategory).toBe('UNCLASSIFIED');
    expect(result.confidence).toBe(0.42);
    expect(result.needsManualReview).toBe(true);
  });

  it('5. Catches Gemini API HTTP / network errors and surfaces the exact failure reason with needsManualReview = true', async () => {
    process.env.GEMINI_API_KEY = 'invalid-gemini-key';

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          message: 'API key not valid. Please pass a valid API key.',
        },
      }),
    } as unknown as Response);

    const result = await classifyTamilFloorNote(
      'காலர் பகுதியில் எண்ணெய் கறை உள்ளது'
    );

    expect(result.source).toBe('AI_ERROR');
    expect(result.reasonCategory).toBe('UNCLASSIFIED');
    expect(result.confidence).toBe(0);
    expect(result.needsManualReview).toBe(true);
    expect(result.errorReason).toContain(
      'API key not valid. Please pass a valid API key.'
    );
    expect(result.englishTranslation).toContain('[AI Translation Unavailable:');
  });
});
