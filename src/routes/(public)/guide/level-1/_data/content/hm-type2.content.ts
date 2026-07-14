import type { GuideBlock } from "../guide-content-blocks";

// Verbatim prose lifted from _pages/Type2ShiftsPage.svelte (Austen's words — never AI-written).
export const hmType2Content: GuideBlock[] = [
  { kind: "heading", level: 1, text: "Type 2 Shifts" },
  {
    kind: "prose",
    html:
      "To move between γ and α/β, you can shift one hand and keep the other hand static.<br>" +
      "This combination is called a <strong class=\"pu\">Shift</strong> (with a capital “S”). Here’s a simple example:",
  },
  {
    kind: "prose",
    html:
      "The following examples explore both same and opposite handpaths.<br>" +
      "They alternate the shifting hand.<br>" +
      "Here, they are shifting in the same direction:",
  },
  { kind: "prose", html: "And here, they are shifting in opposite directions." },
  {
    kind: "prose",
    html:
      "<span class=\"pu\">Shifts</span> seems mundane here, but they’re very useful later for constructing dynamic sequences.",
  },
];
