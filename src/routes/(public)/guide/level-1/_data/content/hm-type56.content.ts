import type { GuideBlock } from "../guide-content-blocks";

// Verbatim prose lifted from _pages/Type456Page.svelte (Austen's words — never AI-written).
export const hmType56Content: GuideBlock[] = [
  { kind: "heading", level: 1, text: "Type 4, 5, 6: Dash, Dual-Dash, Static" },

  { kind: "heading", level: 2, text: "Type 4 - Dash" },
  {
    kind: "prose",
    html:
      'With a <span class="k-dash">Dash</span>, one hand executes a dash while the other hand remains static.<br>' +
      "With alpha → beta, this creates a two-step sequence:",
  },
  { kind: "prose", html: "And with gamma → gamma, it creates a 4-step sequence:" },

  { kind: "heading", level: 2, text: "Type 5 - Dual-Dash" },
  {
    kind: "prose",
    html:
      'With a <span class="k-dual">Dual</span><span class="k-dash">-Dash</span>, both hands dash simultaneously to their opposite points.',
  },
  {
    kind: "prose",
    html:
      'Practice using <span class="k-dual">Dual</span><span class="k-dash">-Dashes</span>, <span class="k-dash">Dashes</span>, and <span class="k-cross">Cross</span><span class="k-shift">-Shifts</span><br>' +
      "from different start positions.",
  },

  { kind: "heading", level: 2, text: "Type 6 - Static" },
  {
    kind: "prose",
    html: 'Finally, <span class="k-static">Static</span> motions are indicated by no arrow:',
  },
  { kind: "prose", html: "Later on, static sequences gain complexity when adding prop rotations." },
];
