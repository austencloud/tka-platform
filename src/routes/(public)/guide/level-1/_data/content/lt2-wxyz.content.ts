import type { GuideBlock } from "../guide-content-blocks";

// Verbatim prose lifted from _pages/Type2ShiftLettersPage.svelte (Austen's words — never AI-written).
export const lt2WxyzContent: GuideBlock[] = [
  { kind: "heading", level: 1, text: "Type 2 Shift Letters" },
  {
    kind: "prose",
    html:
      "So far we’ve learned how to move between α↔β and between γ↔γ.<br>" +
      'In order to travel between these two modes, we can use a Type 2 Motion called a <strong style="color:#6F2DA8">Shift</strong>.',
  },
  {
    kind: "prose",
    html:
      '<strong>A <span style="color:#6F2DA8">Shift</span> (or single shift) is the combination of one shift and one static motion.</strong><br>' +
      "Their letters are organized by end position: α, β, then γ.<br>" +
      "These can also be categorized by opening or closing.",
  },
  {
    kind: "prose",
    html: "When we arrange them in continuous motions, we get the words WΣYΘ and XΔZΩ.",
  },
  {
    kind: "prose",
    html:
      "Though simple at this stage, these motions become more complex<br>" +
      "as we dive deeper into the Alphabet and add rotations to static motions.",
  },
];
