<script lang="ts">
  /**
   * Hand Positions — body page 2, a faithful reproduction of the proof PDF
   * (level-1-v05.pdf, page 8). Text runs are DATA-DRIVEN from the PDF's own
   * coordinates; the 16 figure boxes were measured straight off the rendered
   * proof (99.5pt squares, columns at x = 75 / 195 / 315 / 435pt).
   *
   * The sheet is 816×1056px (8.5×11in @96dpi), 1pt = 4/3px. Root is an absolute
   * layer over the whole GuidePage so coordinates map straight to the sheet. The
   * page renders fullBleed (no GuidePage header) — the title is a positioned run.
   *
   * Each of the 16 minis is a REAL pictograph: the canonical 16 diamond-mode
   * positions (ALPHA1/3/5/7, BETA1/3/5/7, GAMMA1/3/5/7/9/11/13/15) from
   * startPositionManager, rendered through PictographContainer with the prop
   * forced to HAND. The renderer handles correct hand sizing, the right-hand
   * mirror (red HAND auto-mirrors in PropSvg), and the bottom-left position
   * letter glyph (showTKA) in the book's glyph font. printMode = white sheet,
   * darkMode = false = ink-on-white.
   */
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import { startPositionManager } from "$lib/shared/create/services/start-position-manager";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { guideEdit, ptDrag, pt, editText, registerEditSource } from "../_data/guide-edit.svelte";

  const S = 816 / 612; // pt → px (4/3)

  // The 16 diamond-mode positions, in α / β / γ order (4 / 4 / 8). The manager
  // bakes propType STAFF onto each motion; force HAND so the prepared motion
  // carries HAND (what PropSvg's mirror check reads), matching PositionVisualizer.
  const positions = startPositionManager
    .getAllStartPositionVariations(GridMode.DIAMOND)
    .map((p) => ({
      ...p,
      motions: {
        blue: p.motions?.blue ? { ...p.motions.blue, propType: PropType.HAND } : undefined,
        red: p.motions?.red ? { ...p.motions.red, propType: PropType.HAND } : undefined,
      },
    }));

  // Mini box geometry, measured off the proof (pt). 99.5pt squares, pitch 120pt.
  const COLS = [75, 195, 315, 435];
  const colX = (i: number): number => COLS[i] ?? 0;
  const SIZE = 99.5;

  // ── Vertical flow (pt) ────────────────────────────────────────────────────
  // Dense page (title + intro + 3 glyph-led figure sections), so positions are
  // DERIVED from a few spacing knobs instead of hand-placed. Each section now
  // leads with the canonical TKA position glyph, then its name, then a row (or
  // two) of minis, then the italic description; a hairline rule splits sections
  // (parsability, matching the proof). The title sits at the SAME y as The
  // Grid's title so pages stay consistent. Tune GAP to breathe the page.
  // Title size + placement live in guide.css (.guide-title / --guide-title-*),
  // shared by every page. TITLE_Y/TITLE_H here are only the intro-offset anchor
  // for THIS page's cascade; keep TITLE_Y ≈ --guide-title-top so intro clears.
  const TITLE_Y = 22; // ≈ --guide-title-top (22pt) — cascade anchor only
  const TITLE_H = 40; // title layout slot feeding the intro offset
  const GAP = 12; // even gap between major blocks
  const G_IN = 6; // heading→minis and minis→description
  const ROW_GAP = 5; // between the two Gamma rows
  const LINE = 18; // intro line height
  const GLYPH_H = 22; // TKA position glyph height
  const GH_GAP = 1; // glyph → name
  const WORD_H = 18; // name line height
  const DESC_H = 18;
  const CX = 304; // page-centre x for glyphs + names (pt)

  const introY = TITLE_Y + TITLE_H + GAP;
  const introBottom = introY + 2 * LINE + 14;

  const aGlyphY = introBottom + GAP;
  const aHeadY = aGlyphY + GLYPH_H + GH_GAP;
  const ROW_A = aHeadY + WORD_H + G_IN;
  const aDescY = ROW_A + SIZE + G_IN;

  const bGlyphY = aDescY + DESC_H + GAP;
  const bHeadY = bGlyphY + GLYPH_H + GH_GAP;
  const ROW_B = bHeadY + WORD_H + G_IN;
  const bDescY = ROW_B + SIZE + G_IN;

  const gGlyphY = bDescY + DESC_H + GAP;
  const gHeadY = gGlyphY + GLYPH_H + GH_GAP;
  const ROW_G1 = gHeadY + WORD_H + G_IN;
  const ROW_G2 = ROW_G1 + SIZE + ROW_GAP;
  const gDescY = ROW_G2 + SIZE + G_IN;

  // Hairline rules splitting the sections (mid-gap below each description).
  const DIVIDERS = [aDescY + DESC_H + GAP / 2, bDescY + DESC_H + GAP / 2];

  // Canonical TKA position glyphs (Type6 letter SVGs, black ink → correct on the
  // white sheet). γ resolves to the CURRENT gamma glyph automatically — no need
  // to track the old one. ar = intrinsic width/height; sized to GLYPH_H, centred
  // on CX. Source dims mirror PositionGlyph.svelte's LETTER_DIMENSIONS.
  const GLYPHS = [
    { src: "/images/letters_trimmed/Type6/α.svg", ar: 92.22 / 100, y: aGlyphY, name: "Alpha (α)" },
    { src: "/images/letters_trimmed/Type6/β.svg", ar: 66.05 / 100, y: bGlyphY, name: "Beta (β)" },
    { src: "/images/letters_trimmed/Type6/γ.svg", ar: 79 / 100.11, y: gGlyphY, name: "Gamma (γ)" },
  ];

  // Row for the i-th position: α (0–3), β (4–7), γ row1 (8–11), γ row2 (12–15).
  const rowFor = (i: number): number =>
    i < 4 ? ROW_A : i < 8 ? ROW_B : i < 12 ? ROW_G1 : ROW_G2;

  type Run = {
    x: number;
    y: number;
    w: number;
    h: number;
    t: string;
    b?: boolean;
    i?: boolean;
    sub?: boolean;
    title?: boolean;
    line2?: boolean;
  };

  // Intro is ONE grouped block (was three separate runs) so it moves as a unit;
  // line 2 carries the rotate/mirror clause + the bold Red/Blue colour legend.
  let intro = $state({
    x: 0,
    y: introY,
    fs: 15,
    lh: LINE,
    html:
      "There are multiple ways to combine two hand points to form a hand position.<br>" +
      "Positions can be rotated or mirrored.<span class=\"lg\"></span>" +
      "<strong><span class=\"cR\">Red = Right</span> and <span class=\"cB\">Blue = Left.</span></strong><br>" +
      "In The Kinetic Alphabet, our first three positions are called Alpha, Beta, and Gamma.",
  });

  // Section subheads (Alpha/Beta/Gamma) + italic descriptions, at proof coords.
  let RUNS: Run[] = $state([
    { x: 275.0, y: aHeadY, w: 54.8, h: 22, sub: true, t: "Alpha" },
    { x: 75.9, y: aDescY, w: 454.5, h: 18, i: true, t: "In Alpha, the hands occupy the points across from each other." },

    { x: 283.9, y: bHeadY, w: 42.4, h: 22, sub: true, t: "Beta" },
    { x: 150.1, y: bDescY, w: 308.2, h: 18, i: true, t: "In Beta, the hands occupy the same point." },

    { x: 269.3, y: gHeadY, w: 71.5, h: 22, sub: true, t: "Gamma" },
    { x: 154.1, y: gDescY, w: 301.9, h: 18, i: true, t: "In Gamma, the hands form a right angle." },
  ]);

  // Edit mode: drag text runs; dump current coords for CoordsPanel's Copy.
  const r1 = (n: number) => Math.round(n * 10) / 10;
  $effect(() =>
    registerEditSource("Hand Positions (p2)", () =>
      `  intro: x: ${r1(intro.x)}, y: ${r1(intro.y)}\n` +
      RUNS.map((r) => `  ${JSON.stringify(r.t).slice(0, 28)}: x: ${r1(r.x)}, y: ${r1(r.y)}`).join("\n")
    )
  );
