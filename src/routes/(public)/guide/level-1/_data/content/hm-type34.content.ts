import type { GuideBlock } from "../guide-content-blocks";

// Verbatim prose lifted from _pages/Type3CrossShiftsPage.svelte (Austen's words — never AI-written).
export const hmType34Content: GuideBlock[] = [
  { kind: "heading", level: 1, text: "Type 3 Cross-Shifts" },
  {
    kind: "prose",
    html:
      "A <span class=\"cross\">Cross</span><span class=\"shift\">-Shift</span> combines a shift and a dash.<br>" +
      "Since a dash has further to travel, it moves slightly faster.<br>" +
      "To understand <span class=\"cross\">Cross</span><span class=\"shift\">-Shifts</span>, let’s break one down into parts:",
  },
  {
    kind: "prose",
    html:
      "Note the halfway point. One hand is in the center point and one is on a diagonal hand point.<br>" +
      "By pausing at this halfway point, it ensures that the dash moves at the correct speed.<br>" +
      "The following sequences demonstrate their capabilities.<br>" +
      "This one explores alpha → gamma:",
  },
  { kind: "prose", html: "And this one shows beta → gamma:" },
  {
    kind: "prose",
    html:
      "Tech nerds will notice these <span class=\"cross\">Cross</span><span class=\"shift\">-Shifts</span> create <em>Zan’s Diamond</em> variations. Neat!",
  },
];
