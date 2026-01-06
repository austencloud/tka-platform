/**
 * Sequence Comparison Utilities
 *
 * Deep equality checks for sequences to determine if they are identical.
 * Used to skip confirmation modals when editing sequences that are already loaded.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { BeatData } from "../domain/models/BeatData";
import type { StartPositionData } from "../domain/models/StartPositionData";

/**
 * Compare two sequences for deep equality.
 * Compares the actual sequence content (beats and start positions), not metadata like id, name, etc.
 *
 * @param seq1 First sequence to compare
 * @param seq2 Second sequence to compare
 * @returns true if sequences have identical content (beats + start positions)
 */
export function areSequencesEqual(
  seq1: SequenceData | null | undefined,
  seq2: SequenceData | null | undefined
): boolean {
  // Handle null/undefined cases
  if (!seq1 && !seq2) return true;
  if (!seq1 || !seq2) return false;

  // Compare beat arrays
  if (seq1.beats.length !== seq2.beats.length) return false;

  // Deep compare each beat
  for (let i = 0; i < seq1.beats.length; i++) {
    if (!areBeatsEqual(seq1.beats[i], seq2.beats[i])) {
      return false;
    }
  }

  // Compare start positions (handle both startPosition and legacy startingPositionBeat)
  const start1 = seq1.startPosition || seq1.startingPositionBeat;
  const start2 = seq2.startPosition || seq2.startingPositionBeat;

  if (!start1 && !start2) return true;
  if (!start1 || !start2) return false;

  return areStartPositionsEqual(start1, start2);
}

/**
 * Deep compare two beat/pictograph objects
 */
function areBeatsEqual(
  beat1: BeatData | undefined,
  beat2: BeatData | undefined
): boolean {
  if (!beat1 && !beat2) return true;
  if (!beat1 || !beat2) return false;

  // Compare critical properties that define a beat's identity
  // Using JSON.stringify for deep comparison of nested motion objects
  try {
    return JSON.stringify(beat1) === JSON.stringify(beat2);
  } catch {
    // Fallback to shallow comparison if JSON.stringify fails
    return beat1 === beat2;
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
