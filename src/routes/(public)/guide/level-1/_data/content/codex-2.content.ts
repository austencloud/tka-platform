import type { GuideBlock } from "../guide-content-blocks";

// Verbatim structural text lifted from _pages/GuideCodexPage2.svelte → CodexPageBody →
// CodexSheet (SHEET2: Types 3-6, codex/_data/codex-groups.ts). This sheet is an
// interactive grid of pictographs with almost no prose - the type headings are the only
// real text on the page (Austen's words - never AI-written).
export const codex2Content: GuideBlock[] = [
  { kind: "heading", level: 1, text: "The Codex, Continued" },
  { kind: "heading", level: 3, text: "Type 3: Cross-Shift" },
  { kind: "heading", level: 3, text: "Type 4: Dash" },
  { kind: "heading", level: 3, text: "Type 5: Dual-Dash" },
  { kind: "heading", level: 3, text: "Type 6: Static" },
];
