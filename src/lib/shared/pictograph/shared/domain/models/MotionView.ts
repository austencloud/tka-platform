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
