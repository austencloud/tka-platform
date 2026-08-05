/**
 * Pure signature arithmetic over plain motion/step data — no DOM, no storage.
 * The `browser` guard was dropped with the canonicalizer's (see
 * `get-sequence-canonicalizer.ts`); this getter sits on that dependency chain.
 */

import { StepSignatureGenerator } from "./services/step-signature-generator";
import { getMotionSignatureGenerator } from "./get-motion-signature-generator";

let instance: StepSignatureGenerator | null = null;

export function getStepSignatureGenerator(): StepSignatureGenerator {
  return (instance ??= new StepSignatureGenerator(
    getMotionSignatureGenerator()
  ));
}
