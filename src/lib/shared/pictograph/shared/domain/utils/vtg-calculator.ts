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

import { VTGMode, ElementalType } from "../enums/pictograph-enums";
import type { Letter } from "../../../../foundation/domain/models/Letter";
import type { PictographData } from "../models/PictographData";
import { GridMode, GridPosition } from "../../../grid/domain/enums/grid-enums";

export interface VTGCalculationResult {
  vtgMode: VTGMode | null;
  elementalType: ElementalType | null;
}

/**
 * Mapping from VTG mode to elemental type.
 * Based on legacy SVG_PATHS mapping from elemental_glyph.py
 */
const VTG_TO_ELEMENTAL: Record<VTGMode, ElementalType> = {
  [VTGMode.SPLIT_SAME]: ElementalType.WATER,
  [VTGMode.SPLIT_OPP]: ElementalType.FIRE,
  [VTGMode.TOG_SAME]: ElementalType.EARTH,
  [VTGMode.TOG_OPP]: ElementalType.AIR,
  [VTGMode.QUARTER_SAME]: ElementalType.SUN,
  [VTGMode.QUARTER_OPP]: ElementalType.MOON,
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
  VTGMode | ((startPos: GridPosition) => VTGMode)
> = {
  A: VTGMode.SPLIT_SAME,
  B: VTGMode.SPLIT_SAME,
  C: VTGMode.SPLIT_SAME,
  D: (startPos: GridPosition) =>
    [GridPosition.BETA3, GridPosition.BETA7].includes(startPos)
      ? VTGMode.SPLIT_OPP
      : VTGMode.TOG_OPP,
  E: (startPos: GridPosition) =>
    [GridPosition.BETA3, GridPosition.BETA7].includes(startPos)
      ? VTGMode.SPLIT_OPP
      : VTGMode.TOG_OPP,
  F: (startPos: GridPosition) =>
    [GridPosition.BETA3, GridPosition.BETA7].includes(startPos)
      ? VTGMode.SPLIT_OPP
      : VTGMode.TOG_OPP,
  G: VTGMode.TOG_SAME,
  H: VTGMode.TOG_SAME,
  I: VTGMode.TOG_SAME,
  J: (startPos: GridPosition) =>
    [GridPosition.ALPHA1, GridPosition.ALPHA5].includes(startPos)
      ? VTGMode.SPLIT_OPP
      : VTGMode.TOG_OPP,
  K: (startPos: GridPosition) =>
    [GridPosition.ALPHA1, GridPosition.ALPHA5].includes(startPos)
      ? VTGMode.SPLIT_OPP
      : VTGMode.TOG_OPP,
  L: (startPos: GridPosition) =>
    [GridPosition.ALPHA1, GridPosition.ALPHA5].includes(startPos)
      ? VTGMode.SPLIT_OPP
      : VTGMode.TOG_OPP,
  M: VTGMode.QUARTER_OPP,
  N: VTGMode.QUARTER_OPP,
  O: VTGMode.QUARTER_OPP,
  P: VTGMode.QUARTER_OPP,
  Q: VTGMode.QUARTER_OPP,
  R: VTGMode.QUARTER_OPP,
  S: VTGMode.QUARTER_SAME,
  T: VTGMode.QUARTER_SAME,
  U: VTGMode.QUARTER_SAME,
  V: VTGMode.QUARTER_SAME,
};

// BOX grid mode lookup
const BOX_MODE_MAP: Record<
  string,
  VTGMode | ((startPos: GridPosition) => VTGMode)
> = {
  A: VTGMode.SPLIT_SAME,
  B: VTGMode.SPLIT_SAME,
  C: VTGMode.SPLIT_SAME,
  D: VTGMode.QUARTER_OPP,
  E: VTGMode.QUARTER_OPP,
  F: VTGMode.QUARTER_OPP,
  G: VTGMode.TOG_SAME,
  H: VTGMode.TOG_SAME,
  I: VTGMode.TOG_SAME,
  J: VTGMode.QUARTER_OPP,
  K: VTGMode.QUARTER_OPP,
  L: VTGMode.QUARTER_OPP,
  M: (startPos: GridPosition) =>
    [
      GridPosition.GAMMA10,
      GridPosition.GAMMA8,
      GridPosition.GAMMA14,
      GridPosition.GAMMA4,
    ].includes(startPos)
      ? VTGMode.SPLIT_OPP
      : VTGMode.TOG_OPP,
  N: (startPos: GridPosition) =>
    [
      GridPosition.GAMMA10,
      GridPosition.GAMMA8,
      GridPosition.GAMMA14,
      GridPosition.GAMMA4,
    ].includes(startPos)
      ? VTGMode.SPLIT_OPP
      : VTGMode.TOG_OPP,
  O: (startPos: GridPosition) =>
    [
      GridPosition.GAMMA10,
      GridPosition.GAMMA8,
      GridPosition.GAMMA14,
      GridPosition.GAMMA4,
    ].includes(startPos)
      ? VTGMode.SPLIT_OPP
      : VTGMode.TOG_OPP,
  P: (startPos: GridPosition) =>
    [
      GridPosition.GAMMA10,
      GridPosition.GAMMA8,
      GridPosition.GAMMA14,
      GridPosition.GAMMA4,
    ].includes(startPos)
      ? VTGMode.SPLIT_OPP
      : VTGMode.TOG_OPP,
  Q: (startPos: GridPosition) =>
    [
      GridPosition.GAMMA10,
      GridPosition.GAMMA8,
      GridPosition.GAMMA14,
      GridPosition.GAMMA4,
    ].includes(startPos)
      ? VTGMode.SPLIT_OPP
      : VTGMode.TOG_OPP,
  R: (startPos: GridPosition) =>
    [
      GridPosition.GAMMA10,
      GridPosition.GAMMA8,
      GridPosition.GAMMA14,
      GridPosition.GAMMA4,
    ].includes(startPos)
      ? VTGMode.SPLIT_OPP
      : VTGMode.TOG_OPP,
  S: VTGMode.QUARTER_SAME,
  T: VTGMode.QUARTER_SAME,
  U: VTGMode.QUARTER_SAME,
  V: VTGMode.QUARTER_SAME,
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
  const elementalType = VTG_TO_ELEMENTAL[vtgMode];

  return {
    vtgMode,
    elementalType,
  };
}
