/**
 * Sequence Hash Utility
 *
 * Generates a deterministic hash from sequence content for dirty detection.
 * Used to determine if a sequence has been modified since last save.
 *
 * INCLUDES (content that affects the sequence):
 * - Beats and their motions
 * - Start position
 * - Grid mode
 * - Prop type
 *
 * EXCLUDES (metadata that doesn't affect content):
 * - ID, name, word
 * - Timestamps
 * - Thumbnails
 * - Tags, favorites
 * - Placement data (derived)
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { BeatData } from "../domain/models/BeatData";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";

/**
 * Simple string hash function (djb2 algorithm)
 * Fast, deterministic, good distribution
 */
function djb2Hash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) + hash + char; // hash * 33 + char
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Return as positive hex string
  return (hash >>> 0).toString(16);
}

/**
 * Extract hashable motion data (exclude derived/placement data)
 */
function hashableMotion(motion: MotionData | undefined): object | null {
  if (!motion) return null;

  return {
    mt: motion.motionType,
    rd: motion.rotationDirection,
    sl: motion.startLocation,
    el: motion.endLocation,
    t: motion.turns,
    so: motion.startOrientation,
    eo: motion.endOrientation,
    v: motion.isVisible,
    pt: motion.propType,
    c: motion.color,
    gm: motion.gridMode,
  };
}

/**
 * Extract hashable beat data
 */
function hashableBeat(beat: BeatData): object {
  return {
    bn: beat.beatNumber,
    br: beat.blueReversal,
    rr: beat.redReversal,
    bl: beat.isBlank,
    bm: hashableMotion(beat.motions?.blue),
    rm: hashableMotion(beat.motions?.red),
    // Include start/end positions from PictographData
    sp: beat.startPosition,
    ep: beat.endPosition,
    lt: beat.letter,
  };
}

/**
 * Extract hashable start position data
 */
function hashableStartPosition(
  startPos: PictographData | BeatData | undefined | null
): object | null {
  if (!startPos) return null;

  // Check if it's BeatData (has beatNumber) or PictographData
  const isBeatData = "beatNumber" in startPos;

  return {
    sp: startPos.startPosition,
    ep: startPos.endPosition,
    lt: startPos.letter,
    bm: hashableMotion(startPos.motions?.blue),
    rm: hashableMotion(startPos.motions?.red),
    // Include beat-specific fields if it's BeatData
    ...(isBeatData && {
      br: (startPos as BeatData).blueReversal,
      rr: (startPos as BeatData).redReversal,
    }),
  };
}

/**
 * Generate a deterministic hash for a sequence.
 * Used to detect if sequence content has changed.
 *
 * @param sequence - The sequence to hash
 * @returns Hash string, or empty string if sequence is null/empty
 */
export function generateSequenceHash(sequence: SequenceData | null): string {
  if (!sequence) return "";
  if (!sequence.beats || sequence.beats.length === 0) {
    // If no beats but has start position, hash that
    const startPos = sequence.startPosition || sequence.startingPositionBeat;
    if (startPos) {
      const hashable = {
        sp: hashableStartPosition(startPos),
        gm: sequence.gridMode,
        // propType removed from hash - prop type is viewer preference, not sequence identity
      };
      return djb2Hash(JSON.stringify(hashable));
    }
    return "";
  }

  // Build hashable structure
  // NOTE: propType excluded - prop type is viewer preference, not sequence identity
  const hashable = {
    b: sequence.beats.map(hashableBeat),
    sp: hashableStartPosition(
      sequence.startPosition || sequence.startingPositionBeat
    ),
    gm: sequence.gridMode,
  };

  return djb2Hash(JSON.stringify(hashable));
}

/**
 * Compare two sequences to see if their content is equivalent.
 * Uses hash comparison for efficiency.
 */
export function areSequencesEqual(
  a: SequenceData | null,
  b: SequenceData | null
): boolean {
  const hashA = generateSequenceHash(a);
  const hashB = generateSequenceHash(b);
  return hashA === hashB;
}
