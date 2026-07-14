import type { GuideBlock } from "../guide-content-blocks";

// Verbatim prose lifted from _pages/ReversalsPage.svelte (Austen's words — never AI-written).
export const reversalsContent: GuideBlock[] = [
  { kind: "heading", level: 1, text: "Reversals" },
  {
    kind: "prose",
    html: "Reversals open up a huge number of possibilities!<br>There are three types of reversals:",
  },
  { kind: "heading", level: 2, text: "Hand-reversal" },
  {
    kind: "prose",
    html:
      "With a hand reversal, the hand returns to the point it came from previously, without changing the " +
      "prop’s direction of spin. Relative to the center point, this changes a prospin to an antispin and vice-versa.",
  },
  {
    kind: "prose",
    html: "This is the simplest and least disruptive reversal. We’ve already used it in the previous examples.",
  },
  { kind: "heading", level: 2, text: "Prop-reversal" },
  {
    kind: "prose",
    html:
      "With a prop reversal, the hand continues to the next point while the prop reverses direction. " +
      "This reversal also changes a prospin into an antispin and vice-versa.",
  },
  {
    kind: "prose",
    html:
      'Since a prop reversal is less intuitive, an “<strong class="cR">R</strong>/<strong class="cB">R</strong>” is shown in the ' +
      "corresponding color on the pictograph to indicate it.",
  },
  { kind: "heading", level: 2, text: "Full-reversal" },
  {
    kind: "prose",
    html:
      "With a full-reversal, the prop and hand retrace their paths and return to their previous position, " +
      "as if going backwards in time.",
  },
  {
    kind: "prose",
    html:
      'Because this contains a prop reversal, the “<strong class="cR">R</strong>/<strong class="cB">R</strong>” draws attention to it. ' +
      "This succinctly indicates to the performer that something unusual is happening.",
  },
];
