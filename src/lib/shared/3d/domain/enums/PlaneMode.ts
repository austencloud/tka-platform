/**
 * PlaneMode - How the avatar orients relative to the audience
 * and which planes each hand operates on.
 *
 * WALL: Both hands on XY plane, avatar faces audience.
 * DUAL_WHEEL: Each hand on its own YZ wheel plane offset laterally,
 *             avatar turned 90 degrees so arms extend to each side.
 */
export enum PlaneMode {
  WALL = "wall",
  DUAL_WHEEL = "dual-wheel",
}
