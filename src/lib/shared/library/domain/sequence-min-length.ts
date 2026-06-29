import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

/** Minimum number of motion steps a sequence must have to be saved or published. */
export const MIN_SEQUENCE_STEPS = 2;

/**
 * Number of motion steps from the persisted source of truth.
 *
 * `steps` is derived at load and never persisted; `stepPairings` is the persisted
 * per-step list (one entry per motion step). Prefer it, then the derived `steps`
 * array, then the optional stored `sequenceLength`. Returns 0 when none are present.
 */
export function getPersistedStepCount(sequence: SequenceData): number {
  // stepPairings is the persisted source of truth — use its length when present
  // (including when it's an empty array, which legitimately means zero steps).
  if (sequence.stepPairings !== undefined) {
    return sequence.stepPairings.length;
  }
  // steps is derived at load; a non-empty array is reliable for counting.
  if (sequence.steps?.length) {
    return sequence.steps.length;
  }
  // Fall back to the optional stored length (legacy / pre-hydration).
  return sequence.sequenceLength ?? 0;
}

/** True when a sequence has too few steps to keep — one motion step or fewer. */
export function isOneCountSequence(sequence: SequenceData): boolean {
  return getPersistedStepCount(sequence) < MIN_SEQUENCE_STEPS;
}
