/**
 * Ground-truth fixtures for the sequence-combination engine.
 *
 * Every step here is transcribed from Austen's worked cards (2026-08-04): the
 * GG+HH fusion card, the FALG variants, and the ΦΨ bridge steps. The GGGG /
 * HHHH / AAAA cycles extend his literal consecutive steps by continuing the
 * same 90° pattern around the grid.
 *
 * Two invariants make these usable as ground truth, and `fixtures.test.ts`
 * enforces both:
 *   1. Each sequence is a closed loop — step i's startPosition is step i-1's
 *      endPosition, and the last step returns to the first step's seam.
 *   2. Every position LABEL equals what `getGridPositionFromLocations` computes
 *      from that step's own motion locations. The mapper is canon; a label that
 *      disagrees is the bug.
 *
 * Hermetic by construction — no MCP, no network, no fixture files on disk.
 */

import { createStartPositionData } from "$lib/shared/foundation/domain/factories/create-start-position-data";
import { createStepData } from "$lib/shared/foundation/domain/factories/create-step-data";
import type { Letter } from "$lib/shared/foundation/domain/models/letter";
import {
  createSequenceData,
  type SequenceData,
} from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import { calculateArrowLocation } from "$lib/shared/pictograph/arrow/positioning/calculation/services/arrow-locator";
import {
  GridLocation,
  GridMode,
  GridPosition,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  MotionColor,
  MotionType,
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  createMotionData,
  type MotionData,
} from "$lib/shared/pictograph/shared/domain/models/motion-data";

export interface MotionSpec {
  readonly type: MotionType;
  /** PROP rotation direction, exactly as printed on Austen's cards. */
  readonly rot: RotationDirection;
  readonly from: GridLocation;
  readonly to: GridLocation;
  readonly startOri: Orientation;
  readonly endOri: Orientation;
}

function makeMotion(spec: MotionSpec, color: MotionColor): MotionData {
  return createMotionData({
    motionType: spec.type,
    rotationDirection: spec.rot,
    startLocation: spec.from,
    endLocation: spec.to,
    startOrientation: spec.startOri,
    endOrientation: spec.endOri,
    turns: 0,
    color,
    gridMode: GridMode.DIAMOND,
    // createMotionData's arrowLocation default is a hard NORTH, which would be
    // wrong on every fixture step. The locator is a pure function of the two
    // locations plus motion type, so compute it rather than leave it lying.
    arrowLocation: calculateArrowLocation({
      startLocation: spec.from,
      endLocation: spec.to,
      motionType: spec.type,
    }) as GridLocation,
  });
}

export function makeStep(
  stepNumber: number,
  letter: string,
  startPosition: GridPosition,
  endPosition: GridPosition,
  blue: MotionSpec,
  red: MotionSpec
): StepData {
  return createStepData({
    id: `fixture-${letter}-${stepNumber}-${startPosition}-${endPosition}`,
    stepNumber,
    letter: letter as Letter,
    startPosition,
    endPosition,
    gridMode: GridMode.DIAMOND,
    duration: 1,
    motions: {
      [MotionColor.BLUE]: makeMotion(blue, MotionColor.BLUE),
      [MotionColor.RED]: makeMotion(red, MotionColor.RED),
    },
  });
}

/** The static both-hands hold the sequence begins from. */
function holdOf(motion: MotionData): MotionData {
  return createMotionData({
    ...motion,
    motionType: MotionType.STATIC,
    rotationDirection: RotationDirection.NO_ROTATION,
    endLocation: motion.startLocation,
    endOrientation: motion.startOrientation,
    arrowLocation: motion.startLocation,
    turns: 0,
  });
}

export function makeLoop(
  id: string,
  word: string,
  steps: readonly StepData[]
): SequenceData {
  const first = steps[0]!;
  return createSequenceData({
    id,
    name: word,
    word,
    steps,
    isCircular: true,
    gridMode: GridMode.DIAMOND,
    startPosition: createStartPositionData({
      id: `${id}-start`,
      letter: null,
      startPosition: first.startPosition,
      endPosition: first.startPosition,
      gridPosition: first.startPosition,
      motions: {
        [MotionColor.BLUE]: holdOf(first.motions.blue),
        [MotionColor.RED]: holdOf(first.motions.red),
      },
    }),
  });
}

