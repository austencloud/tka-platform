/**
 * Pure signature arithmetic over a single motion — no DOM, no storage. The
 * `browser` guard was dropped with the canonicalizer's (see
 * `get-sequence-canonicalizer.ts`); this getter sits on that dependency chain.
 */

import { MotionSignatureGenerator } from "./services/motion-signature-generator";

let instance: MotionSignatureGenerator | null = null;

export function getMotionSignatureGenerator(): MotionSignatureGenerator {
  return (instance ??= new MotionSignatureGenerator());
}
