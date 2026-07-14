/**
 * Single source for the Alpha and Beta Words SEO doorway (manifest id
 * "lt1-abc-ghi"). Prose is lifted VERBATIM from _pages/AlphaBetaWordsPage.svelte
 * (Austen's words — never AI-written). Prose-only content file for the crawlable
 * doorway route — no sheet hints, no pictograph blocks. See the reflow spec +
 * no-ghostwriting rule.
 */
import type { GuideBlock } from "../guide-content-blocks";

export const lt1AbcGhiContent: GuideBlock[] = [
  { kind: "heading", level: 1, text: "Alpha and Beta Words" },
  { kind: "heading", level: 2, text: "Same Direction" },
  {
    kind: "prose",
    html:
      "The first words we will learn correspond to VTG’s 1:1 motions.<br>" +
      "To execute these, <strong><em>you’ll need to use body turns and/or negative space</em></strong>.",
  },
  {
    kind: "prose",
    html: "Practice each word once in both directions, then again starting with thumbs out.",
  },
];
