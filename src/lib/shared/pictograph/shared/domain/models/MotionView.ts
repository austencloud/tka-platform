/**
 * MotionView — view-layer data attached to a Motion when rendering a pictograph.
 *
 * The core `Motion` (from `@tka/tka-types`) describes the structural/engine-compatible
 * contribution of one hand to a single step: motion type, locations, rotation direction,
 * orientations, turns, plane, color, and prefloat markers.
 *
 * `MotionView` carries the visual/runtime concerns that belong to the renderer, not
 * the engine: visibility flags, prop type preference, computed arrow location, grid
 * mode, placement data, hand path direction, and skew metadata.
 *
 * Paired with a core `Motion` via composition — do NOT embed these fields inside
 * `Motion` or `@tka/tka-types`. Consumers that need both compose at the call site:
 *
 *   type MotionWithView = Motion & MotionView;
 *
 * See docs/superpowers/specs/2026-04-20-sequence-engine-unification-design.md.
 */

import type { Motion } from "@tka/tka-types";
import type { ArrowPlacementData } from "../../../arrow/positioning/placement/domain/ArrowPlacementData";
import type { PropPlacementData } from "../../../prop/domain/models/PropPlacementData";
import type { PropType } from "../../../prop/domain/enums/PropType";
import type { GridLocation, GridMode } from "../../../grid/domain/enums/grid-enums";
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
}

/**
 * Motion composed with its view-layer fields. Use at call sites that read both
 * structural (engine) and visual (renderer) concerns. Renderers, placement
 * services, and anything reading `isVisible` / `propType` / `arrowLocation`
 * should annotate inputs as `MotionWithView` rather than the deprecated
 * `MotionData`.
 *
 * ## Known migration blocker — `plane` required vs optional
 *
 * `@tka/tka-types` declares `Motion.plane: Plane` (required). The app's
 * `MotionData.plane?: Plane` (optional). Because `MotionWithView` intersects
 * the engine's required `plane` with MotionView's omission, the composed type
 * inherits the required form.
 *
 * Existing app call sites construct motions without setting `plane`, and many
 * consumers treat `motion.plane` as possibly undefined. A naive swap from
 * `MotionData` to `Motion` or `MotionWithView` therefore produces cascading
 * TS2345 errors at the construction sites.
 *
 * Before a full migration can land, one of the following must happen:
 *   1. Every motion constructor defaults `plane: Plane.WALL` — remove the
 *      `undefined` escape hatch from the runtime data.
 *   2. `@tka/tka-types` loosens `Motion.plane` to optional. Engine would need
 *      to decide the default-to-wall policy at read time.
 *
 * Option 1 is consistent with the engine's existing "undefined means wall"
 * comment and is the intended direction.
 */
export type MotionWithView = Motion & MotionView;
