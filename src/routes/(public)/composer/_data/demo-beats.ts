/**
 * Derives pictograph demo data for the /composer marketing page from the
 * baked CΨΩX fixture (see $lib/shared/landing/data/demo-sequence.json — one
 * real released rotated LOOP).
 *
 * The guide's pictograph components take PictographData; the fixture's steps
 * are StepData with the same motion payloads, so the mapping is a projection.
 */
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import demoJson from "$lib/shared/landing/data/demo-sequence.json";

export const DEMO_SEQUENCE = demoJson as unknown as SequenceData;

type RawStep = {
  id: string;
  letter?: string;
  motions: Record<string, unknown>;
};

/** One of each letter in the demo word (C Ψ Ω X), for the Learn section's
 *  letter-pairing row. */
export const DEMO_LETTER_BEATS: PictographData[] = (demoJson.steps as unknown as RawStep[])
  .slice(0, 4)
  .map(
    (step) =>
      ({
        id: step.id,
        letter: step.letter ?? null,
        motions: step.motions,
        gridMode: demoJson.gridMode,
      }) as unknown as PictographData
  );