/** The seam each step starts at, in order. */
export function seamsOf(seq: SequenceData): GridPosition[] {
  return seq.steps.map((s) => s.startPosition as GridPosition);
}

// ---------------------------------------------------------------------------
// Compact spec helpers
// ---------------------------------------------------------------------------

const CW = RotationDirection.CLOCKWISE;
const CCW = RotationDirection.COUNTER_CLOCKWISE;
const NONE = RotationDirection.NO_ROTATION;

const { NORTH: N, EAST: E, SOUTH: S, WEST: W } = GridLocation;
const IN = Orientation.IN;
const OUT = Orientation.OUT;

const spec =
  (type: MotionType) =>
  (
    rot: RotationDirection,
    from: GridLocation,
    to: GridLocation,
    startOri: Orientation,
    endOri: Orientation
  ): MotionSpec => ({ type, rot, from, to, startOri, endOri });

const pro = spec(MotionType.PRO);
const anti = spec(MotionType.ANTI);
const dash = spec(MotionType.DASH);
const staticM = spec(MotionType.STATIC);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * GGGG — clockwise pro cycle through the beta world.
 *
 * Steps 1–2 are literal (steps 7–8 of Austen's third FALG variant):
 *   G beta1>beta3, both hands pro cw n>e, in>in
 *   G beta3>beta5, both hands pro cw e>s, in>in
 * Steps 3–4 continue the same 90° pattern (s>w, w>n) back to beta1.
 */
export const GGGG_CW: SequenceData = makeLoop("fx-gggg", "GGGG", [
  makeStep(1, "G", GridPosition.BETA1, GridPosition.BETA3, pro(CW, N, E, IN, IN), pro(CW, N, E, IN, IN)),
  makeStep(2, "G", GridPosition.BETA3, GridPosition.BETA5, pro(CW, E, S, IN, IN), pro(CW, E, S, IN, IN)),
  makeStep(3, "G", GridPosition.BETA5, GridPosition.BETA7, pro(CW, S, W, IN, IN), pro(CW, S, W, IN, IN)),
  makeStep(4, "G", GridPosition.BETA7, GridPosition.BETA1, pro(CW, W, N, IN, IN), pro(CW, W, N, IN, IN)),
]);

/**
 * HHHH — anti cycle through the beta world, orientations alternating in↔out.
 *
 * Steps 1–2 are literal (steps 7–8 of Austen's second example):
 *   H beta1>beta3, both hands anti ccw n>e, in>out
 *   H beta3>beta5, both hands anti ccw e>s, out>in
 * Steps 3–4 continue the pattern (s>w in>out, w>n out>in).
 */
export const HHHH_CCW: SequenceData = makeLoop("fx-hhhh", "HHHH", [
  makeStep(1, "H", GridPosition.BETA1, GridPosition.BETA3, anti(CCW, N, E, IN, OUT), anti(CCW, N, E, IN, OUT)),
  makeStep(2, "H", GridPosition.BETA3, GridPosition.BETA5, anti(CCW, E, S, OUT, IN), anti(CCW, E, S, OUT, IN)),
  makeStep(3, "H", GridPosition.BETA5, GridPosition.BETA7, anti(CCW, S, W, IN, OUT), anti(CCW, S, W, IN, OUT)),
  makeStep(4, "H", GridPosition.BETA7, GridPosition.BETA1, anti(CCW, W, N, OUT, IN), anti(CCW, W, N, OUT, IN)),
]);

/**
 * GHGH — Austen's 4-step GG+HH fusion card, transcribed verbatim:
 *   1 G beta5>beta7  blue pro cw s>w in>in    red pro cw s>w in>in
 *   2 H beta7>beta5  blue anti cw w>s in>out  red anti cw w>s in>out
 *   3 G beta5>beta3  blue pro ccw s>e out>out red pro ccw s>e out>out
 *   4 H beta3>beta5  blue anti ccw e>s out>in red anti ccw e>s out>in
 */
export const GHGH: SequenceData = makeLoop("fx-ghgh", "GHGH", [
  makeStep(1, "G", GridPosition.BETA5, GridPosition.BETA7, pro(CW, S, W, IN, IN), pro(CW, S, W, IN, IN)),
  makeStep(2, "H", GridPosition.BETA7, GridPosition.BETA5, anti(CW, W, S, IN, OUT), anti(CW, W, S, IN, OUT)),
  makeStep(3, "G", GridPosition.BETA5, GridPosition.BETA3, pro(CCW, S, E, OUT, OUT), pro(CCW, S, E, OUT, OUT)),
  makeStep(4, "H", GridPosition.BETA3, GridPosition.BETA5, anti(CCW, E, S, OUT, IN), anti(CCW, E, S, OUT, IN)),
]);

/**
 * AAAA — counter-clockwise pro cycle through the alpha world (hands 180° apart).
 *
 * Step 1 is literal from Austen's FALG card:
 *   A alpha3>alpha1: blue pro ccw w>s, red pro ccw e>n (in>in for a clean cycle)
 * The remaining steps continue the location cycle blue w→s→e→n→w with red
 * always opposite (e→n→w→s→e). Every alpha label below was READ OFF
 * `getGridPositionFromLocations`, not assumed.
 */
export const AAAA_CCW: SequenceData = makeLoop("fx-aaaa", "AAAA", [
  makeStep(1, "A", GridPosition.ALPHA3, GridPosition.ALPHA1, pro(CCW, W, S, IN, IN), pro(CCW, E, N, IN, IN)),
  makeStep(2, "A", GridPosition.ALPHA1, GridPosition.ALPHA7, pro(CCW, S, E, IN, IN), pro(CCW, N, W, IN, IN)),
  makeStep(3, "A", GridPosition.ALPHA7, GridPosition.ALPHA5, pro(CCW, E, N, IN, IN), pro(CCW, W, S, IN, IN)),
  makeStep(4, "A", GridPosition.ALPHA5, GridPosition.ALPHA3, pro(CCW, N, W, IN, IN), pro(CCW, S, E, IN, IN)),
]);

/**
 * Ψ alpha5>beta1 — verbatim: blue static n>n out>out, red dash s>n in>out.
 * One of the two ambient bridge steps between the alpha and beta worlds.
 */
export const PSI_STEP: StepData = makeStep(
  1,
  "Ψ",
  GridPosition.ALPHA5,
  GridPosition.BETA1,
  staticM(NONE, N, N, OUT, OUT),
  dash(NONE, S, N, IN, OUT)
);

/**
 * Φ beta5>alpha5 — verbatim: blue dash s>n in>out, red static s>s in>in.
 * The other ambient bridge step: beta world back out to alpha.
 */
export const PHI_STEP: StepData = makeStep(
  1,
  "Φ",
  GridPosition.BETA5,
  GridPosition.ALPHA5,
  dash(NONE, S, N, IN, OUT),
  staticM(NONE, S, S, IN, IN)
);

/** Every fixture step, named, for whole-corpus assertions. */
export const ALL_FIXTURE_STEPS: readonly {
  readonly name: string;
  readonly step: StepData;
}[] = [
  ...[
    ["GGGG_CW", GGGG_CW],
    ["HHHH_CCW", HHHH_CCW],
    ["GHGH", GHGH],
    ["AAAA_CCW", AAAA_CCW],
  ].flatMap(([name, seq]) =>
    (seq as SequenceData).steps.map((step, i) => ({
      name: `${name as string}[${i}]`,
      step,
    }))
  ),
  { name: "PSI_STEP", step: PSI_STEP },
  { name: "PHI_STEP", step: PHI_STEP },
];
