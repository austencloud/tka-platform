import type { GuideBlock } from "../guide-content-blocks";

// Verbatim structural text lifted from _pages/GuideCodexPage.svelte → CodexPageBody →
// CodexSheet (SHEET1: Double Staff, Types 1-2, codex/_data/codex-groups.ts). This sheet
// is an interactive grid of pictographs with almost no prose — the sheet title and type
// headings are the only real text on the page (Austen's words — never AI-written).
export const codexContent: GuideBlock[] = [
  { kind: "heading", level: 1, text: "The Codex" },
  { kind: "heading", level: 2, text: "Double Staff" },
  { kind: "heading", level: 3, text: "Type 1: Dual-Shift" },
  { kind: "heading", level: 3, text: "Type 2: Shift" },
];
