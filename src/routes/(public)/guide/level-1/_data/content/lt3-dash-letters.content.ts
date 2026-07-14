import type { GuideBlock } from "../guide-content-blocks";

// Verbatim prose lifted from _pages/Type3CrossShiftLettersPage.svelte (Austen's words — never AI-written).
export const lt3DashLettersContent: GuideBlock[] = [
  { kind: "heading", level: 1, text: "Type 3 Cross-Shift Letters" },
  {
    kind: "prose",
    html:
      '<strong style="color:#26e600">Cross</strong><strong style="color:#6F2DA8">-Shifts</strong> use the same letters as <strong style="color:#6F2DA8">Shifts</strong>, but each letter is followed by a<br>' +
      "dash to indicate that the other hand is dashing into its end position.<br>" +
      "They are spoken as “W Dash” or “Sigma Dash”.<br>" +
      "<em>A dash symbol in the glyph equals a dash arrow on the graph.</em><br>" +
      "<strong><em>The end position for each Type 2/3 letter remains the same.</em></strong>",
  },
  {
    kind: "prose",
    html:
      '<strong style="color:#26e600">Cross</strong><strong style="color:#6F2DA8">-Shifts</strong> can be tricky to remember. It helps to first picture the corresponding<br>' +
      "Type 2 pictograph, then add the dash arrow without changing any other variables.",
  },
  {
    kind: "prose",
    html:
      'Just like we did with hands, let’s break down some <strong style="color:#26e600">Cross</strong><strong style="color:#6F2DA8">-Shifts</strong> step-by-step.',
  },
  {
    kind: "prose",
    html:
      "<strong><em>When initially learning, it’s useful to pause at the halfway point to ensure proper timing.</em></strong>",
  },
];
