<script lang="ts">
  /**
   * The Grid — body page 1, a faithful reproduction of the original proof PDF
   * (level-1-v05.pdf, page 7). Layout is DATA-DRIVEN from the PDF's own text-box
   * coordinates: every text run was extracted with its (x, y, w) in PDF points
   * (612×792pt page) and placed here at the exact same spot.
   *
   * The sheet is 816×1056px (8.5×11in @96dpi), so 1pt = 4/3px. The root is an
   * absolute layer over the whole GuidePage, so coordinates map straight to the
   * sheet — text lands where Austen intentionally placed it. The page renders
   * fullBleed (no GuidePage header), so the title is just another positioned run.
   *
   * Grids reuse the canonical renderer (GridSvg) forced to light mode
   * (darkMode={false}) so points print black on white; the two hands reuse the
   * canonical prop hand path, placed on the diamond's W/E hand points.
   */
  import GridSvg from "$lib/shared/pictograph/grid/components/GridSvg.svelte";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

  const S = 816 / 612; // pt → px (4/3)

  // Canonical prop hand path (static/images/props/hand.svg, viewBox 75×100).
  const HAND =
    "M11.17 44.59h3.37V12.7a5.61 5.61 0 1 1 11.2-.01v31.9h3.32V5.72A5.5 5.5 0 0 1 34.66 0a5.55 5.55 0 0 1 5.58 5.77v38.81h3.32V13.56c0-2.99 1.95-5.19 4.97-5.64 3.08-.45 6.18 2.1 6.19 5.15q.02 5.73 0 11.46v38.13c0 .79.16 1.47.94 1.87.85.44 1.73.15 2.27-.77l6.41-10.87c1.64-2.79 4.42-3.73 7.43-2.48 3.04 1.26 4.15 4.73 2.41 7.7L65.3 73.19c-2.17 3.68-4.29 7.4-6.55 11.03a18 18 0 0 1-2.81 3.27 46 46 0 0 1-14.76 9.87c-5.01 2.03-10.23 3.03-15.63 2.51-9.85-.94-17.1-5.78-21.71-14.35A32 32 0 0 1 .26 73a76 76 0 0 1-.25-6.23L0 25.08a5.6 5.6 0 0 1 5.74-5.7 5.5 5.5 0 0 1 5.42 5.41z";
  // Hand placed centred on a 950-space grid point, scaled up from its 75×100 box.
  const HS = 1.9;
  const handTf = (px: number, py: number) => `translate(${px - 37.5 * HS}, ${py - 50 * HS}) scale(${HS})`;
  const W_HAND = { x: 331.9, y: 475 };
  const E_HAND = { x: 618.1, y: 475 };

  type Run = { x: number; y: number; w: number; h: number; t: string; b?: boolean; s?: boolean; title?: boolean };

  // Text runs extracted from PDF p7 (coords = top-left origin, points).
  // b = bold (g_d0_f2), s = script heading (g_d0_f4), title = page title.
  const RUNS: Run[] = [
    { x: 245.6, y: 10.6, w: 124.0, h: 40, title: true, t: "The Grid" },

    // Centered intro block
    { x: 144.7, y: 78.2, w: 322.4, h: 16, t: "The Kinetic Alphabet is based on a 4-point grid." },
    { x: 105.5, y: 116.6, w: 400.8, h: 16, t: "There are two 4-point grids: box mode and diamond mode." },
    { x: 64.9, y: 135.8, w: 482.1, h: 16, b: true, t: "This guide is written in diamond, but everything translates to box." },
    { x: 157.7, y: 174.2, w: 296.4, h: 16, t: "On this grid, there are three types of points:" },

    // Left descriptive column (runs kept separate so bold terms keep their spot)
    { x: 30.7, y: 239.1, w: 27.8, h: 17, t: "The " },
    { x: 62.2, y: 239.1, w: 95.4, h: 17, b: true, t: "center point" },
    { x: 161.3, y: 239.1, w: 103.9, h: 17, t: " is the hub that" },
    { x: 30.7, y: 259.5, w: 201.7, h: 17, t: "everything revolves around." },
    { x: 30.7, y: 331.0, w: 61.9, h: 17, t: "The four " },
    { x: 96.4, y: 331.0, w: 92.8, h: 17, b: true, t: "hand points" },
    { x: 192.9, y: 331.0, w: 84.0, h: 17, t: " are halfway" },
    { x: 30.7, y: 351.4, w: 239.8, h: 17, t: "between the center point and the" },
    { x: 30.7, y: 371.8, w: 92.3, h: 17, t: "outer points." },
    { x: 30.7, y: 440.7, w: 27.8, h: 17, t: "The " },
    { x: 62.2, y: 440.7, w: 95.8, h: 17, b: true, t: "outer points" },
    { x: 161.8, y: 440.7, w: 115.4, h: 17, t: " depict the outer" },
    { x: 30.7, y: 461.1, w: 123.6, h: 17, t: "edges of the grid." },

    // Diagram callout labels
    { x: 432.4, y: 279.9, w: 28.1, h: 13, t: "hand" },
    { x: 428.9, y: 295.5, w: 35.1, h: 13, t: "points" },
    { x: 386.3, y: 390.8, w: 35.4, h: 13, t: "center" },
    { x: 389.3, y: 406.5, w: 29.5, h: 13, t: "point" },
    { x: 512.1, y: 421.8, w: 30.2, h: 13, t: "outer" },
    { x: 509.6, y: 437.4, w: 35.1, h: 13, t: "points" },

    // Centered transition line
    { x: 130.2, y: 524.0, w: 351.5, h: 17, t: "Together, diamond and box form an 8-point grid:" },

    // Grid section headings (script font)
    { x: 82.7, y: 556.8, w: 65.6, h: 20, s: true, t: "Diamond" },
    { x: 287.7, y: 556.8, w: 28.4, h: 20, s: true, t: "Box" },
    { x: 452.8, y: 556.8, w: 83.6, h: 20, s: true, t: "8-point grid" },

    // Footer line
    { x: 116.5, y: 760.9, w: 379.0, h: 19, t: "We’ll use diamond mode to learn each concept." },
  ];

  // Central diagram box (pt, square so the grid stays round) + bottom grid boxes.
  const DIAG = { x: 300, y: 195, w: 260, h: 260 };
  const MINI = { y: 580, w: 150, h: 150 };
  const minis: { x: number; type: "diamond" | "box" | "merged" }[] = [
    { x: 40, type: "diamond" },
    { x: 227, type: "box" },
    { x: 420, type: "merged" },
  ];
