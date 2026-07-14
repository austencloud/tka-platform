import type { GuideBlock } from "../guide-content-blocks";

// Verbatim prose lifted from _pages/StaffPositionsPage.svelte (Austen's words — never AI-written).
export const staffPositionsContent: GuideBlock[] = [
  { kind: "heading", level: 1, text: "Staff Positions" },
  {
    kind: "prose",
    html:
      "When writing sequences with staves, it helps to mark the thumb end with a line.<br>" +
      "The performer can use it to keep track of rotations and check their position on every step.<br>" +
      "It also encourages negative space/body turns instead of finger spinning.",
  },
  { kind: "prose", html: "In the following examples, an end is always at the center point." },
  { kind: "prose", html: "Practice each position below, paying attention to the thumb orientation." },
  {
    kind: "prose",
    html:
      'Thumbs: in out <span class="cB">(out</span>/<span class="cR">in)</span> <span class="cB">(in</span>/<span class="cR">out)</span>',
  },
  {
    kind: "prose",
    html:
      "Many of the pictographs in this guide are depicted with no thumb ends<br>" +
      "when categorizing. It is usually noted only during sequences.",
  },
  {
    kind: "prose",
    html:
      "Most sequences in this guide start with thumbs in for consistency.<br>" +
      "It’s equally valid to start any sequence from a different thumb orientation.",
  },
];
