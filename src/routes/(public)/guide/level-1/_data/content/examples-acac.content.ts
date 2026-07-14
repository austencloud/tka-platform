import type { GuideBlock } from "../guide-content-blocks";

// Verbatim prose lifted from _pages/MixedWordsPage.svelte (Austen's words — never AI-written).
export const examplesAcacContent: GuideBlock[] = [
  { kind: "heading", level: 1, text: "Mixed Words: ACAC and BCBC" },
  {
    kind: "prose",
    html:
      "When combining a hybrid like C with a non-hybrid like A or B, a prop-reversal is necessary.<br>" +
      "Let’s look at the word ACAC.",
  },
  {
    kind: "prose",
    html: "In this variation, the left hand does a reversal on every step. Give it a try:",
  },
  {
    kind: "prose",
    html: "It would be impossible to execute ACAC without using a prop-reversal.",
  },
  {
    kind: "prose",
    html:
      "The previous example shows the hands moving in a <em>continuous</em> path.<br>" +
      "Let’s change that in the next example by including a full-reversal in the middle.<br>" +
      'In this example, the reversals alternate between left (<strong class="cB">R</strong>) and right (<strong class="cR">R</strong>).',
  },
  {
    kind: "prose",
    html:
      "This example uses every type of reversal - <em>hand</em>, <em>prop</em>, and <em>full</em>.<br>" +
      "Challenge yourself to identify where each one occurs.",
  },
  {
    kind: "prose",
    html: "Prop-reversals are also required with BCBC, as shown in this example:",
  },
  {
    kind: "prose",
    html:
      'Here, the <strong class="cR">right</strong> hand is prop-reversing after every step. Eventually, it returns to home.',
  },
];
