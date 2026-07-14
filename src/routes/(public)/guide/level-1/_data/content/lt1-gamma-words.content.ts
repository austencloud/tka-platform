/**
 * Single source for the Gamma Words SEO doorway (manifest id "lt1-gamma-words").
 * Prose is lifted VERBATIM from _pages/GammaWordsPage.svelte (Austen's words —
 * never AI-written); the pictograph construction is a FAITHFUL COPY of that
 * same file's loop-leg derivation (same helpers, same locations/orientations
 * → identical staff pictographs), minus the reader-only wiring (selection,
 * overrides, click-to-animate) and sheet geometry. See the reflow spec +
 * no-ghostwriting rule.
 */
import type { GuideBlock } from "../guide-content-blocks";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import {
  MotionType,
  MotionColor,
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridMode, GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { getGridPositionFromLocations } from "$lib/shared/pictograph/grid/services/grid-position-deriver";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { Letter } from "$lib/shared/foundation/domain/models/letter";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";

const { NORTH: N, EAST: E, SOUTH: SO_, WEST: W } = GridLocation;
const { IN, OUT } = Orientation;
const CW = RotationDirection.CLOCKWISE;
const CCW = RotationDirection.COUNTER_CLOCKWISE;

// ── Motion authoring — copied from GammaWordsPage.svelte ───────────────────
const HP_CW = new Set(["s-w", "w-n", "n-e", "e-s"]);
const hpDir = (from: GridLocation, to: GridLocation) => (HP_CW.has(`${from}-${to}`) ? CW : CCW);
const hand = (color: MotionColor, from: GridLocation, to: GridLocation, anti: boolean, so: Orientation) => {
  const dir = hpDir(from, to);
  return createMotionData({
    motionType: anti ? MotionType.ANTI : MotionType.PRO,
    rotationDirection: anti ? (dir === CW ? CCW : CW) : dir,
    startLocation: from,
    endLocation: to,
    startOrientation: so,
    endOrientation: anti ? (so === IN ? OUT : IN) : so,
    turns: 0,
    color,
    propType: PropType.STAFF,
    gridMode: GridMode.DIAMOND,
  });
};
const staticHand = (color: MotionColor, loc: GridLocation) =>
  createMotionData({
    motionType: MotionType.STATIC,
    startLocation: loc,
    endLocation: loc,
    startOrientation: IN,
    endOrientation: IN,
    color,
    propType: PropType.STAFF,
    gridMode: GridMode.DIAMOND,
  });

// ── The two loops: blue rides CW (Opp block) or CCW (Same block); red always
// rides the CCW loop one step ahead — copied from GammaWordsPage.svelte. ───
type Leg = [GridLocation, GridLocation];
const BLUE_CW: Leg[] = [
  [SO_, W],
  [W, N],
  [N, E],
  [E, SO_],
];
const RED_CCW: Leg[] = [
  [E, N],
  [N, W],
  [W, SO_],
  [SO_, E],
];
const BLUE_CCW: Leg[] = [
  [SO_, E],
  [E, N],
  [N, W],
  [W, SO_],
];

type RowDef = {
  key: string;
  word: string;
  letters: Letter[];
  block: 0 | 1;
  blueAnti: boolean;
  redAnti: boolean;
};
const ROWS: RowDef[] = [
  { key: "gw-mpmp", word: "MPMP", letters: [Letter.M, Letter.P, Letter.M, Letter.P], block: 0, blueAnti: false, redAnti: false },
  { key: "gw-nqnq", word: "NQNQ", letters: [Letter.N, Letter.Q, Letter.N, Letter.Q], block: 0, blueAnti: true, redAnti: true },
  { key: "gw-oror", word: "OROR", letters: [Letter.O, Letter.R, Letter.O, Letter.R], block: 0, blueAnti: true, redAnti: false },
  { key: "gw-ssss", word: "SSSS", letters: [Letter.S, Letter.S, Letter.S, Letter.S], block: 1, blueAnti: false, redAnti: false },
  { key: "gw-tttt", word: "TTTT", letters: [Letter.T, Letter.T, Letter.T, Letter.T], block: 1, blueAnti: true, redAnti: true },
  { key: "gw-uuuu", word: "UUUU", letters: [Letter.U, Letter.U, Letter.U, Letter.U], block: 1, blueAnti: true, redAnti: false },
  { key: "gw-vvvv", word: "VVVV", letters: [Letter.V, Letter.V, Letter.V, Letter.V], block: 1, blueAnti: false, redAnti: true },
];

const legs = (r: RowDef, color: "blue" | "red", i: number): Leg =>
  color === "red" ? RED_CCW[i]! : r.block === 0 ? BLUE_CW[i]! : BLUE_CCW[i]!;

const rowStep = (r: RowDef, i: number): StepData => {
  const bl = legs(r, "blue", i);
  const rl = legs(r, "red", i);
  const bso = r.blueAnti ? (i % 2 === 0 ? IN : OUT) : IN;
  const rso = r.redAnti ? (i % 2 === 0 ? IN : OUT) : IN;
  return {
    id: `${r.key}-s-${i + 1}`,
    letter: r.letters[i]!,
    gridMode: GridMode.DIAMOND,
    startPosition: getGridPositionFromLocations(bl[0], rl[0]),
    endPosition: getGridPositionFromLocations(bl[1], rl[1]),
    stepNumber: i + 1,
    motions: {
      blue: hand(MotionColor.BLUE, bl[0], bl[1], r.blueAnti, bso),
      red: hand(MotionColor.RED, rl[0], rl[1], r.redAnti, rso),
    },
  } as unknown as StepData;
};

const startBox = (block: 0 | 1): StepData =>
  ({
    id: `gw-start-${block}`,
    letter: Letter.GAMMA,
    gridMode: GridMode.DIAMOND,
    stepNumber: 0,
    startPosition: getGridPositionFromLocations(SO_, E),
    endPosition: getGridPositionFromLocations(SO_, E),
    motions: {
      blue: staticHand(MotionColor.BLUE, SO_),
      red: staticHand(MotionColor.RED, E),
    },
  }) as unknown as StepData;

// One strip per word: Start + 4 letters. (GammaWordsPage's PICTO_FLAGS keeps
// showReversals off, so the strip is used directly — no bakeReversals needed
// for the display.)
const rowStrip = (r: RowDef): PictographData[] =>
  [startBox(r.block), ...[0, 1, 2, 3].map((i) => rowStep(r, i))] as unknown as PictographData[];

/** STAFF props, TKA letter glyph on — matching GammaWordsPage's PICTO_FLAGS. */
const RENDER = { propType: PropType.STAFF } as const;

export const lt1GammaWordsContent: GuideBlock[] = [
  { kind: "heading", level: 1, text: "Gamma Words" },
  {
    kind: "prose",
    html: "These are the simplest 4-letter words created with continuous γ→γ motions:",
  },
  {
    kind: "pictographGroup",
    items: rowStrip(ROWS[0]!),
    flowCols: 5,
    layout: "strip",
    stepLabels: ["Start", "1", "2", "3", "4"],
    render: RENDER,
    caption: "MPMP — γ→γ (Opp)",
  },
  {
    kind: "pictographGroup",
    items: rowStrip(ROWS[1]!),
    flowCols: 5,
    layout: "strip",
    stepLabels: ["Start", "1", "2", "3", "4"],
    render: RENDER,
    caption: "NQNQ — γ→γ (Opp)",
  },
  {
    kind: "pictographGroup",
    items: rowStrip(ROWS[2]!),
    flowCols: 5,
    layout: "strip",
    stepLabels: ["Start", "1", "2", "3", "4"],
    render: RENDER,
    caption: "OROR — γ→γ (Opp)",
  },
  {
    kind: "pictographGroup",
    items: rowStrip(ROWS[3]!),
    flowCols: 5,
    layout: "strip",
    stepLabels: ["Start", "1", "2", "3", "4"],
    render: RENDER,
    caption: "SSSS — γ→γ (Same)",
  },
  {
    kind: "pictographGroup",
    items: rowStrip(ROWS[4]!),
    flowCols: 5,
    layout: "strip",
    stepLabels: ["Start", "1", "2", "3", "4"],
    render: RENDER,
    caption: "TTTT — γ→γ (Same)",
  },
  {
    kind: "pictographGroup",
    items: rowStrip(ROWS[5]!),
    flowCols: 5,
    layout: "strip",
    stepLabels: ["Start", "1", "2", "3", "4"],
    render: RENDER,
    caption: "UUUU — γ→γ (Same)",
  },
  {
    kind: "pictographGroup",
    items: rowStrip(ROWS[6]!),
    flowCols: 5,
    layout: "strip",
    stepLabels: ["Start", "1", "2", "3", "4"],
    render: RENDER,
    caption: "VVVV — γ→γ (Same)",
  },
];
