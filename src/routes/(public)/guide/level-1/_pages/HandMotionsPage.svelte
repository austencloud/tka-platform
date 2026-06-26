<script lang="ts">
  /**
   * Hand Motions — body page 3, a faithful reproduction of the proof PDF
   * (level-1-v05.pdf, page 9). Text runs are DATA-DRIVEN from the PDF's own
   * coordinates; the 5 motion boxes were measured straight off the rendered proof
   * (110pt squares).
   *
   * The sheet is 816×1056px (8.5×11in @96dpi), 1pt = 4/3px. Root is an absolute
   * layer over the whole GuidePage so coordinates map straight to the sheet. The
   * page renders fullBleed (no GuidePage header) — the title is a positioned run.
   *
   * Each motion box is a REAL single-hand pictograph: the canonical grid +
   * the blue prop-hand placed at the END location via a `static` motion, rendered
   * through PictographContainer with `visibleHand="blue"` (the renderer filters
   * the absent red hand out entirely — PictographRenderer.svelte). The blue hand
   * shows the end position; a STRAIGHT teaching arrow is overlaid in the grid's
   * 950 viewBox space (W hand-point → destination hand-point), the same overlay
   * technique The Grid page uses for its callout arrows. The proof's diagrams use
   * straight directional arrows, NOT the curved pro/anti pictograph arrows, so no
   * motion-type ambiguity arises. printMode = white sheet, darkMode = false.
   */
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
  import {
    MotionType,
    MotionColor,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { GridMode, GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

  const S = 816 / 612; // pt → px (4/3)

  const B = "#2e3192"; // blue = left hand + teaching arrow
  const INK = "#2c2e35"; // flowchart connector ink (matches proof stroke)

  // ── Diamond hand-point coordinates in the 950 pictograph viewBox ───────────
  // (from grid-coordinates.ts). The straight teaching arrows are drawn between
  // these so they land exactly on the grid's hand points.
  const HP: Record<"n" | "e" | "s" | "w", [number, number]> = {
    n: [475.0, 331.9],
    e: [618.1, 475.0],
    s: [475.0, 618.1],
    w: [331.9, 475.0],
  };

  // A single blue prop-hand resting (static) at one hand point. No red hand.
  const blueHandAt = (loc: GridLocation) => ({
    id: `hm-${loc}`,
    gridMode: GridMode.DIAMOND,
    motions: {
      blue: createMotionData({
        motionType: MotionType.STATIC,
        startLocation: loc,
        endLocation: loc,
        color: MotionColor.BLUE,
        propType: PropType.HAND,
        gridMode: GridMode.DIAMOND,
      }),
    },
  });

  // ── Motion boxes, measured off the proof (pt). 110pt squares. ──────────────
  // arrow = destination hand-point key (W → arrow) or null (Start / static).
  const SIZE = 110;
  type Box = { x: number; y: number; loc: GridLocation; arrow: "n" | "e" | "s" | null };
  const boxes: Box[] = [
    { x: 60.6, y: 233.1, loc: GridLocation.WEST, arrow: null }, // Start (rest at W)
    { x: 298.5, y: 134.9, loc: GridLocation.NORTH, arrow: "n" }, // shift  W→N
    { x: 429.8, y: 134.9, loc: GridLocation.SOUTH, arrow: "s" }, // shift  W→S
    { x: 298.5, y: 241.1, loc: GridLocation.EAST, arrow: "e" }, // dash   W→E
    { x: 298.5, y: 348.6, loc: GridLocation.WEST, arrow: null }, // static (stay W)
  ];

  // Straight teaching arrow geometry in 950 space: from the W hand-point toward
  // the destination hand-point, drawn 70% of the way so the chevron clears the
  // hand sitting at the destination. Returns shaft endpoints + head polygon.
  const FRAC = 0.72;
  const HEAD_LEN = 78;
  const HEAD_W = 92;
  function arrow(destKey: "n" | "e" | "s") {
    const [ax, ay] = HP.w;
    const [bx, by] = HP[destKey];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;
    const tipX = ax + dx * FRAC;
    const tipY = ay + dy * FRAC;
    const baseX = tipX - ux * HEAD_LEN;
    const baseY = tipY - uy * HEAD_LEN;
    const px = -uy;
    const py = ux;
    return {
      x1: ax,
      y1: ay,
      x2: baseX,
      y2: baseY,
      head: `${tipX},${tipY} ${baseX + (px * HEAD_W) / 2},${baseY + (py * HEAD_W) / 2} ${baseX - (px * HEAD_W) / 2},${baseY - (py * HEAD_W) / 2}`,
    };
  }

  // ── Flowchart connectors (pt) — Start box branches into the three rows. ────
  // Trunk from the Start box's right-center to a vertical spine, then a stub to
  // each branch label. Dark ink + 2pt to match the proof's connector strokes.
  const START_RX = 60.6 + SIZE; // Start box right edge
  const START_CY = 233.1 + SIZE / 2; // Start box vertical centre
  const SPINE_X = 188;
  const ROWS_Y = [159, 270, 388]; // shift / dash / static label rows
  const STUB_X = 200;

  type Run = {
    x: number;
    y: number;
    w: number;
    fs: number;
    txt: string;
    t?: boolean; // page title (display serif)
    disp?: boolean; // display serif label (motion names, combination names)
    b?: boolean; // bold body term
  };

  const RUNS: Run[] = [
    { x: 208.9, y: 10.6, w: 208, fs: 40, t: true, txt: "Hand Motions" },

    // Intro (centred)
    { x: 105.7, y: 59.7, w: 404.8, fs: 16, txt: "There are three fundamental hand motions in the Alphabet." },
    { x: 167.2, y: 78.9, w: 281.7, fs: 16, txt: "The arrow shows the direction of motion." },
    { x: 193.9, y: 98.1, w: 228.4, fs: 16, txt: "The hand shows the end position." },

    // Flowchart
    { x: 100, y: 213.2, w: 31.1, fs: 15, txt: "Start" },
    { x: 216.9, y: 149, w: 39.2, fs: 19, disp: true, txt: "shift" },
    { x: 205.3, y: 176.6, w: 63.6, fs: 14, b: true, txt: "Move to an" },
    { x: 205.3, y: 193.4, w: 84.1, fs: 14, b: true, txt: "adjacent point" },
    { x: 411.6, y: 178.2, w: 12.8, fs: 14, b: true, txt: "or" },
    { x: 212.6, y: 262.5, w: 41.6, fs: 19, disp: true, txt: "dash" },
    { x: 206.9, y: 293.7, w: 67.4, fs: 14, b: true, txt: "Move to the" },
    { x: 206.9, y: 310.5, w: 82.9, fs: 14, b: true, txt: "opposite point" },
    { x: 209.2, y: 379.1, w: 47.6, fs: 19, disp: true, txt: "static" },
    { x: 204.7, y: 405.4, w: 62.1, fs: 14, b: true, txt: "Stay at the" },
    { x: 204.7, y: 422.2, w: 77.2, fs: 14, b: true, txt: "current point" },

    // Six combinations (2 columns × 3 rows, text only)
    { x: 99, y: 527.4, w: 114.2, fs: 25, disp: true, txt: "Dual-Shift" },
    { x: 23.2, y: 564, w: 262.3, fs: 16, txt: "Both hands travel to an adjacent point." },
    { x: 417.8, y: 522.1, w: 52.9, fs: 25, disp: true, txt: "Shift" },
    { x: 314.8, y: 552.2, w: 253.4, fs: 16, txt: "One hand travels to an adjacent point" },
    { x: 326.9, y: 571.4, w: 232.7, fs: 16, txt: "and the other hand remains static." },

    { x: 90.4, y: 611, w: 123.3, fs: 25, disp: true, txt: "Cross-Shift" },
    { x: 11.3, y: 642.6, w: 282.6, fs: 16, txt: "One hand travels to an adjacent point and" },
    { x: 11.3, y: 661.8, w: 261.1, fs: 16, txt: "the other travels to the opposite point." },
    { x: 417, y: 608.5, w: 57.4, fs: 25, disp: true, txt: "Dash" },
    { x: 328.9, y: 645.3, w: 260, fs: 16, txt: "One hand travels to the opposite point" },
    { x: 328.9, y: 664.5, w: 229.5, fs: 16, txt: "and the other hand remains static" },

    { x: 92.8, y: 708.4, w: 119.5, fs: 25, disp: true, txt: "Dual-Dash" },
    { x: 21.7, y: 738.2, w: 265.3, fs: 16, txt: "Both hands travel to the opposite point" },
    { x: 415.8, y: 707.3, w: 64, fs: 25, disp: true, txt: "Static" },
    { x: 360, y: 737.9, w: 173.4, fs: 16, txt: "Both hands remain static." },
  ];
</script>

<div class="hand-motions">
  <!-- Flowchart connectors (drawn first, beneath the boxes + text). -->
  <svg class="connectors" viewBox="0 0 612 792" preserveAspectRatio="none" aria-hidden="true">
    <path d="M{START_RX},{START_CY} L{SPINE_X},{START_CY}" />
    <path d="M{SPINE_X},{ROWS_Y[0]} L{SPINE_X},{ROWS_Y[2]}" />
    {#each ROWS_Y as ry}
      <path d="M{SPINE_X},{ry} L{STUB_X},{ry}" />
    {/each}
  </svg>

  <!-- 5 single-hand motion pictographs (grid + blue hand at end) + straight arrows. -->
  {#each boxes as box (box.x + "-" + box.y)}
    <div
      class="mini"
      style="left:{box.x * S}px; top:{box.y * S}px; width:{SIZE * S}px; height:{SIZE * S}px"
    >
      <PictographContainer
        pictographData={blueHandAt(box.loc)}
        gridMode={GridMode.DIAMOND}
        bluePropTypeOverride={PropType.HAND}
        redPropTypeOverride={PropType.HAND}
        visibleHand="blue"
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
      {#if box.arrow}
        {@const a = arrow(box.arrow)}
        <svg class="arrow" viewBox="0 0 950 950" aria-hidden="true">
          <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke={B} stroke-width="26" stroke-linecap="round" />
          <polygon points={a.head} fill={B} />
        </svg>
      {/if}
    </div>
  {/each}

  {#each RUNS as r}
    <span
      class="run"
      class:t={r.t}
      class:disp={r.disp}
      class:b={r.b}
      style="left:{r.x * S}px; top:{r.y * S}px; width:{r.w * S}px; font-size:{r.fs * S}px"
      >{r.txt}</span
    >
  {/each}
</div>

<style>
  /* Absolute layer over the whole GuidePage sheet; coords map straight to pt×S. */
  .hand-motions {
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
  /* Display serif (motion labels + combination names) + the page title — the
     book's header typeface, matching The Grid's script headings. */
  .run.disp,
  .run.t {
    font-family: "Cormorant Garamond", Georgia, serif;
    font-style: italic;
    font-weight: 600;
  }
  .run.t {
    color: #14142b;
  }

  .mini {
    position: absolute;
    border: 1px solid #c4c4cc;
    box-sizing: border-box;
  }

  /* Straight teaching arrow overlay, drawn in the grid's 950 viewBox space so it
     aligns with the hand points beneath it. */
  .arrow {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: visible;
  }

  /* Flowchart connectors — full sheet, drawn in PDF (612×792) space. */
  .connectors {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: visible;
  }
  .connectors path {
    fill: none;
    stroke: #2c2e35;
    stroke-width: 1.6;
  }
</style>
