/**
 * PlaneMode - How the avatar orients relative to the audience
 * and which planes each hand operates on.
 *
 * WALL: Both hands on XY plane, avatar faces audience.
 * DUAL_WHEEL: Each hand on its own YZ wheel plane offset laterally,
 *             avatar turned 90 degrees so arms extend to each side.
 * CUSTOM: Per-hand independent plane selection - not a preset, user picks each hand's plane.
 */
export enum PlaneMode {
  WALL = "wall",
  DUAL_WHEEL = "dual-wheel",
  /** Per-hand independent plane selection - not a preset, user picks each hand's plane */
  CUSTOM = "custom",
  /** Dual-wheel hand paths with wall-plane rotation - creates a "conjoined grid" visual. Discovered accidentally 2026-04-07. */
  CONJOINED_WHEEL = "conjoined_wheel",
}
