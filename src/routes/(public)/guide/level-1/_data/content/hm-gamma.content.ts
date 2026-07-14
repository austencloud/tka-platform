import type { GuideBlock } from "../guide-content-blocks";

// Verbatim prose lifted from _pages/GammaPage.svelte (Austen's words — never AI-written).
export const hmGammaContent: GuideBlock[] = [
  { kind: "heading", level: 1, text: "Gamma: Quarter-Opposite and Quarter-Same" },
  {
    kind: "prose",
    html:
      "Gamma, aka quarter-time, is based on two often forgotten modes:<br>" +
      "<strong>Quarter-Opp</strong> and <strong>Quarter-Same</strong>.<br>" +
      "Quarter-Opp has variations of parallel and antiparallel.",
  },
  { kind: "heading", level: 2, text: "Quarter-Opp" },
  { kind: "prose", html: "In Quarter-Same, this doesn’t happen:" },
  { kind: "heading", level: 2, text: "Quarter-Same" },
  {
    kind: "prose",
    html:
      "When in gamma, you can move to any other variation of gamma.<br>" +
      "These examples are continuous, but non-continuous sequence are also possible.",
  },
  { kind: "prose", html: "Here’s one that switches between Quarter-Opp and Quarter-Same:" },
  {
    kind: "prose",
    html:
      "<strong>Practice using <span class=\"cy\">Dual</span><span class=\"pu\">-Shifts</span> " +
      "to create other non-continuous γ→γ variations!</strong>",
  },
];
