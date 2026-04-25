/**
 * Sequence Equivalence Detector Implementation
 *
 * Detects when two sequences are equivalent despite transforms:
 * 1. Spatial rotation (45° increments around the grid)
 * 2. Circular rotation (different starting beat in circular sequences)
 * 3. Combined transforms
 *
 * This implementation fulfills the existing ISequenceEquivalenceDetector contract.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type {
  ISequenceEquivalenceDetector,
  EquivalenceResult,
  EquivalenceType,
  TransformDetails,
  SequenceSignature,
  StepSignature,
  MotionSignature,
} from "$lib/features/create/shared/services/contracts/ISequenceEquivalenceDetector";
import type { ISequenceCanonicalizer } from "../contracts/ISequenceCanonicalizer";
import type { IStepSignatureGenerator } from "../contracts/IStepSignatureGenerator";
import type { ISpatialTransformDetector } from "../contracts/ISpatialTransformDetector";
import type { IWordCyclicEquivalenceDetector } from "$lib/features/create/shared/services/contracts/IWordCyclicEquivalenceDetector";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export class SequenceEquivalenceDetector implements ISequenceEquivalenceDetector {
  constructor(
    private readonly sequenceCanonicalizer: ISequenceCanonicalizer,
    private readonly stepSignatureGenerator: IStepSignatureGenerator,
    private readonly spatialTransformDetector: ISpatialTransformDetector,
    private readonly wordCyclicEquivalenceDetector: IWordCyclicEquivalenceDetector
  ) {}

  areEquivalent(sequenceA: SequenceData, sequenceB: SequenceData): EquivalenceResult {
    // Quick rejection checks
    if (sequenceA.steps.length !== sequenceB.steps.length) {
      return this.notEquivalent();
    }

    if (sequenceA.steps.length === 0) {
      // Empty sequences are identical
      return this.identical();
    }

    // Check for identical sequences
    if (this.areIdentical(sequenceA, sequenceB)) {
      return this.identical();
    }

    // Check for circular rotation equivalence (same sequence, different start beat)
    if (sequenceA.isCircular && sequenceB.isCircular) {
      const circularResult = this.checkCircularRotation(sequenceA, sequenceB);
      if (circularResult.isEquivalent) {
        return circularResult;
      }
    }

    // Check for spatial rotation equivalence (same sequence, rotated around grid)
    const spatialResult = this.checkSpatialRotation(sequenceA, sequenceB);
    if (spatialResult.isEquivalent) {
      return spatialResult;
    }

    // Check for combined transforms (both circular and spatial)
    if (sequenceA.isCircular && sequenceB.isCircular) {
      const combinedResult = this.checkCombinedTransforms(sequenceA, sequenceB);
      if (combinedResult.isEquivalent) {
        return combinedResult;
      }
    }

    return this.notEquivalent();
  }

  generateSignature(sequence: SequenceData): SequenceSignature {
    const internalSig = this.sequenceCanonicalizer.generateSignature(sequence);

    // Convert internal signature to the interface's expected format
    return {
      word: internalSig.canonicalWord,
      stepCount: internalSig.stepCount,
      isCircular: internalSig.isCircular,
      beatSignatures: internalSig.beatSignatures.map((bs) =>
        this.convertStepSignature(bs)
      ),
      hash: internalSig.hash,
    };
  }

  normalizeRotation(sequence: SequenceData): SequenceData {
    // For now, return the sequence unchanged
    // Full implementation would rotate to a canonical spatial orientation
    // This is a placeholder that satisfies the interface
    return sequence;
  }

  findEquivalentSequences(
    target: SequenceData,
    candidates: readonly SequenceData[]
  ): readonly { sequence: SequenceData; equivalence: EquivalenceResult }[] {
    const results: { sequence: SequenceData; equivalence: EquivalenceResult }[] = [];

    // Generate target hash for quick filtering
    const targetHash = this.sequenceCanonicalizer.generateHash(target);

    for (const candidate of candidates) {
      // Skip if different length (quick rejection)
      if (candidate.steps.length !== target.steps.length) {
        continue;
      }

      // Quick hash comparison for potential matches
      const candidateHash = this.sequenceCanonicalizer.generateHash(candidate);
      if (candidateHash === targetHash) {
        // Hashes match, do full comparison
        const equivalence = this.areEquivalent(target, candidate);
        if (equivalence.isEquivalent) {
          results.push({ sequence: candidate, equivalence });
        }
      } else {
        // Hashes differ, but could still be spatially rotated equivalent
        // Do full comparison for spatial rotation
        const equivalence = this.areEquivalent(target, candidate);
        if (equivalence.isEquivalent) {
          results.push({ sequence: candidate, equivalence });
        }
      }
    }

    return results;
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private areIdentical(seqA: SequenceData, seqB: SequenceData): boolean {
    if (seqA.word !== seqB.word) {
      return false;
    }

    // Compare each beat
    for (let i = 0; i < seqA.steps.length; i++) {
      const stepA = seqA.steps[i];
      const stepB = seqB.steps[i];

      if (!stepA || !stepB) {
        return false;
      }

      const blueA = stepA.motions[MotionColor.BLUE];
      const redA = stepA.motions[MotionColor.RED];
      const blueB = stepB.motions[MotionColor.BLUE];
      const redB = stepB.motions[MotionColor.RED];

      if (!blueA || !redA || !blueB || !redB) {
        return false;
      }

      // Compare locations
      if (
        blueA.startLocation !== blueB.startLocation ||
        blueA.endLocation !== blueB.endLocation ||
        redA.startLocation !== redB.startLocation ||
        redA.endLocation !== redB.endLocation
      ) {
        return false;
      }

      // Compare motion types
      if (blueA.motionType !== blueB.motionType || redA.motionType !== redB.motionType) {
        return false;
      }
    }

    return true;
  }

  private checkCircularRotation(
    seqA: SequenceData,
    seqB: SequenceData
  ): EquivalenceResult {
    // Use word cyclic equivalence detector
    const wordResult = this.wordCyclicEquivalenceDetector.areCyclicEquivalent(
      seqA.word,
      seqB.word
    );

    if (!wordResult.isEquivalent) {
      return this.notEquivalent();
    }

    const offset = wordResult.rotationOffset ?? 0;

    // Verify that the actual step data matches when rotated
    if (!this.verifyCircularRotation(seqA, seqB, offset)) {
      return this.notEquivalent();
    }

    return {
      isEquivalent: true,
      equivalenceType: "circular-rotation",
      transform: {
        spatialRotationSteps: null,
        circularOffset: offset,
        gridModeToggled: false,
      },
    };
  }

  private verifyCircularRotation(
    seqA: SequenceData,
    seqB: SequenceData,
    offset: number
  ): boolean {
    const len = seqA.steps.length;

    for (let i = 0; i < len; i++) {
      const stepA = seqA.steps[i];
      const stepBIndex = (i + offset) % len;
      const stepB = seqB.steps[stepBIndex];

      if (!stepA || !stepB) {
        return false;
      }

      const sigA = this.stepSignatureGenerator.generateSignature(stepA);
      const sigB = this.stepSignatureGenerator.generateSignature(stepB);

      if (!this.stepSignatureGenerator.signaturesMatch(sigA, sigB)) {
        return false;
      }
    }

    return true;
  }

  private checkSpatialRotation(
    seqA: SequenceData,
    seqB: SequenceData
  ): EquivalenceResult {
    // Try all 8 possible spatial rotations
    for (let rotationSteps = 1; rotationSteps < 8; rotationSteps++) {
      if (this.verifySpatialRotation(seqA, seqB, rotationSteps)) {
        return {
          isEquivalent: true,
          equivalenceType: "spatial-rotation",
          transform: {
            spatialRotationSteps: rotationSteps,
            circularOffset: null,
            gridModeToggled: rotationSteps % 2 === 1,
          },
        };
      }
    }

    return this.notEquivalent();
  }

  private verifySpatialRotation(
    seqA: SequenceData,
    seqB: SequenceData,
    rotationSteps: number
  ): boolean {
    for (let i = 0; i < seqA.steps.length; i++) {
      const stepA = seqA.steps[i];
      const stepB = seqB.steps[i];

      if (!stepA || !stepB) {
        return false;
      }

      if (!this.spatialTransformDetector.isRotationOf(stepA, stepB, rotationSteps)) {
        return false;
      }
    }

    return true;
  }

  private checkCombinedTransforms(
    seqA: SequenceData,
    seqB: SequenceData
  ): EquivalenceResult {
    // Try all combinations of circular offset and spatial rotation
    const len = seqA.steps.length;

    for (let circularOffset = 1; circularOffset < len; circularOffset++) {
      for (let spatialSteps = 0; spatialSteps < 8; spatialSteps++) {
        if (this.verifyCombinedTransform(seqA, seqB, circularOffset, spatialSteps)) {
          return {
            isEquivalent: true,
            equivalenceType: "combined",
            transform: {
              spatialRotationSteps: spatialSteps > 0 ? spatialSteps : null,
              circularOffset,
              gridModeToggled: spatialSteps % 2 === 1,
            },
          };
        }
      }
    }

    return this.notEquivalent();
  }

  private verifyCombinedTransform(
    seqA: SequenceData,
    seqB: SequenceData,
    circularOffset: number,
    spatialSteps: number
  ): boolean {
    const len = seqA.steps.length;

    for (let i = 0; i < len; i++) {
      const stepA = seqA.steps[i];
      const stepBIndex = (i + circularOffset) % len;
      const stepB = seqB.steps[stepBIndex];

      if (!stepA || !stepB) {
        return false;
      }

      // If spatial steps is 0, just compare signatures
      if (spatialSteps === 0) {
        const sigA = this.stepSignatureGenerator.generateSignature(stepA);
        const sigB = this.stepSignatureGenerator.generateSignature(stepB);
        if (!this.stepSignatureGenerator.signaturesMatch(sigA, sigB)) {
          return false;
        }
      } else {
        // Check spatial rotation
        if (!this.spatialTransformDetector.isRotationOf(stepA, stepB, spatialSteps)) {
          return false;
        }
      }
    }

    return true;
  }

  private notEquivalent(): EquivalenceResult {
    return {
      isEquivalent: false,
      equivalenceType: null,
      transform: null,
    };
  }

  private identical(): EquivalenceResult {
    return {
      isEquivalent: true,
      equivalenceType: "identical",
      transform: {
        spatialRotationSteps: null,
        circularOffset: null,
        gridModeToggled: false,
      },
    };
  }

  /**
   * Convert internal StepSignature to the interface's expected format.
   */
  private convertStepSignature(internal: import("../../domain/models/signatures").StepSignature): StepSignature {
    return {
      blue: this.convertMotionSignature(internal.blue),
      red: this.convertMotionSignature(internal.red),
      positionGroup: internal.startPositionGroup,
    };
  }

  /**
   * Convert internal MotionSignature to the interface's expected format.
   */
  private convertMotionSignature(internal: import("../../domain/models/signatures").MotionSignature): MotionSignature {
    return {
      type: internal.motionType,
      direction: internal.rotationDirection,
      turns: internal.turns,
      orientationTransition: `${internal.orientationTransition.from}→${internal.orientationTransition.to}`,
    };
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
import { sequenceCanonicalizer } from "./SequenceCanonicalizer";
import { stepSignatureGenerator } from "./StepSignatureGenerator";
import { spatialTransformDetector } from "./SpatialTransformDetector";
import { wordCyclicEquivalenceDetector } from "$lib/features/create/shared/services/implementations/WordCyclicEquivalenceDetector";

export const sequenceEquivalenceDetector = new SequenceEquivalenceDetector(
  sequenceCanonicalizer,
  stepSignatureGenerator,
  spatialTransformDetector,
  wordCyclicEquivalenceDetector
);
