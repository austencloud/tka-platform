import type { GuideBlock } from "../guide-content-blocks";

// Verbatim prose lifted from _pages/TheGridPage.svelte (Austen's words — never AI-written).
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
  {
    kind: "prose",
    html:
      "The <strong>center point</strong> is the hub that<br>everything revolves around.<br><br>" +
      "The four <strong>hand points</strong> are halfway<br>between the center point and the<br>outer points.<br><br>" +
      "The <strong>outer points</strong> depict the outer<br>edges of the grid.",
  },
  { kind: "prose", html: "Together, diamond and box form an 8-point grid:" },
  { kind: "heading", level: 2, text: "Diamond" },
  { kind: "heading", level: 2, text: "Box" },
  { kind: "heading", level: 2, text: "8-point grid" },
  { kind: "prose", html: "We’ll use diamond mode to learn each concept." },
];
