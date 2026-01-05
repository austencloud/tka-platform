/**
 * Turn Pattern Service Implementation
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
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { injectable } from "inversify";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { BeatData } from "../../domain/models/BeatData";
import type {
  TurnPattern,
  TurnPatternCreateData,
  TurnPatternEntry,
  TurnValue,
} from "../../domain/models/TurnPatternData";
import type {
  ITurnPatternManager,
  TurnPatternApplyResult,
  TargetHand,
} from "../contracts/ITurnPatternManager";
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
import { resolve } from "$lib/shared/inversify/di";
import { TYPES } from "$lib/shared/inversify/types";
import type { IOrientationCalculator } from "$lib/shared/pictograph/prop/services/contracts/IOrientationCalculator";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";

const logger = createComponentLogger("TurnPatternManager");

@injectable()
export class TurnPatternManager implements ITurnPatternManager {
  /**
   * Extract a turn pattern from a sequence
   */
  extractPattern(sequence: SequenceData, name: string): TurnPatternCreateData {
    const entries: TurnPatternEntry[] = [];

    for (let i = 0; i < sequence.beats.length; i++) {
      const beat = sequence.beats[i];
      if (!beat) continue;

      const blueMotion = beat.motions?.blue;
      const redMotion = beat.motions?.red;

      entries.push({
        beatIndex: i,
        blue: blueMotion?.turns ?? null,
        red: redMotion?.turns ?? null,
      });
    }

    return {
      name,
      userId: "", // Will be set when saving
      beatCount: sequence.beats.length,
      entries,
    };
  }

  /**
   * Apply a turn pattern to a sequence
   */
  applyPattern(
    pattern: TurnPattern,
    sequence: SequenceData,
    targetHand: TargetHand = "both"
  ): TurnPatternApplyResult {
    // Validate beat count match
    const validation = this.validateForSequence(pattern, sequence);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const warnings: string[] = [];
    let modifiedBeats = 0;

    // Step 1: Apply all turn changes
    const updatedBeats: BeatData[] = sequence.beats.map((beat, beatIndex) => {
      const entry = pattern.entries.find((e) => e.beatIndex === beatIndex);
      if (!entry) return beat;

      let beatModified = false;
      const updatedMotions = { ...beat.motions };

      // Apply blue turns (if targeting blue or both)
      if (
        (targetHand === "both" || targetHand === "blue") &&
        entry.blue !== null &&
        beat.motions?.blue
      ) {
        const result = this.applyTurnToMotion(
          entry.blue,
          beat.motions.blue,
          MotionColor.BLUE,
          sequence.beats,
          beatIndex
        );
        if (result.motion) {
          updatedMotions.blue = result.motion;
          beatModified = true;
        }
        if (result.warning) {
          warnings.push(`Beat ${beatIndex + 1} blue: ${result.warning}`);
        }
      }

      // Apply red turns (if targeting red or both)
      if (
        (targetHand === "both" || targetHand === "red") &&
        entry.red !== null &&
        beat.motions?.red
      ) {
        const result = this.applyTurnToMotion(
          entry.red,
          beat.motions.red,
          MotionColor.RED,
          sequence.beats,
          beatIndex
        );
        if (result.motion) {
          updatedMotions.red = result.motion;
          beatModified = true;
        }
        if (result.warning) {
          warnings.push(`Beat ${beatIndex + 1} red: ${result.warning}`);
        }
      }

      if (beatModified) {
        modifiedBeats++;
        return { ...beat, motions: updatedMotions };
      }
      return beat;
    });

    // Step 2: Propagate orientations forward through the sequence
    // This ensures each beat's startOrientation matches the previous beat's endOrientation
    for (let i = 0; i < updatedBeats.length - 1; i++) {
      const currentBeat = updatedBeats[i];
      const nextBeat = updatedBeats[i + 1];
      if (!currentBeat || !nextBeat) continue;

      // Propagate blue motion orientation
      if (currentBeat.motions?.blue && nextBeat.motions?.blue) {
        const currentEndOrientation = currentBeat.motions.blue.endOrientation;
        const nextStartOrientation = nextBeat.motions.blue.startOrientation;

        if (currentEndOrientation !== nextStartOrientation) {
          const updatedNextMotion = this.updateMotionStartOrientation(
            nextBeat.motions.blue,
            currentEndOrientation,
            MotionColor.BLUE
          );

          updatedBeats[i + 1] = {
            ...nextBeat,
            motions: {
              ...nextBeat.motions,
              blue: updatedNextMotion,
            },
          };
        }
      }

      // Propagate red motion orientation
      if (currentBeat.motions?.red && nextBeat.motions?.red) {
        const currentEndOrientation = currentBeat.motions.red.endOrientation;
        const nextStartOrientation = nextBeat.motions.red.startOrientation;

        if (currentEndOrientation !== nextStartOrientation) {
          const updatedNextMotion = this.updateMotionStartOrientation(
            nextBeat.motions.red,
            currentEndOrientation,
            MotionColor.RED
          );

          // Get latest beat data (might have been updated for blue already)
          const latestNextBeat = updatedBeats[i + 1];
          if (!latestNextBeat) continue;
          updatedBeats[i + 1] = {
            ...latestNextBeat,
            motions: {
              ...latestNextBeat.motions,
              red: updatedNextMotion,
            },
          };
        }
      }
    }

    // Create updated sequence
    const updatedSequence: SequenceData = {
      ...sequence,
      beats: updatedBeats,
    };

    logger.log(
      `Applied pattern "${pattern.name}" - modified ${modifiedBeats} beats with propagation`
    );

    return {
      success: true,
      sequence: updatedSequence,
      modifiedBeats,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Update a motion's start orientation and recalculate end orientation
   */
  private updateMotionStartOrientation(
    motion: MotionData,
    newStartOrientation: Orientation,
    color: MotionColor
  ): MotionData {
    const orientationCalculator = resolve<IOrientationCalculator>(
      TYPES.IOrientationCalculator
    );

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
   * Apply a turn value to a single motion with edge case handling
   */
  private applyTurnToMotion(
    turnValue: TurnValue,
    currentMotion: MotionData,
    color: MotionColor,
    allBeats: readonly BeatData[],
    beatIndex: number
  ): { motion: MotionData | null; warning?: string } {
    const motionType = currentMotion.motionType;

    // Edge case: Float cannot be applied to STATIC or DASH
    if (turnValue === "fl") {
      if (motionType === MotionType.STATIC || motionType === MotionType.DASH) {
        logger.log(
          `Float cannot be applied to ${motionType}, applying 0 turns`
        );
        return {
          motion: this.createUpdatedMotion(currentMotion, 0, color),
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
      // Look back through previous beats for rotation context
      rotationDirection = this.findRotationContext(allBeats, beatIndex, color);
      if (rotationDirection !== currentMotion.rotationDirection) {
        logger.log(
          `Applied context rotation ${rotationDirection} to beat ${beatIndex + 1} ${color}`
        );
      }
    }

    // Create updated motion with new turns
    return {
      motion: this.createUpdatedMotion(
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
  private findRotationContext(
    beats: readonly BeatData[],
    currentBeatIndex: number,
    color: MotionColor
  ): RotationDirection {
    // Step 1: Search backwards from the beat before current
    for (let i = currentBeatIndex - 1; i >= 0; i--) {
      const beat = beats[i];
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
    for (let i = currentBeatIndex + 1; i < beats.length; i++) {
      const beat = beats[i];
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
  private createUpdatedMotion(
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
    const orientationCalculator = resolve<IOrientationCalculator>(
      TYPES.IOrientationCalculator
    );
    const tempMotion = createMotionData({
      ...currentMotion,
      turns: turnValue,
      rotationDirection: updatedRotationDirection,
      motionType: updatedMotionType,
    });
    const newEndOrientation = orientationCalculator.calculateEndOrientation(
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

  /**
   * Save a turn pattern to Firebase
   */
  async savePattern(
    data: TurnPatternCreateData,
    userId: string
  ): Promise<TurnPattern> {
    const firestore = await getFirestoreInstance();
    const patternsRef = collection(firestore, "users", userId, "turnPatterns");

    const docData = {
      name: data.name,
      userId,
      beatCount: data.beatCount,
      entries: data.entries,
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(patternsRef, docData);

    logger.log(`Saved pattern "${data.name}" with ID ${docRef.id}`);

    return {
      id: docRef.id,
      name: data.name,
      userId,
      beatCount: data.beatCount,
      entries: data.entries,
      createdAt: null as any, // Will be populated by Firestore
    };
  }

  /**
   * Load all turn patterns for a user
   */
  async loadPatterns(userId: string): Promise<TurnPattern[]> {
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
        beatCount: data.beatCount,
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
  async deletePattern(patternId: string, userId: string): Promise<void> {
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
  validateForSequence(
    pattern: TurnPattern,
    sequence: SequenceData
  ): { valid: boolean; error?: string } {
    if (pattern.beatCount !== sequence.beats.length) {
      return {
        valid: false,
        error: `Pattern has ${pattern.beatCount} beats but sequence has ${sequence.beats.length} beats`,
      };
    }
    return { valid: true };
  }
}
