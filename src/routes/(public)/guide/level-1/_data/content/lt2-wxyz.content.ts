/**
 * Single source for the Type 2 Shift Letters SEO doorway (manifest id
 * "lt2-wxyz"). Prose is lifted VERBATIM from
 * _pages/Type2ShiftLettersPage.svelte (Austen's words - never AI-written);
 * the pictograph construction is a FAITHFUL COPY of that same file's
 * static+shift derivation (same helpers, same locations/orientations →
 * identical staff pictographs), minus the reader-only wiring (selection,
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

// ── Motion authoring - copied from Type2ShiftLettersPage.svelte ────────────
const HP_CW = new Set(["s-w", "w-n", "n-e", "e-s"]);
const hpDir = (from: GridLocation, to: GridLocation) => (HP_CW.has(`${from}-${to}`) ? CW : CCW);
const redShift = (from: GridLocation, to: GridLocation, anti: boolean, so: Orientation) => {
  const dir = hpDir(from, to);
  return createMotionData({
    motionType: anti ? MotionType.ANTI : MotionType.PRO,
    rotationDirection: anti ? (dir === CW ? CCW : CW) : dir,
    startLocation: from,
    endLocation: to,
    startOrientation: so,
    endOrientation: anti ? (so === IN ? OUT : IN) : so,
    turns: 0,
    color: MotionColor.RED,
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

type CellDef = {
  letter: Letter;
  name: string;
  blueLoc: GridLocation;
  from: GridLocation;
  to: GridLocation;
  anti: boolean;
  so?: Orientation;
};
const step = (c: CellDef, id: string, stepNumber: number | null): StepData =>
  ({
    id,
    letter: c.letter,
    gridMode: GridMode.DIAMOND,
    startPosition: getGridPositionFromLocations(c.blueLoc, c.from),
    endPosition: getGridPositionFromLocations(c.blueLoc, c.to),
    stepNumber,
    motions: {
      blue: staticHand(MotionColor.BLUE, c.blueLoc),
      red: redShift(c.from, c.to, c.anti, c.so ?? IN),
    },
  }) as unknown as StepData;

const startFor = (blueLoc: GridLocation, redLoc: GridLocation, id: string, letter: Letter | null = null): StepData =>
  ({
    id,
    letter,
    gridMode: GridMode.DIAMOND,
    stepNumber: 0,
    startPosition: getGridPositionFromLocations(blueLoc, redLoc),
    endPosition: getGridPositionFromLocations(blueLoc, redLoc),
    motions: {
      blue: staticHand(MotionColor.BLUE, blueLoc),
      red: staticHand(MotionColor.RED, redLoc),
    },
  }) as unknown as StepData;

// ── The four letter boxes - γ→α OPEN, γ→β CLOSE, α→γ CLOSE, β→γ OPEN ───────
type BoxDef = { label: string; tag: "OPEN" | "CLOSE"; cells: CellDef[] };
const BOXES: BoxDef[] = [
  {
    label: "γ→α",
    tag: "OPEN",
    cells: [
      { letter: Letter.W, name: "W", blueLoc: W, from: SO_, to: E, anti: false },
      { letter: Letter.X, name: "X", blueLoc: W, from: SO_, to: E, anti: true },
    ],
  },
  {
    label: "γ→β",
    tag: "CLOSE",
    cells: [
      { letter: Letter.Y, name: "Y", blueLoc: SO_, from: W, to: SO_, anti: false },
      { letter: Letter.Z, name: "Z", blueLoc: SO_, from: W, to: SO_, anti: true },
    ],
  },
  {
    label: "α→γ",
    tag: "CLOSE",
    cells: [
      { letter: Letter.SIGMA, name: "Σ", blueLoc: W, from: E, to: SO_, anti: false },
      { letter: Letter.DELTA, name: "Δ", blueLoc: W, from: E, to: SO_, anti: true },
    ],
  },
  {
    label: "β→γ",
    tag: "OPEN",
    cells: [
      { letter: Letter.THETA, name: "Θ", blueLoc: SO_, from: SO_, to: E, anti: false },
      { letter: Letter.OMEGA, name: "Ω", blueLoc: SO_, from: SO_, to: E, anti: true },
    ],
  },
];

const boxGroup = (box: BoxDef, key: string): PictographData[] =>
  box.cells.map((c) => step(c, `${key}-${c.name}`, null)) as unknown as PictographData[];

// ── The two word rows: red cycles the CCW loop e→n→w→s→e from the shared γ
// Start; blue rests - copied from Type2ShiftLettersPage.svelte. ────────────
const RED_CCW: [GridLocation, GridLocation][] = [
  [E, N],
  [N, W],
  [W, SO_],
  [SO_, E],
];
type RowDef = { key: string; word: string; letters: Letter[]; names: string[]; anti: boolean };
const ROWS: RowDef[] = [
  { key: "t2w-pro", word: "WΣYΘ", letters: [Letter.W, Letter.SIGMA, Letter.Y, Letter.THETA], names: ["W", "Σ", "Y", "Θ"], anti: false },
  { key: "t2w-anti", word: "XΔZΩ", letters: [Letter.X, Letter.DELTA, Letter.Z, Letter.OMEGA], names: ["X", "Δ", "Z", "Ω"], anti: true },
];
const rowCell = (r: RowDef, i: number): CellDef => ({
  letter: r.letters[i]!,
  name: r.names[i]!,
  blueLoc: SO_,
  from: RED_CCW[i]![0],
  to: RED_CCW[i]![1],
  anti: r.anti,
  so: r.anti && i % 2 === 1 ? OUT : IN,
});
// Type2ShiftLettersPage's PICTO_FLAGS keeps showReversals off, so the strip
// is used directly - no bakeReversals needed for the display.
const rowStrip = (r: RowDef): PictographData[] =>
  [
    startFor(SO_, E, "t2w-start"),
    ...[0, 1, 2, 3].map((i) => step(rowCell(r, i), `${r.key}-s-${i + 1}`, i + 1)),
  ] as unknown as PictographData[];

/** STAFF props, TKA letter glyph on - matching Type2ShiftLettersPage's PICTO_FLAGS. */
const RENDER = { propType: PropType.STAFF } as const;

