<script lang="ts">
  /**
   * Hand Motions — body page 3, a faithful reproduction of the proof PDF
   * (level-1-v05.pdf, page 9). Text runs sit at the PDF's own coordinates
   * (top-left origin, 612×792pt sheet, ×4/3 to px); multi-line passages render
   * as GROUPED blocks (one box per paragraph, like the original), not
   * per-line runs.
   *
   * Every motion box is a REAL single-hand pictograph through the current
   * renderer — nothing hand-drawn on them:
   *   shift  → PRO W→N / W→S; PictographPreparer's hand-path mode converts to
   *            FLOAT so the arrow pipeline places the canonical float arrows
   *   dash   → DASH W→E; the system dash arrow
   *   static → STATIC at W; no arrow (matching the proof)
   * The blue hand shows the end position (visibleHand="blue").
   *
   * The flowchart is the proof's: one thick line leaves the Start box, runs
   * straight through to the dash row (same height), with a spine splitting up
   * to shift and down to static. Each branch passes UNDER its bold word
   * (underlining it) and ends in a solid arrowhead pointing at the pictograph
   * box itself.
   *
   * The six combination names are two-tone colored from LETTER_TYPE_COLORS —
   * the system's canonical letter-type color code (Type1 Dual-Shift …
   * Type6 Static) — with hairline table dividers between the six cells,
   * matching the original.
   */
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
  import {
    MotionType,
    MotionColor,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { GridMode, GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { LETTER_TYPE_COLORS } from "$lib/shared/pictograph/shared/domain/constants/pictograph-constants";
  import { LetterType } from "$lib/shared/foundation/domain/models/letter-type";
  import { guideEdit, ptDrag, pt, registerEditSource } from "../_data/guide-edit.svelte";

  const S = 816 / 612; // pt → px (4/3)
  const { NORTH: N, EAST: E, SOUTH: SO_, WEST: W } = GridLocation;

  // ── Motion boxes: real single-hand pictographs (blue hand only) ────────────
  // Movers author as PRO/DASH; hand-path mode floats the shifts and the arrow
  // pipeline renders the canonical arrows. Static shows the resting hand only.
  const singleHand = (id: string, type: MotionType, from: GridLocation, to: GridLocation) => ({
    id: `hm-${id}`,
    letter: null,
    gridMode: GridMode.DIAMOND,
    motions: {
      blue: createMotionData({
        motionType: type,
        startLocation: from,
        endLocation: to,
        color: MotionColor.BLUE,
        propType: PropType.HAND,
        gridMode: GridMode.DIAMOND,
      }),
    },
  });

  // 110pt squares, measured off the proof.
  const SIZE = 110;
  const boxes = [
    { x: 60.6, y: 233.1, data: singleHand("start", MotionType.STATIC, W, W) },
    { x: 298.5, y: 134.9, data: singleHand("shift-cw", MotionType.PRO, W, N) },
    { x: 429.8, y: 134.9, data: singleHand("shift-ccw", MotionType.PRO, W, SO_) },
    { x: 298.5, y: 241.1, data: singleHand("dash", MotionType.DASH, W, E) },
    { x: 298.5, y: 348.6, data: singleHand("static", MotionType.STATIC, W, W) },
  ];

  // ── Flowchart (pt) — the proof's thick line + solid arrowheads ─────────────
  // One line leaves the Start box's right edge at its centre and runs straight
  // through to the dash pictograph (same height). A spine splits up to the
  // shift row and down to the static row. Each branch underlines its word and
  // ends in a solid arrowhead pointing at the pictograph box.
  const START_RX = 60.6 + SIZE; // Start box right edge (170.6)
  const START_CY = 233.1 + SIZE / 2; // 288.1 — also the dash branch line
  const SPINE_X = 178;
  const TIP_X = 295.5; // arrowhead tip, just left of the boxes at x 298.5
  const ROWS_Y = [172, START_CY, 401.5]; // shift / dash / static branch lines
  const LINE_W = 2.6;
  const HEAD_L = 9; // solid arrowhead length
  const HEAD_H = 7.4;

  // ── Six combination names — the system's letter-type color code ────────────
  const T1 = LETTER_TYPE_COLORS[LetterType.TYPE1]; // Dual-Shift: cyan, purple
  const T2 = LETTER_TYPE_COLORS[LetterType.TYPE2]; // Shift: purple
  const T3 = LETTER_TYPE_COLORS[LetterType.TYPE3]; // Cross-Shift: green, purple
  const T4 = LETTER_TYPE_COLORS[LetterType.TYPE4]; // Dash: green
  const T5 = LETTER_TYPE_COLORS[LetterType.TYPE5]; // Dual-Dash: blue, green
  const T6 = LETTER_TYPE_COLORS[LetterType.TYPE6]; // Static: orange

  type Combo = { x: number; y: number; w: number; fs: number; segs: { t: string; c: string }[] };
  let COMBOS: Combo[] = $state([
    { x: 99, y: 527.4, w: 114.2, fs: 25, segs: [{ t: "Dual-", c: T1[0] }, { t: "Shift", c: T1[1] }] },
    { x: 417.8, y: 522.1, w: 52.9, fs: 25, segs: [{ t: "Shift", c: T2[0] }] },
    { x: 90.4, y: 611, w: 123.3, fs: 25, segs: [{ t: "Cross-", c: T3[0] }, { t: "Shift", c: T3[1] }] },
    { x: 417, y: 608.5, w: 57.4, fs: 25, segs: [{ t: "Dash", c: T4[0] }] },
    { x: 92.8, y: 708.4, w: 119.5, fs: 25, segs: [{ t: "Dual-", c: T5[0] }, { t: "Dash", c: T5[1] }] },
    { x: 415.8, y: 707.3, w: 64, fs: 25, segs: [{ t: "Static", c: T6[0] }] },
  ]);

  // Table dividers between the six cells (pt), matching the proof's hairlines:
  // a centre vertical through both columns, horizontals between the rows.
  const DIV_X = 306;
  const DIV_TOP = 518;
  const DIV_BOTTOM = 762;
  const DIV_ROWS_Y = [598.5, 695.5];
  const DIV_MARGIN_X = 10;

  // ── Text (pt) ───────────────────────────────────────────────────────────────
  // Grouped centred/left blocks (one draggable box per passage); positioned
  // single-word runs for the flowchart labels. Coordinates from the proof
  // (baseline − fs = top).
  type Para = {
    x: number; // centred blocks: horizontal offset from centred (0 = centred)
    y: number;
    fs: number;
    lh: number;
    html: string;
    left?: boolean; // left-aligned block positioned at x (flowchart captions)
    i?: boolean; // italic
  };
  let PARAS: Para[] = $state([
    {
      x: 0,
      y: 59.7,
      fs: 16,
      lh: 19.2,
      html:
        "There are three fundamental hand motions in the Alphabet.<br>" +
        "The arrow shows the direction of motion.<br>" +
        "The hand shows the end position.",
    },
    { x: 205.3, y: 176.6, fs: 14, lh: 16.8, left: true, i: true, html: "Move to an<br>adjacent point" },
    { x: 206.9, y: 293.7, fs: 14, lh: 16.8, left: true, i: true, html: "Move to the<br>opposite point" },
    { x: 204.7, y: 405.4, fs: 14, lh: 16.8, left: true, i: true, html: "Stay at the<br>current point" },
    {
      x: 0,
      y: 473.7,
      fs: 16,
      lh: 19.2,
      html:
        "Using these, we can derive six combinations, named below.<br>" +
        "We’ll explore each one individually:",
    },
    // Combination descriptions (centred within their cells via x offset).
    { x: -151.7, y: 564, fs: 16, lh: 19.2, html: "Both hands travel to an adjacent point." },
    { x: 136.5, y: 552.2, fs: 16, lh: 19.2, html: "One hand travels to an adjacent point<br>and the other hand remains static." },
    // These two are left-aligned in the proof (both lines share the same x).
    { x: 11.3, y: 642.6, fs: 16, lh: 19.2, left: true, html: "One hand travels to an adjacent point and<br>the other travels to the opposite point." },
    { x: 328.9, y: 645.3, fs: 16, lh: 19.2, left: true, html: "One hand travels to the opposite point<br>and the other hand remains static" },
    { x: -151.7, y: 738.2, fs: 16, lh: 19.2, html: "Both hands travel to the opposite point" },
    { x: 140.7, y: 737.9, fs: 16, lh: 19.2, html: "Both hands remain static." },
  ]);

  type Run = { x: number; y: number; w: number; fs: number; txt: string; b?: boolean; i?: boolean };
  let RUNS: Run[] = $state([
    { x: 100, y: 213.2, w: 31.1, fs: 15, txt: "Start" },
    { x: 216.9, y: 149, w: 39.2, fs: 19, b: true, txt: "shift" },
    { x: 411.6, y: 178.2, w: 12.8, fs: 14, i: true, txt: "or" },
    { x: 212.6, y: 262.5, w: 41.6, fs: 19, b: true, txt: "dash" },
    { x: 209.2, y: 379.1, w: 47.6, fs: 19, b: true, txt: "static" },
  ]);

  // Edit mode: dump coords for CoordsPanel's Copy button.
  const r1 = (n: number) => Math.round(n * 10) / 10;
  $effect(() =>
    registerEditSource("Hand Motions (p3)", () => {
      const P = PARAS.map((p, i) => `  para[${i}]: x: ${r1(p.x)}, y: ${r1(p.y)}`).join("\n");
      const R = RUNS.map((r) => `  ${JSON.stringify(r.txt)}: x: ${r1(r.x)}, y: ${r1(r.y)}`).join("\n");
      const C = COMBOS.map((c) => `  ${JSON.stringify(c.segs.map((s) => s.t).join(""))}: x: ${r1(c.x)}, y: ${r1(c.y)}`).join("\n");
      return `PARAS\n${P}\n\nRUNS\n${R}\n\nCOMBOS\n${C}`;
    })
  );
</script>

<div class="hand-motions">
  <!-- Flowchart: thick trunk + spine + three branches, each underlining its
       word and ending in a solid arrowhead at the pictograph box. -->
  <svg class="connectors" viewBox="0 0 612 792" preserveAspectRatio="none" aria-hidden="true">
    <!-- Start box → spine (the dash branch continues straight through). -->
    <line x1={START_RX} y1={START_CY} x2={SPINE_X} y2={START_CY} />
    <!-- Spine: shift row down to static row. -->
    <line x1={SPINE_X} y1={ROWS_Y[0]} x2={SPINE_X} y2={ROWS_Y[2]} />
    {#each ROWS_Y as ry}
      <line x1={SPINE_X} y1={ry} x2={TIP_X - HEAD_L + 1} y2={ry} />
      <path
        class="head"
        d="M {TIP_X - HEAD_L} {ry - HEAD_H / 2} L {TIP_X} {ry} L {TIP_X - HEAD_L} {ry + HEAD_H / 2} Z"
      />
    {/each}
  </svg>

  <!-- 5 real single-hand pictographs (canonical float / dash arrows). -->
  {#each boxes as box (box.data.id)}
    <div
      class="mini"
      style="left:{box.x * S}px; top:{box.y * S}px; width:{SIZE * S}px; height:{SIZE * S}px"
    >
      <PictographContainer
        pictographData={box.data}
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
    </div>
  {/each}

  <!-- Table dividers between the six combination cells. -->
  <svg class="dividers" viewBox="0 0 612 792" preserveAspectRatio="none" aria-hidden="true">
    <line x1={DIV_X} y1={DIV_TOP} x2={DIV_X} y2={DIV_BOTTOM} />
    {#each DIV_ROWS_Y as dy}
      <line x1={DIV_MARGIN_X} y1={dy} x2={612 - DIV_MARGIN_X} y2={dy} />
    {/each}
  </svg>

  <!-- Six combination names: two-tone via the canonical letter-type colors. -->
  {#each COMBOS as combo, i (i)}
    <span
      class="combo"
      class:edit={guideEdit.on}
      class:selected={guideEdit.selectedId === `hm-combo-${i}`}
      style="left:{combo.x * S}px; top:{combo.y * S}px; width:{combo.w * S}px; font-size:{combo.fs * S}px"
      use:ptDrag={pt(`hm-combo-${i}`, combo.segs.map((s) => s.t).join(""), combo)}
    >
      {#each combo.segs as seg}<span style="color:{seg.c}">{seg.t}</span>{/each}
    </span>
  {/each}

  <!-- Grouped text blocks. -->
  {#each PARAS as p, i (i)}
    <p
      class="para"
      class:left={p.left}
      class:i={p.i}
      class:edit={guideEdit.on}
      class:selected={guideEdit.selectedId === `hm-para-${i}`}
      style={p.left
        ? `left:${p.x * S}px; top:${p.y * S}px; font-size:${p.fs * S}px; line-height:${p.lh * S}px`
        : `transform: translateX(${p.x * S}px); top:${p.y * S}px; font-size:${p.fs * S}px; line-height:${p.lh * S}px`}
      use:ptDrag={pt(`hm-para-${i}`, "paragraph", p)}
    >
      {@html p.html}
    </p>
  {/each}

  <!-- Positioned single-word runs (flowchart labels). -->
  {#each RUNS as r, i (i)}
    <span
      class="run"
      class:b={r.b}
      class:i={r.i}
      class:edit={guideEdit.on}
      class:selected={guideEdit.selectedId === `hm-run-${i}`}
      style="left:{r.x * S}px; top:{r.y * S}px; width:{r.w * S}px; font-size:{r.fs * S}px"
      use:ptDrag={pt(`hm-run-${i}`, r.txt, r)}
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
    font-family: "Cambria", Georgia, "Times New Roman", serif;
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

  /* Grouped passages: centred blocks span the sheet; .left blocks anchor at x
     (the flowchart captions, left-aligned like the proof). */
  .para {
    position: absolute;
    left: 0;
    right: 0;
    margin: 0;
    text-align: center;
    font-family: "Cambria", Georgia, "Times New Roman", serif;
  }
  .para.left {
    right: auto;
    text-align: left;
  }
  .para.i {
    font-style: italic;
  }

  /* Two-tone combination names — bold, canonical letter-type colors inline. */
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

  /* Flowchart — thick ink lines + solid arrowheads, proof style. */
  .connectors {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: visible;
  }
  .connectors line {
    stroke: #1c1c1f;
    stroke-width: 2.6;
  }
  .connectors .head {
    fill: #1c1c1f;
  }

  /* Combination-table hairlines. */
  .dividers {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  .dividers line {
    stroke: #9a9aa4;
    stroke-width: 0.8;
  }

  /* ── Edit mode affordances ─────────────────────────────────────────────── */
  .run.edit,
  .para.edit,
  .combo.edit {
    outline: 1px dashed rgba(55, 48, 163, 0.4);
    cursor: move;
  }
  .run.selected,
  .para.selected,
  .combo.selected {
    outline: 1.5px solid #3730a3;
    outline-offset: 1px;
  }
</style>
