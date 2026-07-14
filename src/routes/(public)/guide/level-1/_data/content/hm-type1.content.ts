import type { GuideBlock } from "../guide-content-blocks";

// Verbatim prose lifted from _pages/Type1AlphaBetaPage.svelte (Austen's words — never AI-written).
export const hmType1Content: GuideBlock[] = [
  { kind: "heading", level: 1, text: "Type 1 Dual-Shifts: Alpha and Beta" },
  {
    kind: "prose",
    html:
      "When both hands move to adjacent locations, it’s called a <span class=\"cy\">Dual</span><span class=\"pu\">-Shift</span>.<br>" +
      "Our first <span class=\"cy\">Dual</span><span class=\"pu\">-Shifts</span> correspond to the four modes of timing/direction: SS, TS, SO, TO.<br>" +
      "You can determine the start position by looking at the non-pointed end of the arrow.",
  },
  { kind: "heading", level: 2, text: "Split-Same" },
  { kind: "heading", level: 2, text: "Tog-Same" },
  {
    kind: "prose",
    html:
      "The Kinetic Alphabet puts focus on simultaneous motions between<br>" +
      "two positions, relative to the center point.<br>" +
      "Let’s try another type of <span class=\"cy\">Dual</span><span class=\"pu\">-Shift</span>.<br>" +
      "What happens when we move between α and β?",
  },
  { kind: "heading", level: 2, text: "Split-Opp" },
  { kind: "heading", level: 2, text: "Tog-Opp" },
  {
    kind: "prose",
    html: "Notice that it can be either <em>Split-Opp</em> or <em>Tog-Opp</em> depending on start position.",
  },
  {
    kind: "prose",
    html:
      "<strong>Practice using <span class=\"cy\">Dual</span><span class=\"pu\">-Shifts</span> to travel between Alpha and Beta in each mode.</strong>",
  },
];
