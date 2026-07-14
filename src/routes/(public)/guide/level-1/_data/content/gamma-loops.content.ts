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

// Verbatim prose lifted from _pages/GammaLoopsPage.svelte (Austen's words — never AI-written);
// pictograph construction is a FAITHFUL COPY of that same file's step authoring (same
// helpers, same locations/orientations → identical staff pictographs), minus the
// reader-only wiring (selection, overrides, click-to-animate, sheet geometry).

const { NORTH: N, EAST: E, SOUTH: SO_, WEST: W } = GridLocation;
const { IN, OUT } = Orientation;
const CW = RotationDirection.CLOCKWISE;
const CCW = RotationDirection.COUNTER_CLOCKWISE;

// ── Step authoring ──────────────────────────────────────────────────────────
const HP_CW = new Set(["s-w", "w-n", "n-e", "e-s"]);
const flip = (o: Orientation) => (o === IN ? OUT : IN);
type HandStep = { anti: boolean; from: GridLocation; to: GridLocation; so: Orientation };
const h = (anti: boolean, from: GridLocation, to: GridLocation, so: Orientation = IN): HandStep => ({ anti, from, to, so });
const handMotion = (color: MotionColor, x: HandStep) => {
  const dir = HP_CW.has(`${x.from}-${x.to}`) ? CW : CCW;
  return createMotionData({
    motionType: x.anti ? MotionType.ANTI : MotionType.PRO,
    rotationDirection: x.anti ? (dir === CW ? CCW : CW) : dir,
    startLocation: x.from,
    endLocation: x.to,
    startOrientation: x.so,
    endOrientation: x.anti ? flip(x.so) : x.so,
    turns: 0,
    color,
    propType: PropType.STAFF,
    gridMode: GridMode.DIAMOND,
  });
};
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

type Step = { letter: Letter; blue: HandStep; red: HandStep };
const st = (letter: Letter, blue: HandStep, red: HandStep): Step => ({ letter, blue, red });
const { M, V, P, U, Q, O, T, R } = Letter;
const NL = Letter.N;
const SL = Letter.S;

type LoopDef = {
  key: string;
  word: string;
  steps: Step[];
};
const LOOPS: LoopDef[] = [
  {
    // SOTR ×2 — both props CW throughout; second half rotated 180°.
    key: "gl-sotr",
    word: "SOTR Rotated",
    steps: [
      st(SL, h(false, SO_, W), h(false, E, SO_)),
      st(O, h(false, W, N), h(true, SO_, E)),
      st(T, h(true, N, W), h(true, E, N, OUT)),
      st(R, h(false, W, N, OUT), h(true, N, W)),
      st(SL, h(false, N, E, OUT), h(false, W, N, OUT)),
      st(O, h(false, E, SO_, OUT), h(true, N, W, OUT)),
      st(T, h(true, SO_, E, OUT), h(true, W, SO_)),
      st(R, h(false, E, SO_), h(true, SO_, E, OUT)),
    ],
  },
  {
    // VPUQ ×2 — blue CCW / red CW throughout; second half rotated 180°.
    key: "gl-vpuq",
    word: "VPUQ Rotated",
    steps: [
      st(V, h(false, SO_, E), h(true, E, N)),
      st(P, h(false, E, N), h(false, N, E, OUT)),
      st(U, h(false, N, W), h(true, E, N, OUT)),
      st(Q, h(true, W, N), h(true, N, W)),
      st(V, h(false, N, W, OUT), h(true, W, SO_, OUT)),
      st(P, h(false, W, SO_, OUT), h(false, SO_, W)),
      st(U, h(false, SO_, E, OUT), h(true, W, SO_)),
      st(Q, h(true, E, SO_, OUT), h(true, SO_, E, OUT)),
    ],
  },
  {
    // MVNU ×2 — blue CW / red CCW throughout; second half rotated 180°.
    key: "gl-mvnu",
    word: "MVNU Rotated",
    steps: [
      st(M, h(false, SO_, W), h(false, E, N)),
      st(V, h(false, W, N), h(true, N, E)),
      st(NL, h(true, N, W), h(true, E, SO_, OUT)),
      st(U, h(false, W, N, OUT), h(true, SO_, W)),
      st(M, h(false, N, E, OUT), h(false, W, SO_, OUT)),
      st(V, h(false, E, SO_, OUT), h(true, SO_, W, OUT)),
      st(NL, h(true, SO_, E, OUT), h(true, W, N)),
      st(U, h(false, E, SO_), h(true, N, E, OUT)),
    ],
  },
];

const stepData = (l: LoopDef, i: number): StepData => {
  const s = l.steps[i]!;
  return {
    id: `${l.key}-${i + 1}`,
    letter: s.letter,
    gridMode: GridMode.DIAMOND,
    startPosition: getGridPositionFromLocations(s.blue.from, s.red.from),
    endPosition: getGridPositionFromLocations(s.blue.to, s.red.to),
    stepNumber: i + 1,
    motions: {
      blue: handMotion(MotionColor.BLUE, s.blue),
      red: handMotion(MotionColor.RED, s.red),
    },
  } as unknown as StepData;
};
// Start box: Γ — blue S, red E, thumbs in.
const startBox = (l: LoopDef): StepData =>
  ({
    id: `${l.key}-0`,
    letter: Letter.GAMMA,
    gridMode: GridMode.DIAMOND,
    stepNumber: 0,
    startPosition: getGridPositionFromLocations(SO_, E),
    endPosition: getGridPositionFromLocations(SO_, E),
    motions: {
      blue: stat(MotionColor.BLUE, SO_),
      red: stat(MotionColor.RED, E),
    },
  }) as unknown as StepData;

// Each LOOP's full strip (start + 8 steps), reversal dots derived from the
// motions themselves via bakeReversals (never hand-authored) — matching
// GammaLoopsPage.svelte's PICTO_FLAGS.showReversals: true. Constant per-hand
// prop rotation means bakeReversals derives no flags here, matching the artboard.
const loopStrip = (l: LoopDef): PictographData[] => {
  const authored = [startBox(l), ...l.steps.map((_, i) => stepData(l, i))];
  return [authored[0], ...bakeReversals(authored.slice(1))] as unknown as PictographData[];
};

/** STAFF props with reversal dots — matching GammaLoopsPage's PICTO_FLAGS. */
const RENDER = { propType: PropType.STAFF, showReversals: true } as const;

export const gammaLoopsContent: GuideBlock[] = [
  { kind: "heading", level: 1, text: "Gamma LOOPs" },
  {
    kind: "prose",
    html:
      "<strong>The γ→γ letters can connect to any other γ→γ letter.</strong><br>" +
      "In these examples, each word ends in gamma position on the opposite side.<br>" +
      "By repeating the word from there, we return to home position.",
  },
  { kind: "pictographGroup", items: loopStrip(LOOPS[0]!), flowCols: 3, card: true, render: RENDER, caption: LOOPS[0]!.word },
  { kind: "pictographGroup", items: loopStrip(LOOPS[1]!), flowCols: 3, card: true, render: RENDER, caption: LOOPS[1]!.word },
  { kind: "pictographGroup", items: loopStrip(LOOPS[2]!), flowCols: 3, card: true, render: RENDER, caption: LOOPS[2]!.word },
  {
    kind: "prose",
    html:
      "Note that the pictographs in each second word repetition are rotated 180°.<br>" +
      "Because of this, these examples are classified as <em>Rotated LOOPs</em>.",
  },
];
