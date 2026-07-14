import type { GuideBlock } from "../guide-content-blocks";

// Verbatim prose lifted from _pages/Type1LoopsPage.svelte (Austen's words — never AI-written).
export const miscPermutationsContent: GuideBlock[] = [
  { kind: "heading", level: 1, text: "Type 1 LOOPs" },
  {
    kind: "prose",
    html:
      "In this example of DJII, the graphs in the second repetition (steps 5-8) mirror the<br>" +
      "graphs in the first repetition (steps 1-4), classifying it as a <em>Mirrored LOOP</em>.",
  },
  { kind: "prose", html: "Swapped & Rotated LOOP" },
  {
    kind: "prose",
    html:
      "In this example of KIEC, the colors are swapped in the second half,<br>" +
      "so it is classified as a <em>Swapped & Mirrored LOOP</em>.",
  },
];
