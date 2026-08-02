/**
 * Start Position Presets
 *
 * Defines preset configurations for allowed/blocked starting positions.
 * Uses a blocklist approach: positions NOT in the blocked list are allowed.
 */

import { GridMode, GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

/**
 * Available preset options for start position selection
 */
export enum StartPositionPreset {
  /** All positions allowed - no restrictions */
  ANY = "any",
  /**
   * Classic Three - the original representative positions:
   * - ALPHA1/ALPHA2: Hands opposite (180°)
   * - BETA5/BETA4: Hands parallel (0°)
   * - GAMMA11/GAMMA12: Hands perpendicular (90°)
   *
   * Named "Classic" because these are the foundational positions
   * representing each position type (alpha, beta, gamma).
   */
  CLASSIC = "classic",
  /** User's custom selection - persisted between sessions */
  CUSTOM = "custom",
}

/**
 * Human-readable labels for presets
 */
export const PRESET_LABELS: Record<StartPositionPreset, string> = {
  [StartPositionPreset.ANY]: "All",
  [StartPositionPreset.CLASSIC]: "Classic 3",
  [StartPositionPreset.CUSTOM]: "Custom",
};

/**
 * Descriptions for each preset
 */
export const PRESET_DESCRIPTIONS: Record<StartPositionPreset, string> = {
  [StartPositionPreset.ANY]: "All 16 positions",
  [StartPositionPreset.CLASSIC]: "α1, β5, γ11",
  [StartPositionPreset.CUSTOM]: "Your selection",
};

// =============================================================================
// DIAMOND MODE POSITIONS (odd numbers)
// =============================================================================

/** All diamond mode positions */
export const ALL_DIAMOND_POSITIONS: GridPosition[] = [
  GridPosition.ALPHA1,
  GridPosition.ALPHA3,
  GridPosition.ALPHA5,
  GridPosition.ALPHA7,
  GridPosition.BETA1,
  GridPosition.BETA3,
  GridPosition.BETA5,
  GridPosition.BETA7,
  GridPosition.GAMMA1,
  GridPosition.GAMMA3,
  GridPosition.GAMMA5,
  GridPosition.GAMMA7,
  GridPosition.GAMMA9,
  GridPosition.GAMMA11,
  GridPosition.GAMMA13,
  GridPosition.GAMMA15,
];

/** Classic Three positions for diamond mode */
export const CLASSIC_DIAMOND_POSITIONS: GridPosition[] = [
  GridPosition.ALPHA1,
  GridPosition.BETA5,
  GridPosition.GAMMA11,
];

// =============================================================================
// BOX MODE POSITIONS (even numbers)
// =============================================================================

/** All box mode positions */
export const ALL_BOX_POSITIONS: GridPosition[] = [
  GridPosition.ALPHA2,
  GridPosition.ALPHA4,
  GridPosition.ALPHA6,
  GridPosition.ALPHA8,
  GridPosition.BETA2,
  GridPosition.BETA4,
  GridPosition.BETA6,
  GridPosition.BETA8,
  GridPosition.GAMMA2,
  GridPosition.GAMMA4,
  GridPosition.GAMMA6,
  GridPosition.GAMMA8,
  GridPosition.GAMMA10,
  GridPosition.GAMMA12,
  GridPosition.GAMMA14,
  GridPosition.GAMMA16,
];

/** Classic Three positions for box mode */
export const CLASSIC_BOX_POSITIONS: GridPosition[] = [
  GridPosition.ALPHA2,
  GridPosition.BETA4,
  GridPosition.GAMMA12,
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get all positions for a grid mode
 */
export function getAllPositions(gridMode: GridMode): GridPosition[] {
  return gridMode === GridMode.DIAMOND
    ? ALL_DIAMOND_POSITIONS
    : ALL_BOX_POSITIONS;
}

/**
 * Read the persisted blocked-position slice that belongs to one grid mode.
 * The full array may hold preferences for both grids so switching modes does
 * not discard the selection the user made in the other grid.
 */
export function getBlockedPositionsForGrid(
  blockedPositions: readonly GridPosition[],
  gridMode: GridMode
): GridPosition[] {
  const gridPositions = new Set(getAllPositions(gridMode));
  return blockedPositions.filter((position) => gridPositions.has(position));
}

/**
 * Get the blocked positions for a preset
 * Returns positions that should be EXCLUDED (blocklist approach)
 *
 * Note: CUSTOM preset returns empty array - the caller should use
 * the stored custom blocked positions instead.
 */
export function getBlockedPositionsForPreset(
  preset: StartPositionPreset,
  gridMode: GridMode
): GridPosition[] {
  const allPositions = getAllPositions(gridMode);

  switch (preset) {
    case StartPositionPreset.ANY:
      // Nothing blocked - all positions allowed
      return [];

    case StartPositionPreset.CLASSIC: {
      // Block everything EXCEPT the classic three
      const classicPositions =
        gridMode === GridMode.DIAMOND
          ? CLASSIC_DIAMOND_POSITIONS
          : CLASSIC_BOX_POSITIONS;

      return allPositions.filter((pos) => !classicPositions.includes(pos));
    }

    case StartPositionPreset.CUSTOM:
      // Custom - caller manages their own blocked list
      // Return empty array as a signal to use stored custom selection
      return [];

    default:
      return [];
  }
}

/**
 * Get allowed positions (inverse of blocked)
 */
export function getAllowedPositions(
  blockedPositions: GridPosition[],
  gridMode: GridMode
): GridPosition[] {
  const allPositions = getAllPositions(gridMode);
  const blockedSet = new Set(blockedPositions);
  return allPositions.filter((pos) => !blockedSet.has(pos));
}

/**
 * Determine which preset matches a given blocked list
 * Returns CUSTOM if no preset matches exactly
 */
export function detectPresetFromBlocked(
  blockedPositions: GridPosition[],
  gridMode: GridMode
): StartPositionPreset {
  const blocked = new Set(
    getBlockedPositionsForGrid(blockedPositions, gridMode)
  );

  // Check ANY (nothing blocked)
  if (blocked.size === 0) {
    return StartPositionPreset.ANY;
  }

  // Check CLASSIC (all but 3 blocked)
  const classicBlocked = getBlockedPositionsForPreset(
    StartPositionPreset.CLASSIC,
    gridMode
  );
  if (
    classicBlocked.length === blocked.size &&
    classicBlocked.every((pos) => blocked.has(pos))
  ) {
    return StartPositionPreset.CLASSIC;
  }

  // Any other configuration is CUSTOM
  return StartPositionPreset.CUSTOM;
}

/**
 * Get a random allowed position
 */
export function getRandomAllowedPosition(
  blockedPositions: GridPosition[],
  gridMode: GridMode
): GridPosition {
  const allowed = getAllowedPositions(blockedPositions, gridMode);

  if (allowed.length === 0) {
    // Fallback to first position if somehow all are blocked
    console.warn("All positions blocked, falling back to first position");
    return getAllPositions(gridMode)[0]!;
  }

  return allowed[Math.floor(Math.random() * allowed.length)]!;
}
