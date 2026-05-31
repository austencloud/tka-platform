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
 * ## Migration blockers - resolved and outstanding
 *
 * ### Resolved 2026-04-20
 *
 * `@tka/tka-types` Motion.plane is now optional (commit 900965c4). The guard
 * was loosened to match (commit a299c806). `createMotion` still defaults the
 * runtime value to `Plane.wall` when omitted.
 *
 * ### Outstanding - deeper enum incompatibilities
 *
 * The bigger obstacle to swapping `MotionData` -> `Motion` in consumers:
 *
 *   1. **App enums are nominal TS `enum` types, tka-types uses `const`-as-union.**
 *      `enum MotionType { PRO = "pro" }` makes `MotionType.PRO` nominally
 *      distinct from `"pro"` at the type level. A caller holding
 *      `MotionData` (app enums) cannot directly satisfy a parameter typed
 *      as `Motion` (tka-types unions) without a cast, even though the
 *      runtime values match.
 *
 *   2. **`Plane` value set disagrees.** App `Plane` has 9 values (WALL,
 *      WHEEL, FLOOR, plus 6 fusion planes). tka-types `Plane` also has 9
 *      values now (wall, wheel, floor, plus 6 fusion planes), but
 *      `MotionData.plane: Plane` (app enum) is still nominally distinct
 *      from `Motion.plane: Plane` (tka-types const-as-union) due to
 *      issue #1 above.
 *
 *   3. **Interfaces still declare `MotionData`.** Swapping an implementation
 *      without also swapping the interface triggers TS2416 "not assignable
 *      to base type". Interface and impl must migrate together.
 *
 * A clean migration requires one of:
 *   - Unify `Plane` (merge fusion planes into tka-types, or extract a
 *     shared 3D enum package).
 *   - Convert app enums to `const`-as-union so values become structurally
 *     assignable.
 *   - Introduce `MotionData` as a structurally-compatible alias of
 *     `Motion & MotionView` (the Motion half using app enums re-exported
 *     from tka-types as type aliases).
 *
 * Until this prerequisite is addressed, Category A / B / C migration of
 * consumers from `MotionData` is blocked. See session log on 2026-04-20.
 */
export type MotionWithView = Motion & MotionView;
