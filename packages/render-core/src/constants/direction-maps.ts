/**
 * Beta offset direction maps
 *
 * When two props end at the same location (a "beta" position),
 * they need to be offset from each other so they don't overlap.
 * The direction of offset depends on:
 * - The location (N/S/E/W vs NE/SE/SW/NW)
 * - The orientation type (radial IN/OUT vs non-radial CLOCK/COUNTER)
 * - The motion color (red vs blue)
 * - For shift motions, the start->end transition
 */

import type { GridLocation, VectorDirection } from "../types.js";

type ColorMap = Record<"blue" | "red", VectorDirection>;


/**
 * Diamond grid (N/S/E/W) - radial orientation (IN/OUT)
 */
export const DIAMOND_RADIAL_MAP: Record<GridLocation, ColorMap> = {
  n: { red: "right", blue: "left" },
  e: { red: "down", blue: "up" },
  s: { red: "left", blue: "right" },
  w: { red: "up", blue: "down" },
  ne: { red: "right", blue: "left" },
  se: { red: "right", blue: "left" },
  sw: { red: "right", blue: "left" },
  nw: { red: "right", blue: "left" },
  c: { red: "right", blue: "left" },
};

/**
 * Diamond grid (N/S/E/W) - non-radial orientation (CLOCK/COUNTER)
 */
export const DIAMOND_NON_RADIAL_MAP: Record<GridLocation, ColorMap> = {
  n: { red: "up", blue: "down" },
  e: { red: "right", blue: "left" },
  s: { red: "down", blue: "up" },
  w: { red: "left", blue: "right" },
  ne: { red: "up", blue: "down" },
  se: { red: "up", blue: "down" },
  sw: { red: "up", blue: "down" },
  nw: { red: "up", blue: "down" },
  c: { red: "up", blue: "down" },
};

/**
 * Box grid (NE/SE/SW/NW) - radial orientation
 */
export const BOX_RADIAL_MAP: Record<GridLocation, ColorMap> = {
  ne: { red: "downright", blue: "upleft" },
  se: { red: "upright", blue: "downleft" },
  sw: { red: "downright", blue: "upleft" },
  nw: { red: "upright", blue: "downleft" },
  n: { red: "downright", blue: "upleft" },
  e: { red: "downright", blue: "upleft" },
  s: { red: "downright", blue: "upleft" },
  w: { red: "downright", blue: "upleft" },
  c: { red: "right", blue: "left" },
};

/**
 * Box grid (NE/SE/SW/NW) - non-radial orientation (CLOCK/COUNTER)
 * Also used for interradial orientations (clockIn/clockOut/counterIn/counterOut)
 * as a close approximation — both are perpendicular-ish to the radial axis.
 */
export const BOX_NON_RADIAL_MAP: Record<GridLocation, ColorMap> = {
  ne: { red: "upright", blue: "downleft" },
  se: { red: "upleft", blue: "downright" },
  sw: { red: "upright", blue: "downleft" },
  nw: { red: "upleft", blue: "downright" },
  n: { red: "upright", blue: "downleft" },
  e: { red: "upright", blue: "downleft" },
  s: { red: "upright", blue: "downleft" },
  w: { red: "upright", blue: "downleft" },
  c: { red: "up", blue: "down" },
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
 */
export const SHIFT_NON_RADIAL_MAP: Record<GridLocation, Partial<Record<GridLocation, VectorDirection>>> = {
  e: { n: "up", s: "up" },
  w: { n: "down", s: "down" },
  n: { e: "right", w: "right" },
  s: { e: "left", w: "left" },
  ne: { se: "upleft", nw: "downright" },
  se: { ne: "downleft", sw: "upright" },
  sw: { nw: "upright", se: "downleft" },
  nw: { ne: "downright", sw: "upleft" },
  c: {},
};


/**
 * Letter I (one pro + one anti, same trajectory) has unique offset directions
 * different from generic shift maps.
 * Ported from app's DirectionMaps.ts LETTER_I_RADIAL_MAP / LETTER_I_NON_RADIAL_MAP.
 */
export const LETTER_I_RADIAL_MAP: Record<GridLocation, ColorMap> = {
  n: { red: "right", blue: "left" },
  e: { red: "down", blue: "up" },
  s: { red: "left", blue: "right" },
  w: { red: "down", blue: "up" },
  ne: { red: "downright", blue: "upleft" },
  se: { red: "upright", blue: "downleft" },
  sw: { red: "downright", blue: "upleft" },
  nw: { red: "upright", blue: "downleft" },
  c: { red: "up", blue: "down" },
};

export const LETTER_I_NON_RADIAL_MAP: Record<GridLocation, ColorMap> = {
  n: { red: "up", blue: "down" },
  e: { red: "right", blue: "left" },
  s: { red: "down", blue: "up" },
  w: { red: "right", blue: "left" },
  ne: { red: "upright", blue: "downleft" },
  se: { red: "downright", blue: "upleft" },
  sw: { red: "upright", blue: "downleft" },
  nw: { red: "downright", blue: "upleft" },
  c: { red: "up", blue: "down" },
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
