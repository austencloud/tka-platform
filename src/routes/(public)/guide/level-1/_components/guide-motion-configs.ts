/**
 * Single source of truth for the Level 1 Guide hand-motion demos.
 *
 * GENERATED ASSETS: the mp4 loops under `static/guide/level-1/motions/{id}.mp4`
 * are baked from these configs, NOT hand-authored. To change a demo:
 *   1. Edit the relevant entry below.
 *   2. `npm run dev`, open `/test/guide-motion-bake`, click "Bake all".
 *   3. Eyeball the preview grid.
 *   4. Commit the changed `static/guide/level-1/motions/*.mp4`.
 *
 * `buildGuideMotionSequence` is the shared builder (extracted from the old
 * GuideMotionDemo.svelte). Only the bake route and the dev write endpoint
 * import this module — the runtime guide page imports nothing from here.
 */
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import { GridMode, GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  MotionType,
  MotionColor,
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { createSequenceData, type SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/StartPositionData";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";

export interface GuideMotionLeg {
  start: GridLocation;
  end: GridLocation;
  motionType: MotionType;
}

export interface GuideMotionConfig {
  id: string;
  label: string;
  red: GuideMotionLeg;
  blue?: GuideMotionLeg;
  /** Renderer visibility flag — threaded into `renderScene`'s `visibility.blueMotionVisible`
   *  by the bake helper. NOT reflected in the `SequenceData` output of `buildGuideMotionSequence`
   *  (the blue motion is always present in the data; this flag controls whether it is drawn). */
  showBlue: boolean;
}

export const GUIDE_MOTION_CONFIGS: GuideMotionConfig[] = [
  // --- HandMotions.svelte (5) ---
  {
    id: "hm-start",
    label: "Hand resting static at west (starting position)",
    showBlue: false,
    red: { start: GridLocation.WEST, end: GridLocation.WEST, motionType: MotionType.STATIC },
  },
  {
    id: "hm-shift-wn",
    label: "Hand shifts from west to north",
    showBlue: false,
    red: { start: GridLocation.WEST, end: GridLocation.NORTH, motionType: MotionType.PRO },
  },
  {
    id: "hm-shift-ws",
    label: "Hand shifts from west to south",
    showBlue: false,
    red: { start: GridLocation.WEST, end: GridLocation.SOUTH, motionType: MotionType.PRO },
  },
  {
    id: "hm-dash-we",
    label: "Hand dashes straight across from west to east",
    showBlue: false,
    red: { start: GridLocation.WEST, end: GridLocation.EAST, motionType: MotionType.DASH },
  },
  {
    id: "hm-static-w", // Same motion as hm-start; separate baked asset for the static-branch cell in HandMotions.svelte (two distinct positions in the guide → two stable filenames).
    label: "Hand stays static at west",
    showBlue: false,
    red: { start: GridLocation.WEST, end: GridLocation.WEST, motionType: MotionType.STATIC },
  },

  // --- Type1AlphaBeta.svelte (4) ---
  {
    id: "t1-split-same",
    label: "Dual-shift: both hands shift in parallel, alpha to alpha",
    showBlue: true,
    red: { start: GridLocation.EAST, end: GridLocation.NORTH, motionType: MotionType.PRO },
    blue: { start: GridLocation.WEST, end: GridLocation.SOUTH, motionType: MotionType.PRO },
  },
  {
    id: "t1-together-same",
    label: "Dual-shift: both hands shift from south, beta to beta",
    showBlue: true,
    red: { start: GridLocation.SOUTH, end: GridLocation.EAST, motionType: MotionType.PRO },
    blue: { start: GridLocation.SOUTH, end: GridLocation.WEST, motionType: MotionType.PRO },
  },
  {
    id: "t1-split-to-together",
    label: "Dual-shift: hands start apart and end together",
    showBlue: true,
    red: { start: GridLocation.EAST, end: GridLocation.SOUTH, motionType: MotionType.PRO },
    blue: { start: GridLocation.WEST, end: GridLocation.SOUTH, motionType: MotionType.PRO },
  },
  {
    id: "t1-together-to-split",
    label: "Dual-shift: hands start together and end apart",
    showBlue: true,
    red: { start: GridLocation.SOUTH, end: GridLocation.EAST, motionType: MotionType.PRO },
    blue: { start: GridLocation.SOUTH, end: GridLocation.WEST, motionType: MotionType.PRO },
  },

  // --- Type1Gamma.svelte (2) ---
  {
    id: "t1-gamma-to-gamma",
    label: "Dual-shift from gamma to gamma",
    showBlue: true,
    red: { start: GridLocation.EAST, end: GridLocation.SOUTH, motionType: MotionType.PRO },
    blue: { start: GridLocation.SOUTH, end: GridLocation.WEST, motionType: MotionType.PRO },
  },
  {
    id: "t1-gamma-opposite",
    label: "Dual-shift at gamma, hands moving in opposite directions",
    showBlue: true,
    red: { start: GridLocation.EAST, end: GridLocation.NORTH, motionType: MotionType.PRO },
    blue: { start: GridLocation.SOUTH, end: GridLocation.EAST, motionType: MotionType.PRO },
  },

  // --- Type2Shifts.svelte (2) ---
  {
    id: "t2-red-shifts",
    label: "Shift: right hand shifts while left hand stays static",
    showBlue: true,
    red: { start: GridLocation.EAST, end: GridLocation.SOUTH, motionType: MotionType.PRO },
    blue: { start: GridLocation.WEST, end: GridLocation.WEST, motionType: MotionType.STATIC },
  },
  {
    id: "t2-blue-shifts",
    label: "Shift: left hand shifts while right hand stays static",
    showBlue: true,
    red: { start: GridLocation.EAST, end: GridLocation.EAST, motionType: MotionType.STATIC },
    blue: { start: GridLocation.WEST, end: GridLocation.NORTH, motionType: MotionType.PRO },
  },

  // --- Type3CrossShifts.svelte (1) ---
  {
    id: "t3-cross-shift",
    label: "Cross-shift: right hand shifts while left hand dashes across",
    showBlue: true,
    red: { start: GridLocation.EAST, end: GridLocation.SOUTH, motionType: MotionType.PRO },
    blue: { start: GridLocation.WEST, end: GridLocation.EAST, motionType: MotionType.DASH },
  },

  // --- Type4Dash.svelte (1) ---
  {
    id: "t4-dash",
    label: "Dash: right hand dashes across while left hand stays static",
    showBlue: true,
    red: { start: GridLocation.SOUTH, end: GridLocation.NORTH, motionType: MotionType.DASH },
    blue: { start: GridLocation.WEST, end: GridLocation.WEST, motionType: MotionType.STATIC },
  },

  // --- Type5DualDash.svelte (1) ---
  {
    id: "t5-dual-dash",
    label: "Dual-dash: both hands dash across the center",
    showBlue: true,
    red: { start: GridLocation.EAST, end: GridLocation.WEST, motionType: MotionType.DASH },
    blue: { start: GridLocation.WEST, end: GridLocation.EAST, motionType: MotionType.DASH },
  },

  // --- Type6Static.svelte (3) ---
  {
    id: "t6-static-alpha",
    label: "Static: both hands hold at alpha (opposite points)",
    showBlue: true,
    red: { start: GridLocation.EAST, end: GridLocation.EAST, motionType: MotionType.STATIC },
    blue: { start: GridLocation.WEST, end: GridLocation.WEST, motionType: MotionType.STATIC },
  },
  {
    id: "t6-static-beta",
    label: "Static: both hands hold at beta (same point)",
    showBlue: true,
    red: { start: GridLocation.SOUTH, end: GridLocation.SOUTH, motionType: MotionType.STATIC },
    blue: { start: GridLocation.SOUTH, end: GridLocation.SOUTH, motionType: MotionType.STATIC },
  },
  {
    id: "t6-static-gamma",
    label: "Static: both hands hold at gamma (right angle)",
    showBlue: true,
    red: { start: GridLocation.EAST, end: GridLocation.EAST, motionType: MotionType.STATIC },
    blue: { start: GridLocation.SOUTH, end: GridLocation.SOUTH, motionType: MotionType.STATIC },
  },
];

export const GUIDE_MOTION_IDS: ReadonlySet<string> = new Set(GUIDE_MOTION_CONFIGS.map((c) => c.id));

export function isKnownMotionId(id: string): boolean {
  return GUIDE_MOTION_IDS.has(id);
}

function makeMotion(
  color: MotionColor,
  startLoc: GridLocation,
  endLoc: GridLocation,
  type: MotionType,
): MotionData {
  // Shifts (pro/anti) arc along the perimeter — the curved arc is what
  // distinguishes a shift from a dash. Dashes cut straight across the center.
  const pathShape = type === MotionType.DASH ? "linear" : "arc";
  return {
    motionType: type,
    rotationDirection: RotationDirection.NO_ROTATION,
    startLocation: startLoc,
    endLocation: endLoc,
    color,
    turns: 0,
    startOrientation: Orientation.IN,
    endOrientation: Orientation.IN,
    isVisible: true,
    propType: PropType.HAND,
    gridMode: GridMode.DIAMOND,
    pathShape,
    arrowLocation: startLoc,
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

export function buildGuideMotionSequence(config: GuideMotionConfig): SequenceData {
  const { red, blue } = config;
  const bStart = blue?.start ?? red.start;
  const bEnd = blue?.end ?? bStart;
  const bMotion = blue?.motionType ?? MotionType.STATIC;

  const startPosition: StartPositionData = {
    isStartPosition: true as const,
    id: `guide-${config.id}-start`,
    gridMode: GridMode.DIAMOND,
    motions: {
      blue: makeMotion(MotionColor.BLUE, bStart, bStart, MotionType.STATIC),
      red: makeMotion(MotionColor.RED, red.start, red.start, MotionType.STATIC),
    },
  };

  const step: StepData = {
    isStep: true as const,
    id: `guide-${config.id}-step1`,
    stepNumber: 1,
    duration: 1,
    blueReversal: false,
    redReversal: false,
    isBlank: false,
    gridMode: GridMode.DIAMOND,
    motions: {
      blue: makeMotion(MotionColor.BLUE, bStart, bEnd, bMotion),
      red: makeMotion(MotionColor.RED, red.start, red.end, red.motionType),
    },
  };

  return createSequenceData({
    id: `guide-motion-${config.id}`,
    name: config.id,
    word: config.id,
    steps: [step],
    startPosition,
    gridMode: GridMode.DIAMOND,
  });
}
