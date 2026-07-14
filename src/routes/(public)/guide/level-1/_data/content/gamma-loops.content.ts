import type { GuideBlock } from "../guide-content-blocks";

// Verbatim prose lifted from _pages/GammaLoopsPage.svelte (Austen's words — never AI-written).
export const gammaLoopsContent: GuideBlock[] = [
  { kind: "heading", level: 1, text: "Gamma LOOPs" },
  {
    kind: "prose",
    html:
      "<strong>The γ→γ letters can connect to any other γ→γ letter.</strong><br>" +
      "In these examples, each word ends in gamma position on the opposite side.<br>" +
      "By repeating the word from there, we return to home position.",
  },
  {
    kind: "prose",
    html:
      "Note that the pictographs in each second word repetition are rotated 180°.<br>" +
      "Because of this, these examples are classified as <em>Rotated LOOPs</em>.",
  },
];
