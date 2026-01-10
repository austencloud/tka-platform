/**
 * SequenceConverter Implementation
 *
 * Converts SequenceData beats to MotionConfig3D.
 * Bridges the gap between 2D sequence data model and 3D animation system.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { MotionConfig3D } from "../../domain/models/MotionData3D";
import { Plane } from "../../domain/enums/Plane";
import {
  MotionColor,
  MotionType,
  RotationDirection,
  Orientation,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type {
  ISequenceConverter,
  BeatMotionConfigs,
} from "../contracts/ISequenceConverter";

export class SequenceConverter implements ISequenceConverter {
  /**
   * Convert a MotionData object to MotionConfig3D
   */
  motionDataToConfig3D(
    motion: MotionData,
    plane: Plane = Plane.WALL
  ): MotionConfig3D {
    // Handle turns - "fl" (float) becomes 0
    const turns = motion.turns === "fl" ? 0 : (motion.turns as number);

    return {
      plane,
      startLocation: motion.startLocation,
      endLocation: motion.endLocation,
      motionType: motion.motionType,
      rotationDirection: motion.rotationDirection,
      turns,
      startOrientation: motion.startOrientation,
      endOrientation: motion.endOrientation,
    };
  }

  /**
   * Extract motion configs from a BeatData or StartPositionData object
   */
  beatDataToConfigs(
    beat: BeatData | StartPositionData,
    plane: Plane = Plane.WALL
  ): BeatMotionConfigs {
    const blueMotion = beat.motions?.[MotionColor.BLUE];
    const redMotion = beat.motions?.[MotionColor.RED];

    // Start positions use 0 for beatNumber, regular beats use their beatNumber
    const beatNumber =
      "isStartPosition" in beat && beat.isStartPosition
        ? 0
        : (beat as BeatData).beatNumber ?? 0;

    return {
      beatNumber,
      blue:
        blueMotion && blueMotion.isVisible !== false
          ? this.motionDataToConfig3D(blueMotion, plane)
          : null,
      red:
        redMotion && redMotion.isVisible !== false
          ? this.motionDataToConfig3D(redMotion, plane)
          : null,
    };
  }

  /**
   * Convert an entire sequence to an array of beat motion configs
   * Filters out beat 0 (start position)
   */
  sequenceToMotionConfigs(
    sequence: SequenceData,
    plane: Plane = Plane.WALL
  ): BeatMotionConfigs[] {
    if (!sequence.beats || sequence.beats.length === 0) {
      return [];
    }

    return sequence.beats
      .filter((beat) => beat.beatNumber !== 0)
      .map((beat) => this.beatDataToConfigs(beat, plane))
      .sort((a, b) => a.beatNumber - b.beatNumber);
  }

  /**
   * Get start position configs from sequence
   */
  getStartPositionConfigs(
    sequence: SequenceData,
    plane: Plane = Plane.WALL
  ): BeatMotionConfigs | null {
    // Try startPosition field first
    if (sequence.startPosition) {
      return this.beatDataToConfigs(sequence.startPosition, plane);
    }

    // Fall back to beat 0 in beats array
    const beat0 = sequence.beats?.find((beat) => beat.beatNumber === 0);
    if (beat0) {
      return this.beatDataToConfigs(beat0, plane);
    }

    return null;
  }

  /**
   * Create default motion config
   */
  createDefaultConfig(plane: Plane = Plane.WALL): MotionConfig3D {
    return {
      plane,
      startLocation: GridLocation.NORTH,
      endLocation: GridLocation.NORTH,
      motionType: MotionType.STATIC,
      rotationDirection: RotationDirection.NO_ROTATION,
      turns: 0,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
    };
  }
}
