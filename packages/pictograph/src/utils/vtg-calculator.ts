/**
 * VTG Mode Calculator
 *
 * Calculates VTG (Vulcan Tech Gospel) mode and elemental type from pictograph data.
 * Uses a lookup table approach based on letter, grid mode, and start position.
 */

import {
  VTGMode,
  ElementalType,
  GridMode,
  GridPosition,
} from "@tka/types";
import type { Letter, PictographData } from "@tka/types";

export interface VTGCalculationResult {
  vtgMode: VTGMode | null;
  elementalType: ElementalType | null;
}

const VTG_TO_ELEMENTAL: Record<VTGMode, ElementalType> = {
  [VTGMode.SPLIT_SAME]: ElementalType.WATER,
  [VTGMode.SPLIT_OPP]: ElementalType.FIRE,
  [VTGMode.TOG_SAME]: ElementalType.EARTH,
  [VTGMode.TOG_OPP]: ElementalType.AIR,
  [VTGMode.QUARTER_SAME]: ElementalType.SUN,
  [VTGMode.QUARTER_OPP]: ElementalType.MOON,
};

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

export function calculateVTG(
  letter: Letter,
  gridMode: GridMode,
  startPosition: GridPosition
): VTGCalculationResult {
  const defaultResult: VTGCalculationResult = {
    vtgMode: null,
    elementalType: null,
  };

  const letterValue = letter as string;

  if (!letterValue) {
    return defaultResult;
  }

  const modeMap =
    gridMode === GridMode.DIAMOND ? DIAMOND_MODE_MAP : BOX_MODE_MAP;

  const modeOrFunction = modeMap[letterValue];

  if (!modeOrFunction) {
    return defaultResult;
  }

  const vtgMode =
    typeof modeOrFunction === "function"
      ? modeOrFunction(startPosition)
      : modeOrFunction;

  const elementalType = VTG_TO_ELEMENTAL[vtgMode];

  return {
    vtgMode,
    elementalType,
  };
}
