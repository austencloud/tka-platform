import type { GridLocation, Orientation } from "../types.js";
import {
  STATIC_RADIAL_CLOCKWISE_MAP as SHARED_STATIC_RADIAL_CLOCKWISE_MAP,
  STATIC_RADIAL_COUNTER_CLOCKWISE_MAP as SHARED_STATIC_RADIAL_COUNTER_CLOCKWISE_MAP,
  STATIC_NON_RADIAL_CLOCKWISE_MAP as SHARED_STATIC_NON_RADIAL_CLOCKWISE_MAP,
  STATIC_NON_RADIAL_COUNTER_CLOCKWISE_MAP as SHARED_STATIC_NON_RADIAL_COUNTER_CLOCKWISE_MAP,
} from "@tka/render-core";

/**
 * Diamond grid rotation angles by orientation and location
 */
export const DIAMOND_PROP_ANGLES: Record<
  Orientation,
  Record<GridLocation, number>
> = {
  in: {
    n: 90,
    s: 270,
    w: 0,
    e: 180,
    ne: 0,
    se: 0,
    sw: 0,
    nw: 0,
    c: 0,
  },
  out: {
    n: 270,
    s: 90,
    w: 180,
    e: 0,
    ne: 0,
    se: 0,
    sw: 0,
    nw: 0,
    c: 0,
  },
  clock: {
    n: 0,
    s: 180,
    w: 270,
    e: 90,
    ne: 0,
    se: 0,
    sw: 0,
    nw: 0,
    c: 0,
  },
  counter: {
    n: 180,
    s: 0,
    w: 90,
    e: 270,
    ne: 0,
    se: 0,
    sw: 0,
    nw: 0,
    c: 0,
  },
  // Interradial orientations (Level 6)
  clockIn: {
    n: 45,
    s: 225,
    w: 315,
    e: 135,
    ne: 0,
    se: 0,
    sw: 0,
    nw: 0,
    c: 0,
  },
  clockOut: {
    n: 315,
    s: 135,
    w: 225,
    e: 45,
    ne: 0,
    se: 0,
    sw: 0,
    nw: 0,
    c: 0,
  },
  counterIn: {
    n: 135,
    s: 315,
    w: 45,
    e: 225,
    ne: 0,
    se: 0,
    sw: 0,
    nw: 0,
    c: 0,
  },
  counterOut: {
    n: 225,
    s: 45,
    w: 135,
    e: 315,
    ne: 0,
    se: 0,
    sw: 0,
    nw: 0,
    c: 0,
  },
  // Centric orientations (Level 5 - prop at center, pointing toward compass direction)
  // SVG convention: 0=east, 90=south, 180=west, 270=north (clockwise)
  centerN: { n: 0, s: 0, w: 0, e: 0, ne: 0, se: 0, sw: 0, nw: 0, c: 270 },
  centerNE: { n: 0, s: 0, w: 0, e: 0, ne: 0, se: 0, sw: 0, nw: 0, c: 315 },
  centerE: { n: 0, s: 0, w: 0, e: 0, ne: 0, se: 0, sw: 0, nw: 0, c: 0 },
  centerSE: { n: 0, s: 0, w: 0, e: 0, ne: 0, se: 0, sw: 0, nw: 0, c: 45 },
  centerS: { n: 0, s: 0, w: 0, e: 0, ne: 0, se: 0, sw: 0, nw: 0, c: 90 },
  centerSW: { n: 0, s: 0, w: 0, e: 0, ne: 0, se: 0, sw: 0, nw: 0, c: 135 },
  centerW: { n: 0, s: 0, w: 0, e: 0, ne: 0, se: 0, sw: 0, nw: 0, c: 180 },
  centerNW: { n: 0, s: 0, w: 0, e: 0, ne: 0, se: 0, sw: 0, nw: 0, c: 225 },
};

/**
 * Box grid rotation angles by orientation and location
 */
export const BOX_PROP_ANGLES: Record<
  Orientation,
  Record<GridLocation, number>
