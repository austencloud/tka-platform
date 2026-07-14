import type { GuideBlock } from "../guide-content-blocks";

// Verbatim prose lifted from _pages/HandMotionsPage.svelte (Austen's words — never AI-written).
export const handMotionsContent: GuideBlock[] = [
  { kind: "heading", level: 1, text: "Hand Motions" },
  {
    kind: "prose",
    html:
      "There are three fundamental hand motions in the Alphabet.<br>" +
      "The arrow shows the direction of motion.<br>" +
      "The hand shows the end position.",
  },
  { kind: "prose", html: "Move to an<br>adjacent point" },
  { kind: "prose", html: "Move to the<br>opposite point" },
  { kind: "prose", html: "Stay at the<br>current point" },
  {
    kind: "prose",
    html:
      "Using these, we can derive six combinations, named below.<br>" +
      "We’ll explore each one individually:",
  },
  { kind: "heading", level: 2, text: "Dual-Shift" },
  { kind: "prose", html: "Both hands travel to an adjacent point." },
  { kind: "heading", level: 2, text: "Shift" },
  {
    kind: "prose",
    html: "One hand travels to an adjacent point<br>and the other hand remains static.",
  },
  { kind: "heading", level: 2, text: "Cross-Shift" },
  {
    kind: "prose",
    html: "One hand travels to an adjacent point and<br>the other travels to the opposite point.",
  },
  { kind: "heading", level: 2, text: "Dash" },
  {
    kind: "prose",
    html: "One hand travels to the opposite point<br>and the other hand remains static",
  },
  { kind: "heading", level: 2, text: "Dual-Dash" },
  { kind: "prose", html: "Both hands travel to the opposite point" },
  { kind: "heading", level: 2, text: "Static" },
  { kind: "prose", html: "Both hands remain static." },
];
