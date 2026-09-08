import type { GridLocation, VectorDirection } from "../types.js";
import type { HandSide } from "@tka/tka-types";

type HandDirectionMap = Record<HandSide, VectorDirection>;

/**
 * Diamond grid (N/S/E/W) - radial orientation (IN/OUT)
 */
export const DIAMOND_RADIAL_MAP: Record<GridLocation, HandDirectionMap> = {
  n: { right: "right", left: "left" },
  e: { right: "down", left: "up" },
  s: { right: "left", left: "right" },
  w: { right: "up", left: "down" },
  ne: { right: "right", left: "left" },
  se: { right: "right", left: "left" },
  sw: { right: "right", left: "left" },
  nw: { right: "right", left: "left" },
  c: { right: "right", left: "left" },
};

/**
 * Diamond grid (N/S/E/W) - non-radial orientation (CLOCK/COUNTER)
 */
export const DIAMOND_NON_RADIAL_MAP: Record<GridLocation, HandDirectionMap> = {
  n: { right: "up", left: "down" },
  e: { right: "right", left: "left" },
  s: { right: "down", left: "up" },
  w: { right: "left", left: "right" },
  ne: { right: "up", left: "down" },
  se: { right: "up", left: "down" },
  sw: { right: "up", left: "down" },
  nw: { right: "up", left: "down" },
  c: { right: "up", left: "down" },
};

/**
 * Box grid (NE/SE/SW/NW) - radial orientation
 */
export const BOX_RADIAL_MAP: Record<GridLocation, HandDirectionMap> = {
  ne: { right: "downright", left: "upleft" },
  se: { right: "upright", left: "downleft" },
  sw: { right: "downright", left: "upleft" },
  nw: { right: "upright", left: "downleft" },
  n: { right: "downright", left: "upleft" },
  e: { right: "downright", left: "upleft" },
  s: { right: "downright", left: "upleft" },
  w: { right: "downright", left: "upleft" },
  c: { right: "right", left: "left" },
};

/**
 * Box grid (NE/SE/SW/NW) - non-radial orientation (CLOCK/COUNTER)
 */
// Non-radial separation is the radial separation rotated 90° CCW (x,y)->(y,-x),
// because a non-radial staff lies perpendicular to the radial axis, so props
// nest along the radial axis instead of across it. Must stay the exact CCW
// rotation of BOX_RADIAL_MAP — the center entry (right/left -> up/down) already
// follows this; the corners had drifted to mixed/scrambled rotations.
export const BOX_NON_RADIAL_MAP: Record<GridLocation, HandDirectionMap> = {
  ne: { right: "upright", left: "downleft" },
  se: { right: "upleft", left: "downright" },
  sw: { right: "upright", left: "downleft" },
  nw: { right: "upleft", left: "downright" },
  n: { right: "upright", left: "downleft" },
  e: { right: "upright", left: "downleft" },
  s: { right: "upright", left: "downleft" },
  w: { right: "upright", left: "downleft" },
  c: { right: "up", left: "down" },
};

/**
 * Shift motion transitions - radial orientation
 * Maps [startLocation][endLocation] -> direction
 */
export const SHIFT_RADIAL_MAP: Record<GridLocation, Partial<Record<GridLocation, VectorDirection>>> = {
  e: { n: "right", s: "right" },
  w: { n: "left", s: "left" },
  n: { e: "up", w: "up" },
  s: { e: "down", w: "down" },
  ne: { nw: "upright", se: "upright" },
  se: { ne: "downright", sw: "downright" },
  sw: { nw: "downleft", se: "downleft" },
  nw: { ne: "upleft", sw: "upleft" },
  c: {},
};

/**
 * Shift motion transitions - non-radial orientation
 *
 * At box corners, separation follows the radial axis through the occupied
 * corner. Keeping that axis correct prevents the two staves from sliding
 * along their shared non-radial line and appearing to overlap.
 */
export const SHIFT_NON_RADIAL_MAP: Record<GridLocation, Partial<Record<GridLocation, VectorDirection>>> = {
  e: { n: "up", s: "up" },
  w: { n: "down", s: "down" },
  n: { e: "right", w: "right" },
  s: { e: "left", w: "left" },
  ne: { se: "upleft", nw: "downright" },
  se: { ne: "upright", sw: "upright" },
  sw: { nw: "upleft", se: "downright" },
  nw: { ne: "downleft", sw: "downleft" },
  c: {},
};

export const LETTER_I_RADIAL_MAP: Record<GridLocation, HandDirectionMap> = {
  n: { right: "right", left: "left" },
  e: { right: "down", left: "up" },
  s: { right: "left", left: "right" },
  w: { right: "down", left: "up" },
  ne: { right: "downright", left: "upleft" },
  se: { right: "upright", left: "downleft" },
  sw: { right: "downright", left: "upleft" },
  nw: { right: "upright", left: "downleft" },
  c: { right: "up", left: "down" },
};

export const LETTER_I_NON_RADIAL_MAP: Record<GridLocation, HandDirectionMap> = {
  n: { right: "up", left: "down" },
  e: { right: "right", left: "left" },
  s: { right: "down", left: "up" },
  w: { right: "right", left: "left" },
  ne: { right: "upright", left: "downleft" },
  se: { right: "downright", left: "upleft" },
  sw: { right: "upright", left: "downleft" },
  nw: { right: "downright", left: "upleft" },
  c: { right: "up", left: "down" },
};

export const OPPOSITE_DIRECTIONS: Record<VectorDirection, VectorDirection> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
  upright: "downleft",
  downleft: "upright",
  upleft: "downright",
  downright: "upleft",
};
