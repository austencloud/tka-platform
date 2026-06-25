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

  const S = 816 / 612; // pt → px (4/3)

  // The 16 diamond-mode positions, in α / β / γ order (4 / 4 / 8).
  const positions = startPositionManager.getAllStartPositionVariations(GridMode.DIAMOND);

  // Mini box geometry, measured off the proof (pt). 99.5pt squares, pitch 120pt.
  const COLS = [75, 195, 315, 435];
  const colX = (i: number): number => COLS[i] ?? 0;
  const SIZE = 99.5;
  const ROW_A = 157;
  const ROW_B = 355;
  const ROW_G1 = 551.5;
  const ROW_G2 = 657.5;

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
    legend?: boolean;
  };

  const B = "#2e3192"; // blue = left
  const R = "#cc2127"; // red = right

  // Text runs extracted from PDF p8 (top-left origin, points).
  const RUNS: Run[] = [
    { x: 201.1, y: 8, w: 218.4, h: 40, title: true, t: "Hand Positions" },

    { x: 64.4, y: 44.2, w: 491.6, h: 15, t: "There are multiple ways to combine two hand points to form a hand position." },
    { x: 96.4, y: 62.2, w: 235.8, h: 15, t: "Positions can be rotated or mirrored." },
    { x: 335.4, y: 62.2, w: 188.6, h: 15, b: true, legend: true, t: "Red = Right and Blue = Left." },
    { x: 42.5, y: 80.2, w: 535.4, h: 15, t: "In The Kinetic Alphabet, our first three positions are called Alpha, Beta, and Gamma." },

    { x: 275.0, y: 128.0, w: 54.8, h: 22, sub: true, t: "Alpha" },
    { x: 75.9, y: 263.8, w: 454.5, h: 18, i: true, t: "In Alpha, the hands occupy the points across from each other." },

    { x: 283.9, y: 326.6, w: 42.4, h: 22, sub: true, t: "Beta" },
    { x: 150.1, y: 461.5, w: 308.2, h: 18, i: true, t: "In Beta, the hands occupy the same point." },

    { x: 269.3, y: 520.3, w: 71.5, h: 22, sub: true, t: "Gamma" },
    { x: 154.1, y: 764.0, w: 301.9, h: 18, i: true, t: "In Gamma, the hands form a right angle." },
  ];
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

  {#each RUNS as r}
    <span
      class="run"
      class:b={r.b}
      class:i={r.i}
      class:sub={r.sub}
      class:t={r.title}
      style="left:{r.x * S}px; top:{r.y * S}px; width:{r.w * S}px; font-size:{r.h * S}px"
    >
      {#if r.legend}
        <span style="color:{R}">Red = Right</span> and <span style="color:{B}">Blue = Left.</span>
      {:else}
        {r.t}
      {/if}
    </span>
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
  /* Italic descriptions + the Greek subheads + the page title use the book's
     display serif. */
  .run.i {
    font-family: "Cormorant Garamond", Georgia, serif;
    font-style: italic;
    font-weight: 500;
  }
  .run.sub {
    font-family: "Cormorant Garamond", Georgia, serif;
    font-weight: 600;
  }
  .run.t {
    font-family: "Cormorant Garamond", Georgia, serif;
    font-style: italic;
    font-weight: 600;
    color: #14142b;
  }

  .mini {
    position: absolute;
    border: 1px solid #c4c4cc;
    box-sizing: border-box;
  }
</style>
