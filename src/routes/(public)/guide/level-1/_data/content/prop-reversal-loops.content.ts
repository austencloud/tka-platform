import type { GuideBlock } from "../guide-content-blocks";

// Verbatim prose lifted from _pages/PropReversalLoopsPage.svelte (Austen's words — never AI-written).
export const propReversalLoopsContent: GuideBlock[] = [
  { kind: "heading", level: 1, text: "Prop-Reversal LOOPs" },
  {
    kind: "prose",
    html:
      "Each of these words uses a prop-reversal.<br>" +
      "These examples are <em>Rotated LOOPs</em>.",
  },
  {
    kind: "prose",
    html:
      'In this example of BΔMX, the <strong class="cR">right</strong> hand stops on steps 2 and 4 before resuming its ' +
      "motion around the center point. Even when there is a step with no motion in<br>" +
      'between, we can still mark the reversal with an “<strong class="cR">R</strong>” to indicate the prop reversal.',
  },
];
