/**
 * Builder Step Converter
 *
 * Converts visual builder's BuilderStep model into PictographData/MotionData.
 * Extracted from StepStrip.svelte's inline conversion logic.
 */

import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { type GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  MotionColor,
  MotionType,
  Orientation,
  RotationDirection,
  HandMotionType,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import { HandPathMotionCalculator } from "$lib/features/create/assemble/services/HandPathMotionCalculator";
import { motionQueryHandler } from "$lib/shared/pictograph/shared/services/implementations/MotionQueryHandler";
import type { BuilderStep } from "../../state/assemble-state.svelte";
import type { IBuilderStepConverter } from "../contracts/IBuilderStepConverter";

export class BuilderStepConverter implements IBuilderStepConverter {
  private readonly pathCalculator = new HandPathMotionCalculator();

  /** Derive MotionType (PRO/ANTI/DASH/STATIC) from step data */
  private resolveMotionType(step: BuilderStep, gridMode: GridMode): MotionType {
    const handMotionType = this.pathCalculator.calculateMotionType(
      step.startPosition,
      step.endPosition,
      gridMode,
    );
    switch (handMotionType) {
      case HandMotionType.STATIC:
        return MotionType.STATIC;
      case HandMotionType.DASH:
        return MotionType.DASH;
      // Hash motions use the same rotation behavior as dash (straight line, no arc)
      case HandMotionType.HASH_IN:
      case HandMotionType.HASH_OUT:
        return MotionType.DASH;
      case HandMotionType.SHIFT: {
        // Float: -0.5 turns cancels the arc rotation so the prop appears to float
        if (step.turnCount === -0.5) return MotionType.FLOAT;

        const handPathDir = this.pathCalculator.calculateRotationDirection(
          step.startPosition,
          step.endPosition,
          gridMode,
        );
        return handPathDir === step.rotationDirection
          ? MotionType.PRO
          : MotionType.ANTI;
      }
      default:
        return MotionType.STATIC;
    }
  }

  stepToMotion(step: BuilderStep, color: MotionColor, gridMode: GridMode): MotionData {
    const motionType = this.resolveMotionType(step, gridMode);
    const resolvedRotation =
      step.startPosition === step.endPosition
        ? RotationDirection.NO_ROTATION
        : step.rotationDirection;

    return createMotionData({
      color,
      startLocation: step.startPosition,
      endLocation: step.endPosition,
      motionType,
      rotationDirection: resolvedRotation,
      turns: step.turnCount,
      startOrientation: step.startOrientation,
      endOrientation: step.endOrientation,
      gridMode,
      arrowLocation: step.startPosition,
      isVisible: true,
    });
  }

  createStaticMotion(
    position: GridLocation,
    orientation: Orientation,
    color: MotionColor,
    gridMode: GridMode,
  ): MotionData {
    return createMotionData({
      color,
      startLocation: position,
      endLocation: position,
      motionType: MotionType.STATIC,
      rotationDirection: RotationDirection.NO_ROTATION,
      turns: 0,
      startOrientation: orientation,
      endOrientation: orientation,
      gridMode,
      arrowLocation: position,
      isVisible: true,
    });
  }

  convertToPictographs(
    blueSteps: BuilderStep[],
    redSteps: BuilderStep[],
    gridMode: GridMode,
  ): PictographData[] {
    const totalSteps = Math.max(blueSteps.length, redSteps.length);
    const result: PictographData[] = [];

    for (let i = 0; i < totalSteps; i++) {
      const blueStep = blueSteps[i];
      const redStep = redSteps[i];

      const motions: PictographData["motions"] = {};
      if (blueStep) motions[MotionColor.BLUE] = this.stepToMotion(blueStep, MotionColor.BLUE, gridMode);
      if (redStep) motions[MotionColor.RED] = this.stepToMotion(redStep, MotionColor.RED, gridMode);

      result.push({
        id: `builder-step-${i}`,
        motions,
        gridMode,
      });
    }

    return result;
  }

  convertToStartPosition(
    blueSteps: BuilderStep[],
    redSteps: BuilderStep[],
    currentPosition: GridLocation | null,
    currentOrientation: Orientation,
    activeHand: MotionColor,
    gridMode: GridMode,
  ): PictographData | null {
    const firstBlue = blueSteps[0];
    const firstRed = redSteps[0];
    const isPlacing = currentPosition !== null;

    // Determine blue start
    let bluePos: GridLocation | null = null;
    let blueOri: Orientation = Orientation.IN;
    if (firstBlue) {
      bluePos = firstBlue.startPosition;
      blueOri = firstBlue.startOrientation;
    } else if (isPlacing && activeHand === MotionColor.BLUE) {
      bluePos = currentPosition;
      blueOri = currentOrientation;
    }

    // Determine red start
    let redPos: GridLocation | null = null;
    let redOri: Orientation = Orientation.IN;
    if (firstRed) {
      redPos = firstRed.startPosition;
      redOri = firstRed.startOrientation;
    } else if (isPlacing && activeHand === MotionColor.RED) {
      redPos = currentPosition;
      redOri = currentOrientation;
    }

    if (!bluePos && !redPos) return null;

    const motions: PictographData["motions"] = {};
    if (bluePos) motions[MotionColor.BLUE] = this.createStaticMotion(bluePos, blueOri, MotionColor.BLUE, gridMode);
    if (redPos) motions[MotionColor.RED] = this.createStaticMotion(redPos, redOri, MotionColor.RED, gridMode);

    return {
      id: "builder-start",
      motions,
      gridMode,
    };
  }

  async lookupLetter(
    blueMotion: MotionData,
    redMotion: MotionData,
    gridMode: GridMode,
  ): Promise<Letter | null> {
    const letter = await motionQueryHandler.findLetterByMotionConfiguration(
      blueMotion,
      redMotion,
      gridMode,
    );
    return (letter as Letter) ?? null;
  }
}
