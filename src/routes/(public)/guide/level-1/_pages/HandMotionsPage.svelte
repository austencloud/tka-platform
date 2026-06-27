<script lang="ts">
  /**
   * Hand Motions — body page 3, a faithful reproduction of the proof PDF
   * (level-1-v05.pdf, page 9). Text runs + the 5 motion boxes are DATA-DRIVEN
   * from the PDF's own coordinates (110pt squares).
   *
   * The sheet is 816×1056px (8.5×11in @96dpi), 1pt = 4/3px. Root is an absolute
   * layer over the whole GuidePage so coordinates map straight to the sheet. The
   * page renders fullBleed (no GuidePage header) — the title is a positioned run.
   *
   * Each motion box is a REAL single-hand pictograph: the canonical grid + the
   * blue prop-hand placed at the END location via a `static` motion, rendered
   * through PictographContainer with `visibleHand="blue"` (the renderer filters
   * the absent red hand out entirely). The blue hand shows the end position; a
   * straight teaching arrow — open chevron head, matching the proof's marker
   * arrows — is overlaid in the grid's 950 viewBox space (endpoints traced off
   * the proof). The proof uses straight directional arrows, NOT the curved
   * pro/anti pictograph arrows, so no motion-type ambiguity arises.
   *
   * Type styling mirrors the proof exactly: shift/dash/static are BOLD upright,
   * their captions are ITALIC, and the six combination names are two-tone colored
   * (prefix = compound-type color, base word = base-motion color) using the print
   * guide's own type colors from _styles/guide.css. printMode = white sheet.
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
  // arrow = teaching-arrow key (or null for Start / static, which show no arrow).
  const SIZE = 110;
  type ArrowKey = "n" | "s" | "e";
  type Box = { x: number; y: number; loc: GridLocation; arrow: ArrowKey | null };
  const boxes: Box[] = [
    { x: 60.6, y: 233.1, loc: GridLocation.WEST, arrow: null }, // Start (rest at W)
    { x: 298.5, y: 134.9, loc: GridLocation.NORTH, arrow: "n" }, // shift  W→N
    { x: 429.8, y: 134.9, loc: GridLocation.SOUTH, arrow: "s" }, // shift  W→S
    { x: 298.5, y: 241.1, loc: GridLocation.EAST, arrow: "e" }, // dash   W→E
    { x: 298.5, y: 348.6, loc: GridLocation.WEST, arrow: null }, // static (stay W)
  ];

  // Teaching-arrow endpoints in the 950 grid viewBox, traced off the proof: a
  // straight shaft offset to clear the hand (shift up-left, dash low), drawn with
  // an OPEN CHEVRON head like the proof's marker arrows.
  const ARROWS: Record<ArrowKey, { x1: number; y1: number; x2: number; y2: number }> = {
    n: { x1: 215, y1: 400, x2: 392, y2: 208 }, // W→N
    s: { x1: 215, y1: 550, x2: 392, y2: 742 }, // W→S
    e: { x1: 352, y1: 618, x2: 582, y2: 618 }, // W→E
  };
  const ARROW_W = 22; // shaft + chevron stroke width (950 space)
  const HEAD_LEN = 92;
  const HEAD_ANG = 0.52; // ~30° half-angle of the open chevron

  // Open-chevron head path ("M barb1 L tip L barb2") for an arrow x1,y1→x2,y2.
  function chevron(a: { x1: number; y1: number; x2: number; y2: number }): string {
    const dx = a.x2 - a.x1;
    const dy = a.y2 - a.y1;
    const L = Math.hypot(dx, dy) || 1;
    const bx = -dx / L; // back direction (tip → tail)
    const by = -dy / L;
    const ca = Math.cos(HEAD_ANG);
    const sa = Math.sin(HEAD_ANG);
    const p1x = a.x2 + (bx * ca - by * sa) * HEAD_LEN;
    const p1y = a.y2 + (bx * sa + by * ca) * HEAD_LEN;
    const p2x = a.x2 + (bx * ca + by * sa) * HEAD_LEN;
    const p2y = a.y2 + (-bx * sa + by * ca) * HEAD_LEN;
    return `M ${p1x.toFixed(1)} ${p1y.toFixed(1)} L ${a.x2} ${a.y2} L ${p2x.toFixed(1)} ${p2y.toFixed(1)}`;
  }

  // ── Flowchart connectors (pt) — Start box branches into the three rows, each
  // branch ending in a right-pointing arrowhead at the label (matching proof). ─
  const START_RX = 60.6 + SIZE; // Start box right edge
  const START_CY = 233.1 + SIZE / 2; // Start box vertical centre
  const SPINE_X = 188;
  const ROWS_Y = [159, 272, 389]; // shift / dash / static label centres
  const STUB_X = 200;

  // ── Six combination names — two-tone, using the print guide's type colors
  // (_styles/guide.css). Prefix = compound-type color, base word = base color. ─
  const C = {
    dualShift: "oklch(0.72 0.15 220)",
    shift: "oklch(0.65 0.15 280)",
    crossShift: "oklch(0.70 0.15 160)",
    dash: "oklch(0.72 0.15 60)",
    dualDash: "oklch(0.70 0.15 190)",
    static: "oklch(0.60 0.02 270)",
  };
  type Combo = { x: number; y: number; w: number; fs: number; segs: { t: string; c: string }[] };
  const COMBOS: Combo[] = [
    { x: 99, y: 527.4, w: 114.2, fs: 25, segs: [{ t: "Dual-", c: C.dualShift }, { t: "Shift", c: C.shift }] },
    { x: 417.8, y: 522.1, w: 52.9, fs: 25, segs: [{ t: "Shift", c: C.shift }] },
    { x: 90.4, y: 611, w: 123.3, fs: 25, segs: [{ t: "Cross-", c: C.crossShift }, { t: "Shift", c: C.shift }] },
    { x: 417, y: 608.5, w: 57.4, fs: 25, segs: [{ t: "Dash", c: C.dash }] },
    { x: 92.8, y: 708.4, w: 119.5, fs: 25, segs: [{ t: "Dual-", c: C.dualDash }, { t: "Dash", c: C.dash }] },
    { x: 415.8, y: 707.3, w: 64, fs: 25, segs: [{ t: "Static", c: C.static }] },
  ];

  type Run = {
    x: number;
    y: number;
    w: number;
    fs: number;
    txt: string;
    t?: boolean; // page title (display serif italic)
    b?: boolean; // bold body term (shift / dash / static)
    i?: boolean; // italic body term (captions, "or")
  };

  const RUNS: Run[] = [
    { x: 208.9, y: 10.6, w: 208, fs: 40, t: true, txt: "Hand Motions" },

    // Intro (centred)
    { x: 105.7, y: 59.7, w: 404.8, fs: 16, txt: "There are three fundamental hand motions in the Alphabet." },
    { x: 167.2, y: 78.9, w: 281.7, fs: 16, txt: "The arrow shows the direction of motion." },
    { x: 193.9, y: 98.1, w: 228.4, fs: 16, txt: "The hand shows the end position." },

    // Flowchart: bold labels, italic captions
    { x: 100, y: 213.2, w: 31.1, fs: 15, txt: "Start" },
    { x: 216.9, y: 149, w: 39.2, fs: 19, b: true, txt: "shift" },
    { x: 205.3, y: 176.6, w: 63.6, fs: 14, i: true, txt: "Move to an" },
    { x: 205.3, y: 193.4, w: 84.1, fs: 14, i: true, txt: "adjacent point" },
    { x: 411.6, y: 178.2, w: 12.8, fs: 14, i: true, txt: "or" },
    { x: 212.6, y: 262.5, w: 41.6, fs: 19, b: true, txt: "dash" },
    { x: 206.9, y: 293.7, w: 67.4, fs: 14, i: true, txt: "Move to the" },
    { x: 206.9, y: 310.5, w: 82.9, fs: 14, i: true, txt: "opposite point" },
    { x: 209.2, y: 379.1, w: 47.6, fs: 19, b: true, txt: "static" },
    { x: 204.7, y: 405.4, w: 62.1, fs: 14, i: true, txt: "Stay at the" },
    { x: 204.7, y: 422.2, w: 77.2, fs: 14, i: true, txt: "current point" },

    // Six combination descriptions (names rendered separately, two-tone)
    { x: 23.2, y: 564, w: 262.3, fs: 16, txt: "Both hands travel to an adjacent point." },
    { x: 314.8, y: 552.2, w: 253.4, fs: 16, txt: "One hand travels to an adjacent point" },
    { x: 326.9, y: 571.4, w: 232.7, fs: 16, txt: "and the other hand remains static." },
    { x: 11.3, y: 642.6, w: 282.6, fs: 16, txt: "One hand travels to an adjacent point and" },
    { x: 11.3, y: 661.8, w: 261.1, fs: 16, txt: "the other travels to the opposite point." },
    { x: 328.9, y: 645.3, w: 260, fs: 16, txt: "One hand travels to the opposite point" },
    { x: 328.9, y: 664.5, w: 229.5, fs: 16, txt: "and the other hand remains static" },
    { x: 21.7, y: 738.2, w: 265.3, fs: 16, txt: "Both hands travel to the opposite point" },
    { x: 360, y: 737.9, w: 173.4, fs: 16, txt: "Both hands remain static." },
  ];
</script>

<div class="hand-motions">
  <!-- Flowchart connectors (drawn first, beneath the boxes + text). Each branch
       ends in a right-pointing arrowhead at its label. -->
  <svg class="connectors" viewBox="0 0 612 792" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <marker id="hmBranch" markerWidth="6" markerHeight="6" refX="4.6" refY="3" orient="auto">
        <path d="M0,0 L5.5,3 L0,6 Z" fill="#2c2e35" />
      </marker>
    </defs>
    <path class="trunk" d="M{START_RX},{START_CY} L{SPINE_X},{START_CY}" />
    <path class="trunk" d="M{SPINE_X},{ROWS_Y[0]} L{SPINE_X},{ROWS_Y[2]}" />
    {#each ROWS_Y as ry}
      <path class="branch" d="M{SPINE_X},{ry} L{STUB_X},{ry}" marker-end="url(#hmBranch)" />
    {/each}
  </svg>

  <!-- 5 single-hand motion pictographs (grid + blue hand at end) + chevron arrows. -->
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
        {@const a = ARROWS[box.arrow]}
        <svg class="arrow" viewBox="0 0 950 950" aria-hidden="true">
          <line
            x1={a.x1}
            y1={a.y1}
            x2={a.x2}
            y2={a.y2}
            stroke={B}
            stroke-width={ARROW_W}
            stroke-linecap="round"
          />
          <path d={chevron(a)} fill="none" stroke={B} stroke-width={ARROW_W} stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      {/if}
    </div>
  {/each}

  <!-- Six combination names: two-tone colored, bold. -->
  {#each COMBOS as combo (combo.x + "-" + combo.y)}
    <span
      class="combo"
      style="left:{combo.x * S}px; top:{combo.y * S}px; width:{combo.w * S}px; font-size:{combo.fs * S}px"
    >
      {#each combo.segs as seg}<span style="color:{seg.c}">{seg.t}</span>{/each}
    </span>
  {/each}

  {#each RUNS as r}
    <span
      class="run"
      class:t={r.t}
      class:b={r.b}
      class:i={r.i}
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
  .run.i {
    font-style: italic;
  }
  /* Page title — the book's display serif (matches The Grid / Hand Positions). */
  .run.t {
    font-family: "Cormorant Garamond", Georgia, serif;
    font-style: italic;
    font-weight: 600;
    color: #14142b;
  }

  /* Two-tone combination names — bold sans, color per segment (set inline). */
  .combo {
    position: absolute;
    font-family: ui-sans-serif, system-ui, "Segoe UI", sans-serif;
    font-weight: 700;
    line-height: 1;
    white-space: nowrap;
    text-align: center;
  }

  .mini {
    position: absolute;
    border: 1px solid #c4c4cc;
    box-sizing: border-box;
  }

  /* Straight teaching arrow overlay, drawn in the grid's 950 viewBox space. */
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
