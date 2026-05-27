/**
 * VTG Mode Calculator
 *
 * Calculates VTG (Vulcan Tech Gospel) mode and elemental type from pictograph data.
 * VTG mode is determined by a LOOKUP TABLE based on:
 * - Letter (A-V)
 * - Grid mode (DIAMOND or BOX)
 * - Start position (for conditional cases)
 *
 * Based on legacy vtg_glyph.py implementation.
 */

import { TNDMode as TNDMode, ElementalType } from "../enums/pictograph-enums";
import type { Letter } from "../../../../foundation/domain/models/Letter";
import type { PictographData } from "../models/PictographData";
import { GridMode, GridPosition } from "../../../grid/domain/enums/grid-enums";

export interface VTGCalculationResult {
  vtgMode: TNDMode | null;
  elementalType: ElementalType | null;
}

// Position subsets used by conditional VTG lookups.
// Typed as GridPosition[] so .includes() accepts the full GridPosition union.
const BETA_3_7: GridPosition[] = [GridPosition.BETA3, GridPosition.BETA7];
const ALPHA_1_5: GridPosition[] = [GridPosition.ALPHA1, GridPosition.ALPHA5];
const GAMMA_DIAG: GridPosition[] = [
  GridPosition.GAMMA10,
  GridPosition.GAMMA8,
  GridPosition.GAMMA14,
  GridPosition.GAMMA4,
];

/**
 * Mapping from VTG mode to elemental type.
 * Based on legacy SVG_PATHS mapping from elemental_glyph.py
 */
const TND_TO_ELEMENTAL: Record<TNDMode, ElementalType> = {
  [TNDMode.SPLIT_SAME]: ElementalType.WATER,
  [TNDMode.SPLIT_OPP]: ElementalType.FIRE,
  [TNDMode.TOG_SAME]: ElementalType.EARTH,
  [TNDMode.TOG_OPP]: ElementalType.AIR,
  [TNDMode.QUARTER_SAME]: ElementalType.SUN,
  [TNDMode.QUARTER_OPP]: ElementalType.MOON,
};

/**
 * VTG Mode Lookup Tables
 *
 * These are hard-coded mappings from the legacy Python code.
 * VTG mode is NOT derived from motion properties - it's a deterministic
 * lookup based on letter, grid mode, and sometimes start position.
 */

// DIAMOND grid mode lookup
const DIAMOND_MODE_MAP: Record<
  string,
  TNDMode | ((startPos: GridPosition) => TNDMode)
> = {
  A: TNDMode.SPLIT_SAME,
  B: TNDMode.SPLIT_SAME,
  C: TNDMode.SPLIT_SAME,
  D: (startPos: GridPosition) =>
    BETA_3_7.includes(startPos)
      ? TNDMode.SPLIT_OPP
      : TNDMode.TOG_OPP,
  E: (startPos: GridPosition) =>
    BETA_3_7.includes(startPos)
      ? TNDMode.SPLIT_OPP
      : TNDMode.TOG_OPP,
  F: (startPos: GridPosition) =>
    BETA_3_7.includes(startPos)
      ? TNDMode.SPLIT_OPP
      : TNDMode.TOG_OPP,
  G: TNDMode.TOG_SAME,
  H: TNDMode.TOG_SAME,
  I: TNDMode.TOG_SAME,
  J: (startPos: GridPosition) =>
    ALPHA_1_5.includes(startPos)
      ? TNDMode.SPLIT_OPP
      : TNDMode.TOG_OPP,
  K: (startPos: GridPosition) =>
    ALPHA_1_5.includes(startPos)
      ? TNDMode.SPLIT_OPP
      : TNDMode.TOG_OPP,
  L: (startPos: GridPosition) =>
    ALPHA_1_5.includes(startPos)
      ? TNDMode.SPLIT_OPP
      : TNDMode.TOG_OPP,
  M: TNDMode.QUARTER_OPP,
  N: TNDMode.QUARTER_OPP,
  O: TNDMode.QUARTER_OPP,
  P: TNDMode.QUARTER_OPP,
  Q: TNDMode.QUARTER_OPP,
  R: TNDMode.QUARTER_OPP,
  S: TNDMode.QUARTER_SAME,
  T: TNDMode.QUARTER_SAME,
  U: TNDMode.QUARTER_SAME,
  V: TNDMode.QUARTER_SAME,
};

