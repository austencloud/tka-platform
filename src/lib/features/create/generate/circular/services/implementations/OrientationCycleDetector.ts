/**
 * Orientation Cycle Detection Service
 *
 * Determines how many repetitions of a sequence are needed to return
 * to the starting prop orientation.
 *
 * For LOOP sequences, the sequence may return to the starting grid position
 * after one repetition, but the prop orientation might be rotated 90° or 180°.
 * This service detects whether the sequence needs 1, 2, or 4 repetitions
 * to return to both the starting position AND orientation.
 *
 * Algorithm:
 * 1. Extract starting orientation from start position or first beat
 * 2. Track orientation changes through each beat
 * 3. After sequence completes, check if orientation matches start
 * 4. If not, simulate additional repetitions (up to 4 total)
 * 5. Return the minimum number of cycles needed
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { BeatData } from "../../../../shared/domain/models/BeatData";
import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { StartPositionData } from "../../../../shared/domain/models/StartPositionData";

export interface OrientationCycleResult {
  /** Number of repetitions needed (1, 2, or 4) */
  cycleCount: 1 | 2 | 4;
  /** Blue prop orientation after each repetition */
  blueOrientations: Orientation[];
  /** Red prop orientation after each repetition */
  redOrientations: Orientation[];
}

export class OrientationCycleDetector {
  /**
   * Detect how many repetitions are needed to return to starting orientation
   */
  detectOrientationCycle(sequence: SequenceData): OrientationCycleResult {
    const beats = sequence.beats;

    if (!beats || beats.length === 0) {
      // Empty sequence - trivially returns in 1 cycle
      return {
        cycleCount: 1,
        blueOrientations: [Orientation.IN],
        redOrientations: [Orientation.IN],
      };
    }

    // Get starting orientations
    const startOrientations = this.getStartingOrientations(sequence);

    // Track orientations through repetitions
    const blueOrientations: Orientation[] = [startOrientations.blue];
    const redOrientations: Orientation[] = [startOrientations.red];

    let currentBlue = startOrientations.blue;
    let currentRed = startOrientations.red;

    // Simulate up to 4 repetitions
    for (let rep = 1; rep <= 4; rep++) {
      // Step through each beat in this repetition
      for (const beat of beats) {
        const blueMotion = beat.motions.blue;
        const redMotion = beat.motions.red;

        if (blueMotion) {
          currentBlue = blueMotion.endOrientation;
        }
        if (redMotion) {
          currentRed = redMotion.endOrientation;
        }
      }

      blueOrientations.push(currentBlue);
      redOrientations.push(currentRed);

      // Check if we're back to starting orientation
      if (
        currentBlue === startOrientations.blue &&
        currentRed === startOrientations.red
      ) {
        return {
          cycleCount: rep as 1 | 2 | 4,
          blueOrientations,
          redOrientations,
        };
      }
    }

    // If we haven't returned after 4 reps, something is wrong
    // Default to 4 (maximum cycle count)
    console.warn(
      `Sequence ${sequence.id} did not return to starting orientation after 4 repetitions`
    );
    return {
      cycleCount: 4,
      blueOrientations,
      redOrientations,
    };
  }

  /**
   * Extract starting orientations from start position or first beat
   */
  private getStartingOrientations(sequence: SequenceData): {
    blue: Orientation;
    red: Orientation;
  } {
    // Try start position first
    const startPos = sequence.startPosition || sequence.startingPositionBeat;

    if (startPos && this.isStartPositionData(startPos)) {
      const blueMotion = startPos.motions?.blue;
      const redMotion = startPos.motions?.red;

      return {
        blue: blueMotion?.startOrientation ?? Orientation.IN,
        red: redMotion?.startOrientation ?? Orientation.IN,
      };
    }

    // Fall back to first beat if no start position
    const firstBeat = sequence.beats[0];
    if (firstBeat) {
      const blueMotion = firstBeat.motions?.blue;
      const redMotion = firstBeat.motions?.red;

      return {
        blue: blueMotion?.startOrientation ?? Orientation.IN,
        red: redMotion?.startOrientation ?? Orientation.IN,
      };
    }

    // Default to IN orientation
    return {
      blue: Orientation.IN,
      red: Orientation.IN,
    };
  }

  /**
   * Type guard for StartPositionData
   */
  private isStartPositionData(
    data: StartPositionData | BeatData
  ): data is StartPositionData {
    return "isStartPosition" in data && data.isStartPosition === true;
  }
}