export const lt2WxyzContent: GuideBlock[] = [
  { kind: "heading", level: 1, text: "Type 2 Shift Letters" },
  {
    kind: "prose",
    html:
      "So far we’ve learned how to move between α↔β and between γ↔γ.<br>" +
      'In order to travel between these two modes, we can use a Type 2 Motion called a <strong style="color:#6F2DA8">Shift</strong>.',
  },
  {
    kind: "prose",
    html:
      '<strong>A <span style="color:#6F2DA8">Shift</span> (or single shift) is the combination of one shift and one static motion.</strong><br>' +
      "Their letters are organized by end position: α, β, then γ.<br>" +
      "These can also be categorized by opening or closing.",
  },
  { kind: "pictographGroup", items: boxGroup(BOXES[0]!, "t2-a"), flowCols: 2, render: RENDER, caption: "γ→α OPEN: W, X" },
  { kind: "pictographGroup", items: boxGroup(BOXES[1]!, "t2-b"), flowCols: 2, render: RENDER, caption: "γ→β CLOSE: Y, Z" },
  { kind: "pictographGroup", items: boxGroup(BOXES[2]!, "t2-c"), flowCols: 2, render: RENDER, caption: "α→γ CLOSE: Sigma, Delta" },
  { kind: "pictographGroup", items: boxGroup(BOXES[3]!, "t2-d"), flowCols: 2, render: RENDER, caption: "β→γ OPEN: Theta, Omega" },
  {
    kind: "prose",
    html: "When we arrange them in continuous motions, we get the words WΣYΘ and XΔZΩ.",
  },
  {
    kind: "pictographGroup",
    items: rowStrip(ROWS[0]!),
    flowCols: 5,
    layout: "strip",
    stepLabels: ["Start", "1", "2", "3", "4"],
    card: true,
    render: RENDER,
    caption: "WΣYΘ: pro",
  },
  {
    kind: "pictographGroup",
    items: rowStrip(ROWS[1]!),
    flowCols: 5,
    layout: "strip",
    stepLabels: ["Start", "1", "2", "3", "4"],
    card: true,
    render: RENDER,
    caption: "XΔZΩ: anti",
  },
  {
    kind: "prose",
    html:
      "Though simple at this stage, these motions become more complex<br>" +
      "as we dive deeper into the Alphabet and add rotations to static motions.",
  },
];
