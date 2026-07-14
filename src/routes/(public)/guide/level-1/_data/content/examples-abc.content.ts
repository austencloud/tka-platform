import type { GuideBlock } from "../guide-content-blocks";

// Verbatim prose lifted from _pages/ExamplesPage.svelte (Austen's words — never AI-written).
export const examplesAbcContent: GuideBlock[] = [
  { kind: "heading", level: 1, text: "Examples" },
  {
    kind: "prose",
    html:
      "Let’s practice reversals and permutations.<br>" +
      "We’ll use AABB as an example to explore different reversal placements.<br>" +
      "<strong>These start from the same alpha start position. Interpret it from the first motions.</strong>",
  },
  {
    kind: "prose",
    html:
      "Here’s an AABB in which both staves execute <strong>prop-reversals</strong> after steps 2 and 4, notated by an " +
      '“<strong class="cR">R</strong>/<strong class="cB">R</strong>” on the pictographs.',
  },
  {
    kind: "prose",
    html: "This requires negative space or a body turn to execute.",
  },
  {
    kind: "prose",
    html: "Let’s place the reversals in a different place. This time we’ll put them after step 1.",
  },
  {
    kind: "prose",
    html:
      "This will put our left hand on top after step 4, so we’ll repeat the sequence again mirrored (with a " +
      "reversal after step 5) to return to our original home position.",
  },
  {
    kind: "prose",
    html: "This is a <em>Mirrored LOOP</em>.",
  },
  {
    kind: "prose",
    html: "Now let’s look at another variation of AABB*2 with reversals after steps 3 & 7:",
  },
  {
    kind: "prose",
    html:
      "As demonstrated with these examples, a reversal in different locations in the word can lead to a " +
      "notably different outcome.",
  },
  {
    kind: "prose",
    html:
      "The word AABB is not limited to one presentation, it is a broad category of sequences that includes " +
      "those letters with variations on reversals and thumb orientation.",
  },
];
