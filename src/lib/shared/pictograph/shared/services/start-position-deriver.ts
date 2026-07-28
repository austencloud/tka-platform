import { getGridPositionFromLocations } from "$lib/shared/pictograph/grid/services/grid-position-deriver";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import {
  createMotionData,
  isVisibleMotion,
} from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { createPictographData } from "$lib/shared/pictograph/shared/domain/factories/create-pictograph-data";
import {
  MotionType,
  MotionColor,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { Letter } from "$lib/shared/foundation/domain/models/letter";
import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { getSequenceMotionProfile } from "$lib/shared/foundation/services/sequence-motion-profile";
import type { SoloMotionColor } from "$lib/shared/foundation/services/sequence-motion-profile";
import { createStartPositionData } from "$lib/shared/create/factories/create-start-position-data";

export class StartPositionDeriver {
  deriveFromFirstStep(firstStep: StepData): StartPositionData {
    const blueMotion = firstStep.motions?.[MotionColor.BLUE];
    const redMotion = firstStep.motions?.[MotionColor.RED];

    // Invisible placeholder = hand not really there (both-required Step shape).
    if (!isVisibleMotion(blueMotion) || !isVisibleMotion(redMotion)) {
      throw new Error(
        "Cannot derive start position: first beat missing blue or red motion"
      );
    }

    const blueStartLocation = blueMotion.startLocation;
    const redStartLocation = redMotion.startLocation;

    const gridPosition = getGridPositionFromLocations(
      blueStartLocation,
      redStartLocation
    );

    const letter = this.getLetterFromGridPosition(gridPosition);

    const gridMode = blueMotion.gridMode;

    const blueStaticMotion = createMotionData({
      motionType: MotionType.STATIC,
      startLocation: blueStartLocation,
      endLocation: blueStartLocation,
      startOrientation: blueMotion.startOrientation,
      endOrientation: blueMotion.startOrientation,
      rotationDirection: RotationDirection.NO_ROTATION,
      turns: 0,
      color: MotionColor.BLUE,
      isVisible: true,
      propType: blueMotion.propType,
      arrowLocation: blueStartLocation,
      gridMode,
    });

    const redStaticMotion = createMotionData({
      motionType: MotionType.STATIC,
      startLocation: redStartLocation,
      endLocation: redStartLocation,
      startOrientation: redMotion.startOrientation,
      endOrientation: redMotion.startOrientation,
      rotationDirection: RotationDirection.NO_ROTATION,
      turns: 0,
      color: MotionColor.RED,
      isVisible: true,
      propType: redMotion.propType,
      arrowLocation: redStartLocation,
      gridMode,
    });

    const pictographData = createPictographData({
      id: `derived-start-${gridPosition}`,
      letter,
      startPosition: gridPosition,
      endPosition: gridPosition,
      motions: {
        [MotionColor.BLUE]: blueStaticMotion,
        [MotionColor.RED]: redStaticMotion,
      },
    });

    return {
      ...pictographData,
      isStartPosition: true,
      gridPosition,
    } as StartPositionData;
  }

  getOrDeriveStartPosition(sequence: SequenceData): StartPositionData | null {
    const profile = getSequenceMotionProfile(sequence);
    const isRenderable = (
      candidate: StartPositionData | null | undefined
    ): candidate is StartPositionData => {
      if (!candidate) return false;
      const blueVisible = isVisibleMotion(
        candidate.motions?.[MotionColor.BLUE]
      );
      const redVisible = isVisibleMotion(candidate.motions?.[MotionColor.RED]);
      if (profile.kind === "solo") {
        return profile.color === "blue"
          ? blueVisible && !redVisible
          : redVisible && !blueVisible;
      }
      return blueVisible && redVisible;
    };

    if (isRenderable(sequence.startPosition)) {
      return sequence.startPosition;
    }

    if (isRenderable(sequence.startingPosition)) {
      return sequence.startingPosition;
    }

    const firstStep = sequence.steps?.[0];
    if (firstStep) {
      try {
        return profile.kind === "solo"
          ? this.deriveSoloFromFirstStep(firstStep, profile.color)
          : this.deriveFromFirstStep(firstStep);
      } catch (error) {
        console.warn("Failed to derive start position from first beat:", error);
        return null;
      }
    }

    return null;
  }

  private deriveSoloFromFirstStep(
    firstStep: StepData,
    color: SoloMotionColor
  ): StartPositionData {
    const source = firstStep.motions?.[color];
    if (!isVisibleMotion(source)) {
      throw new Error(
        `Cannot derive solo start position: first beat missing ${color} motion`
      );
    }

    const staticMotion = createMotionData({
      ...source,
      motionType: MotionType.STATIC,
      rotationDirection: RotationDirection.NO_ROTATION,
      endLocation: source.startLocation,
      endOrientation: source.startOrientation,
      turns: 0,
      arrowLocation: source.startLocation,
      isVisible: true,
    });

    return createStartPositionData({
      gridPosition: null,
      motions: { [color]: staticMotion },
    });
  }

  private getLetterFromGridPosition(position: GridPosition): Letter {
    const positionStr = position.toString().toLowerCase();

    if (positionStr.startsWith("alpha")) {
      return Letter.ALPHA;
    }
    if (positionStr.startsWith("beta")) {
      return Letter.BETA;
    }
    if (positionStr.startsWith("gamma")) {
      return Letter.GAMMA;
    }

    console.warn(
      `Unknown grid position type: ${position}, defaulting to ALPHA`
    );
    return Letter.ALPHA;
  }
}

export const startPositionDeriver = new StartPositionDeriver();