</script>

<div class="hand-positions">
  <!-- 16 real position pictographs (hand prop), measured boxes. -->
  {#each positions as pos, i (pos.id)}
    <div
      class="mini"
      style="left:{colX(i % 4) * S}px; top:{rowFor(i) * S}px; width:{SIZE * S}px; height:{SIZE * S}px"
    >
      <PictographContainer
        pictographData={pos}
        gridMode={GridMode.DIAMOND}
        bluePropTypeOverride={PropType.HAND}
        redPropTypeOverride={PropType.HAND}
        showGrid={true}
        showTKA={true}
        showPositions={false}
        showReversals={false}
        showTnD={false}
        showElemental={false}
        showNonRadialPoints={false}
        showHandPoints={true}
        darkMode={false}
        printMode={true}
        disableTransitions={true}
      />
    </div>
  {/each}

  <!-- Canonical TKA position glyph leading each section, centred above the name. -->
  {#each GLYPHS as g}
    <img
      class="glyph"
      src={g.src}
      alt={g.name}
      style="left:{(CX - (GLYPH_H * g.ar) / 2) * S}px; top:{g.y * S}px; height:{GLYPH_H * S}px"
    />
  {/each}

  <!-- Hairline rules splitting α / β / γ for parsability (matches the proof). -->
  {#each DIVIDERS as dy}
    <div class="rule" style="left:{64.4 * S}px; top:{dy * S}px; width:{491.6 * S}px"></div>
  {/each}

  <!-- Intro as ONE movable block: plain sentence, rotate/mirror + colour legend,
       then the Alpha/Beta/Gamma sentence (was three separate runs). -->
  <p
    class="para"
    class:edit={guideEdit.on}
    class:selected={guideEdit.selectedId === `hp-intro`}
    style="top:{intro.y * S}px; font-size:{intro.fs * S}px; line-height:{intro.lh * S}px"
    use:ptDrag={pt(`hp-intro`, "intro", intro)}
    use:editText={{ id: `hp-intro`, label: "intro", get: () => intro.html, set: (h) => (intro.html = h) }}
  >
    {@html intro.html}
  </p>

  {#each RUNS as r, i (i)}
    <span
      class="run"
      class:b={r.b}
      class:i={r.i}
      class:sub={r.sub}
      class:t={r.title}
      class:edit={guideEdit.on}
      class:selected={guideEdit.selectedId === `hp-run-${i}`}
      style="left:{r.x * S}px; top:{r.y * S}px; width:{r.w * S}px; font-size:{r.h * S}px"
      use:ptDrag={pt(`hp-run-${i}`, r.t, r)}
      use:editText={{ id: `hp-run-${i}`, label: r.t, get: () => r.t, set: (v) => (r.t = v), plain: true }}>{r.t}</span
    >
  {/each}
</div>

<style>
  /* Absolute layer over the whole GuidePage sheet; coords map straight to pt×S. */
  .hand-positions {
    position: absolute;
    inset: 0;
    color: #141414;
  }

  .run {
    position: absolute;
    font-family: "Times New Roman", Times, Georgia, serif;
    line-height: 1;
    white-space: nowrap;
    text-align: center;
  }
  .run.b {
    font-weight: 700;
  }
  .run.edit {
    outline: 1px dashed rgba(55, 48, 163, 0.4);
    cursor: move;
  }
  .run.selected {
    outline: 1.5px solid #3730a3;
    outline-offset: 1px;
  }
  /* Intro block — one centred, movable paragraph (like Type1/Gamma). */
  .para {
    position: absolute;
    left: 0;
    right: 0;
    margin: 0;
    text-align: center;
    color: #141414;
    font-family: "Times New Roman", Times, Georgia, serif;
  }
  .para.edit {
    outline: 1px dashed rgba(55, 48, 163, 0.4);
    cursor: move;
  }
  .para.selected {
    outline: 1.5px solid #3730a3;
    outline-offset: 1px;
  }
  .para :global(.cR) {
    color: #cc2127;
  }
  .para :global(.cB) {
    color: #2e3192;
  }
  .para :global(.lg) {
    display: inline-block;
    width: 1.6em;
  }
  /* Italic descriptions use the serif. */
  .run.i {
    font-family: var(--guide-display);
    font-style: italic;
    font-weight: 500;
  }
  /* Greek subheads — display serif (unchanged from the proof). */
  .run.sub {
    font-family: var(--guide-display);
    font-weight: 600;
  }
  /* Page title is the shared .guide-title (guide.css) — no per-page title rule. */

  .mini {
    position: absolute;
    border: 1px solid #c4c4cc;
    box-sizing: border-box;
  }

  /* TKA position glyph (Type6 SVG) leading each section. */
  .glyph {
    position: absolute;
    width: auto; /* height drives size; intrinsic ratio sets width */
  }

  /* Hairline section divider. */
  .rule {
    position: absolute;
    height: 1px;
    background: #bcbcc6;
  }

</style>
