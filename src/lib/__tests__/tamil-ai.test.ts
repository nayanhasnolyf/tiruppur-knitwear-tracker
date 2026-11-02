import { describe, it, expect } from 'vitest';
import {
  classifyTamilFloorNote,
  classifyTamilFloorNoteFallback,
} from '../tamil-ai';

describe('Tamil-to-English AI Reason Classifier & Fallback Guardrails (tamil-ai)', () => {
  it('1. Accurately translates and classifies Tamil machine breakdown note (MACHINE_BREAKDOWN)', async () => {
    const note =
      'ஊசி தட்டு உடைந்துவிட்டது, 2 தையல் இயந்திரங்கள் 4 மணி நேரம் நின்றன';
    const result = await classifyTamilFloorNote(note);

    expect(result.reasonCategory).toBe('MACHINE_BREAKDOWN');
    expect(result.englishTranslation).toContain('Needle plate broke');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.needsManualReview).toBe(false);
  });

  it('2. Accurately translates and classifies Tamil collar oil stain rework note (QUALITY_REWORK)', async () => {
    const note =
      'காலர் பகுதியில் எண்ணெய் கறை உள்ளது, மறுபடியும் வாஷிங் செய்ய வேண்டும்';
    const result = await classifyTamilFloorNote(note);

    expect(result.reasonCategory).toBe('QUALITY_REWORK');
    expect(result.englishTranslation).toContain('Oil stain found on collar area');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.needsManualReview).toBe(false);
  });

  it('3. Detects EB power cut (POWER_CUT) and fabric defect (FABRIC_DEFECT) notes in Tamil', async () => {
    const powerResult = await classifyTamilFloorNote(
      'இன்று காலை 3 மணி நேரம் மின்சாரம் இல்லை, ஜெனரேட்டர் பழுது'
    );
    expect(powerResult.reasonCategory).toBe('POWER_CUT');
    expect(powerResult.confidence).toBeGreaterThanOrEqual(0.85);
    expect(powerResult.needsManualReview).toBe(false);

    const fabricResult = await classifyTamilFloorNote(
      'துணியில் சாயம் வேறுபாடு மற்றும் சிறிய ஓட்டை உள்ளது'
    );
    expect(fabricResult.reasonCategory).toBe('FABRIC_DEFECT');
    expect(fabricResult.confidence).toBeGreaterThanOrEqual(0.85);
    expect(fabricResult.needsManualReview).toBe(false);
  });

  it('4. Flags vague/ambiguous Tamil floor notes ("இன்று வேலை சற்று தாமதம்") as UNCLASSIFIED with confidence < 0.70 and needsManualReview = true', async () => {
    const vagueNote = 'இன்று வேலை சற்று தாமதம், மெதுவாக நடக்கிறது';
    const result = await classifyTamilFloorNote(vagueNote);

    expect(result.reasonCategory).toBe('UNCLASSIFIED');
    expect(result.confidence).toBeLessThan(0.7);
    expect(result.needsManualReview).toBe(true);
    expect(result.englishTranslation).toContain('requires merchandiser review');
  });

  it('5. Handles empty or whitespace-only Tamil input cleanly without throwing', async () => {
    const emptyResult = classifyTamilFloorNoteFallback('   ');

    expect(emptyResult.rawNoteTamil).toBe('');
    expect(emptyResult.englishTranslation).toBe('');
    expect(emptyResult.reasonCategory).toBe('UNCLASSIFIED');
    expect(emptyResult.confidence).toBe(0);
    expect(emptyResult.needsManualReview).toBe(false);
  });

  it('6. Detects worker shortage (WORKER_SHORTAGE) and printing/rain delay (PRINT_WASH_DELAY)', async () => {
    const workerResult = await classifyTamilFloorNote(
      'மழை காரணமாக 6 டெய்லர் ஆட்கள் இன்று விடுமுறை'
    );
    expect(workerResult.reasonCategory).toBe('WORKER_SHORTAGE');
    expect(workerResult.needsManualReview).toBe(false);

    const printResult = await classifyTamilFloorNote(
      'பிரிண்டிங் கியூரிங் தாமதம், மழை காரணமாக காயவில்லை'
    );
    expect(printResult.reasonCategory).toBe('PRINT_WASH_DELAY');
    expect(printResult.needsManualReview).toBe(false);
  });
});
