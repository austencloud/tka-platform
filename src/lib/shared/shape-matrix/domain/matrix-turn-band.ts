import type {
  TurnLevel,
  TurnValue,
} from "$lib/shared/create/services/level-turn-values";
import { turnValuesForLevel } from "$lib/shared/create/services/level-turn-values";
import type { AxisFilter, MatrixFilters } from "./filter-flower-axis";

export type MatrixLabelMode = "turns" | "ratios";

export function matrixTurnsForLevel(level: TurnLevel): readonly TurnValue[] {
  return turnValuesForLevel(level);
}

function axisFilterForTurn(turn: TurnValue): AxisFilter {
  return {
    style: "all",
    turns: new Set([turn]),
    ori: "all",
    grid: "diamond",
  };
}

/** Independent axis bands keep every page finite: four rows by four columns. */
export function matrixFiltersForTurns(
  blueTurn: TurnValue,
  redTurn: TurnValue
): MatrixFilters {
  return {
    blue: axisFilterForTurn(blueTurn),
    red: axisFilterForTurn(redTurn),
    collapse: false,
  };
}

/** Backwards-compatible same-band helper for lab consumers. */
export function matrixFiltersForTurn(turn: TurnValue): MatrixFilters {
  return matrixFiltersForTurns(turn, turn);
}
