import type { GuideBlock } from "../guide-content-blocks";

// Verbatim prose lifted from _pages/SixteenCountPage.svelte (Austen's words — never AI-written).
export const sixteenCountContent: GuideBlock[] = [
  { kind: "heading", level: 1, text: "16-Count Sequences" },
  { kind: "prose", html: "These 4-letter words repeat 4 times, giving us 16-count sequences." },
  {
    kind: "prose",
    html:
      "Here, each repetition of the word ends in a β that is 90° from its start. " +
      "This means it will take 4 repetitions to return to home.",
  },
  { kind: "prose", html: "<em>(Rotated + Swapped LOOP)</em>" },
  {
    kind: "prose",
    html:
      "Here, the staves return to home after two word repetitions. To make it " +
      "symmetrical, it repeats twice more, filling the rest of the quadrants.",
  },
  { kind: "prose", html: "<em>(Rotated + Mirrored + Swapped LOOP)</em>" },
];
