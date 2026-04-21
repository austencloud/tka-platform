/**
 * Motion — one hand's contribution to a single step.
 *
 * Canonical replacement for:
 *   - `MotionData` in packages/sequence-engine/src/core/types/sequence-engine-types.ts
 *   - `MotionData` in src/lib/shared/pictograph/** (app copy)
 *
 * Typed by enum, not string. Immutable by contract — all fields readonly.
 * Use the builders in `./builders.ts` to construct; they runtime-validate
 * enum membership and freeze the returned object.
 */
import type { MotionType } from "./motion-type.js";
import type { RotationDirection } from "./rotation-direction.js";
import type { Orientation } from "./orientation.js";
import type { GridLocation } from "./grid.js";
import type { Plane } from "./plane.js";
import type { PropColor } from "./prop-color.js";

export interface Motion {
  readonly motionType: MotionType;
  readonly startLocation: GridLocation;
  readonly endLocation: GridLocation;
  readonly rotationDirection: RotationDirection;
  readonly startOrientation: Orientation;
  readonly endOrientation: Orientation;
  /**
   * Number of half-turns (180 degree increments). Float motions use the
   * literal "fl" marker for "floating" — rotation decided at render time.
   */
  readonly turns: number | "fl";
  /**
   * Optional — defaults to 'wall' in most contexts. When omitted, consumers
   * should treat as wall. `createMotion` fills in `Plane.wall` when omitted,
   * but the contract permits storing a Motion without a plane field for
   * back-compat with app-side code that predates the 3D viewer.
   */
  readonly plane?: Plane;
  /**
   * Prop color. Optional: Motions stored under `step.motions.blue` are
   * definitionally blue; `color` is redundant there. Kept for back-compat
   * with code that passes flat Motion objects across boundaries.
   */
  readonly color?: PropColor;
  /**
   * Original motion type before float conversion. Present only when
   * `motionType === "float"` and the source was a shift. Consumers like
   * TurnColorInterpreter need this to pick the correct slot
   * (pro vs anti) for TYPE1_HYBRID letter turn coloring.
   */
  readonly prefloatMotionType?: MotionType;
  /** Original rotation direction before float conversion; paired with prefloatMotionType. */
  readonly prefloatRotationDirection?: RotationDirection;
}
