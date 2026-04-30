/**
 * LOOP Validator Interface
 *
 * Validates which LOOP (Linked Orbital Offset Pattern) types are available
 * for a given position pair. Used by sequence extension to determine valid
 * extension patterns.
 */

import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { LOOPOption } from "./ISequenceExtender";
import type {
  LOOPType,
  Period,
} from "$lib/features/create/generate/circular/domain/models/circular-models";

/**
 * Result of validating LOOP options for a position pair
 */
export interface LOOPValidationResult {
  /** LOOP options that are valid for this position pair */
  available: LOOPOption[];
  /** LOOP options that exist but aren't valid for this position pair */
  unavailable: LOOPOption[];
}

export interface ILOOPValidator {
  /**
   * Get LOOP options filtered by validity for a position pair.
   * Checks which LOOP types can work given the start and end positions.
   *
   * @param startPosition - The starting position
   * @param endPosition - The ending position
   * @param period - Whether this is a halved (180°) or quartered (90°) rotation
   * @returns Object with available and unavailable LOOP options
   */
  getLOOPOptionsForPositionPair(
    startPosition: GridPosition,
    endPosition: GridPosition,
    period: Period
  ): LOOPValidationResult;

  /**
   * Check if a specific LOOP type is valid for a given position pair.
   *
   * @param loopType - The LOOP type to check
   * @param positionPair - Position pair string in format "start,end"
   * @param period - Whether this is a halved or quartered rotation
   * @returns true if the LOOP type is valid for this position pair
   */
  isLOOPValidForPositionPair(
    loopType: LOOPType,
    positionPair: string,
    period: Period
  ): boolean;

  /**
   * Get all supported LOOP options (regardless of position validity).
   * Used for UI display when showing all possible LOOPs.
   *
   * @returns Array of all supported LOOP options
   */
  getAllSupportedLOOPOptions(): LOOPOption[];
}
