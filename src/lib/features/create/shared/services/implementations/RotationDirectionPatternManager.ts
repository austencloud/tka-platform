/**
 * Rotation Direction Pattern Service Implementation
 *
 * Handles extraction, application, and persistence of rotation direction patterns.
 * Rotation direction patterns capture rotation direction (CW/CCW) per beat to transform sequences.
 *
 * Key difference from Turn Pattern Service:
 * - Turn patterns modify the NUMBER of turns (0, 1, 2, fl, etc.)
 * - This service modifies the DIRECTION of rotation (CW vs CCW)
 * - This service NEVER adds or removes turns - only changes direction where rotation exists
 *
 * Critical behavior when applying:
 * - PRO/ANTI flip when rotation direction changes (matches RotationDirectionHandler)
 * - Floats are skipped (they have no rotation)
 * - DASH/STATIC at 0 turns are skipped (don't add rotation)
 */

import type { Timestamp } from "firebase/firestore";
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  deleteDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { StepData } from "../../domain/models/StepData";
import type {
  RotationDirectionPattern,
  RotationDirectionPatternCreateData,
  RotationDirectionPatternEntry,
  RotationDirectionValue,
} from "../../domain/models/RotationDirectionPatternData";
import type {
  IRotationDirectionPatternManager,
  RotationDirectionPatternApplyResult,
  TargetHand,
} from "../contracts/IRotationDirectionPatternManager";
import {
  createMotionData,
  type MotionData,
} from "$lib/shared/pictograph/shared/domain/models/MotionData";
import {
  MotionColor,
  MotionType,
  RotationDirection,
  type Orientation,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { motionQueryHandler } from "$lib/shared/pictograph/shared/services/implementations/MotionQueryHandler";
import { orientationCalculator } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import { createStepData } from "../../domain/factories/createStepData";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";

const logger = createComponentLogger("RotationDirectionPatternManager");

export class RotationDirectionPatternManager implements IRotationDirectionPatternManager {
  /**
   * Extract a rotation direction pattern from a sequence
   *
   * Rules for extraction:
   * - FLOAT → "none" (floats have no rotation)
   * - STATIC @ 0 turns → "none"
   * - DASH @ 0 turns → "none"
   * - PRO/ANTI/DASH/STATIC with turns > 0 → actual direction ("cw" or "ccw")
   */
  extractPattern(
    sequence: SequenceData,
    name: string
  ): RotationDirectionPatternCreateData {
    const entries: RotationDirectionPatternEntry[] = [];

    for (let i = 0; i < sequence.steps.length; i++) {
      const beat = sequence.steps[i];
      if (!beat) continue;

      const blueMotion = beat.motions?.blue;
      const redMotion = beat.motions?.red;

      entries.push({
        stepIndex: i,
        blue: blueMotion ? this.extractRotationDirection(blueMotion) : null,
        red: redMotion ? this.extractRotationDirection(redMotion) : null,
      });
    }

    return {
      name,
      userId: "", // Will be set when saving
      stepCount: sequence.steps.length,
      entries,
    };
  }

  /**
   * Extract rotation direction value from a single motion
   */
  private extractRotationDirection(motion: MotionData): RotationDirectionValue {
    const { motionType, turns, rotationDirection } = motion;

    // Float motions have no rotation
    if (motionType === MotionType.FLOAT) {
      return "none";
    }

    // STATIC or DASH at 0 turns have no rotation
    if (
      (motionType === MotionType.STATIC || motionType === MotionType.DASH) &&
      turns === 0
    ) {
      return "none";
    }

    // Motions with no rotation direction
    if (rotationDirection === RotationDirection.NO_ROTATION) {
      return "none";
    }

    // Return actual rotation direction
    if (rotationDirection === RotationDirection.CLOCKWISE) {
      return "cw";
    }
    if (rotationDirection === RotationDirection.COUNTER_CLOCKWISE) {
      return "ccw";
    }

    return "none";
  }

  /**
   * Apply a rotation direction pattern to a sequence
   *
   * Key behavior: NEVER adds or removes turns - only modifies direction
   */
  async applyPattern(
    pattern: RotationDirectionPattern,
    sequence: SequenceData,
    targetHand: TargetHand = "both"
  ): Promise<RotationDirectionPatternApplyResult> {
    // Validate beat count match
    const validation = this.validateForSequence(pattern, sequence);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const warnings: string[] = [];
    let modifiedSteps = 0;
    const modifiedBeatIndices: number[] = [];

    // Step 1: Apply all rotation direction changes
    const updatedSteps: StepData[] = sequence.steps.map((beat, stepIndex) => {
      const entry = pattern.entries.find((e) => e.stepIndex === stepIndex);
      if (!entry) return beat;

      let stepModified = false;
      const updatedMotions = { ...beat.motions };

      // Apply blue rotation direction (if targeting blue or both)
      if (
        (targetHand === "both" || targetHand === "blue") &&
        entry.blue !== null &&
        beat.motions?.blue
      ) {
        const result = this.applyRotationToMotion(
          entry.blue,
          beat.motions.blue,
          MotionColor.BLUE,
          stepIndex
        );
        if (result.motion) {
          updatedMotions.blue = result.motion;
          stepModified = true;
        }
        if (result.warning) {
          warnings.push(`Beat ${stepIndex + 1} blue: ${result.warning}`);
        }
      }

      // Apply red rotation direction (if targeting red or both)
      if (
        (targetHand === "both" || targetHand === "red") &&
        entry.red !== null &&
        beat.motions?.red
      ) {
        const result = this.applyRotationToMotion(
          entry.red,
          beat.motions.red,
          MotionColor.RED,
          stepIndex
        );
        if (result.motion) {
          updatedMotions.red = result.motion;
          stepModified = true;
        }
        if (result.warning) {
          warnings.push(`Beat ${stepIndex + 1} red: ${result.warning}`);
        }
      }

      if (stepModified) {
        modifiedSteps++;
        modifiedBeatIndices.push(stepIndex);
        return { ...beat, motions: updatedMotions };
      }
      return beat;
    });

    // Step 2: Propagate orientations forward through the sequence
    this.propagateOrientations(updatedSteps);

    // Step 3: Look up correct letters for all modified steps
    const gridMode = sequence.gridMode ?? GridMode.DIAMOND;
    await this.recalculateLettersForBeats(
      updatedSteps,
      modifiedBeatIndices,
      gridMode
    );

    // Create updated sequence
    const updatedSequence: SequenceData = {
      ...sequence,
      steps: updatedSteps,
    };

    logger.log(
      `Applied rotation pattern "${pattern.name}" - modified ${modifiedSteps} steps`
    );

    return {
      success: true,
      sequence: updatedSequence,
      modifiedSteps,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Recalculate letters for modified steps using the pictograph dataset
   */
  private async recalculateLettersForBeats(
    steps: StepData[],
    modifiedBeatIndices: number[],
    gridMode: GridMode
  ): Promise<void> {
    for (const stepIndex of modifiedBeatIndices) {
      const beat = steps[stepIndex];
      if (!beat) continue;

      const blueMotion = beat.motions?.blue;
      const redMotion = beat.motions?.red;

      if (!blueMotion || !redMotion) continue;

      try {
        const foundLetter =
          await motionQueryHandler.findLetterByMotionConfiguration(
            blueMotion,
            redMotion,
            gridMode
          );

        if (foundLetter) {
          const newLetter = foundLetter as Letter;
          if (newLetter !== beat.letter) {
            logger.log(
              `Beat ${stepIndex + 1}: Updated letter "${beat.letter}" → "${newLetter}"`
            );
            steps[stepIndex] = createStepData({
              ...beat,
              letter: newLetter,
            });
          }
        } else {
          logger.warn(
            `Beat ${stepIndex + 1}: Could not find letter for modified motion configuration`
          );
        }
      } catch (error) {
        logger.warn(`Beat ${stepIndex + 1}: Error looking up letter:`, error);
      }
    }
  }

  /**
   * Apply rotation direction to a single motion
   *
   * Skip logic:
   * - FLOAT → skip (floats have no rotation)
   * - STATIC @ 0 turns → skip (no rotation to modify)
   * - DASH @ 0 turns → skip (don't add turns)
   * - DASH @ turns > 0 + "none" → skip (don't remove turns)
   * - PRO/ANTI + "none" → skip (don't convert to static/dash)
   *
   * Apply logic:
   * - PRO/ANTI getting CW/CCW → flip motion type if direction changes
   * - DASH with turns getting CW/CCW → apply direction
   */
  private applyRotationToMotion(
    patternValue: RotationDirectionValue,
    currentMotion: MotionData,
    color: MotionColor,
    stepIndex: number
  ): { motion: MotionData | null; warning?: string } {
    const { motionType, turns, rotationDirection } = currentMotion;

    // FLOAT: skip (floats have no rotation)
    if (motionType === MotionType.FLOAT) {
      return { motion: null, warning: "Skipped float (no rotation)" };
    }

    // STATIC @ 0 turns: skip (no rotation to modify)
    if (motionType === MotionType.STATIC && turns === 0) {
      return { motion: null, warning: "Skipped static@0 (no rotation)" };
    }

    // DASH @ 0 turns: skip (don't add turns)
    if (motionType === MotionType.DASH && turns === 0) {
      return { motion: null, warning: "Skipped dash@0 (no rotation)" };
    }

    // Pattern value is "none": skip (don't remove rotation)
    if (patternValue === "none") {
      return { motion: null };
    }

    // Convert pattern value to enum
    const newRotationDirection =
      patternValue === "cw"
        ? RotationDirection.CLOCKWISE
        : RotationDirection.COUNTER_CLOCKWISE;

    // Skip if already at this rotation direction
    if (rotationDirection === newRotationDirection) {
      return { motion: null };
    }

    // For shifts (pro/anti), motion type is DERIVED from the relationship
    // between rotation direction and hand orbital direction.
    // PRO = prop spins the same way the hand orbits.
    // ANTI = prop spins opposite to the hand orbit.
    // For non-shifts (dash/static/float), motion type is unchanged.
    const newMotionType = deriveMotionType(currentMotion, newRotationDirection);

    // Recalculate end orientation
    // Using direct import instead of container for HMR performance
    const tempMotion = createMotionData({
      ...currentMotion,
      rotationDirection: newRotationDirection,
      motionType: newMotionType,
    });
    const newEndOrientation = orientationCalculator.calculateEndOrientation(
      tempMotion,
      color
    );

    return {
      motion: createMotionData({
        ...currentMotion,
        rotationDirection: newRotationDirection,
        motionType: newMotionType,
        endOrientation: newEndOrientation,
      }),
    };
  }

  /**
   * Propagate orientations forward through the sequence
   * Ensures each beat's startOrientation matches the previous beat's endOrientation
   */
  private propagateOrientations(steps: StepData[]): void {
    for (let i = 0; i < steps.length - 1; i++) {
      const currentStep = steps[i];
      const nextStep = steps[i + 1];
      if (!currentStep || !nextStep) continue;

      // Propagate blue motion orientation
      if (currentStep.motions?.blue && nextStep.motions?.blue) {
        const currentEndOrientation = currentStep.motions.blue.endOrientation;
        const nextStartOrientation = nextStep.motions.blue.startOrientation;

        if (currentEndOrientation !== nextStartOrientation) {
          const updatedNextMotion = this.updateMotionStartOrientation(
            nextStep.motions.blue,
            currentEndOrientation,
            MotionColor.BLUE
          );

          steps[i + 1] = {
            ...nextStep,
            motions: {
              ...nextStep.motions,
              blue: updatedNextMotion,
            },
          };
        }
      }

      // Propagate red motion orientation
      if (currentStep.motions?.red && nextStep.motions?.red) {
        const currentEndOrientation = currentStep.motions.red.endOrientation;
        const nextStartOrientation = nextStep.motions.red.startOrientation;

        if (currentEndOrientation !== nextStartOrientation) {
          const updatedNextMotion = this.updateMotionStartOrientation(
            nextStep.motions.red,
            currentEndOrientation,
            MotionColor.RED
          );

          // Get latest beat data (might have been updated for blue already)
          const latestNextStep = steps[i + 1];
          if (!latestNextStep) continue;
          steps[i + 1] = {
            ...latestNextStep,
            motions: {
              ...latestNextStep.motions,
              red: updatedNextMotion,
            },
          };
        }
      }
    }
  }

  /**
   * Update a motion's start orientation and recalculate end orientation
   */
  private updateMotionStartOrientation(
    motion: MotionData,
    newStartOrientation: Orientation,
    color: MotionColor
  ): MotionData {
    // Using direct import instead of container for HMR performance

    const tempMotion = createMotionData({
      ...motion,
      startOrientation: newStartOrientation,
    });

    const newEndOrientation = orientationCalculator.calculateEndOrientation(
      tempMotion,
      color
    );

    return createMotionData({
      ...motion,
      startOrientation: newStartOrientation,
      endOrientation: newEndOrientation,
    });
  }

  /**
   * Save a rotation direction pattern to Firebase
   */
  async savePattern(
    data: RotationDirectionPatternCreateData,
    userId: string
  ): Promise<RotationDirectionPattern> {
    const firestore = await getFirestoreInstance();
    const patternsRef = collection(
      firestore,
      "users",
      userId,
      "rotationDirectionPatterns"
    );

    const docData = {
      name: data.name,
      userId,
      stepCount: data.stepCount,
      entries: data.entries,
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(patternsRef, docData);

    logger.log(`Saved rotation pattern "${data.name}" with ID ${docRef.id}`);

    return {
      id: docRef.id,
      name: data.name,
      userId,
      stepCount: data.stepCount,
      entries: data.entries,
      createdAt: null as Timestamp | null, // Will be populated by Firestore
    };
  }

  /**
   * Load all rotation direction patterns for a user
   */
  async loadPatterns(userId: string): Promise<RotationDirectionPattern[]> {
    const firestore = await getFirestoreInstance();
    const patternsRef = collection(
      firestore,
      "users",
      userId,
      "rotationDirectionPatterns"
    );
    const q = query(patternsRef, orderBy("createdAt", "desc"));

    const snapshot = await getDocs(q);
    const patterns: RotationDirectionPattern[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      patterns.push({
        id: doc.id,
        name: data.name,
        userId: data.userId,
        stepCount: data.stepCount,
        entries: data.entries,
        createdAt: data.createdAt,
      });
    });

    logger.log(
      `Loaded ${patterns.length} rotation patterns for user ${userId}`
    );
    return patterns;
  }

  /**
   * Delete a rotation direction pattern
   */
  async deletePattern(patternId: string, userId: string): Promise<void> {
    const firestore = await getFirestoreInstance();
    const patternRef = doc(
      firestore,
      "users",
      userId,
      "rotationDirectionPatterns",
      patternId
    );
    await deleteDoc(patternRef);
    logger.log(`Deleted rotation pattern ${patternId}`);
  }

  /**
   * Validate that a pattern can be applied to a sequence
   */
  validateForSequence(
    pattern: RotationDirectionPattern,
    sequence: SequenceData
  ): { valid: boolean; error?: string } {
    if (pattern.stepCount !== sequence.steps.length) {
      return {
        valid: false,
        error: `Pattern has ${pattern.stepCount} steps but sequence has ${sequence.steps.length} steps`,
      };
    }
    return { valid: true };
  }
}

// ============================================================================
// MOTION TYPE DERIVATION
// ============================================================================

// CW hand orbital pairs: startLocation → endLocation traces a clockwise arc
const CW_PAIRS: [string, string][] = [
  ["s", "w"], ["w", "n"], ["n", "e"], ["e", "s"],
  ["ne", "se"], ["se", "sw"], ["sw", "nw"], ["nw", "ne"],
];

// CCW hand orbital pairs
const CCW_PAIRS: [string, string][] = [
  ["w", "s"], ["n", "w"], ["e", "n"], ["s", "e"],
  ["ne", "nw"], ["nw", "sw"], ["sw", "se"], ["se", "ne"],
];

/**
 * Derive the hand's orbital direction from start/end grid locations.
 * Returns CW, CCW, or null (for dash/static hand paths).
 */
function deriveHandOrbitalDirection(
  startLocation: string,
  endLocation: string
): RotationDirection | null {
  const s = startLocation.toLowerCase();
  const e = endLocation.toLowerCase();

  if (CW_PAIRS.some(([a, b]) => a === s && b === e))
    return RotationDirection.CLOCKWISE;
  if (CCW_PAIRS.some(([a, b]) => a === s && b === e))
    return RotationDirection.COUNTER_CLOCKWISE;

  return null;
}

/**
 * Derive motion type from the relationship between rotation direction and
 * hand orbital direction.
 *
 * For shifts (PRO/ANTI):
 *   PRO  = prop spins the same direction as the hand orbits
 *   ANTI = prop spins opposite to the hand orbit
 *
 * For non-shifts (DASH/STATIC/FLOAT): motion type is unchanged.
 */
function deriveMotionType(
  motion: MotionData,
  newRotationDirection: RotationDirection
): MotionType {
  // Only shifts (PRO/ANTI) have their motion type determined by rotation
  if (
    motion.motionType !== MotionType.PRO &&
    motion.motionType !== MotionType.ANTI
  ) {
    return motion.motionType;
  }

  const handDirection = deriveHandOrbitalDirection(
    motion.startLocation,
    motion.endLocation
  );

  // If hand path isn't a shift arc (dash/static trajectory), keep as-is
  if (!handDirection) {
    return motion.motionType;
  }

  // PRO = rotation matches hand orbit, ANTI = opposite
  return newRotationDirection === handDirection
    ? MotionType.PRO
    : MotionType.ANTI;
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const rotationDirectionPatternManager = new RotationDirectionPatternManager();
