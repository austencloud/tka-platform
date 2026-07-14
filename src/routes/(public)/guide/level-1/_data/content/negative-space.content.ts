import type { GuideBlock } from "../guide-content-blocks";

// Verbatim prose lifted from _pages/NegativeSpacePage.svelte (Austen's words — never AI-written).
export const negativeSpaceContent: GuideBlock[] = [
  { kind: "heading", level: 1, text: "Negative Space and Body Turns" },
  {
    kind: "prose",
    html:
      "Many sequences seem impossible, but most can be solved by using negative space or body turns.<br>" +
      "<strong><em>Negative space</em></strong> lets you face the audience and reduces body movement<br>" +
      "<strong><em>Body turns</em></strong> add movement and help you execute patterns with longer staves.<br>" +
      "Each method is equally important, and learning both will maximize capability.<br>" +
      "This guide will assume some knowledge of these fundamental concepts.",
  },
  { kind: "prose", html: "To make the most of the Alphabet, it’s highly recommended that you learn the following." },

  { kind: "heading", level: 2, text: "360° Isolation" },
  {
    kind: "prose",
    html:
      "To execute this without finger-spinning, turn your torso to the left on step 3. During this " +
      "step, the staff moves briefly in wheel-plane relative to your left-facing view. On step 4, turn your " +
      "body back to center as you return to the start position.",
  },
  {
    kind: "prose",
    html:
      "Practice in reverse, then do both directions in the other hand.<br>Then practice it with the thumb out, isolating the pinky end.",
  },

  { kind: "heading", level: 2, text: "4-Petal Antispin" },
  { kind: "prose", html: "To execute this in wall plane, you must do one of the following on step 2:" },
  {
    kind: "prose",
    html:
      "• Pass the thumb end through the negative space above your right shoulder on step 2.<br>" +
      "• Turn your torso to the left on step 2 and pass the thumb end in front, then pass the pinky end on " +
      "the inside of your right arm as you move to step 3.",
  },
  {
    kind: "prose",
    html:
      "Practice in reverse, then do both directions in the other hand.<br>" +
      "Then practice everything again starting with the thumb out.<br>" +
      "Try using both negative space and turns. Good luck!",
  },
];
