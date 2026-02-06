/**
 * Tunnel Mode Sequence Manager Interface
 *
 * Coordinates sequence loading and transformations for Tunnel Mode.
 * Handles both primary and secondary sequences with consistent logic.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export type SequenceType = "primary" | "secondary";
export type TransformOperation = "mirror" | "rotate" | "colorSwap" | "rewind";

export interface ITunnelModeSequenceManager {
  /**
   * Load a sequence for animation, handling both working sequences
   * (from Create module) and database sequences that need loading.
   *
   * @param sequence The sequence to load
   * @param type Whether this is primary or secondary sequence
   * @returns Fully loaded sequence with all beat data, or null on error
   */
  loadSequence(
    sequence: SequenceData,
    type: SequenceType
  ): Promise<SequenceData | null>;

  /**
   * Transform a sequence and invoke callback with transformed result.
   * Handles all transformation operations in a unified way.
   *
   * @param sequence The sequence to transform
   * @param type Whether this is primary or secondary sequence
   * @param operation The transformation to apply
   * @param onUpdate Callback invoked with transformed sequence
   */
  transformAndUpdate(
    sequence: SequenceData,
    type: SequenceType,
    operation: TransformOperation,
    onUpdate: (transformed: SequenceData) => void
  ): Promise<void>;
}
