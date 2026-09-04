import {
  TND_BY_FAMILY,
  type TnDElement,
} from "$lib/features/choreo-card/domain/tnd-element";
import { createStartPositionData } from "$lib/shared/foundation/domain/factories/create-start-position-data";
import { createStepData } from "$lib/shared/foundation/domain/factories/create-step-data";
import {
  createSequenceData,
  type SequenceData,
} from "$lib/shared/foundation/domain/models/sequence-data";
import { Letter } from "$lib/shared/foundation/domain/models/letter";
import {
  GridLocation,
  GridMode,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { getGridPositionFromLocations } from "$lib/shared/pictograph/grid/services/grid-position-deriver";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import {
  HandSide,
  MotionType,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  createMotionData,
  createPlaceholderMotion,
} from "$lib/shared/pictograph/shared/domain/models/motion-data";

const { NORTH: N, EAST: E, SOUTH: S, WEST: W } = GridLocation;

type Move = readonly [
  leftFrom: GridLocation,
  leftTo: GridLocation,
  rightFrom: GridLocation,
  rightTo: GridLocation,
];

function handMotion(hand: HandSide, from: GridLocation, to: GridLocation) {
  return createMotionData({
    hand,
    motionType: from === to ? MotionType.STATIC : MotionType.PRO,
    startLocation: from,
    endLocation: to,
    propType: PropType.HAND,
    gridMode: GridMode.DIAMOND,
  });
}

function buildHandSequence(
  id: string,
  name: string,
  from: GridLocation,
  to: GridLocation,
  motionType: MotionType
): SequenceData {
  const leftStart = createMotionData({
    hand: HandSide.LEFT,
    motionType: MotionType.STATIC,
    startLocation: from,
    endLocation: from,
    propType: PropType.HAND,
    gridMode: GridMode.DIAMOND,
  });
  const right = createPlaceholderMotion(HandSide.RIGHT, { location: E });
  const left = createMotionData({
    hand: HandSide.LEFT,
    motionType,
    startLocation: from,
    endLocation: to,
    propType: PropType.HAND,
    gridMode: GridMode.DIAMOND,
  });

  return createSequenceData({
    id,
    name,
    word: "",
    gridMode: GridMode.DIAMOND,
    startPosition: createStartPositionData({
      id: `${id}-start`,
      motions: { left: leftStart, right },
    }),
    steps: [
      createStepData({
        id: `${id}-1`,
        letter: null,
        gridMode: GridMode.DIAMOND,
        stepNumber: 1,
        motions: { left, right },
      }),
    ],
  });
}

export const HAND_PATH_STEPS = [
  {
    id: "shift",
    name: "Shift",
    guideCaption: "Move to an adjacent point",
    sequence: buildHandSequence(
      "learn-hand-shift",
      "Shift",
      W,
      N,
      MotionType.PRO
    ),
  },
  {
    id: "dash",
    name: "Dash",
    guideCaption: "Move to the opposite point",
    sequence: buildHandSequence(
      "learn-hand-dash",
      "Dash",
      W,
      E,
      MotionType.DASH
    ),
  },
  {
    id: "static",
    name: "Static",
    guideCaption: "Remain at the same point",
    sequence: buildHandSequence(
      "learn-hand-static",
      "Static",
      W,
      W,
      MotionType.STATIC
    ),
  },
] as const;

export type TimingDirectionModeId = "ss" | "ts" | "so" | "to" | "qo" | "qs";

export interface TimingDirectionMode {
  id: TimingDirectionModeId;
  name: string;
  timing: "Split" | "Together" | "Quarter";
  direction: "Same" | "Opposite";
  element: TnDElement;
  sequence: SequenceData;
}

function buildModeSequence(
  id: TimingDirectionModeId,
  name: string,
  moves: readonly Move[],
  letters: readonly (Letter | null)[]
): SequenceData {
  const first = moves[0]!;
  const startPosition = getGridPositionFromLocations(first[0], first[2]);
  const startLeft = handMotion(HandSide.LEFT, first[0], first[0]);
  const startRight = handMotion(HandSide.RIGHT, first[2], first[2]);

  return createSequenceData({
    id: `learn-mode-${id}`,
    name,
    word: "",
    gridMode: GridMode.DIAMOND,
    isCircular: true,
    startPosition: createStartPositionData({
      id: `learn-mode-${id}-start`,
      startPosition,
      endPosition: startPosition,
      gridPosition: startPosition,
      motions: { left: startLeft, right: startRight },
    }),
    steps: moves.slice(1).map((move, index) =>
      createStepData({
        id: `learn-mode-${id}-${index + 1}`,
        letter: letters[index] ?? null,
        gridMode: GridMode.DIAMOND,
        startPosition: getGridPositionFromLocations(move[0], move[2]),
        endPosition: getGridPositionFromLocations(move[1], move[3]),
        stepNumber: index + 1,
        motions: {
          left: handMotion(HandSide.LEFT, move[0], move[1]),
          right: handMotion(HandSide.RIGHT, move[2], move[3]),
        },
      })
    ),
  });
}

function mode(
  id: TimingDirectionModeId,
  familyId: string,
  name: string,
  timing: TimingDirectionMode["timing"],
  direction: TimingDirectionMode["direction"],
  moves: readonly Move[],
  letters: readonly (Letter | null)[]
): TimingDirectionMode {
  const element = TND_BY_FAMILY[familyId];
  if (!element) throw new Error(`Missing T&D family ${familyId}`);
  return {
    id,
    name,
    timing,
    direction,
    element,
    sequence: buildModeSequence(id, name, moves, letters),
  };
}

export const ALPHA_BETA_MODES = [
  mode(
    "ss",
    "split-same",
    "Split-Same",
    "Split",
    "Same",
    [
      [S, S, N, N],
      [S, W, N, E],
      [W, N, E, S],
      [N, E, S, W],
      [E, S, W, N],
    ],
    [Letter.A, Letter.A, Letter.A, Letter.A]
  ),
  mode(
    "ts",
    "tog-same",
    "Together-Same",
    "Together",
    "Same",
    [
      [S, S, S, S],
      [S, W, S, W],
      [W, N, W, N],
      [N, E, N, E],
      [E, S, E, S],
    ],
    [Letter.G, Letter.G, Letter.G, Letter.G]
  ),
  mode(
    "so",
    "split-opp",
    "Split-Opposite",
    "Split",
    "Opposite",
    [
      [W, W, W, W],
      [W, N, W, S],
      [N, E, S, E],
      [E, S, E, N],
      [S, W, N, W],
    ],
    [Letter.D, Letter.J, Letter.D, Letter.J]
  ),
  mode(
    "to",
    "tog-opp",
    "Together-Opposite",
    "Together",
    "Opposite",
    [
      [S, S, S, S],
      [S, W, S, E],
      [W, N, E, N],
      [N, E, N, W],
      [E, S, W, S],
    ],
    [Letter.D, Letter.J, Letter.D, Letter.J]
  ),
] as const satisfies readonly TimingDirectionMode[];

export const GAMMA_MODES = [
  mode(
    "qo",
    "quarter-opp",
    "Quarter-Opposite",
    "Quarter",
    "Opposite",
    [
      [S, S, E, E],
      [S, W, E, N],
      [W, N, N, W],
      [N, E, W, S],
      [E, S, S, E],
    ],
    [null, Letter.P, null, Letter.P]
  ),
  mode(
    "qs",
    "quarter-same",
    "Quarter-Same",
    "Quarter",
    "Same",
    [
      [S, S, E, E],
      [S, E, E, N],
      [E, N, N, W],
      [N, W, W, S],
      [W, S, S, E],
    ],
    [null, null, null, null]
  ),
] as const satisfies readonly TimingDirectionMode[];

/**
 * The public article explorer and the Learn lessons demonstrate the same six
 * relationships. Keep their playable sequences on this one authored list so a
 * corrected motion reaches both surfaces.
 */
export const TIMING_DIRECTION_MODES: readonly TimingDirectionMode[] = [
  ...ALPHA_BETA_MODES,
  ...GAMMA_MODES,
];
