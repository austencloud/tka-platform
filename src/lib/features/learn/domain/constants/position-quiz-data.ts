/**
 * Position Identification Quiz data constants
 */

import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { shuffleArray } from "./shared-types";

export { type PositionType } from "./shared-types";
import type { PositionType } from "./shared-types";
// 8-point cardinal+intercardinal union (distinct from the 4-point HandPosition
// in the staff/motion files — see shared-types.ts).
export type HandPosition = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

export interface PositionQuestion {
  left: HandPosition;
  right: HandPosition;
  gridMode: GridMode;
  type: PositionType;
}

export interface PositionTypeInfo {
  symbol: string;
  label: string;
}

export const POSITION_TYPE_INFO: Record<PositionType, PositionTypeInfo> = {
  alpha: { symbol: "α", label: "Alpha" },
  beta: { symbol: "β", label: "Beta" },
  gamma: { symbol: "γ", label: "Gamma" },
};

export const ALPHA_POSITIONS: { left: HandPosition; right: HandPosition; gridMode: GridMode }[] = [
  { left: "N", right: "S", gridMode: GridMode.DIAMOND },
  { left: "E", right: "W", gridMode: GridMode.DIAMOND },
  { left: "NE", right: "SW", gridMode: GridMode.BOX },
  { left: "NW", right: "SE", gridMode: GridMode.BOX },
];

export const BETA_POSITIONS: { left: HandPosition; right: HandPosition; gridMode: GridMode }[] = [
  { left: "N", right: "N", gridMode: GridMode.DIAMOND },
  { left: "E", right: "E", gridMode: GridMode.DIAMOND },
  { left: "S", right: "S", gridMode: GridMode.DIAMOND },
  { left: "NW", right: "NW", gridMode: GridMode.BOX },
];

export const GAMMA_POSITIONS: { left: HandPosition; right: HandPosition; gridMode: GridMode }[] = [
  { left: "N", right: "E", gridMode: GridMode.DIAMOND },
  { left: "N", right: "W", gridMode: GridMode.DIAMOND },
  { left: "S", right: "E", gridMode: GridMode.DIAMOND },
  { left: "S", right: "W", gridMode: GridMode.DIAMOND },
  { left: "NE", right: "SE", gridMode: GridMode.BOX },
  { left: "NE", right: "NW", gridMode: GridMode.BOX },
];

export function generatePositionQuestions(): PositionQuestion[] {
  const questions: PositionQuestion[] = [];

  // Add 3 of each type
  for (let i = 0; i < 3; i++) {
    const alphaIdx = Math.floor(Math.random() * ALPHA_POSITIONS.length);
    questions.push({ ...ALPHA_POSITIONS[alphaIdx]!, type: "alpha" });

    const betaIdx = Math.floor(Math.random() * BETA_POSITIONS.length);
    questions.push({ ...BETA_POSITIONS[betaIdx]!, type: "beta" });

    const gammaIdx = Math.floor(Math.random() * GAMMA_POSITIONS.length);
    questions.push({ ...GAMMA_POSITIONS[gammaIdx]!, type: "gamma" });
  }

  // Shuffle (Fisher-Yates; unbiased)
  return shuffleArray(questions);
}
