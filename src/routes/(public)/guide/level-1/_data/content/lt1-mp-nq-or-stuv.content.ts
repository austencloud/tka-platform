/**
 * Single source for the Gamma Letters SEO doorway (manifest id
 * "lt1-mp-nq-or-stuv"). Prose is lifted VERBATIM from
 * _pages/GammaLettersPage.svelte (Austen's words — never AI-written), including
 * the three word captions (the page's own "memorable phrase"s). Prose-only
 * content file for the crawlable doorway route — no sheet hints, no pictograph
 * blocks. See the reflow spec + no-ghostwriting rule.
 */
import type { GuideBlock } from "../guide-content-blocks";

export const lt1MpNqOrStuvContent: GuideBlock[] = [
  { kind: "heading", level: 1, text: "Gamma Letters" },
  {
    kind: "prose",
    html:
      "γ→γ motions can combine with any other γ→γ motion to create lots of words!<br>" +
      "First let’s look at the compound letters (<em>Quarter-Opp</em>).",
  },
  {
    kind: "prose",
    html:
      "When combined as a continuous motion, these form MP, NQ, and OR.<br>" +
      "Here they are along with a memorable phrase:",
  },
  {
    kind: "prose",
    html: '<span class="tka-font">MP</span> - <em>Magic Potion</em>',
  },
  {
    kind: "prose",
    html: '<span class="tka-font">NQ</span> - <em>Never Quit</em>',
  },
  {
    kind: "prose",
    html: '<span class="tka-font">OR</span> - <em>Open Road</em>',
  },
  {
    kind: "prose",
    html:
      "The final γ→γ group (<em>Quarter-Same</em>) has 4 instead of 3.<br>" +
      "It may seem like U and V contain the same information, but it’s impossible to rotate or<br>" +
      "reflect U in order to turn it into V, and vice-versa, so they must be disambiguated.",
  },
  {
    kind: "prose",
    html:
      "Note that all four have a <em>leading</em> hand and a <em>following</em> hand.<br>" +
      'Here, the <strong class="cR">right</strong> is leading and <strong class="cB">left</strong> is following, but it’s equally valid to swap this.<br>' +
      "<strong><em>U leads with an isolation</em></strong> (a round motion like the letter U).<br>" +
      "<strong><em>V leads with an antispin</em></strong> (a spiky motion like the letter V).<br>" +
      "These self-combine to form the words SS, TT, UU, and VV.",
  },
];
