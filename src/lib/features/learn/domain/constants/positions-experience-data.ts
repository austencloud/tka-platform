/**
 * Positions Concept Experience data constants
 */

import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

export type HandPosition = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

export interface PositionExample {
  left: HandPosition;
  right: HandPosition;
  gridMode: GridMode;
}

export const ALPHA_EXAMPLES: readonly PositionExample[] = [
  { left: "N", right: "S", gridMode: GridMode.DIAMOND },
  { left: "E", right: "W", gridMode: GridMode.DIAMOND },
  { left: "NE", right: "SW", gridMode: GridMode.BOX },
  { left: "NW", right: "SE", gridMode: GridMode.BOX },
] as const;

export const BETA_EXAMPLES: readonly PositionExample[] = [
  { left: "N", right: "N", gridMode: GridMode.DIAMOND },
  { left: "E", right: "E", gridMode: GridMode.DIAMOND },
  { left: "SW", right: "SW", gridMode: GridMode.BOX },
  { left: "NE", right: "NE", gridMode: GridMode.BOX },
] as const;

export const GAMMA_EXAMPLES: readonly PositionExample[] = [
  { left: "N", right: "E", gridMode: GridMode.DIAMOND },
  { left: "N", right: "W", gridMode: GridMode.DIAMOND },
  { left: "S", right: "E", gridMode: GridMode.DIAMOND },
  { left: "NE", right: "SE", gridMode: GridMode.BOX },
] as const;

export interface PositionInfo {
  name: string;
  symbol: string;
  summary: string;
  description: string;
  keyInsight: string;
}

export const POSITION_INFO: Record<"alpha" | "beta" | "gamma", PositionInfo> = {
  alpha: {
    name: "Alpha",
    symbol: "α",
    summary: "The hands occupy the points across from each other.",
    description: "The hands are as far apart as they can be. One hand is always directly across from the other.",
    keyInsight: "Alpha is the big, open position. If you can draw a straight line through the center connecting both hands, that's alpha.",
  },
  beta: {
    name: "Beta",
    symbol: "β",
    summary: "The hands occupy the same point.",
    description: "Both hands share the same spot on the grid, stacked on top of each other.",
    keyInsight: "Beta is the together position. Hands start or end here when they come together.",
  },
  gamma: {
    name: "Gamma",
    symbol: "γ",
    summary: "The hands form a right angle.",
    description: "The hands are next to each other, one step apart on the grid. Not opposite, not together, but adjacent.",
    keyInsight: "Gamma is the in-between position. The hands are close but not stacked, offset but not opposite.",
  },
};
