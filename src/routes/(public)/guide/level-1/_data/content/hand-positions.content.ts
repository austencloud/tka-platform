/**
 * Single source for the Hand Positions page (manifest id "hand-positions").
 * Prose is lifted VERBATIM from the original HandPositionsPage.svelte (Austen's
 * words — never AI-written). Geometry constants are copied from that same file so
 * SheetFrame reproduces the proof sheet pixel-for-pixel; FlowFrame ignores the
 * pt hints and stacks the blocks. See the reflow spec + no-ghostwriting rule.
 */
import type { GuideBlock, SheetGrid } from "../guide-content-blocks";
import { startPositionManager } from "$lib/shared/create/services/start-position-manager";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

// The 16 diamond-mode positions (α/β/γ, 4/4/8), prop forced to HAND — identical
// to the original page's derivation (HandPositionsPage.svelte lines 31–39).
const positions = startPositionManager
  .getAllStartPositionVariations(GridMode.DIAMOND)
  .map((p) => ({
    ...p,
    motions: {
      blue: p.motions?.blue ? { ...p.motions.blue, propType: PropType.HAND } : undefined,
      red: p.motions?.red ? { ...p.motions.red, propType: PropType.HAND } : undefined,
    },
  }));

// ── Geometry, copied verbatim from HandPositionsPage.svelte (lines 42–102) ──
const COLS = [75, 195, 315, 435];
const SIZE = 99.5;
const TITLE_Y = 22,
  TITLE_H = 40,
  GAP = 12,
  G_IN = 6,
  ROW_GAP = 5,
  LINE = 18;
const GLYPH_H = 22,
  GH_GAP = 1,
  WORD_H = 18,
  DESC_H = 18;

const introY = TITLE_Y + TITLE_H + GAP;
const introBottom = introY + 2 * LINE + 14;
const aGlyphY = introBottom + GAP;
const aHeadY = aGlyphY + GLYPH_H + GH_GAP;
const ROW_A = aHeadY + WORD_H + G_IN;
const aDescY = ROW_A + SIZE + G_IN;
const bGlyphY = aDescY + DESC_H + GAP;
const bHeadY = bGlyphY + GLYPH_H + GH_GAP;
const ROW_B = bHeadY + WORD_H + G_IN;
const bDescY = ROW_B + SIZE + G_IN;
const gGlyphY = bDescY + DESC_H + GAP;
const gHeadY = gGlyphY + GLYPH_H + GH_GAP;
const ROW_G1 = gHeadY + WORD_H + G_IN;
const ROW_G2 = ROW_G1 + SIZE + ROW_GAP;
const gDescY = ROW_G2 + SIZE + G_IN;
const DIVIDERS = [aDescY + DESC_H + GAP / 2, bDescY + DESC_H + GAP / 2];

const grid: SheetGrid = {
  cols: COLS,
  rows: [ROW_A, ROW_B, ROW_G1, ROW_G2],
  cell: SIZE,
  rowFor: positions.map((_, i) => (i < 4 ? 0 : i < 8 ? 1 : i < 12 ? 2 : 3)),
};

// Verbatim intro HTML (HandPositionsPage.svelte lines 125–128).
const INTRO_HTML =
  "There are multiple ways to combine two hand points to form a hand position.<br>" +
  'Positions can be rotated or mirrored.<span class="lg"></span>' +
  '<strong><span class="cR">Red = Right</span> and <span class="cB">Blue = Left.</span></strong><br>' +
  "In The Kinetic Alphabet, our first three positions are called Alpha, Beta, and Gamma.";

export const handPositionsContent: GuideBlock[] = [
  { kind: "heading", level: 1, text: "Hand Positions", sheet: { x: 0, y: TITLE_Y } },
  {
    kind: "prose",
    html: INTRO_HTML,
    sheet: { x: 0, y: introY, fontSize: 15, lineHeight: LINE, align: "center" },
  },

  {
    kind: "glyphImage",
    src: "/images/letters_trimmed/Type6/α.svg",
    alt: "Alpha (α)",
    heightPt: GLYPH_H,
    sheet: { x: 304, y: aGlyphY },
  },
  { kind: "heading", level: 2, text: "Alpha", sheet: { x: 275.0, y: aHeadY, w: 54.8, h: 22, align: "center" } },
  {
    kind: "prose",
    html: "In Alpha, the hands occupy the points across from each other.",
    sheet: { x: 75.9, y: aDescY, w: 454.5, h: 18, align: "center" },
  },

  {
    kind: "glyphImage",
    src: "/images/letters_trimmed/Type6/β.svg",
    alt: "Beta (β)",
    heightPt: GLYPH_H,
    sheet: { x: 304, y: bGlyphY },
  },
  { kind: "heading", level: 2, text: "Beta", sheet: { x: 283.9, y: bHeadY, w: 42.4, h: 22, align: "center" } },
  {
    kind: "prose",
    html: "In Beta, the hands occupy the same point.",
    sheet: { x: 150.1, y: bDescY, w: 308.2, h: 18, align: "center" },
  },

  {
    kind: "glyphImage",
    src: "/images/letters_trimmed/Type6/γ.svg",
    alt: "Gamma (γ)",
    heightPt: GLYPH_H,
    sheet: { x: 304, y: gGlyphY },
  },
  { kind: "heading", level: 2, text: "Gamma", sheet: { x: 269.3, y: gHeadY, w: 71.5, h: 22, align: "center" } },
  {
    kind: "prose",
    html: "In Gamma, the hands form a right angle.",
    sheet: { x: 154.1, y: gDescY, w: 301.9, h: 18, align: "center" },
  },

  {
    kind: "pictographGroup",
    items: positions,
    grid,
    flowCols: 4,
    caption: "The sixteen canonical hand positions.",
  },

  { kind: "rule", sheet: { x: 64.4, y: DIVIDERS[0]!, w: 491.6 } },
  { kind: "rule", sheet: { x: 64.4, y: DIVIDERS[1]!, w: 491.6 } },
];
