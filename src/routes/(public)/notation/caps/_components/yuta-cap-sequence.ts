/**
 * Hand-authored Yuta CAP sequence for the /notation/caps live hero.
 *
 * The exact pattern Austen specced (2026-07-19), verified against the domain
 * server's orientation algebra (pro + even turns preserves orientation; anti +
 * odd turns preserves orientation), so every step is out → out:
 *
 *   1. pro  E → S, 0 turns, cw   (isolation — pro at 0 turns)
 *   2. pro  S → W, 0 turns, cw   (isolation)
 *   3. anti W → S, 1 turn,  ccw  (antispin petal)
 *   4. anti S → E, 1 turn,  ccw  (antispin petal — closes the loop at east)
 *
 * One club, one hand: the blue hand is authored static-at-west with
 * isVisible:false, so engine and renderers skip it entirely.
 * Template lineage: buildGuideMotionSequence (guide-motion-configs.ts).
 */
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import {
  GridMode,
  GridLocation,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  MotionType,
  MotionColor,
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  createSequenceData,
  type SequenceData,
} from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";

type PathShape = "arc" | "linear" | "concave";

interface Leg {
  start: GridLocation;
  end: GridLocation;
  type: MotionType;
  turns: number;
  rotation: RotationDirection;
  /* Per-motion pathShape WINS over the engine's motion-aware default
     (resolvePathType returns it first), so it must match the motion type:
     pro = arc, anti = concave. Forcing "arc" on the anti steps made them
     render as pro-shaped sweeps (the 2026-07-19 bug). */
  pathShape: PathShape;
}

const RED_LEGS: Leg[] = [
  {
    start: GridLocation.EAST,
    end: GridLocation.SOUTH,
    type: MotionType.PRO,
    turns: 0,
    rotation: RotationDirection.CLOCKWISE,
    pathShape: "arc",
  },
  {
    start: GridLocation.SOUTH,
    end: GridLocation.WEST,
    type: MotionType.PRO,
    turns: 0,
    rotation: RotationDirection.CLOCKWISE,
    pathShape: "arc",
  },
  {
    start: GridLocation.WEST,
    end: GridLocation.SOUTH,
    type: MotionType.ANTI,
    turns: 1,
    rotation: RotationDirection.COUNTER_CLOCKWISE,
    pathShape: "concave",
  },
  {
    start: GridLocation.SOUTH,
    end: GridLocation.EAST,
    type: MotionType.ANTI,
    turns: 1,
    rotation: RotationDirection.COUNTER_CLOCKWISE,
    pathShape: "concave",
  },
];

function makeMotion(
  color: MotionColor,
  start: GridLocation,
  end: GridLocation,
  type: MotionType,
  turns: number,
  rotation: RotationDirection,
  pathShape: PathShape,
  isVisible: boolean,
): MotionData {
  return {
    motionType: type,
    rotationDirection: rotation,
    startLocation: start,
    endLocation: end,
    color,
    turns,
    startOrientation: Orientation.OUT,
    endOrientation: Orientation.OUT,
    isVisible,
    propType: PropType.CLUB,
    gridMode: GridMode.DIAMOND,
    pathShape,
    arrowLocation: start,
    arrowPlacementData: {
      positionX: 0,
      positionY: 0,
      rotationAngle: 0,
      coordinates: null,
      svgCenter: null,
      svgMirrored: false,
      manualAdjustmentX: 0,
      manualAdjustmentY: 0,
    },
    propPlacementData: { positionX: 0, positionY: 0, rotationAngle: 0 },
  };
}

/* The hidden hand: engine and renderers skip isVisible:false motions
   entirely (isVisibleMotion guards), so this is a genuine solo club. */
function staticBlue(): MotionData {
  return makeMotion(
    MotionColor.BLUE,
    GridLocation.WEST,
    GridLocation.WEST,
    MotionType.STATIC,
    0,
    RotationDirection.NO_ROTATION,
    "arc",
    false,
  );
}

export function buildYutaCapSequence(): SequenceData {
  const startPosition: StartPositionData = {
    isStartPosition: true as const,
    id: "caps-yuta-start",
    gridMode: GridMode.DIAMOND,
    motions: {
      blue: staticBlue(),
      red: makeMotion(
        MotionColor.RED,
        GridLocation.EAST,
        GridLocation.EAST,
        MotionType.STATIC,
        0,
        RotationDirection.NO_ROTATION,
        "arc",
        true,
      ),
    },
  };

  const steps: StepData[] = RED_LEGS.map((leg, i) => ({
    id: `caps-yuta-step${i + 1}`,
    stepNumber: i + 1,
    duration: 1,
    blueReversal: false,
    redReversal: false,
    isBlank: false,
    letter: null,
    startPosition: null,
    endPosition: null,
    gridMode: GridMode.DIAMOND,
    motions: {
      blue: staticBlue(),
      red: makeMotion(
        MotionColor.RED,
        leg.start,
        leg.end,
        leg.type,
        leg.turns,
        leg.rotation,
        leg.pathShape,
        true,
      ),
    },
  }));

  return createSequenceData({
    id: "caps-yuta-live",
    name: "Yuta CAP",
    word: "yuta-cap",
    steps,
    startPosition,
    gridMode: GridMode.DIAMOND,
  });
}
