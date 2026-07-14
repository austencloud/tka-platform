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
import { bakeReversals } from "../guide-sequence-adapter";

// Verbatim prose lifted from _pages/LoopsPage.svelte (Austen's words — never
// AI-written); the pictograph construction below is a FAITHFUL COPY of that
// same file's LOOPS/handMotion/stepData/startBox authoring (same helpers, same
// locations/orientations/reversal flags → identical staff pictographs), minus
// the reader-only wiring (selection, overrides, click-to-animate, PARAS/RULES/
// HEADS sheet geometry).

const { NORTH: N, EAST: E, SOUTH: SO_, WEST: W } = GridLocation;
const { IN, OUT } = Orientation;
const CW = RotationDirection.CLOCKWISE;
const CCW = RotationDirection.COUNTER_CLOCKWISE;
const NOROT = RotationDirection.NO_ROTATION;

// ── Step authoring — copied from _pages/LoopsPage.svelte ───────────────────
const HP_CW = new Set(["s-w", "w-n", "n-e", "e-s"]);
type HandStep = { t: "pro" | "anti" | "dash" | "static"; from: GridLocation; to: GridLocation; so: Orientation };
const handMotion = (color: MotionColor, h: HandStep) => {
  const dir = HP_CW.has(`${h.from}-${h.to}`) ? CW : CCW;
  const type =
    h.t === "pro" ? MotionType.PRO : h.t === "anti" ? MotionType.ANTI : h.t === "dash" ? MotionType.DASH : MotionType.STATIC;
  const flips = h.t === "anti" || h.t === "dash";
  return createMotionData({
    motionType: type,
    rotationDirection: h.t === "pro" ? dir : h.t === "anti" ? (dir === CW ? CCW : CW) : NOROT,
    startLocation: h.from,
    endLocation: h.to,
    startOrientation: h.so,
    endOrientation: flips ? (h.so === IN ? OUT : IN) : h.so,
    turns: 0,
    color,
    propType: PropType.STAFF,
    gridMode: GridMode.DIAMOND,
  });
};

type Step = { letter: Letter; name: string; blue: HandStep; red: HandStep; bRev?: boolean; rRev?: boolean };
const hs = (t: HandStep["t"], from: GridLocation, to: GridLocation, so: Orientation = IN): HandStep => ({ t, from, to, so });

type LoopDef = {
  key: string;
  word: string;
  startLetter: Letter;
  startBlue: GridLocation;
  startRed: GridLocation;
  steps: Step[];
};

const LOOPS: LoopDef[] = [
  {
    // Mirrored: AABB + its horizontal-plane reflection (R R on step 5).
    key: "loop-mirror",
    word: "AABB Mirrored",
    startLetter: Letter.ALPHA,
    startBlue: W,
    startRed: E,
    steps: [
      { letter: Letter.A, name: "A", blue: hs("pro", W, N), red: hs("pro", E, SO_) },
      { letter: Letter.A, name: "A", blue: hs("pro", N, E), red: hs("pro", SO_, W) },
      { letter: Letter.B, name: "B", blue: hs("anti", E, N), red: hs("anti", W, SO_) },
      { letter: Letter.B, name: "B", blue: hs("anti", N, W, OUT), red: hs("anti", SO_, E, OUT) },
      { letter: Letter.A, name: "A", blue: hs("pro", W, SO_), red: hs("pro", E, N), bRev: true, rRev: true },
      { letter: Letter.A, name: "A", blue: hs("pro", SO_, E), red: hs("pro", N, W) },
      { letter: Letter.B, name: "B", blue: hs("anti", E, SO_), red: hs("anti", W, N) },
      { letter: Letter.B, name: "B", blue: hs("anti", SO_, W, OUT), red: hs("anti", N, E, OUT) },
    ],
  },
  {
    // Rotated: each DΨ repetition lands 90° around (S→W→N→E→S).
    key: "loop-rotate",
    word: "DΨDΨDΨDΨ Rotated",
    startLetter: Letter.BETA,
    startBlue: SO_,
    startRed: SO_,
    steps: [
      { letter: Letter.D, name: "D", blue: hs("pro", SO_, W), red: hs("pro", SO_, E) },
      { letter: Letter.PSI, name: "Ψ", blue: hs("static", W, W), red: hs("dash", E, W) },
      { letter: Letter.D, name: "D", blue: hs("pro", W, N), red: hs("pro", W, SO_, OUT) },
      { letter: Letter.PSI, name: "Ψ", blue: hs("static", N, N), red: hs("dash", SO_, N, OUT) },
      { letter: Letter.D, name: "D", blue: hs("pro", N, E), red: hs("pro", N, W) },
      { letter: Letter.PSI, name: "Ψ", blue: hs("static", E, E), red: hs("dash", W, E) },
      { letter: Letter.D, name: "D", blue: hs("pro", E, SO_), red: hs("pro", E, N, OUT) },
      { letter: Letter.PSI, name: "Ψ", blue: hs("static", SO_, SO_), red: hs("dash", N, SO_, OUT) },
    ],
  },
  {
    // Swapped: Δ-TQZ- twice, second repetition swaps right/left roles.
    key: "loop-swap",
    word: "Δ-TQZ- Swapped",
    startLetter: Letter.BETA,
    startBlue: SO_,
    startRed: SO_,
    steps: [
      { letter: Letter.DELTA_DASH, name: "Δ-", blue: hs("dash", SO_, N), red: hs("anti", SO_, E) },
      { letter: Letter.T, name: "T", blue: hs("anti", N, W, OUT), red: hs("anti", E, N, OUT) },
      { letter: Letter.Q, name: "Q", blue: hs("anti", W, N), red: hs("anti", N, W), bRev: true },
      { letter: Letter.Z_DASH, name: "Z-", blue: hs("dash", N, SO_, OUT), red: hs("anti", W, SO_, OUT) },
      { letter: Letter.DELTA_DASH, name: "Δ-", blue: hs("anti", SO_, E), red: hs("dash", SO_, N), bRev: true },
      { letter: Letter.T, name: "T", blue: hs("anti", E, N, OUT), red: hs("anti", N, W, OUT) },
      { letter: Letter.Q, name: "Q", blue: hs("anti", N, W), red: hs("anti", W, N), rRev: true },
      { letter: Letter.Z_DASH, name: "Z-", blue: hs("anti", W, SO_, OUT), red: hs("dash", N, SO_, OUT) },
    ],
  },
];

