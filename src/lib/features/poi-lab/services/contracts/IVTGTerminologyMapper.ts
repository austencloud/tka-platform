/**
 * VTG Terminology Mapper Interface
 *
 * Maps TKA pictograph data to VTG (Vulcan Tech Gospel) terminology.
 * Enables displaying VTG terms alongside TKA notation.
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { VTGTerminologyMapping } from "../../domain/poi-models";

export interface IVTGTerminologyMapper {
  /**
   * Derive VTG terminology from a pictograph's motions.
   *
   * Calculates:
   * - Timing: Together (same phase) vs Split (180° out)
   * - Direction: Same (both spin same way) vs Opposite
   * - Ratio: 1:1, 1:3, 1:5 based on turns
   *
   * Returns null if the pictograph doesn't have two motions.
   */
  deriveVTGTerminology(pictograph: PictographData): VTGTerminologyMapping | null;

  /**
   * Get pattern ratio from turn count.
   *
   * - turns <= 1 → "1:1"
   * - turns <= 3 → "1:3"
   * - turns > 3 → "1:5"
   */
  getPatternRatio(turns: number): string;
}