</script>

<!-- A square grid figure: white sheet + canonical GridSvg forced to ink (light
     mode). `hands` overlays the two prop hands on the diamond's W/E hand points. -->
{#snippet figure(type: "diamond" | "box" | "merged", hands = false)}
  <svg class="fig" viewBox="0 0 950 950">
    <rect width="950" height="950" fill="#ffffff" />
    {#if type === "merged"}
      <GridSvg gridMode={GridMode.DIAMOND} darkMode={false} />
      <GridSvg gridMode={GridMode.BOX} darkMode={false} />
    {:else}
      <GridSvg gridMode={type === "box" ? GridMode.BOX : GridMode.DIAMOND} darkMode={false} />
    {/if}
    {#if hands}
      <path d={HAND} fill="#2e3192" transform={handTf(W_HAND.x, W_HAND.y)} />
      <path d={HAND} fill="#cc2127" transform={handTf(E_HAND.x, E_HAND.y)} />
    {/if}
  </svg>
{/snippet}

<div class="grid-page">
  <!-- Figures first so their white sheets sit BENEATH the text + arrows. -->
  <div
    class="diagram"
    style="left:{DIAG.x * S}px; top:{DIAG.y * S}px; width:{DIAG.w * S}px; height:{DIAG.h * S}px"
  >
    {@render figure("diamond", true)}
  </div>

  {#each minis as m}
    <div
      class="mini"
      style="left:{m.x * S}px; top:{MINI.y * S}px; width:{MINI.w * S}px; height:{MINI.h * S}px"
    >
      {@render figure(m.type)}
    </div>
  {/each}

  {#each RUNS as r}
    <span
      class="run"
      class:b={r.b}
      class:s={r.s}
      class:t={r.title}
      style="left:{r.x * S}px; top:{r.y * S}px; width:{r.w * S}px; font-size:{r.h * S}px"
      >{r.t}</span
    >
  {/each}

  <!-- Callout arrows, drawn directly in PDF coordinate space (612×792), on top. -->
  <svg class="arrows" viewBox="0 0 612 792" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <marker id="ah" markerWidth="7" markerHeight="7" refX="5.5" refY="3" orient="auto">
        <path d="M0,0 L6,3 L0,6 Z" fill="#222" />
      </marker>
    </defs>
    <!-- hand points → the two hand points -->
    <path d="M442,309 Q418,320 396,323" />
    <path d="M453,309 Q468,317 467,323" />
    <!-- center point → center dot -->
    <path d="M420,398 Q430,365 430,336" />
    <!-- outer points → bottom outer dot -->
    <path d="M512,432 Q472,424 444,409" />
  </svg>
</div>

<style>
  /* Absolute layer over the whole GuidePage sheet; coords map straight to pt×S. */
  .grid-page {
    position: absolute;
    inset: 0;
    color: #141414;
  }

  .run {
    position: absolute;
    /* Times metrics sit close to the proof's serif, so runs placed at the PDF's
       x-coordinates keep their original spacing without overlapping. */
    font-family: "Times New Roman", Times, Georgia, serif;
    line-height: 1;
    white-space: nowrap;
  }
  .run.b {
    font-weight: 700;
  }
  /* Script headings (Diamond / Box / 8-point grid) + the page title — the book's
     header typeface. */
  .run.s,
  .run.t {
    font-family: "Cormorant Garamond", Georgia, serif;
    font-style: italic;
    font-weight: 600;
  }
  .run.t {
    color: #14142b;
    text-align: center;
  }

  .diagram,
  .mini {
    position: absolute;
    border: 1px solid #c4c4cc;
  }
  .fig {
    display: block;
    width: 100%;
    height: 100%;
  }
  /* GridSvg fades in via its own .visible state; force it on for a static print. */
  .fig :global(.grid-container) {
    opacity: 1;
  }
  /* The proof shows points only — drop the connecting grid lines. */
  .fig :global(line) {
    display: none;
  }

  /* Callout arrows overlay — full sheet, drawn in PDF (612×792) space. */
  .arrows {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: visible;
  }
  /* Only the arrow lines (direct children) — NOT the marker's triangle path. */
  .arrows > path {
    fill: none;
    stroke: #222;
    stroke-width: 1.1;
    marker-end: url(#ah);
  }
</style>