const stat = (color: MotionColor, loc: GridLocation) =>
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

const stepData = (l: LoopDef, i: number): StepData => {
  const st = l.steps[i]!;
  return {
    id: `${l.key}-${i + 1}`,
    letter: st.letter,
    gridMode: GridMode.DIAMOND,
    startPosition: getGridPositionFromLocations(st.blue.from, st.red.from),
    endPosition: getGridPositionFromLocations(st.blue.to, st.red.to),
    stepNumber: i + 1,
    blueReversal: !!st.bRev,
    redReversal: !!st.rRev,
    motions: {
      blue: handMotion(MotionColor.BLUE, st.blue),
      red: handMotion(MotionColor.RED, st.red),
    },
  } as unknown as StepData;
};

const startBox = (l: LoopDef): StepData =>
  ({
    id: `${l.key}-0`,
    letter: l.startLetter,
    gridMode: GridMode.DIAMOND,
    stepNumber: 0,
    startPosition: getGridPositionFromLocations(l.startBlue, l.startRed),
    endPosition: getGridPositionFromLocations(l.startBlue, l.startRed),
    motions: {
      blue: stat(MotionColor.BLUE, l.startBlue),
      red: stat(MotionColor.RED, l.startRed),
    },
  }) as unknown as StepData;

// Start + 8 steps per LOOP, reversal dots derived from the motions themselves
// (bakeReversals; never hand-authored for display) — matches _pages/LoopsPage
// .svelte's resolvedStrip (minus the admin-override seam).
const loopStrip = (l: LoopDef): PictographData[] => {
  const authored = [startBox(l), ...l.steps.map((_, i) => stepData(l, i))];
  return [authored[0], ...bakeReversals(authored.slice(1))] as unknown as PictographData[];
};

/** STAFF props with reversal dots — matching LoopsPage's PICTO_FLAGS. */
const RENDER = { propType: PropType.STAFF, showReversals: true } as const;

export const permutationsContent: GuideBlock[] = [
  { kind: "heading", level: 1, text: "LOOPs" },
  {
    kind: "prose",
    html:
      "When a word ends on a variation of its start position, we can repeat it to trace a<br>" +
      "complimentary pattern, eventually returning back to the start position (aka home).<br>" +
      "This type of sequence is called a <strong><em>LOOP</em></strong>.",
  },
  {
    kind: "prose",
    html: "Three common types of LOOPs are <em>Mirrored</em>, <em>Rotated</em>, and <em>Swapped</em>.",
  },
  { kind: "heading", level: 2, text: "Mirrored" },
  {
    kind: "prose",
    html: "In a mirrored LOOP, the second repetition’s pictographs reflect the first, which changes their rotation direction.",
  },
  {
    kind: "prose",
    html: "In this example, each column is reflected across a horizontal plane.",
  },
  {
    kind: "pictographGroup",
    items: loopStrip(LOOPS[0]!),
    flowCols: 3,
    card: true,
    render: RENDER,
    caption: LOOPS[0]!.word,
  },
  { kind: "heading", level: 2, text: "Rotated" },
  {
    kind: "prose",
    html: "In a rotated LOOP, each repetition ends in a rotated variation on its previous position.",
  },
  {
    kind: "prose",
    html: "In this example, there is a 90° rotation, finally returning to the start position (aka “home”).",
  },
  {
    kind: "pictographGroup",
    items: loopStrip(LOOPS[1]!),
    flowCols: 3,
    card: true,
    render: RENDER,
    caption: LOOPS[1]!.word,
  },
  { kind: "heading", level: 2, text: "Swapped" },
  {
    kind: "prose",
    html: 'In a swapped LOOP, each repetition swaps the roles of <strong class="cR">right</strong>/<strong class="cB">left</strong>.',
  },
  {
    kind: "prose",
    html: "Though the prop’s shapes look the same, this swap changes the body motion significantly.",
  },
  {
    kind: "pictographGroup",
    items: loopStrip(LOOPS[2]!),
    flowCols: 3,
    card: true,
    render: RENDER,
    caption: LOOPS[2]!.word,
  },
];
