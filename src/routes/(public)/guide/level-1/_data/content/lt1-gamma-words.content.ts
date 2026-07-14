/**
 * Single source for the Gamma Words SEO doorway (manifest id "lt1-gamma-words").
 * Prose is lifted VERBATIM from _pages/GammaWordsPage.svelte (Austen's words —
 * never AI-written). This page is almost entirely pictograph grids on the proof
 * sheet — only one intro sentence exists as real prose. Prose-only content file
 * for the crawlable doorway route — no sheet hints, no pictograph blocks. See
 * the reflow spec + no-ghostwriting rule.
 */
import type { GuideBlock } from "../guide-content-blocks";

export const lt1GammaWordsContent: GuideBlock[] = [
  { kind: "heading", level: 1, text: "Gamma Words" },
  {
    kind: "prose",
    html: "These are the simplest 4-letter words created with continuous γ→γ motions:",
  },
];
