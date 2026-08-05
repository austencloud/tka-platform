/**
 * Pure dynamic-programming alignment over plain step data — no DOM, no storage,
 * no network (verified against `services/sequence-aligner.ts`, which imports
 * only types). The `browser` guard was dropped with the canonicalizer's (see
 * `get-sequence-canonicalizer.ts`); this getter sits on that dependency chain
 * and carried the same split, where the browser took the real path while every
 * unit test took the caller's fallback.
 */

import { SequenceAligner } from "./services/sequence-aligner";
import { getStepSignatureGenerator } from "./get-step-signature-generator";
import { getSpatialTransformDetector } from "./get-spatial-transform-detector";

let instance: SequenceAligner | null = null;

export function getSequenceAligner(): SequenceAligner {
  return (instance ??= new SequenceAligner(
    getStepSignatureGenerator(),
    getSpatialTransformDetector()
  ));
}
