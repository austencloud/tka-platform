/**
 * Single source for the Compound Letters SEO doorway (manifest id
 * "lt1-dj-ek-fl"). Prose is lifted VERBATIM from _pages/CompoundLettersPage.svelte
 * (Austen's words — never AI-written), including the three word captions ("cute
 * phrases" the page itself refers to). Prose-only content file for the crawlable
 * doorway route — no sheet hints, no pictograph blocks. See the reflow spec +
 * no-ghostwriting rule.
 */
import type { GuideBlock } from "../guide-content-blocks";

export const lt1DjEkFlContent: GuideBlock[] = [
  { kind: "heading", level: 1, text: "Compound Letters" },
  {
    kind: "prose",
    html: "Now let’s look at the letters that move from β→α or α→β.",
  },
  {
    kind: "prose",
    html: "All pictographs can be rotated or mirrored without changing letters.",
  },
  {
    kind: "prose",
    html: "These can be either <em>Tog-Opp</em> or <em>Split-Opp</em> depending on which α/β you start from.",
  },
  {
    kind: "prose",
    html: "These compound letters can’t be self-combined like the previous letters.",
  },
  {
    kind: "prose",
    html: "Instead, they combine with other compound letters to form the words DJ, EK, and FL.",
  },
  {
    kind: "prose",
    html: "Here they are along with cute phrases to help you remember:",
  },
  {
    kind: "prose",
    html: '<span class="tka-font">DJ</span> - <em>Disco Jam</em>',
  },
  {
    kind: "prose",
    html: '<span class="tka-font">EK</span> - <em>Exploding Kitten</em>',
  },
  {
    kind: "prose",
    html: '<span class="tka-font">FL</span> - <em>Fruity Loops</em>',
  },
];
