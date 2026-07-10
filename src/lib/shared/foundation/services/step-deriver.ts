import type { ViewerPreferences } from "./types";
import type { SoloPropData } from "../domain/models/solo-prop-data";
import type { StepPairingData } from "../domain/models/step-pairing-data";
import type { SoloPropStepData } from "../domain/models/solo-prop-step-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import {
  MotionColor,
  MotionType,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  GridLocation,
  GridMode,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { calculateHandpathDirection } from "$lib/shared/pictograph/arrow/positioning/calculation/services/handpath-direction-calculator";

const CARDINAL = new Set<GridLocation>([
  GridLocation.NORTH,
  GridLocation.EAST,
  GridLocation.SOUTH,
  GridLocation.WEST,
]);

const INTERCARDINAL = new Set<GridLocation>([
  GridLocation.NORTHEAST,
  GridLocation.SOUTHEAST,
  GridLocation.SOUTHWEST,
  GridLocation.NORTHWEST,
]);

function deriveStepGridMode(
  blueStart: GridLocation,
  blueEnd: GridLocation,
  redStart: GridLocation,
  redEnd: GridLocation
): GridMode {
  const locations = [blueStart, blueEnd, redStart, redEnd];

  if (locations.includes(GridLocation.CENTER)) {
    return GridMode.CENTRIC;
  }

  const allCardinal = locations.every((loc) => CARDINAL.has(loc));
  if (allCardinal) return GridMode.DIAMOND;

  const allIntercardinal = locations.every((loc) => INTERCARDINAL.has(loc));
  if (allIntercardinal) return GridMode.BOX;

  return GridMode.SKEWED;
}

function derivePrefloatRotation(
  prefloatMotionType: MotionType | undefined,
  startLocation: GridLocation,
  endLocation: GridLocation
): RotationDirection | undefined {
  if (!prefloatMotionType) return undefined;
  const handpath = calculateHandpathDirection(startLocation, endLocation);
  if (handpath === "cw") {
    return prefloatMotionType === MotionType.PRO
      ? RotationDirection.CLOCKWISE
      : RotationDirection.COUNTER_CLOCKWISE;
  }
  if (handpath === "ccw") {
    return prefloatMotionType === MotionType.PRO
      ? RotationDirection.COUNTER_CLOCKWISE
      : RotationDirection.CLOCKWISE;
  }
  return undefined;
}

function rehydrateMotion(
  step: SoloPropStepData,
  color: MotionColor,
  gridMode: GridMode,
  propType: PropType
): MotionData {
  const prefloatRotationDirection = derivePrefloatRotation(
    step.prefloatMotionType,
    step.startLocation,
    step.endLocation
  );

  return createMotionData({
    startLocation: step.startLocation,
    endLocation: step.endLocation,
    startOrientation: step.startOrientation,
    endOrientation: step.endOrientation,
    motionType: step.motionType,
    rotationDirection: step.rotationDirection,
    turns: step.turns,
    handPath: step.handPath ?? null,
    skewSteps: step.skewSteps ?? null,
    skewDir: step.skewDir ?? null,
    color,
    propType,
    isVisible: true,
    gridMode,
    arrowLocation: step.startLocation,
    ...(step.prefloatMotionType && {
      prefloatMotionType: step.prefloatMotionType,
    }),
    ...(prefloatRotationDirection && { prefloatRotationDirection }),
  });
}

export function deriveSteps(
  blueSoloProp: SoloPropData,
  redSoloProp: SoloPropData,
  stepPairings: readonly StepPairingData[],
  viewerPrefs?: ViewerPreferences
): StepData[] {
  const bluePropType = viewerPrefs?.bluePropType ?? PropType.STAFF;
  const redPropType =
    viewerPrefs?.catDogMode ? (viewerPrefs.redPropType ?? PropType.STAFF) : bluePropType;
  const count = stepPairings.length;

  if (blueSoloProp.steps.length !== count || redSoloProp.steps.length !== count) {
    throw new Error(
      `deriveSteps: step array length mismatch - ` +
        `blue=${blueSoloProp.steps.length}, ` +
        `red=${redSoloProp.steps.length}, ` +
        `pairings=${count}`
    );
  }

  return stepPairings.map((pairing, i) => {
    const blueStep = blueSoloProp.steps[i] as SoloPropStepData;
    const redStep = redSoloProp.steps[i] as SoloPropStepData;

    const gridMode = deriveStepGridMode(
      blueStep.startLocation,
      blueStep.endLocation,
      redStep.startLocation,
      redStep.endLocation
    );

    const blueMotion = rehydrateMotion(blueStep, MotionColor.BLUE, gridMode, bluePropType);
    const redMotion = rehydrateMotion(redStep, MotionColor.RED, gridMode, redPropType);

    const stepData: StepData = {
      id: crypto.randomUUID(),
      letter: pairing.letter,
      startPosition: pairing.startPosition,
      endPosition: pairing.endPosition,
      motions: { blue: blueMotion, red: redMotion },
      gridMode,
      stepNumber: i + 1,
      duration: blueStep.duration,
      blueReversal: pairing.blueReversal,
      redReversal: pairing.redReversal,
      isBlank: false,
    };

    return stepData;
  });
}

export function deriveStartPosition(
  blueSoloProp: SoloPropData,
  redSoloProp: SoloPropData
): StartPositionData {
  const gridMode = deriveStepGridMode(
    blueSoloProp.startLocation,
    blueSoloProp.startLocation,
    redSoloProp.startLocation,
    redSoloProp.startLocation
  );

  const blueMotion = createMotionData({
    startLocation: blueSoloProp.startLocation,
    endLocation: blueSoloProp.startLocation,
    startOrientation: blueSoloProp.startOrientation,
    endOrientation: blueSoloProp.startOrientation,
    motionType: MotionType.STATIC,
    rotationDirection: RotationDirection.NO_ROTATION,
    turns: 0,
    color: MotionColor.BLUE,
    propType: PropType.STAFF,
    isVisible: true,
    gridMode,
    arrowLocation: blueSoloProp.startLocation,
  });

  const redMotion = createMotionData({
    startLocation: redSoloProp.startLocation,
    endLocation: redSoloProp.startLocation,
    startOrientation: redSoloProp.startOrientation,
    endOrientation: redSoloProp.startOrientation,
    motionType: MotionType.STATIC,
    rotationDirection: RotationDirection.NO_ROTATION,
    turns: 0,
    color: MotionColor.RED,
    propType: PropType.STAFF,
    isVisible: true,
    gridMode,
    arrowLocation: redSoloProp.startLocation,
  });

  return {
    id: crypto.randomUUID(),
    isStartPosition: true,
    motions: { blue: blueMotion, red: redMotion },
    gridMode,
    gridPosition: null,
  };
}
