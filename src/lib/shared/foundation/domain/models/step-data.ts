/**
 * Beat Domain Model - Shared
 *
 * The app's working step type: a canonical `@tka/tka-types` `Step` whose
 * motions carry the app's view fields (`MotionData` = Motion + required view
 * fields). Since 2026-07-02 this extends the canonical `Step` directly, so
 * every `StepData` IS a `Step` by declaration — no bridge needed.
 *
 * BOTH hands are required. A hand that is "not really there" (blank beat,
 * assembly in progress, stripped solo view) is an invisible static
 * placeholder — see `createPlaceholderMotion` and the absence-encoding design
 * (docs/superpowers/specs/active/2026-07-02-stepdata-step-absence-encoding-design.md).
 * One-hand PICTOGRAPHS remain legal at the render layer via `PictographData`'s
 * partial motions; StepData stays structurally assignable to PictographData.
 *
 * NOTE: StepData represents actual steps in a sequence (stepNumber >= 1).
 * For start positions, use StartPositionData instead.
 */
import type { Step } from "@tka/tka-types";
import type { Letter } from "./letter";
import type { GridPosition, GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";

export interface StepMotions {
  readonly blue: MotionData;
  readonly red: MotionData;
}

export interface StepData extends Step {
  // Structurally identical to the canonical fields; re-declared with the
  // app-local imports so consumers keep their existing import graph.
  readonly letter: Letter | null;
  readonly startPosition: GridPosition | null;
  readonly endPosition: GridPosition | null;
  readonly gridMode?: GridMode;
  readonly motions: StepMotions;

  // Beat context properties (app extras; reversals are re-derived on read by
  // processReversals — canonical Step deliberately does not store them)
  readonly duration: number;
  readonly blueReversal: boolean;
  readonly redReversal: boolean;
  readonly isBlank: boolean;

  // Pictograph-level extras formerly inherited from PictographData
  readonly betaSwapped?: boolean;
  readonly category?: number | null;

  // App-level runtime discriminator (pictograph-type-guards distinguishes
  // StepData / StartPositionData / bare PictographData by it)
  readonly isStep?: true;
  // Selection state (UI extra; the id-keyed selection store is the successor)
  readonly isSelected?: boolean;
}

// Compile-time proof the redefinition holds: every StepData is a canonical
// Step AND remains assignable to the render layer's PictographData.
type Assert<T extends true> = T;
type _StepDataIsCanonicalStep = Assert<StepData extends Step ? true : false>;
type _StepDataIsPictographData = Assert<
  StepData extends import("$lib/shared/pictograph/shared/domain/models/pictograph-data").PictographData
    ? true
    : false
>;
