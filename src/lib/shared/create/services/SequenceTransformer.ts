/**
 * Sequence Transformation Service
 *
 * Injectable facade that composes pure transform functions.
 * Provides DI integration while delegating to pure functions.
 *
 * For single-hand transforms (blue or red), this service passes the required
 * services to derive new positions and look up correct letters.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { IMotionQueryHandler } from "$lib/shared/foundation/services/data/data-contracts";
import type { OrientationCalculator } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";
import type { GridPositionDeriver } from "$lib/shared/pictograph/grid/services/implementations/GridPositionDeriver";
import type { ReversalDetector } from "$lib/shared/create/services/reversal-detector";
import type { TargetHand } from "$lib/shared/create/state/panel-coordination-state.svelte";

import {
  clearSequence,
  duplicateSequence,
  mirrorSequence,
  flipSequence,
  rotateSequence,
  colorSwapSequence,
  invertSequence,
  rewindSequence,
  shiftStartPosition,
  deriveSequenceLetters,
} from "$lib/shared/create/services/sequence-transforms";

export class SequenceTransformer {
  constructor(
    private readonly motionQueryHandler: IMotionQueryHandler,
    private readonly orientationCalculator: OrientationCalculator,
    private readonly reversalDetector: ReversalDetector,
    private readonly positionDeriver: GridPositionDeriver
  ) {}

  clearSequence(sequence: SequenceData): SequenceData {
    return clearSequence(sequence);
  }

  duplicateSequence(sequence: SequenceData, newName?: string): SequenceData {
    return duplicateSequence(sequence, newName);
  }

  async mirrorSequence(
    sequence: SequenceData,
    targetHand: TargetHand = "both"
  ): Promise<SequenceData> {
    return mirrorSequence(
      sequence,
      this.positionDeriver,
      this.motionQueryHandler,
      targetHand
    );
  }

  async flipSequence(
    sequence: SequenceData,
    targetHand: TargetHand = "both"
  ): Promise<SequenceData> {
    return flipSequence(
      sequence,
      this.positionDeriver,
      this.motionQueryHandler,
      targetHand
    );
  }

  swapColors(sequence: SequenceData): SequenceData {
    // Note: swapColors always operates on both hands - that's its purpose
    return colorSwapSequence(sequence);
  }

  async rotateSequence(
    sequence: SequenceData,
    rotationAmount: number,
    targetHand: TargetHand = "both"
  ): Promise<SequenceData> {
    return rotateSequence(
      sequence,
      rotationAmount,
      this.positionDeriver,
      this.motionQueryHandler,
      targetHand
    );
  }

  async invertSequence(
    sequence: SequenceData,
    targetHand: TargetHand = "both"
  ): Promise<SequenceData> {
    return invertSequence(
      sequence,
      this.motionQueryHandler,
      this.orientationCalculator,
      targetHand
    );
  }

  async rewindSequence(
    sequence: SequenceData,
    targetHand: TargetHand = "both"
  ): Promise<SequenceData> {
    // First, apply the rewind transformation (reverses beat order, swaps start/end positions)
    const rewoundSequence = await rewindSequence(
      sequence,
      this.motionQueryHandler,
      targetHand
    );

    // Then recalculate reversals based on the new beat order
    // This is critical because reversals depend on comparing consecutive steps
    // and beat 1 should never have reversals (nothing before it to compare)
    return this.reversalDetector.processReversals(rewoundSequence);
  }

  shiftStartPosition(
    sequence: SequenceData,
    targetStepNumber: number
  ): SequenceData {
    return shiftStartPosition(sequence, targetStepNumber);
  }

  async deriveSequenceLetters(sequence: SequenceData): Promise<SequenceData> {
    return deriveSequenceLetters(sequence, this.motionQueryHandler);
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
import { motionQueryHandler } from "$lib/shared/pictograph/shared/services/implementations/MotionQueryHandler";
import { orientationCalculator } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";
import { reversalDetector } from "$lib/shared/create/services/reversal-detector";
import { gridPositionDeriver } from "$lib/shared/pictograph/grid/services/implementations/GridPositionDeriver";

export const sequenceTransformer = new SequenceTransformer(
  motionQueryHandler,
  orientationCalculator,
  reversalDetector,
  gridPositionDeriver
);
