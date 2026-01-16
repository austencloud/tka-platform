/**
 * Mirrored Rotated LOOP Executor
 *
 * Executes the mirrored-rotated LOOP (Linked Orbital Offset Pattern) by composing
 * two LOOP operations sequentially:
 * 1. ROTATED: Apply strict rotation with user-selected slice size (halved or quartered)
 * 2. MIRRORED: Apply vertical mirroring to double the sequence again
 *
 * Examples:
 *
 * HALVED mode (16-count sequence):
 * - Generate 4 letters (16 ÷ 4)
 * - Rotation (halved) → 8 letters (4 × 2, returns to home)
 * - Mirroring → 16 letters (8 × 2)
 *
 * QUARTERED mode (16-count sequence):
 * - Generate 2 letters (16 ÷ 8)
 * - Rotation (quartered) → 8 letters (2 × 4, returns to home)
 * - Mirroring → 16 letters (8 × 2)
 *
 * IMPORTANT: Supports both halved and quartered slice sizes
 * IMPORTANT: End position for generation must match the rotation requirement
 */

import { SliceSize } from "../../domain/models/circular-models";
import type { ILOOPExecutor } from "../contracts/ILOOPExecutor";
import type { StepData } from "../../../../shared/domain/models/StepData";

export class MirroredRotatedLOOPExecutor implements ILOOPExecutor {
  constructor(
    private readonly strictRotatedExecutor: ILOOPExecutor,
    private readonly strictMirroredExecutor: ILOOPExecutor
  ) {}

  /**
   * Execute the mirrored-rotated LOOP by composing rotation + mirroring
   *
   * @param sequence - The partial sequence to complete (must include start position at index 0)
   * @param sliceSize - The slice size for rotation (halved or quartered)
   * @returns The complete circular sequence with all steps
   */
  executeLOOP(sequence: StepData[], sliceSize: SliceSize): StepData[] {
    // Step 1: Apply STRICT_ROTATED with user-selected slice size
    // HALVED: doubles the sequence (e.g., 4 steps → 8 steps)
    // QUARTERED: quadruples the sequence (e.g., 2 steps → 8 steps)
    // Returns to home position in both cases
    const rotatedSequence = this.strictRotatedExecutor.executeLOOP(
      sequence,
      sliceSize
    );

    // Step 2: Apply STRICT_MIRRORED to the rotated sequence
    // This always doubles the sequence using vertical mirroring
    // For example: 8 steps → 16 steps final
    const finalSequence = this.strictMirroredExecutor.executeLOOP(
      rotatedSequence,
      SliceSize.HALVED // Not actually used by mirrored executor, but passed for consistency
    );

    return finalSequence;
  }
}
