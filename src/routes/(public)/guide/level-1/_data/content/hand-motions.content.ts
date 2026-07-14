import type { GuideBlock } from "../guide-content-blocks";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { MotionType, MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridMode, GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";

const { NORTH: N, EAST: E, SOUTH: SO_, WEST: W } = GridLocation;

// Single-hand pictograph builder — copied verbatim from _pages/HandMotionsPage.svelte
// (blue hand only; the renderer's hand-path mode floats the shifts into the
// canonical float arrows, dash gets the system dash arrow, static shows the
// resting hand).
const singleHand = (id: string, type: MotionType, from: GridLocation, to: GridLocation) => ({
  id: `hm-${id}`,
  letter: null,
  gridMode: GridMode.DIAMOND,
  motions: {
    blue: createMotionData({
      motionType: type,
      startLocation: from,
      endLocation: to,
      color: MotionColor.BLUE,
      propType: PropType.HAND,
      gridMode: GridMode.DIAMOND,
    }),
  },
});

// The five motion-demo boxes, in the source page's own order (HandMotionsPage.svelte
// `boxes` array) — sheet geometry (x/y) dropped, the box's word kept as its caption.
const DEMOS = [
  { caption: "Start", data: singleHand("start", MotionType.STATIC, W, W) },
  { caption: "Shift", data: singleHand("shift-cw", MotionType.PRO, W, N) },
  { caption: "Shift", data: singleHand("shift-ccw", MotionType.PRO, W, SO_) },
  { caption: "Dash", data: singleHand("dash", MotionType.DASH, W, E) },
  { caption: "Static", data: singleHand("static", MotionType.STATIC, W, W) },
];

/** HAND props, TKA letter glyph off — matching HandMotionsPage's PICTO_FLAGS (showTKA={false}). */
const RENDER = { propType: PropType.HAND, showTKA: false } as const;

// Verbatim prose lifted from _pages/HandMotionsPage.svelte (Austen's words — never AI-written).
export const handMotionsContent: GuideBlock[] = [
  { kind: "heading", level: 1, text: "Hand Motions" },
  {
    kind: "prose",
    html:
      "There are three fundamental hand motions in the Alphabet.<br>" +
      "The arrow shows the direction of motion.<br>" +
      "The hand shows the end position.",
  },
  ...DEMOS.map((d) => ({
    kind: "pictograph" as const,
    data: d.data as unknown as PictographData,
    render: RENDER,
    caption: d.caption,
  })),
  { kind: "prose", html: "Move to an<br>adjacent point" },
  { kind: "prose", html: "Move to the<br>opposite point" },
  { kind: "prose", html: "Stay at the<br>current point" },
  {
    kind: "prose",
    html:
      "Using these, we can derive six combinations, named below.<br>" +
      "We’ll explore each one individually:",
  },
  { kind: "heading", level: 2, text: "Dual-Shift" },
  { kind: "prose", html: "Both hands travel to an adjacent point." },
  { kind: "heading", level: 2, text: "Shift" },
  {
    kind: "prose",
    html: "One hand travels to an adjacent point<br>and the other hand remains static.",
  },
  { kind: "heading", level: 2, text: "Cross-Shift" },
  {
    kind: "prose",
    html: "One hand travels to an adjacent point and<br>the other travels to the opposite point.",
  },
  { kind: "heading", level: 2, text: "Dash" },
  {
    kind: "prose",
    html: "One hand travels to the opposite point<br>and the other hand remains static",
  },
  { kind: "heading", level: 2, text: "Dual-Dash" },
  { kind: "prose", html: "Both hands travel to the opposite point" },
  { kind: "heading", level: 2, text: "Static" },
  { kind: "prose", html: "Both hands remain static." },
];
