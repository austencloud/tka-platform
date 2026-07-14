import type { GuideBlock } from "../guide-content-blocks";

// Verbatim prose lifted from _pages/WordsPage.svelte (Austen's words — never AI-written).
export const wordsContent: GuideBlock[] = [
  { kind: "heading", level: 1, text: "Words" },
  { kind: "prose", html: "Let’s create more complex words using pictographs!" },
  {
    kind: "prose",
    html:
      "In order to perform the words in this section correctly without finger-spinning,<br>" +
      "you must be familiar with negative space and body turns.",
  },
  {
    kind: "prose",
    html:
      "If you finger-spin instead of using negative space, you’ll lose precision and<br>" +
      "the ability to check your thumb orientation on each step to see if you’re still on track.",
  },
  {
    kind: "prose",
    html:
      "We’ll use the word AABB as an example. Here are three variations on AABB, starting from<br>" +
      'different thumb orientations. Use staves or <strong><span class="cR">red</span>/<span class="cB">blue</span></strong> pens to follow along.',
  },
  {
    kind: "prose",
    html:
      "As you execute these with staves, notice that each of these sequences requires a different type<br>" +
      "of negative space, either above/below the shoulder or behind the elbow.",
  },
  {
    kind: "prose",
    html:
      "The execution of the same word can feel completely different depending on factors like<br>" +
      "the start position, rotation direction, and thumb orientation. That’s why it’s necessary to<br>" +
      "draw the full sequence with pictographs for complete clarity.",
  },
  {
    kind: "prose",
    html:
      "<strong>The Alphabet is primarily a system of <em>pictographs</em>,<br>" +
      "organized by letters for convenient communication.</strong>",
  },
  {
    kind: "prose",
    html:
      "The letters do not give all of the information, and are merely intended to separate<br>" +
      "motion combinations into categories which can be further clarified with detailed pictographs.",
  },
];
