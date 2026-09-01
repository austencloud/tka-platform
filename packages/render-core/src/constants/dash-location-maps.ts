/**
 * Dash arrow location maps
 *
 * Dash arrows are NOT placed at their start or end locations.
 * Instead, their location is calculated based on the motion parameters.
 */

import type { GridLocation } from "../types.js";


export const PHI_DASH_PSI_DASH_LOCATION_MAP: Record<string, GridLocation> = {
  // Diamond (cardinal) locations
  "right,n,s": "e",
  "right,e,w": "n",
  "right,s,n": "e",
  "right,w,e": "n",
  "left,n,s": "w",
  "left,e,w": "s",
  "left,s,n": "w",
  "left,w,e": "s",
  // Box (intercardinal) locations
  "right,nw,se": "ne",
  "right,ne,sw": "se",
  "right,sw,ne": "se",
  "right,se,nw": "ne",
  "left,nw,se": "sw",
  "left,ne,sw": "nw",
  "left,sw,ne": "nw",
  "left,se,nw": "sw",
};

// LAMBDA ZERO TURNS SPECIAL CASE
// Key format: "startLocation,endLocation,otherEndLocation"

export const LAMBDA_ZERO_TURNS_LOCATION_MAP: Record<string, GridLocation> = {
  "n,s,w": "e",
  "e,w,s": "n",
  "n,s,e": "w",
  "w,e,s": "n",
  "s,n,w": "e",
  "e,w,n": "s",
  "s,n,e": "w",
  "w,e,n": "s",
  "ne,sw,nw": "se",
  "nw,se,ne": "sw",
  "sw,ne,se": "nw",
  "se,nw,sw": "ne",
  "ne,sw,se": "nw",
  "nw,se,sw": "ne",
  "sw,ne,nw": "se",
  "se,nw,ne": "sw",
};

// DEFAULT ZERO TURNS DASH LOCATION MAP
// Key format: "startLocation,endLocation"

export const DEFAULT_ZERO_TURNS_DASH_LOCATION_MAP: Record<string, GridLocation> = {
  "n,s": "e",
  "e,w": "s",
  "s,n": "w",
  "w,e": "n",
  "ne,sw": "se",
  "nw,se": "ne",
  "sw,ne": "nw",
  "se,nw": "sw",
};


export const NON_ZERO_TURNS_DASH_LOCATION_MAP: Record<string, Record<GridLocation, GridLocation>> = {
  clockwise: {
    n: "e",
    e: "s",
    s: "w",
    w: "n",
    ne: "se",
    se: "sw",
    sw: "nw",
    nw: "ne",
    c: "c",
  },
  counter_clockwise: {
    n: "w",
    e: "n",
    s: "e",
    w: "s",
    ne: "nw",
    se: "ne",
    sw: "se",
    nw: "sw",
    c: "c",
  },
};

// TYPE 3 DASH LOCATION MAPS
// Key format: "dashStartLocation,shiftArrowLocation"

/**
 * Diamond mode Type3 dash location map
 */
export const DIAMOND_DASH_LOCATION_MAP: Record<string, GridLocation> = {
  "n,nw": "e",
  "n,ne": "w",
  "n,se": "w",
  "n,sw": "e",
  "e,nw": "s",
  "e,ne": "s",
  "e,se": "n",
  "e,sw": "n",
  "s,nw": "e",
  "s,ne": "w",
  "s,se": "w",
  "s,sw": "e",
  "w,nw": "s",
  "w,ne": "s",
  "w,se": "n",
  "w,sw": "n",
};

/**
 * Box mode Type3 dash location map
 */
export const BOX_DASH_LOCATION_MAP: Record<string, GridLocation> = {
  "ne,n": "se",
  "ne,e": "nw",
  "ne,s": "nw",
  "ne,w": "se",
  "se,n": "sw",
  "se,e": "sw",
  "se,s": "ne",
  "se,w": "ne",
  "sw,n": "se",
  "sw,e": "nw",
  "sw,s": "nw",
  "sw,w": "se",
  "nw,n": "sw",
  "nw,e": "sw",
  "nw,s": "ne",
  "nw,w": "ne",
};


export const PHI_DASH_LETTERS = ["Φ-"];
export const PSI_DASH_LETTERS = ["Ψ-"];
export const LAMBDA_LETTERS = ["Λ"];
export const LAMBDA_DASH_LETTERS = ["Λ-"];
export const TYPE3_LETTERS = ["W-", "X-", "Y-", "Z-", "Σ-", "Δ-", "Θ-", "Ω-"];


export const OPPOSITE_LOCATION_MAP: Record<GridLocation, GridLocation> = {
  n: "s",
  s: "n",
  e: "w",
  w: "e",
  ne: "sw",
  sw: "ne",
  se: "nw",
  nw: "se",
  c: "c",
};
