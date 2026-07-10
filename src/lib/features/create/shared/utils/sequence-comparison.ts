/**
 * Sequence Comparison Utilities
 *
 * Deep equality checks for sequences to determine if they are identical.
 * Used to skip confirmation modals when editing sequences that are already loaded.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
import type { Step } from "@tka/tka-types";

/**
 * Compare two sequences for deep equality.
 * Compares the actual sequence content (steps and start positions), not metadata like id, name, etc.
 *
 * @param seq1 First sequence to compare
 * @param seq2 Second sequence to compare
 * @returns true if sequences have identical content (steps + start positions)
 */
export function areSequencesEqual(
  seq1: SequenceData | null | undefined,
  seq2: SequenceData | null | undefined
): boolean {
  // Handle null/undefined cases
  if (!seq1 && !seq2) return true;
  if (!seq1 || !seq2) return false;

  // Compare beat arrays
  if (seq1.steps.length !== seq2.steps.length) return false;

  // Deep compare each beat
  for (let i = 0; i < seq1.steps.length; i++) {
    if (!areBeatsEqual(seq1.steps[i], seq2.steps[i])) {
      return false;
    }
  }

  // Compare start positions (handle both startPosition and legacy startingPosition)
  const start1 = seq1.startPosition || seq1.startingPosition;
  const start2 = seq2.startPosition || seq2.startingPosition;

  if (!start1 && !start2) return true;
  if (!start1 || !start2) return false;

  return areStartPositionsEqual(start1, start2);
}

/**
 * Deep compare two beat/pictograph objects
 */
function areBeatsEqual(
  step1: Step | undefined,
  step2: Step | undefined
): boolean {
  if (!step1 && !step2) return true;
  if (!step1 || !step2) return false;

  // Compare critical properties that define a beat's identity
  // Using JSON.stringify for deep comparison of nested motion objects
  try {
    return JSON.stringify(step1) === JSON.stringify(step2);
  } catch {
    // Fallback to shallow comparison if JSON.stringify fails
    return step1 === step2;
  }
}

/**
 * Deep compare two start position objects
 */
function areStartPositionsEqual(
  pos1: StartPositionData | undefined,
  pos2: StartPositionData | undefined
): boolean {
  if (!pos1 && !pos2) return true;
  if (!pos1 || !pos2) return false;

  // Compare critical properties that define a start position's identity
  try {
    return JSON.stringify(pos1) === JSON.stringify(pos2);
  } catch {
    // Fallback to shallow comparison if JSON.stringify fails
    return pos1 === pos2;
  }
}
