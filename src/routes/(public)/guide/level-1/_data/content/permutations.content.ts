import type { GuideBlock } from "../guide-content-blocks";

// Verbatim prose lifted from _pages/LoopsPage.svelte (Austen's words — never AI-written).
export const permutationsContent: GuideBlock[] = [
  { kind: "heading", level: 1, text: "LOOPs" },
  {
    kind: "prose",
    html:
      "When a word ends on a variation of its start position, we can repeat it to trace a<br>" +
      "complimentary pattern, eventually returning back to the start position (aka home).<br>" +
      "This type of sequence is called a <strong><em>LOOP</em></strong>.",
  },
  {
    kind: "prose",
    html: "Three common types of LOOPs are <em>Mirrored</em>, <em>Rotated</em>, and <em>Swapped</em>.",
  },
  { kind: "heading", level: 2, text: "Mirrored" },
  {
    kind: "prose",
    html: "In a mirrored LOOP, the second repetition’s pictographs reflect the first, which changes their rotation direction.",
  },
  {
    kind: "prose",
    html: "In this example, each column is reflected across a horizontal plane.",
  },
  { kind: "heading", level: 2, text: "Rotated" },
  {
    kind: "prose",
    html: "In a rotated LOOP, each repetition ends in a rotated variation on its previous position.",
  },
  {
    kind: "prose",
    html: "In this example, there is a 90° rotation, finally returning to the start position (aka “home”).",
  },
  { kind: "heading", level: 2, text: "Swapped" },
  {
    kind: "prose",
    html: 'In a swapped LOOP, each repetition swaps the roles of <strong class="cR">right</strong>/<strong class="cB">left</strong>.',
  },
  {
    kind: "prose",
    html: "Though the prop’s shapes look the same, this swap changes the body motion significantly.",
  },
];
