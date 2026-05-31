/**
 * Sequence Transformation Service
 *
 * Composes pure transform functions, binding the shared motion-query and
 * reversal-detector singletons at module scope so call sites can invoke the
 * transforms directly (or via the `sequenceTransformer` bundle for DI).
 *
 * For single-hand transforms (blue or red), these functions pass the required
 * services to derive new positions and look up correct letters.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { TargetHand } from "$lib/shared/create/state/panel-coordination-state.svelte";

import {
  clearSequence as clearSequenceTransform,
  duplicateSequence as duplicateSequenceTransform,
  mirrorSequence as mirrorSequenceTransform,
  flipSequence as flipSequenceTransform,
  rotateSequence as rotateSequenceTransform,
  colorSwapSequence,
  invertSequence as invertSequenceTransform,
  rewindSequence as rewindSequenceTransform,
  shiftStartPosition as shiftStartPositionTransform,
  deriveSequenceLetters as deriveSequenceLettersTransform,
} from "$lib/shared/create/services/sequence-transforms";

import { motionQueryHandler } from "$lib/shared/pictograph/shared/services/motion-query-handler";
import { reversalDetector } from "$lib/shared/create/services/reversal-detector";

export function clearSequence(sequence: SequenceData): SequenceData {
  return clearSequenceTransform(sequence);
}

export function duplicateSequence(
  sequence: SequenceData,
  newName?: string
): SequenceData {
  return duplicateSequenceTransform(sequence, newName);
}

export async function mirrorSequence(
  sequence: SequenceData,
  targetHand: TargetHand = "both"
): Promise<SequenceData> {
  return mirrorSequenceTransform(sequence, motionQueryHandler, targetHand);
}

export async function flipSequence(
  sequence: SequenceData,
  targetHand: TargetHand = "both"
): Promise<SequenceData> {
  return flipSequenceTransform(sequence, motionQueryHandler, targetHand);
}

export function swapColors(sequence: SequenceData): SequenceData {
  // Note: swapColors always operates on both hands - that's its purpose
  return colorSwapSequence(sequence);
}

export async function rotateSequence(
  sequence: SequenceData,
  rotationAmount: number,
  targetHand: TargetHand = "both"
): Promise<SequenceData> {
  return rotateSequenceTransform(
    sequence,
    rotationAmount,
    motionQueryHandler,
    targetHand
  );
}

export async function invertSequence(
  sequence: SequenceData,
  targetHand: TargetHand = "both"
): Promise<SequenceData> {
  return invertSequenceTransform(sequence, motionQueryHandler, targetHand);
}

export async function rewindSequence(
  sequence: SequenceData,
  targetHand: TargetHand = "both"
): Promise<SequenceData> {
  // First, apply the rewind transformation (reverses beat order, swaps start/end positions)
  const rewoundSequence = await rewindSequenceTransform(
    sequence,
    motionQueryHandler,
    targetHand
  );

  // Then recalculate reversals based on the new beat order
  // This is critical because reversals depend on comparing consecutive steps
  // and beat 1 should never have reversals (nothing before it to compare)
  return reversalDetector.processReversals(rewoundSequence);
}

export function shiftStartPosition(
  sequence: SequenceData,
  targetStepNumber: number
): SequenceData {
  return shiftStartPositionTransform(sequence, targetStepNumber);
}

export async function deriveSequenceLetters(
  sequence: SequenceData
): Promise<SequenceData> {
  return deriveSequenceLettersTransform(sequence, motionQueryHandler);
}

/**
 * Object bundle of the sequence-transformer functions, retained so the many
 * create-module dependency-injection call sites keep an object to call
 * `.mirrorSequence(...)` etc. on. The class wrapper was dissolved into the
 * module-level functions above.
 */
export const sequenceTransformer = {
  clearSequence,
  duplicateSequence,
  mirrorSequence,
  flipSequence,
  swapColors,
  rotateSequence,
  invertSequence,
  rewindSequence,
  shiftStartPosition,
  deriveSequenceLetters,
};

/** Structural type of the sequence-transformer bundle, for DI parameter typing. */
export type SequenceTransformer = typeof sequenceTransformer;
