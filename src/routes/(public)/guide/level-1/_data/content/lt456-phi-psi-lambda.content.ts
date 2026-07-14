import type { GuideBlock } from "../guide-content-blocks";

// Verbatim prose lifted from _pages/Type456LettersPage.svelte (Austen's words — never AI-written).
export const lt456PhiPsiLambdaContent: GuideBlock[] = [
  { kind: "heading", level: 1, text: "Type 4, 5, 6 Letters: Phi, Psi, Lambda" },
  { kind: "heading", level: 2, text: "Type 4 - Dash" },
  {
    kind: "prose",
    html:
      'With a <strong style="color:#26e600">Dash</strong>, one prop executes a dash and the other remains static.<br><br>' +
      "“Lambda” can be further shortened by calling it “Lam”.",
  },
  { kind: "heading", level: 2, text: "Type 5 - Dual-Dash" },
  {
    kind: "prose",
    html:
      'In a <strong style="color:#00b3ff">Dual</strong><strong style="color:#26e600">-Dash</strong>, both hands are dashing.<br>' +
      "The end position remains the same.",
  },
  { kind: "heading", level: 2, text: "Type 6 - Static" },
  {
    kind: "prose",
    html:
      'In a <strong style="color:#eb7d00">Static</strong> motion, both hands remain still for a beat.<br>' +
      "These become more interesting when adding turns.",
  },
];
