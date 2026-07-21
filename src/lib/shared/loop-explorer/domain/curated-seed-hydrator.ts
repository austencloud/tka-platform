import { createStepData } from "$lib/shared/foundation/domain/factories/create-step-data";
import type { LOOPType } from "$lib/shared/foundation/domain/models/generation/circular-models";
import { normalizeLetter } from "$lib/shared/foundation/domain/models/letter";
import {
  createSequenceData,
  type SequenceData,
} from "$lib/shared/foundation/domain/models/sequence-data";
import {
  convertToGridPosition,
  mapLocation,
  mapMotionType,
  mapOrientation,
  mapRotationDirection,
} from "$lib/shared/foundation/services/data/enum-mapper";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  createMotionData,
  type MotionData,
} from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { startPositionDeriver } from "$lib/shared/pictograph/shared/services/start-position-deriver";
import type { LoopSlice } from "./legality";

export interface CuratedMotionWire {
  readonly motionType: string;
  readonly startLocation: string;
  readonly endLocation: string;
  readonly rotationDirection: string;
  readonly startOrientation: string;
  readonly endOrientation: string;
  readonly turns: number | "fl";
  readonly plane?: string;
  readonly prefloatMotionType?: string;
  readonly prefloatRotationDirection?: string;
}

export interface CuratedStepWire {
  readonly letter: string;
  readonly startPosition: string;
  readonly endPosition: string;
  readonly stepNumber: number;
  readonly blueMotion: CuratedMotionWire;
  readonly redMotion: CuratedMotionWire;
}

export interface CuratedSequenceWire {
  readonly word: string;
  readonly startPosition: string;
  readonly steps: readonly CuratedStepWire[];
}

function hydrateMotion(
  wire: CuratedMotionWire,
  color: MotionColor
): MotionData {
  const startLocation = mapLocation(wire.startLocation);

  return createMotionData({
    motionType: mapMotionType(wire.motionType),
    startLocation,
    endLocation: mapLocation(wire.endLocation),
    rotationDirection: mapRotationDirection(wire.rotationDirection),
    startOrientation: mapOrientation(wire.startOrientation),
    endOrientation: mapOrientation(wire.endOrientation),
    turns: wire.turns === "fl" ? "fl" : wire.turns,
    ...(wire.plane === "wall" && { plane: "wall" }),
    ...(wire.prefloatMotionType && {
      prefloatMotionType: mapMotionType(wire.prefloatMotionType),
    }),
    ...(wire.prefloatRotationDirection && {
      prefloatRotationDirection: mapRotationDirection(
        wire.prefloatRotationDirection
      ),
    }),
    color,
    isVisible: true,
    propType: PropType.STAFF,
    // The compact harness format does not persist placement data. This is the
    // same safe seed used by the existing raw-step converter; render pipelines
    // derive the final placement from the completed pictograph when needed.
    arrowLocation: startLocation,
    gridMode: GridMode.DIAMOND,
  });
}

/**
 * Converts the verification harness's compact wire format at a trusted data
 * boundary. Editorial pages and the fallback corpus share this one converter,
 * so string positions can never leak into the animation engine again.
 */
export function hydrateCuratedSequence(
  wire: CuratedSequenceWire,
  loopType: LOOPType,
  slice: LoopSlice,
  sequenceIndex: number
): SequenceData {
  if (!wire.steps.length) {
    throw new Error("seed has no steps");
  }

  const id = `curated-${loopType}-${slice}-${sequenceIndex}`;
  const steps = wire.steps.map((step, stepIndex) => {
    const letter = normalizeLetter(step.letter);
    const startPosition = convertToGridPosition(step.startPosition);
    const endPosition = convertToGridPosition(step.endPosition);

    if (!letter || !startPosition || !endPosition) {
      throw new Error(`seed step ${stepIndex + 1} has invalid notation data`);
    }

    return createStepData({
      id: `${id}-step-${stepIndex + 1}`,
      letter,
      startPosition,
      endPosition,
      stepNumber: step.stepNumber,
      duration: 1,
      motions: {
        [MotionColor.BLUE]: hydrateMotion(step.blueMotion, MotionColor.BLUE),
        [MotionColor.RED]: hydrateMotion(step.redMotion, MotionColor.RED),
      },
    });
  });

  const firstStep = steps[0];
  if (!firstStep) throw new Error("seed has no hydrated steps");

  const startPosition = startPositionDeriver.deriveFromFirstBeat(firstStep);
  const declaredStartPosition = convertToGridPosition(wire.startPosition);
  if (
    !declaredStartPosition ||
    startPosition.gridPosition !== declaredStartPosition
  ) {
    throw new Error(
      `declared start ${wire.startPosition} disagrees with first-step motions`
    );
  }

  const period = slice === "quartered" ? 4 : 2;
  return createSequenceData({
    id,
    name: wire.word,
    word: wire.word,
    steps,
    startPosition,
    thumbnails: [],
    isFavorite: false,
    isCircular: true,
    loopType,
    period,
    orientationCycleCount: period,
    sequenceLength: steps.length,
    gridMode: GridMode.DIAMOND,
    tags: ["curated-loop-seed"],
    metadata: { source: "loop-explorer-verification-harness" },
  });
}
