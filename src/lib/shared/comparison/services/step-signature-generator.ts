/**
 * Beat Signature Generator Implementation
 *
 * Creates rotation-invariant signatures for complete beats (both hands).
 * Composes motion signatures with position group and hand angle information.
 */

import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { MotionSignatureGenerator } from "./motion-signature-generator";
import type {
  StepSignature,
  StepComparisonResult,
  MotionSignature,
} from "../domain/models/signatures";
import type {
  GridPosition} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  GridLocation,
  GridPositionGroup,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { getPositionGroup } from "$lib/shared/foundation/domain/models/generation/circular-position-maps";

/**
 * Scoring weights for beat similarity calculation.
 */
const SCORING_WEIGHTS = {
  blueMotion: 0.35,
  redMotion: 0.35,
  positionGroup: 0.20,
  handAngle: 0.10,
} as const;

/**
 * Map of grid locations to their angular position (in 45° steps from north).
 */
const LOCATION_TO_ANGLE: Record<GridLocation, number> = {
  [GridLocation.NORTH]: 0,
  [GridLocation.NORTHEAST]: 1,
  [GridLocation.EAST]: 2,
  [GridLocation.SOUTHEAST]: 3,
  [GridLocation.SOUTH]: 4,
  [GridLocation.SOUTHWEST]: 5,
  [GridLocation.WEST]: 6,
  [GridLocation.NORTHWEST]: 7,
  [GridLocation.CENTER]: 0,
};

export class StepSignatureGenerator {
  constructor(private readonly motionSignatureGenerator: MotionSignatureGenerator) {}

  generateSignature(step: StepData): StepSignature {
    const blueMotion = step.motions[MotionColor.BLUE];
    const redMotion = step.motions[MotionColor.RED];

    if (!blueMotion || !redMotion) {
      throw new Error("Beat must have both blue and red motions");
    }

    const blueSignature = this.motionSignatureGenerator.generateSignature(blueMotion);
    const redSignature = this.motionSignatureGenerator.generateSignature(redMotion);

    const startPositionGroup = this.derivePositionGroup(step.startPosition);
    const endPositionGroup = this.derivePositionGroup(step.endPosition);

    const startHandAngle = this.calculateHandAngle(
      blueMotion.startLocation,
      redMotion.startLocation
    );
    const endHandAngle = this.calculateHandAngle(
      blueMotion.endLocation,
      redMotion.endLocation
    );

    const hash = this.generateHash(
      blueSignature,
      redSignature,
      startPositionGroup,
      endPositionGroup,
      startHandAngle,
      endHandAngle
    );

    return {
      startPositionGroup,
      endPositionGroup,
      blue: blueSignature,
      red: redSignature,
      startHandAngle,
      endHandAngle,
      hash,
    };
  }

  signaturesMatch(a: StepSignature, b: StepSignature): boolean {
    // Quick check: if hashes differ, definitely not equal
    if (a.hash !== b.hash) {
      return false;
    }

    return (
      a.startPositionGroup === b.startPositionGroup &&
      a.endPositionGroup === b.endPositionGroup &&
      this.motionSignatureGenerator.signaturesMatch(a.blue, b.blue) &&
      this.motionSignatureGenerator.signaturesMatch(a.red, b.red) &&
      a.startHandAngle === b.startHandAngle &&
      a.endHandAngle === b.endHandAngle
    );
  }

  compareSignatures(a: StepSignature, b: StepSignature): StepComparisonResult {
    const blueComparison = this.motionSignatureGenerator.compareSignatures(a.blue, b.blue);
    const redComparison = this.motionSignatureGenerator.compareSignatures(a.red, b.red);

    const positionGroupMatch =
      a.startPositionGroup === b.startPositionGroup &&
      a.endPositionGroup === b.endPositionGroup;

    const handAngleMatch =
      a.startHandAngle === b.startHandAngle && a.endHandAngle === b.endHandAngle;

    // Calculate weighted similarity
    let score = 0;
    score += SCORING_WEIGHTS.blueMotion * blueComparison.similarity;
    score += SCORING_WEIGHTS.redMotion * redComparison.similarity;
    score += SCORING_WEIGHTS.positionGroup * (positionGroupMatch ? 1 : 0);
    score += SCORING_WEIGHTS.handAngle * (handAngleMatch ? 1 : 0);

    const isExactMatch =
      blueComparison.isExactMatch &&
      redComparison.isExactMatch &&
      positionGroupMatch &&
      handAngleMatch;

    return {
      isExactMatch,
      similarity: Math.min(1, Math.max(0, score)),
      breakdown: {
        positionGroupMatch,
        blueSimilarity: blueComparison.similarity,
        redSimilarity: redComparison.similarity,
        handAngleMatch,
      },
    };
  }

  generateSignatures(steps: readonly StepData[]): readonly StepSignature[] {
    return steps.map((step) => this.generateSignature(step));
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Derive position group from a GridPosition.
   * Falls back to ALPHA if position is not provided.
   */
  private derivePositionGroup(position: GridPosition | null | undefined): GridPositionGroup {
    if (!position) {
      return GridPositionGroup.ALPHA;
    }

    try {
      return getPositionGroup(position);
    } catch (error) {
      // If position doesn't match expected format, try parsing the prefix.
      if (position.startsWith("alpha")) return GridPositionGroup.ALPHA;
      if (position.startsWith("beta")) return GridPositionGroup.BETA;
      if (position.startsWith("gamma")) return GridPositionGroup.GAMMA;
      if (position.startsWith("zeta")) return GridPositionGroup.ZETA;
      if (position.startsWith("eta")) return GridPositionGroup.ETA;
      // Nothing matched — the position data is corrupt. Surface it instead of
      // silently treating every bad value as ALPHA, which would produce wrong
      // signatures (and wrong comparison results) with no trace.
      console.warn(
        `[StepSignatureGenerator] Unrecognized position "${position}"; falling back to ALPHA. Comparison results may be inaccurate.`,
        error
      );
      return GridPositionGroup.ALPHA;
    }
  }

  /**
   * Calculate the angular distance between two hand locations.
   * Returns value from 0-4 (in 45° steps):
   * - 0 = same location (beta)
   * - 1 = 45° apart (eta)
   * - 2 = 90° apart (gamma)
   * - 3 = 135° apart (zeta)
   * - 4 = 180° apart (alpha)
   */
  private calculateHandAngle(blueLocation: GridLocation, redLocation: GridLocation): number {
    const blueAngle = LOCATION_TO_ANGLE[blueLocation];
    const redAngle = LOCATION_TO_ANGLE[redLocation];

    // Calculate absolute angular difference
    let diff = Math.abs(blueAngle - redAngle);

    // Normalize to 0-4 range (shortest path around the circle)
    if (diff > 4) {
      diff = 8 - diff;
    }

    return diff;
  }

  /**
   * Generate a hash for quick inequality checking.
   */
  private generateHash(
    blue: MotionSignature,
    red: MotionSignature,
    startPosGroup: GridPositionGroup,
    endPosGroup: GridPositionGroup,
    startAngle: number,
    endAngle: number
  ): string {
    const blueHash = this.motionSignatureGenerator.hashSignature(blue);
    const redHash = this.motionSignatureGenerator.hashSignature(red);
    return `${startPosGroup}>${endPosGroup}:${startAngle}-${endAngle}:B[${blueHash}]R[${redHash}]`;
  }
}
