/**
 * Bridge Finder Interface
 *
 * Finds bridge letters that can connect a sequence to a loopable position.
 * Used for circularization when the sequence end position doesn't directly
 * align with the start position for LOOP application.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { CircularizationOption } from "./ISequenceExtender";

export interface IBridgeFinder {
  /**
   * Get circularization options for a sequence that isn't directly loopable.
   * Returns bridge letter options that would bring the sequence to a loopable position.
   *
   * This is used when the sequence end position is in a different group than
   * the start position (e.g., alpha vs beta).
   *
   * @param sequence - The current sequence to analyze
   * @returns Array of circularization options, each with a bridge letter and available LOOPs
   */
  getCircularizationOptions(
    sequence: SequenceData
  ): Promise<CircularizationOption[]>;

  /**
   * Get all extension options that would bring the sequence to a loopable position.
   * Only returns pictographs that END in the same position GROUP as the sequence starts.
   *
   * For example: if sequence starts at alpha3, only show letters that end in alpha1/3/5/7.
   * Used for pictograph-first UX where user selects a bridge pictograph visually.
   *
   * @param sequence - The current sequence to analyze
   * @returns Array of extension options with bridge letters, LOOPs, and orientation info
   */
  getAllExtensionOptions(
    sequence: SequenceData
  ): Promise<CircularizationOption[]>;
}
