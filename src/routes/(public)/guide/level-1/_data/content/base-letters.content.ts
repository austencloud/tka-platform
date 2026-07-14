/**
 * Single source for the Base Letters SEO doorway (manifest id "base-letters").
 * Prose is lifted VERBATIM from _pages/BaseLettersPage.svelte (Austen's words —
 * never AI-written). This is a prose-only content file for the crawlable doorway
 * route — no sheet hints, no pictograph blocks (those stay in the interactive
 * reader's single-source content). See the reflow spec + no-ghostwriting rule.
 */
import type { GuideBlock } from "../guide-content-blocks";

export const baseLettersContent: GuideBlock[] = [
  { kind: "heading", level: 1, text: "Base Letters" },
  { kind: "heading", level: 2, text: "Type 1 - Dual-Shift" },
  {
    kind: "prose",
    html:
      "Just like positions, each motion pictograph can be rotated, reflected, or color swapped.<br>" +
      "Letters are organized on the page by end position, Alpha, Beta, then Gamma.<br>" +
      "Let’s look at each type individually.",
  },
  {
    kind: "prose",
    html: "First we’ll look at A, B, and C. Their handpath is <em>Split-Same</em> and they move from α→α:",
  },
  {
    kind: "prose",
    html:
      "Notice the pattern: <strong>Pro - Anti - Hybrid</strong><br>" +
      "This pattern helps you navigate/memorize the letters.",
  },
  {
    kind: "prose",
    html:
      "If you only remember that A has prospins, you can infer that B has antispins.<br>" +
      "If you only remember that B has antispins, you can infer that C is a hybrid.<br>" +
      "<strong><em>If you memorize only one letter in each group, you know all of them.</em></strong>",
  },
  {
    kind: "prose",
    html: "Next let’s look at G, H, and I. Their handpaths are <em>Tog-Same</em> and they move from β→β:",
  },
  {
    kind: "prose",
    html: "In hybrids like C and I, either hand can execute a prospin or antispin.",
  },
  {
    kind: "prose",
    html:
      "Here, the <strong class=\"cR\">right</strong> is in pro and <strong class=\"cB\">left</strong> in anti, " +
      "but it’s equally valid to swap this.",
  },
];
