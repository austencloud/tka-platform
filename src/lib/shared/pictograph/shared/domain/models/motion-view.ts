/**
 * MotionView - view-layer data attached to a Motion when rendering a pictograph.
 *
 * The core `Motion` (from `@tka/tka-types`) describes the structural/engine-compatible
 * contribution of one hand to a single step: motion type, locations, rotation direction,
 * orientations, turns, plane, color, and prefloat markers.
 *
 * `MotionView` carries the visual/runtime concerns that belong to the renderer, not
 * the engine: visibility flags, prop type preference, computed arrow location, grid
 * mode, placement data, hand path direction, and skew metadata.
 *
 * Paired with a core `Motion` via composition - do NOT embed these fields inside
 * `Motion` or `@tka/tka-types`. Consumers that need both compose at the call site:
 *
 *   type MotionWithView = Motion & MotionView;
 *
 * See docs/superpowers/specs/2026-04-20-sequence-engine-unification-design.md.
 */

import type { Motion } from "@tka/tka-types";
import type { ArrowPlacementData } from "../../../arrow/positioning/placement/domain/arrow-placement-data";
import type { PropPlacementData } from "../../../prop/domain/models/prop-placement-data";
import type { PropType } from "../../../prop/domain/enums/prop-type";
import type {
  GridLocation,
  GridMode,
} from "../../../grid/domain/enums/grid-enums";
import type { HandPath, SkewDirection } from "../enums/pictograph-enums";

export interface MotionView {
  /** Whether this motion's visuals render. Default: true. */
  readonly isVisible?: boolean;

  /** Prop appearance selection. Viewer preference, overridden by global settings at render time. */
  readonly propType?: PropType;

  /**
   * Resolved arrow grid location. Calculated by `ArrowLocationCalculator` from the
   * core Motion's start/end locations + motion type + grid mode. Never defaulted.
   */
  readonly arrowLocation?: GridLocation;

  /** Grid mode at render time. Diamond (cardinal) vs Box (intercardinal). */
  readonly gridMode?: GridMode;

  /** Per-motion arrow placement adjustments produced by the placement pipeline. */
  readonly arrowPlacementData?: ArrowPlacementData;

  /** Per-motion prop placement adjustments produced by the placement pipeline. */
  readonly propPlacementData?: PropPlacementData;

  /**
   * Hand path direction. Essential for floats (no rotation direction to derive from);
   * stored explicitly for all motion types to keep data self-documenting.
   */
  readonly handPath?: HandPath | null;

  /** Number of 45 degree steps the motion travels. 0 = normal path, 1+ = skewed. */
  readonly skewSteps?: number | null;

  /** Skew direction sign. Only meaningful when `skewSteps > 0`. */
  readonly skewDir?: SkewDirection | null;

  /**
   * Per-step path-shape override for animation interpolation (arc/linear/concave).
   * Absent = use the global pathShape setting. Lives here, not on core `Motion`:
   * it is a render/animation concern, not engine structure. Drives
   * PropInterpolator / HandPathAnimator (single-frame renders never read it).
   */
  readonly pathShape?: "arc" | "linear" | "concave";
}

/**
 * Motion composed with its view-layer fields. Use at call sites that read both
 * structural (engine) and visual (renderer) concerns. Renderers, placement
 * services, and anything reading `isVisible` / `propType` / `arrowLocation`
 * should annotate inputs as `MotionWithView` rather than the deprecated
 * `MotionData`.
 *
 * ## Migration blockers - all resolved
 *
 * ### Resolved 2026-04-20
 *
 * `@tka/tka-types` Motion.plane is now optional (commit 900965c4). The guard
 * was loosened to match (commit a299c806). `createMotion` still defaults the
 * runtime value to `Plane.wall` when omitted.
 *
 * ### Resolved by 2026-07-01 - enum nominality no longer blocks
 *
 * The 2026-04-20 blocker ("app enums are nominal TS enums, tka-types uses
 * const-as-union") no longer holds: every enum the lean `Motion` touches
 * (MotionType, GridLocation, GridMode, RotationDirection, Orientation,
 * HandSide and Plane have since been converted to const-as-union on the app
 * side, so the types are structurally identical across the package boundary.
 * Verified empirically 2026-07-01: `const m: Motion = motionData` and
 * `const mv: MotionWithView = motionData` both compile with zero errors
 * (probe validated with a deliberate-error canary to prove the file was
 * actually checked). `HandPath` and `SkewDirection` remain nominal TS enums
 * but exist only on the app side (`MotionView`) - they never cross into
 * `@tka/tka-types`, so their nominality is irrelevant to the migration.
 *
 * The remaining adoption work is therefore mechanical retyping (interfaces
 * and impls migrate together to avoid TS2416), not type-system surgery.
 */
export type MotionWithView = Motion & MotionView;
