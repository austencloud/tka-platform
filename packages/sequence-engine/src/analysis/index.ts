/**
 * Analysis Layer
 *
 * Sequence analysis tools: reversal detection, motion signals, constraint
 * checking, word feasibility.
 *
 * `deriveReversals` is THE canonical reversal detector (hand-arc aware,
 * loop-wrap capable). The former `ReversalDetector` class (a third,
 * rotation-only implementation with divergent semantics) was deleted
 * 2026-07-05 — it had no consumers.
 */

export {
  deriveReversals,
  type StepReversals,
  type DeriveReversalsOptions,
  type ReversalStepLike,
} from "./deriveReversals.js";

export {
  handArcDirection,
  propRotationDirection,
  type ArcDirection,
  type PropRotation,
  type MotionSignalSource,
} from "./motion-signals.js";
