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
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import { startPositionManager } from "$lib/shared/create/services/start-position-manager";
  import { GridMode, GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

  const S = 816 / 612; // pt → px (4/3)

  // The labelled diagram's two hands ARE a real pictograph: ALPHA3 (blue hand at
  // West, red hand at East) rendered with the prop forced to HAND, so the hand
  // size and the red right-hand mirror come from the canonical renderer instead
  // of a hand-rolled SVG path.
  const ALPHA3_RAW = startPositionManager
    .getAllStartPositionVariations(GridMode.DIAMOND)
    .find((p) => p.startPosition === GridPosition.ALPHA3);
  // Force the motions' prop to HAND so the prepared motion carries HAND (what
  // PropSvg's red-hand mirror reads); the manager bakes STAFF by default.
  const ALPHA3 = ALPHA3_RAW
    ? {
        ...ALPHA3_RAW,
        motions: {
          blue: ALPHA3_RAW.motions?.blue
            ? { ...ALPHA3_RAW.motions.blue, propType: PropType.HAND }
            : undefined,
          red: ALPHA3_RAW.motions?.red
            ? { ...ALPHA3_RAW.motions.red, propType: PropType.HAND }
            : undefined,
        },
      }
    : undefined;

  type Run = { x: number; y: number; w: number; h: number; t: string; b?: boolean; s?: boolean; title?: boolean; op?: boolean };

  // Text runs extracted from PDF p7 (coords = top-left origin, points).
  // b = bold (g_d0_f2), s = script heading (g_d0_f4), title = page title.
  const RUNS: Run[] = [
    // Centered intro block
    { x: 144.7, y: 78.2, w: 322.4, h: 16, t: "The Kinetic Alphabet is based on a 4-point grid." },
    { x: 105.5, y: 116.6, w: 400.8, h: 16, t: "There are two 4-point grids: box mode and diamond mode." },
    { x: 64.9, y: 135.8, w: 482.1, h: 16, b: true, t: "This guide is written in diamond, but everything translates to box." },
    { x: 157.7, y: 174.2, w: 296.4, h: 16, t: "On this grid, there are three types of points:" },

    // Left descriptive column lives in PARAS (single selectable blocks).

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

    // Operators between the bottom minis: Diamond + Box = 8-point grid.
    // Centred in the gaps (minis at x 35.5 / 225 / 414.5) on the mini mid-line.
    { x: 190, y: 650, w: 40, h: 34, op: true, t: "+" },
    { x: 379.5, y: 650, w: 40, h: 34, op: true, t: "=" },

    // Footer line
    { x: 116.5, y: 760.9, w: 379.0, h: 19, t: "We’ll use diamond mode to learn each concept." },
  ];

  // The three point descriptions as SINGLE selectable text blocks (bold term
  // inline, explicit line breaks) — not per-word runs that fragment + gap when
  // selected. Positioned at the proof's first-line origin; lh = proof line pitch.
  const PARAS = [
    { x: 30.7, y: 239.1, w: 255, lh: 20.4, html: "The <strong>center point</strong> is the hub that<br>everything revolves around." },
    { x: 30.7, y: 331.0, w: 255, lh: 20.4, html: "The four <strong>hand points</strong> are halfway<br>between the center point and the<br>outer points." },
    { x: 30.7, y: 440.7, w: 255, lh: 20.4, html: "The <strong>outer points</strong> depict the outer<br>edges of the grid." },
  ];

  // Central diagram box (pt, square so the grid stays round) + bottom grid boxes.
  // Measured off the proof: the figure's center lands at (444.3, 360.8)pt with an
  // outer-point radius of 94.75pt, i.e. a 300pt-square 950-viewBox fit at this
  // origin. Matching it puts every grid dot exactly where the proof's are, so the
  // straight callout arrows below line up with the real pictograph's points.
  const DIAG = { x: 294.3, y: 210.8, w: 300, h: 300 };
  // Bottom minis measured off the proof: 159.5pt squares at x 35.5 / 225 / 414.5,
  // top y589 (bottom 748.5, ~12pt above the footer — the proof's tight, even gap).
  const MINI = { y: 589, w: 159.5, h: 159.5 };
  const minis: { x: number; type: "diamond" | "box" | "merged" }[] = [
    { x: 35.5, type: "diamond" },
    { x: 225, type: "box" },
    { x: 414.5, type: "merged" },
  ];
</script>

<!-- A square grid figure: white sheet + canonical GridSvg forced to ink (light
     mode). `hands` overlays the two prop hands on the diamond's W/E hand points. -->
{#snippet figure(type: "diamond" | "box" | "merged")}
  <svg class="fig" viewBox="0 0 950 950">
    <rect width="950" height="950" fill="#ffffff" />
    {#if type === "merged"}
      <GridSvg gridMode={GridMode.DIAMOND} darkMode={false} />
      <GridSvg gridMode={GridMode.BOX} darkMode={false} />
    {:else}
      <GridSvg gridMode={type === "box" ? GridMode.BOX : GridMode.DIAMOND} darkMode={false} />
    {/if}
  </svg>
{/snippet}

<div class="grid-page">
  <!-- Figures first so their white sheets sit BENEATH the text + arrows. -->
  <div
    class="diagram"
    style="left:{DIAG.x * S}px; top:{DIAG.y * S}px; width:{DIAG.w * S}px; height:{DIAG.h * S}px"
  >
    {#if ALPHA3}
      <PictographContainer
        pictographData={ALPHA3}
        gridMode={GridMode.DIAMOND}
        bluePropTypeOverride={PropType.HAND}
        redPropTypeOverride={PropType.HAND}
        showGrid={true}
        showTKA={false}
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
    {/if}
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
      class:op={r.op}
      style="left:{r.x * S}px; top:{r.y * S}px; width:{r.w * S}px; font-size:{r.h * S}px"
      >{r.t}</span
    >
  {/each}

  <!-- Point descriptions as single selectable blocks (bold term + line breaks). -->
  {#each PARAS as p}
    <p
      class="para"
      style="left:{p.x * S}px; top:{p.y * S}px; width:{p.w * S}px; font-size:{17 * S}px; line-height:{p.lh * S}px"
    >
      {@html p.html}
    </p>
  {/each}

  <!-- Callout arrows, drawn directly in PDF coordinate space (612×792), on top. -->
  <svg class="arrows" viewBox="0 0 612 792" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <marker id="ah" markerWidth="7" markerHeight="7" refX="5.5" refY="3" orient="auto">
        <path d="M0,0 L6,3 L0,6 Z" fill="#222" />
      </marker>
    </defs>
    <!-- "hand points" → the two hand points. Tails start just under the LABEL
         (y≈310, below the "points" text at ~308) and fork outward around the N
         hand-point dot, so they read as coming from the text, not the dot. -->
    <path d="M444,310 L410.4,337.2" />
    <path d="M449,310 L479.6,337.3" />
    <!-- "center point" → center dot (straight, up-right, head reaching the dot) -->
    <path d="M415,390 L439,368" />
    <!-- "outer points" → east + south outer points (two arrows, tails clear of the label) -->
    <path d="M518,420 L532,377" />
    <path d="M505,443 L462,450" />
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
  /* Point descriptions: one flowing block each (selectable as a unit), same
     serif as the runs; bold term inline, line breaks explicit. */
  .para {
    position: absolute;
    margin: 0;
    font-family: "Times New Roman", Times, Georgia, serif;
    color: #141414;
    text-align: left;
  }
  /* The + / = operators between the bottom minis — heavy, centred in their box. */
  .run.op {
    text-align: center;
    font-weight: 700;
    color: #1a1a1a;
  }
  /* Section headings (Diamond / Box / 8-point grid) — display serif (unchanged). */
  .run.s {
    font-family: var(--guide-display);
    font-style: italic;
    font-weight: 600;
  }
  /* Page title is the shared .guide-title (guide.css) — no per-page title rule. */

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
