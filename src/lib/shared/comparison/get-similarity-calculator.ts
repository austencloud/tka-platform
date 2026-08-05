/**
 * Pure comparison arithmetic over plain sequence data — no DOM, no storage, no
 * network (verified against `services/similarity-calculator.ts`, whose only
 * value imports are `MotionColor` and `isVisibleMotion`). The `browser` guard
 * was dropped with the canonicalizer's (see `get-sequence-canonicalizer.ts`)
 * for the same reason: with it in place the browser took the calculator path
 * while every unit test took the caller's fallback, so the shipped path was the
 * untested one.
 */

import { SimilarityCalculator } from "./services/similarity-calculator";
import { getStepSignatureGenerator } from "./get-step-signature-generator";
import { getSequenceAligner } from "./get-sequence-aligner";

let instance: SimilarityCalculator | null = null;

export function getSimilarityCalculator(): SimilarityCalculator {
  return (instance ??= new SimilarityCalculator(
    getStepSignatureGenerator(),
    getSequenceAligner()
  ));
}
