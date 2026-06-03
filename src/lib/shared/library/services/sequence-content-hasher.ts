/**
 * sequence-content-hasher - Computes a deterministic SHA-256 hash from motion content
 *
 * The hash is the sequence's identity as a physical movement pattern.
 * Same hash = same variation. Different hash = different variation.
 *
 * Only motion-defining fields contribute to the hash. Everything that's a user
 * annotation (name, tags, visibility, thumbnails) is excluded.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export async function computeHash(sequence: SequenceData): Promise<string> {
  const content = extractContent(sequence);
  const json = JSON.stringify(content);
  const buffer = new TextEncoder().encode(json);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function extractContent(sequence: SequenceData): unknown {
  // Resolve the sequence-level grid mode once. Steps and start positions
  // that don't specify their own gridMode inherit this value. Normalizing
  // here prevents undefined-vs-"diamond" from producing different hashes
  // for sequences that are physically identical.
  const seqGridMode = sequence.gridMode ?? null;

  return {
    gridMode: seqGridMode,
    startPosition: extractStartPosition(
      sequence.startPosition ?? sequence.startingPosition,
      seqGridMode
    ),
    steps: sequence.steps.map((step) =>
      extractStep(step, seqGridMode)
    ),
  };
}

function extractStartPosition(
  sp: StartPositionData | undefined,
  inheritedGridMode: string | null
): unknown {
  if (!sp) return null;
  return {
    motions: extractMotions(sp.motions),
    gridMode: sp.gridMode ?? inheritedGridMode,
  };
}

function extractStep(
  step: StepData,
  inheritedGridMode: string | null
): unknown {
  return {
    letter: step.letter ?? null,
    blueReversal: step.blueReversal,
    redReversal: step.redReversal,
    isBlank: step.isBlank,
    duration: step.duration,
    motions: extractMotions(step.motions),
    gridMode: step.gridMode ?? inheritedGridMode,
  };
}

function extractMotions(
  motions: Partial<Record<MotionColor, MotionData | undefined>>
): unknown {
  // Sort by color key for determinism (BLUE before RED alphabetically)
  const sorted = [MotionColor.BLUE, MotionColor.RED]
    .filter((color) => motions[color])
    .map((color) => [color, extractMotion(motions[color]!)]);
  return Object.fromEntries(sorted);
}

// Intentionally excluded from hash:
// - arrowPlacementData, propPlacementData: rendering/layout concerns derived from motion fields
// - propType: viewer preference, not sequence identity (overridden by global settings)
// - isVisible, color, arrowLocation: rendering state, not motion definition
function extractMotion(m: MotionData): unknown {
  return {
    motionType: m.motionType,
    rotationDirection: m.rotationDirection,
    startLocation: m.startLocation,
    endLocation: m.endLocation,
    turns: m.turns,
    startOrientation: m.startOrientation,
    endOrientation: m.endOrientation,
    handPath: m.handPath ?? null,
    gridMode: m.gridMode,
    skewSteps: m.skewSteps ?? null,
    skewDir: m.skewDir ?? null,
  };
}