// BOX grid mode lookup
const BOX_MODE_MAP: Record<
  string,
  TNDMode | ((startPos: GridPosition) => TNDMode)
> = {
  A: TNDMode.SPLIT_SAME,
  B: TNDMode.SPLIT_SAME,
  C: TNDMode.SPLIT_SAME,
  D: TNDMode.QUARTER_OPP,
  E: TNDMode.QUARTER_OPP,
  F: TNDMode.QUARTER_OPP,
  G: TNDMode.TOG_SAME,
  H: TNDMode.TOG_SAME,
  I: TNDMode.TOG_SAME,
  J: TNDMode.QUARTER_OPP,
  K: TNDMode.QUARTER_OPP,
  L: TNDMode.QUARTER_OPP,
  M: (startPos: GridPosition) =>
    GAMMA_DIAG.includes(startPos)
      ? TNDMode.SPLIT_OPP
      : TNDMode.TOG_OPP,
  N: (startPos: GridPosition) =>
    GAMMA_DIAG.includes(startPos)
      ? TNDMode.SPLIT_OPP
      : TNDMode.TOG_OPP,
  O: (startPos: GridPosition) =>
    GAMMA_DIAG.includes(startPos)
      ? TNDMode.SPLIT_OPP
      : TNDMode.TOG_OPP,
  P: (startPos: GridPosition) =>
    GAMMA_DIAG.includes(startPos)
      ? TNDMode.SPLIT_OPP
      : TNDMode.TOG_OPP,
  Q: (startPos: GridPosition) =>
    GAMMA_DIAG.includes(startPos)
      ? TNDMode.SPLIT_OPP
      : TNDMode.TOG_OPP,
  R: (startPos: GridPosition) =>
    GAMMA_DIAG.includes(startPos)
      ? TNDMode.SPLIT_OPP
      : TNDMode.TOG_OPP,
  S: TNDMode.QUARTER_SAME,
  T: TNDMode.QUARTER_SAME,
  U: TNDMode.QUARTER_SAME,
  V: TNDMode.QUARTER_SAME,
};

/**
 * Calculate VTG mode from pictograph data.
 *
 * This uses a lookup table approach, NOT motion property derivation.
 *
 * @param pictographData - Complete pictograph data
 * @param gridMode - Grid mode (DIAMOND or BOX)
 * @returns VTG calculation result with mode and elemental type
 */
export function calculateVTGFromPictograph(
  pictographData: PictographData | null | undefined,
  gridMode: GridMode
): VTGCalculationResult {
  const defaultResult: VTGCalculationResult = {
    vtgMode: null,
    elementalType: null,
  };

  if (!pictographData?.letter) {
    return defaultResult;
  }

  const letter = pictographData.letter;
  const startPosition = pictographData.startPosition;

  if (!startPosition) {
    return defaultResult;
  }

  return calculateVTG(letter, gridMode, startPosition);
}

/**
 * Calculate VTG mode from letter, grid mode, and start position.
 *
 * @param letter - Letter enum value
 * @param gridMode - Grid mode (DIAMOND or BOX)
 * @param startPosition - Start position
 * @returns VTG calculation result
 */
export function calculateVTG(
  letter: Letter,
  gridMode: GridMode,
  startPosition: GridPosition
): VTGCalculationResult {
  const defaultResult: VTGCalculationResult = {
    vtgMode: null,
    elementalType: null,
  };

  // Letter is an enum, use it directly as a string value
  const letterValue = letter as string;

  if (!letterValue) {
    return defaultResult;
  }

  // Select the appropriate lookup table based on grid mode
  const modeMap =
    gridMode === GridMode.DIAMOND ? DIAMOND_MODE_MAP : BOX_MODE_MAP;

  // Get the VTG mode from the lookup table
  const modeOrFunction = modeMap[letterValue];

  if (!modeOrFunction) {
    return defaultResult;
  }

  // If it's a function, call it with the start position
  const vtgMode =
    typeof modeOrFunction === "function"
      ? modeOrFunction(startPosition)
      : modeOrFunction;

  // Map VTG mode to elemental type
  const elementalType = TND_TO_ELEMENTAL[vtgMode];

  return {
    vtgMode,
    elementalType,
  };
}
