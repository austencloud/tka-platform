/**
 * Pure grid arithmetic over plain step data — no DOM, no storage, no network
 * (verified against `services/spatial-transform-detector.ts`, whose only value
 * imports are the grid/motion enums and a location map). The `browser` guard
 * was dropped with the canonicalizer's (see `get-sequence-canonicalizer.ts`);
 * this getter sits on that dependency chain and carried the same split, where
 * the browser took the real path while every unit test took the caller's
 * fallback.
 */

import { SpatialTransformDetector } from "./services/spatial-transform-detector";

let instance: SpatialTransformDetector | null = null;

export function getSpatialTransformDetector(): SpatialTransformDetector {
  return (instance ??= new SpatialTransformDetector());
}
