/**
 * Turn Pattern Service
 *
 * Handles extraction, application, and persistence of turn patterns.
 * Turn patterns capture rotation amounts per beat to transform sequences.
 */

import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  deleteDoc,
  addDoc,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type {
  TurnPattern,
  TurnPatternCreateData,
  TurnPatternEntry,
  TurnValue,
} from "$lib/shared/create/domain/turn-pattern-data";
/**
 * Specifies which hand(s) to apply pattern changes to
 */
export type TargetHand = "blue" | "red" | "both";

/**
 * Result of applying a turn pattern to a sequence
 */
export interface TurnPatternApplyResult {
  /** Whether the application was successful */
  readonly success: boolean;
  /** The modified sequence (if successful) */
  readonly sequence?: SequenceData;
  /** Error message if not successful */
  readonly error?: string;
  /** Number of steps that were modified */
  readonly modifiedSteps?: number;
  /** Warnings about edge cases encountered */
  readonly warnings?: readonly string[];
}
import {
  createMotionData,
  type MotionData,
} from "$lib/shared/pictograph/shared/domain/models/motion-data";
import {
  MotionColor,
  MotionType,
  RotationDirection,
  type Orientation,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { calculateEndOrientation } from "$lib/shared/pictograph/prop/services/orientation-calculator";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";

const logger = createComponentLogger("TurnPatternManager");

/**
 * Extract a turn pattern from a sequence
 */
export function extractPattern(sequence: SequenceData, name: string): TurnPatternCreateData {
  const entries: TurnPatternEntry[] = [];

  for (let i = 0; i < sequence.steps.length; i++) {
    const beat = sequence.steps[i];
    if (!beat) continue;

    const blueMotion = beat.motions?.blue;
    const redMotion = beat.motions?.red;

    entries.push({
      stepIndex: i,
      blue: blueMotion?.turns ?? null,
      red: redMotion?.turns ?? null,
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
 * Apply a turn pattern to a sequence
 */
export function applyPattern(
  pattern: TurnPattern,
  sequence: SequenceData,
  targetHand: TargetHand = "both"
): TurnPatternApplyResult {
  // Validate beat count match
  const validation = validateForSequence(pattern, sequence);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const warnings: string[] = [];
  let modifiedSteps = 0;

  // Step 1: Apply all turn changes
  const updatedSteps: StepData[] = sequence.steps.map((step, stepIndex) => {
    const entry = pattern.entries.find((e) => e.stepIndex === stepIndex);
    if (!entry) return step;

    let stepModified = false;
    const updatedMotions = { ...step.motions };

    // Apply blue turns (if targeting blue or both)
    if (
      (targetHand === "both" || targetHand === "blue") &&
      entry.blue !== null &&
      step.motions?.blue
    ) {
      const result = applyTurnToMotion(
        entry.blue,
        step.motions.blue,
        MotionColor.BLUE,
        sequence.steps,
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

    // Apply red turns (if targeting red or both)
    if (
      (targetHand === "both" || targetHand === "red") &&
      entry.red !== null &&
      step.motions?.red
    ) {
      const result = applyTurnToMotion(
        entry.red,
        step.motions.red,
        MotionColor.RED,
        sequence.steps,
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
      return { ...step, motions: updatedMotions };
    }
    return step;
  });

  // Step 2: Propagate orientations forward through the sequence
  // This ensures each beat's startOrientation matches the previous beat's endOrientation
  for (let i = 0; i < updatedSteps.length - 1; i++) {
    const currentStep = updatedSteps[i];
    const nextStep = updatedSteps[i + 1];
    if (!currentStep || !nextStep) continue;

    // Propagate blue motion orientation
    if (currentStep.motions?.blue && nextStep.motions?.blue) {
      const currentEndOrientation = currentStep.motions.blue.endOrientation;
      const nextStartOrientation = nextStep.motions.blue.startOrientation;

      if (currentEndOrientation !== nextStartOrientation) {
        const updatedNextMotion = updateMotionStartOrientation(
          nextStep.motions.blue,
          currentEndOrientation,
          MotionColor.BLUE
        );

        updatedSteps[i + 1] = {
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
        const updatedNextMotion = updateMotionStartOrientation(
          nextStep.motions.red,
          currentEndOrientation,
          MotionColor.RED
        );

        // Get latest step data (might have been updated for blue already)
        const latestNextStep = updatedSteps[i + 1];
        if (!latestNextStep) continue;
        updatedSteps[i + 1] = {
          ...latestNextStep,
          motions: {
            ...latestNextStep.motions,
            red: updatedNextMotion,
          },
        };
      }
    }
  }

  // Create updated sequence
  const updatedSequence: SequenceData = {
    ...sequence,
    steps: updatedSteps,
  };

  logger.log(
    `Applied pattern "${pattern.name}" - modified ${modifiedSteps} steps with propagation`
  );

  return {
    success: true,
    sequence: updatedSequence,
    modifiedSteps,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Save a turn pattern to Firebase
 */
export async function savePattern(
  data: TurnPatternCreateData,
  userId: string
): Promise<TurnPattern> {
  const firestore = await getFirestoreInstance();
  const patternsRef = collection(firestore, "users", userId, "turnPatterns");

  const docData = {
    name: data.name,
    userId,
    stepCount: data.stepCount,
    entries: data.entries,
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(patternsRef, docData);

  logger.log(`Saved pattern "${data.name}" with ID ${docRef.id}`);

  return {
    id: docRef.id,
    name: data.name,
    userId,
    stepCount: data.stepCount,
    entries: data.entries,
    createdAt: null as unknown as Timestamp, // Will be populated by Firestore
  };
}

/**
 * Load all turn patterns for a user
 */
export async function loadPatterns(userId: string): Promise<TurnPattern[]> {
  const firestore = await getFirestoreInstance();
  const patternsRef = collection(firestore, "users", userId, "turnPatterns");
  const q = query(patternsRef, orderBy("createdAt", "desc"));

  const snapshot = await getDocs(q);
  const patterns: TurnPattern[] = [];

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

  logger.log(`Loaded ${patterns.length} patterns for user ${userId}`);
  return patterns;
}

/**
 * Delete a turn pattern
 */
export async function deletePattern(patternId: string, userId: string): Promise<void> {
  const firestore = await getFirestoreInstance();
  const patternRef = doc(
    firestore,
    "users",
    userId,
    "turnPatterns",
    patternId
  );
  await deleteDoc(patternRef);
  logger.log(`Deleted pattern ${patternId}`);
}

/**
 * Validate that a pattern can be applied to a sequence
 */
export function validateForSequence(
  pattern: TurnPattern,
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

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

/**
 * Update a motion's start orientation and recalculate end orientation
 */
function updateMotionStartOrientation(
  motion: MotionData,
  newStartOrientation: Orientation,
  color: MotionColor
): MotionData {
  const tempMotion = createMotionData({
    ...motion,
    startOrientation: newStartOrientation,
  });

  const newEndOrientation = calculateEndOrientation(
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
 * Apply a turn value to a single motion with edge case handling
 */
function applyTurnToMotion(
  turnValue: TurnValue,
  currentMotion: MotionData,
  color: MotionColor,
  allSteps: readonly StepData[],
  stepIndex: number
): { motion: MotionData | null; warning?: string } {
  const motionType = currentMotion.motionType;

  // Edge case: Float cannot be applied to STATIC or DASH
  if (turnValue === "fl") {
    if (motionType === MotionType.STATIC || motionType === MotionType.DASH) {
      logger.log(
        `Float cannot be applied to ${motionType}, applying 0 turns`
      );
      return {
        motion: createUpdatedMotion(currentMotion, 0, color),
        warning: `Float converted to 0 (${motionType} cannot float)`,
      };
    }
  }

  // Handle rotation direction when applying turns > 0 to motion with no rotation
  let rotationDirection = currentMotion.rotationDirection;
  if (
    typeof turnValue === "number" &&
    turnValue > 0 &&
    rotationDirection === RotationDirection.NO_ROTATION
  ) {
    // Look back through previous steps for rotation context
    rotationDirection = findRotationContext(allSteps, stepIndex, color);
    if (rotationDirection !== currentMotion.rotationDirection) {
      logger.log(
        `Applied context rotation ${rotationDirection} to beat ${stepIndex + 1} ${color}`
      );
    }
  }

  // Create updated motion with new turns
  return {
    motion: createUpdatedMotion(
      currentMotion,
      turnValue,
      color,
      rotationDirection
    ),
  };
}

/**
 * Find rotation context by searching backwards first, then forwards.
 * Only defaults to CLOCKWISE if no rotation direction is found in either direction.
 */
function findRotationContext(
  steps: readonly StepData[],
  currentStepIndex: number,
  color: MotionColor
): RotationDirection {
  // Step 1: Search backwards from the beat before current
  for (let i = currentStepIndex - 1; i >= 0; i--) {
    const beat = steps[i];
    if (!beat) continue;

    const motion = beat.motions?.[color];
    if (
      motion &&
      motion.rotationDirection !== RotationDirection.NO_ROTATION
    ) {
      logger.log(
        `Found backward rotation context at beat ${i + 1}: ${motion.rotationDirection}`
      );
      return motion.rotationDirection;
    }
  }

  // Step 2: Search forwards from the beat after current
  for (let i = currentStepIndex + 1; i < steps.length; i++) {
    const beat = steps[i];
    if (!beat) continue;

    const motion = beat.motions?.[color];
    if (
      motion &&
      motion.rotationDirection !== RotationDirection.NO_ROTATION
    ) {
      logger.log(
        `Found forward rotation context at beat ${i + 1}: ${motion.rotationDirection}`
      );
      return motion.rotationDirection;
    }
  }

  // Step 3: Default to clockwise only if no context found in either direction
  logger.log(
    `No rotation context found for ${color}, defaulting to CLOCKWISE`
  );
  return RotationDirection.CLOCKWISE;
}

/**
 * Create an updated motion with new turn value
 */
function createUpdatedMotion(
  currentMotion: MotionData,
  turnValue: TurnValue,
  color: MotionColor,
  rotationDirection?: RotationDirection
): MotionData {
  const currentTurns = currentMotion.turns;
  const isConvertingToFloat = currentTurns !== "fl" && turnValue === "fl";
  const isConvertingFromFloat = currentTurns === "fl" && turnValue !== "fl";

  let updatedMotionType = currentMotion.motionType;
  let updatedRotationDirection =
    rotationDirection ?? currentMotion.rotationDirection;
  let updatedPrefloatMotionType = currentMotion.prefloatMotionType;
  let updatedPrefloatRotationDirection =
    currentMotion.prefloatRotationDirection;

  // Handle float conversion
  if (isConvertingToFloat) {
    updatedPrefloatMotionType = currentMotion.motionType;
    updatedPrefloatRotationDirection = currentMotion.rotationDirection;
    updatedMotionType = MotionType.FLOAT;
    updatedRotationDirection = RotationDirection.NO_ROTATION;
  } else if (isConvertingFromFloat) {
    if (currentMotion.prefloatMotionType) {
      updatedMotionType = currentMotion.prefloatMotionType;
    }
    if (currentMotion.prefloatRotationDirection) {
      updatedRotationDirection = currentMotion.prefloatRotationDirection;
    }
  } else {
    // Auto-assign rotation for DASH/STATIC (matches legacy behavior)
    const isDashOrStatic =
      updatedMotionType === MotionType.DASH ||
      updatedMotionType === MotionType.STATIC;

    if (isDashOrStatic) {
      if (
        typeof turnValue === "number" &&
        turnValue > 0 &&
        currentMotion.rotationDirection === RotationDirection.NO_ROTATION
      ) {
        updatedRotationDirection =
          rotationDirection ?? RotationDirection.CLOCKWISE;
      } else if (turnValue === 0) {
        updatedRotationDirection = RotationDirection.NO_ROTATION;
      }
    }
  }

  // Recalculate end orientation
  const tempMotion = createMotionData({
    ...currentMotion,
    turns: turnValue,
    rotationDirection: updatedRotationDirection,
    motionType: updatedMotionType,
  });
  const newEndOrientation = calculateEndOrientation(
    tempMotion,
    color
  );

  return createMotionData({
    ...currentMotion,
    turns: turnValue,
    motionType: updatedMotionType,
    rotationDirection: updatedRotationDirection,
    prefloatMotionType: updatedPrefloatMotionType,
    prefloatRotationDirection: updatedPrefloatRotationDirection,
    endOrientation: newEndOrientation,
  });
}
