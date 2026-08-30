/**
 * Single source for The Grid page (manifest id "the-grid"). Prose is lifted
 * VERBATIM from _pages/TheGridPage.svelte (Austen's words - never AI-written).
 * The two-hand diagram is the same ALPHA3 pictograph that page builds; the three
 * grid figures reuse the canonical GridSvg via the `gridFigure` flow block. The
 * sheet toggle renders the built _pages component (with its callout arrows/labels,
 * which are absolute-positioned sheet chrome and don't reflow). See the reflow
 * spec + no-ghostwriting rule.
 */
import type { GuideBlock } from "../guide-content-blocks";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { THE_GRID_ALPHA3 } from "../the-grid-pictograph";

export const theGridContent: GuideBlock[] = [
  { kind: "heading", level: 1, text: "The Grid" },
  {
    kind: "prose",
    html:
      "The Kinetic Alphabet is based on a 4-point grid.<br><br>" +
      "There are two 4-point grids: box mode and diamond mode.<br>" +
      "<strong>This guide is written in diamond, but everything translates to box.</strong><br><br>" +
      "On this grid, there are three types of points:",
  },
  ...(THE_GRID_ALPHA3
    ? [
        {
          kind: "pictograph",
          data: THE_GRID_ALPHA3,
          render: { propType: PropType.HAND, showTKA: false },
          caption: "Two hands on the diamond grid: blue at west, red at east.",
        } as GuideBlock,
      ]
    : []),
  {
    kind: "prose",
    html:
      "The <strong>center point</strong> is the hub that<br>everything revolves around.<br><br>" +
      "The four <strong>hand points</strong> are halfway<br>between the center point and the<br>outer points.<br><br>" +
      "The <strong>outer points</strong> depict the outer<br>edges of the grid.",
  },
  { kind: "prose", html: "Together, diamond and box form an 8-point grid:" },
  { kind: "gridFigure", mode: "diamond", caption: "Diamond" },
  { kind: "gridFigure", mode: "box", caption: "Box" },
  { kind: "gridFigure", mode: "merged", caption: "8-point grid" },
  { kind: "prose", html: "We’ll use diamond mode to learn each concept." },
];
