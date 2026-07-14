import type { GuideBlock } from "../guide-content-blocks";

// Verbatim prose lifted from _pages/EightLetterWordsPage.svelte (Austen's words — never AI-written).
export const eightLetterWordsContent: GuideBlock[] = [
  { kind: "heading", level: 1, text: "8-Letter Words" },
  {
    kind: "prose",
    html:
      "Words can be any length.<br>" +
      "These 8-letter words repeat twice, to create 16-count sequences.",
  },
  { kind: "prose", html: "(Rotated LOOP)" },
  { kind: "prose", html: "(Mirrored + Swapped LOOP)" },
];
