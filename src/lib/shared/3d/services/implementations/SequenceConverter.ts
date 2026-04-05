/**
 * SequenceConverter Implementation
 *
 * Converts SequenceData steps to MotionConfig3D.
 * Bridges the gap between 2D sequence data model and 3D animation system.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
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
  StepMotionConfigs,
} from "../contracts/ISequenceConverter";
import type { PlaneModeConfig } from "../../domain/constants/plane-mode-configs";

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

    const config = {
      plane,
      startLocation: motion.startLocation,
      endLocation: motion.endLocation,
      motionType: motion.motionType,
      rotationDirection: motion.rotationDirection,
      turns,
      startOrientation: motion.startOrientation,
      endOrientation: motion.endOrientation,
    };

    return config;
  }

  /**
   * Extract motion configs from a StepData or StartPositionData object
   */
  beatDataToConfigs(
    beat: StepData | StartPositionData,
    plane: Plane = Plane.WALL,
    modeConfig?: PlaneModeConfig
  ): StepMotionConfigs {
    const blueMotion = beat.motions?.[MotionColor.BLUE];
    const redMotion = beat.motions?.[MotionColor.RED];

    // Start positions use 0 for stepNumber, regular steps use their stepNumber
    const stepNumber =
      "isStartPosition" in beat && beat.isStartPosition
        ? 0
        : (beat as StepData).stepNumber ?? 0;

    // If a mode config is provided, use per-hand planes and offsets.
    // Otherwise fall back to the single plane for both hands (current behavior).
    const bluePlane = modeConfig?.bluePlane ?? plane;
    const redPlane = modeConfig?.redPlane ?? plane;
    const blueOffset = modeConfig?.blueLateralOffset ?? 0;
    const redOffset = modeConfig?.redLateralOffset ?? 0;
    const rotPlane = modeConfig?.rotationPlane;
    const skipFacing = modeConfig?.skipFacingTransform;

    return {
      stepNumber,
      blue:
        blueMotion && blueMotion.isVisible !== false
          ? { ...this.motionDataToConfig3D(blueMotion, bluePlane), lateralOffset: blueOffset || undefined, rotationPlane: rotPlane, skipFacingTransform: skipFacing }
          : null,
      red:
        redMotion && redMotion.isVisible !== false
          ? { ...this.motionDataToConfig3D(redMotion, redPlane), lateralOffset: redOffset || undefined, rotationPlane: rotPlane, skipFacingTransform: skipFacing }
          : null,
    };
  }

  /**
   * Convert an entire sequence to an array of beat motion configs
   * Filters out beat 0 (start position)
   */
  sequenceToMotionConfigs(
    sequence: SequenceData,
    plane: Plane = Plane.WALL,
    modeConfig?: PlaneModeConfig
  ): StepMotionConfigs[] {
    if (!sequence.steps || sequence.steps.length === 0) {
      return [];
    }

    const configs = sequence.steps
      .filter((beat) => beat.stepNumber !== 0)
      .map((beat) => this.beatDataToConfigs(beat, plane, modeConfig))
      .sort((a, b) => a.stepNumber - b.stepNumber);

    return configs;
  }

  /**
   * Get start position configs from sequence
   */
  getStartPositionConfigs(
    sequence: SequenceData,
    plane: Plane = Plane.WALL,
    modeConfig?: PlaneModeConfig
  ): StepMotionConfigs | null {
    // Try startPosition field first
    if (sequence.startPosition) {
      return this.beatDataToConfigs(sequence.startPosition, plane, modeConfig);
    }

    // Fall back to beat 0 in steps array
    const step0 = sequence.steps?.find((beat) => beat.stepNumber === 0);
    if (step0) {
      return this.beatDataToConfigs(step0, plane, modeConfig);
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
