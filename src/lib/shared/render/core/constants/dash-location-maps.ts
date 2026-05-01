import type { GridLocation } from "../types.js";

export const PHI_DASH_PSI_DASH_LOCATION_MAP: Record<string, GridLocation> = {
  "red,n,s": "e",
  "red,e,w": "n",
  "red,s,n": "e",
  "red,w,e": "n",
  "blue,n,s": "w",
  "blue,e,w": "s",
  "blue,s,n": "w",
  "blue,w,e": "s",
  "red,nw,se": "ne",
  "red,ne,sw": "se",
  "red,sw,ne": "se",
  "red,se,nw": "ne",
  "blue,nw,se": "sw",
  "blue,ne,sw": "nw",
  "blue,sw,ne": "nw",
  "blue,se,nw": "sw",
};

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