> = {
  in: {
    ne: 135,
    nw: 45,
    sw: 315,
    se: 225,
    n: 0,
    s: 0,
    e: 0,
    w: 0,
    c: 0,
  },
  out: {
    ne: 315,
    nw: 225,
    sw: 135,
    se: 45,
    n: 0,
    s: 0,
    e: 0,
    w: 0,
    c: 0,
  },
  clock: {
    ne: 45,
    nw: 315,
    sw: 225,
    se: 135,
    n: 0,
    s: 0,
    e: 0,
    w: 0,
    c: 0,
  },
  counter: {
    ne: 225,
    nw: 135,
    sw: 45,
    se: 315,
    n: 0,
    s: 0,
    e: 0,
    w: 0,
    c: 0,
  },
  // Interradial orientations (Level 6)
  clockIn: {
    ne: 90,
    nw: 0,
    sw: 270,
    se: 180,
    n: 0,
    s: 0,
    e: 0,
    w: 0,
    c: 0,
  },
  clockOut: {
    ne: 0,
    nw: 270,
    sw: 180,
    se: 90,
    n: 0,
    s: 0,
    e: 0,
    w: 0,
    c: 0,
  },
  counterIn: {
    ne: 180,
    nw: 90,
    sw: 0,
    se: 270,
    n: 0,
    s: 0,
    e: 0,
    w: 0,
    c: 0,
  },
  counterOut: {
    ne: 270,
    nw: 180,
    sw: 90,
    se: 0,
    n: 0,
    s: 0,
    e: 0,
    w: 0,
    c: 0,
  },
  // Centric orientations (Level 5 - prop at center, pointing toward compass direction)
  // SVG convention: 0=east, 90=south, 180=west, 270=north (clockwise)
  centerN: { n: 0, s: 0, w: 0, e: 0, ne: 0, se: 0, sw: 0, nw: 0, c: 270 },
  centerNE: { n: 0, s: 0, w: 0, e: 0, ne: 0, se: 0, sw: 0, nw: 0, c: 315 },
  centerE: { n: 0, s: 0, w: 0, e: 0, ne: 0, se: 0, sw: 0, nw: 0, c: 0 },
  centerSE: { n: 0, s: 0, w: 0, e: 0, ne: 0, se: 0, sw: 0, nw: 0, c: 45 },
  centerS: { n: 0, s: 0, w: 0, e: 0, ne: 0, se: 0, sw: 0, nw: 0, c: 90 },
  centerSW: { n: 0, s: 0, w: 0, e: 0, ne: 0, se: 0, sw: 0, nw: 0, c: 135 },
  centerW: { n: 0, s: 0, w: 0, e: 0, ne: 0, se: 0, sw: 0, nw: 0, c: 180 },
  centerNW: { n: 0, s: 0, w: 0, e: 0, ne: 0, se: 0, sw: 0, nw: 0, c: 225 },
};

/**
 * PRO rotation maps
 */
export const PRO_CLOCKWISE_MAP: Record<GridLocation, number> = {
  n: 315,
  e: 45,
  s: 135,
  w: 225,
  ne: 0,
  se: 90,
  sw: 180,
  nw: 270,
  c: 0,
};

export const PRO_COUNTER_CLOCKWISE_MAP: Record<GridLocation, number> = {
  n: 45,
  e: 135,
  s: 225,
  w: 315,
  ne: 90,
  se: 180,
  sw: 270,
  nw: 0,
  c: 0,
};

/**
 * ANTI rotation maps
 * ANTI clockwise = PRO counter-clockwise
 * ANTI counter-clockwise = PRO clockwise
 */
export const ANTI_CLOCKWISE_MAP: Record<GridLocation, number> = {
  n: 45,
  e: 135,
  s: 225,
  w: 315,
  ne: 90,
  se: 180,
  sw: 270,
  nw: 0,
  c: 0,
};

export const ANTI_COUNTER_CLOCKWISE_MAP: Record<GridLocation, number> = {
  n: 315,
  e: 45,
  s: 135,
  w: 225,
  ne: 0,
  se: 90,
  sw: 180,
  nw: 270,
  c: 0,
};

/**
 * STATIC rotation maps - radial (IN/OUT) orientations
 */
export const STATIC_RADIAL_CLOCKWISE_MAP: Record<GridLocation, number> =
  SHARED_STATIC_RADIAL_CLOCKWISE_MAP;

export const STATIC_RADIAL_COUNTER_CLOCKWISE_MAP: Record<GridLocation, number> =
  SHARED_STATIC_RADIAL_COUNTER_CLOCKWISE_MAP;

/**
 * STATIC rotation maps - non-radial (CLOCK/COUNTER) orientations
 */
export const STATIC_NON_RADIAL_CLOCKWISE_MAP: Record<GridLocation, number> =
  SHARED_STATIC_NON_RADIAL_CLOCKWISE_MAP;

export const STATIC_NON_RADIAL_COUNTER_CLOCKWISE_MAP: Record<
  GridLocation,
  number
> = SHARED_STATIC_NON_RADIAL_COUNTER_CLOCKWISE_MAP;

/**
 * DASH rotation maps
 */
export const DASH_CLOCKWISE_MAP: Record<GridLocation, number> = {
  n: 0,
  e: 90,
  s: 180,
  w: 270,
  ne: 45,
  se: 135,
  sw: 225,
  nw: 315,
  c: 0,
};

export const DASH_COUNTER_CLOCKWISE_MAP: Record<GridLocation, number> = {
  n: 0,
  e: 90,
  s: 180,
  w: 270,
  ne: 45,
  se: 135,
  sw: 225,
  nw: 315,
  c: 0,
};

/**
 * DASH no-rotation map (special case for straight dashes)
 * Key format: "startLocation,endLocation" (lowercase)
 */
export const DASH_NO_ROTATION_MAP: Record<string, number> = {
  // Vertical dashes
  "n,s": 90,
  "s,n": 270,
  // Horizontal dashes
  "e,w": 180,
  "w,e": 0,
  // Diagonal dashes
  "se,nw": 225,
  "sw,ne": 315,
  "nw,se": 45,
  "ne,sw": 135,
};

/**
 * FLOAT rotation maps (same as PRO but uses handpath direction)
 */
export const FLOAT_CLOCKWISE_MAP = PRO_CLOCKWISE_MAP;
export const FLOAT_COUNTER_CLOCKWISE_MAP = PRO_COUNTER_CLOCKWISE_MAP;
