<script lang="ts">
  /**
   * Gamma — γ→γ Quarter-Opp / Quarter-Same — body page 5, a faithful rebuild of
   * the proof PDF (level-1-v05.pdf, page 11) in the CURRENT renderer's language.
   * Nothing on the pictographs is hand-drawn — every adornment is the system's:
   *
   *   - Hand motion   → real FLOAT motions (author as PRO shift; because both
   *                     props are HAND, PictographPreparer's hand-path mode makes
   *                     them floats and the arrow pipeline draws the system arrow).
   *   - Count numbers → StepData.stepNumber (0 → "Start", 1..n numerals) via the
   *                     renderer's top-left StepNumber overlay.
   *   - Positions     → startPosition/endPosition (getGridPositionFromLocations)
   *                     → the top-centre γ→γ PositionGlyph.
   *   - Mode          → bottom-right ElementalGlyph, derived GEOMETRICALLY by the
   *                     TnD deriver (deriveTnD is letter-free and classifies both
   *                     gamma halves + the quarter modes), so no letter is needed.
   *
   * Letters are left null on every box: the position + TnD derivers are purely
   * geometric, and no gamma box has both hands on an identical from→end path
   * (they stay 90° apart), so the default float placement separates every arrow —
   * the special-placement tier that the α/β Tog rows needed does not apply here.
   *
   * Geometry comes from the proof's own image placements + text runs (extracted
   * from the PDF operator list). Strips (pt, top-left origin):
   *   QO   L90.6 T124   500×100  (Start + 4)
   *   QS   L90   T279.2 500×100  (Start + 4)
   *   swap L56.2 T512.9 500×200  (5×2 grid — Start,1..4 / _,5..8; box 5 under 1)
   * Text y = baseline − fs (the proof's convention); the row-label glyph line
   * (γ→γ, dropped by the glyph-font extraction) sits 21.7pt above the mode name.
   *
   * Sequences decoded from the artboard and cross-checked with MCP VTG data:
   *   QO = opposite-spin, 90°-apart loop; its four counts are Parallel /
   *        Antiparallel / Parallel / Antiparallel (the column headers).
   *   QS = same-spin, 90°-out-of-phase loop (red leads blue by one point).
   *   swap = alternates QO/QS each count and closes back to Start.
   */
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
  import {
    MotionType,
    MotionColor,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { GridMode, GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { getGridPositionFromLocations } from "$lib/shared/pictograph/grid/services/grid-position-deriver";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import { guideEdit, ptDrag, pt, registerEditSource } from "../_data/guide-edit.svelte";

  const S = 816 / 612; // pt → px (4/3)
  const { NORTH: N, EAST: E, SOUTH: SO_, WEST: W } = GridLocation;

  // A hand that moves → PRO shift (hand-path mode converts to FLOAT); a hand that
  // stays → STATIC (no arrow). Positions/elemental/numbers all derive downstream.
  const motion = (color: MotionColor, from: GridLocation, to: GridLocation) =>
    createMotionData({
      motionType: from === to ? MotionType.STATIC : MotionType.PRO,
      startLocation: from,
      endLocation: to,
      color,
      propType: PropType.HAND,
      gridMode: GridMode.DIAMOND,
    });

  // [blueFrom, blueTo, redFrom, redTo]; Start boxes hold (from === to).
  type Move = [GridLocation, GridLocation, GridLocation, GridLocation];
  const box = (m: Move, step: number): StepData =>
    ({
      id: `gamma-${step}-${m.join("-")}`,
      letter: null,
      gridMode: GridMode.DIAMOND,
      startPosition: getGridPositionFromLocations(m[0], m[2]),
      endPosition: getGridPositionFromLocations(m[1], m[3]),
      motions: {
        blue: motion(MotionColor.BLUE, m[0], m[1]),
        red: motion(MotionColor.RED, m[2], m[3]),
      },
      stepNumber: step,
      duration: 1,
      blueReversal: false,
      redReversal: false,
      isBlank: false,
    }) as unknown as StepData;

  // ── Strip geometry from the proof's image placements (pt) ──────────────────
  const BOX = 100;
  type Cell = { m: Move; step: number } | null; // null = empty grid cell
  type Strip = { x: number; y: number; rows: Cell[][] };
  const c = (m: Move, step: number): Cell => ({ m, step });

  const STRIPS: Strip[] = [
    // γ→γ Quarter-Opp — opposite spin, hands 90° apart the whole loop.
    {
      x: 90.6,
      y: 124,
      rows: [
        [
          c([SO_, SO_, E, E], 0), // Start: blue S, red E
          c([SO_, W, E, N], 1), //  Parallel
          c([W, N, N, W], 2), //    Antiparallel
          c([N, E, W, SO_], 3), //  Parallel
          c([E, SO_, SO_, E], 4), // Antiparallel
        ],
      ],
    },
    // γ→γ Quarter-Same — same spin, red leads blue by one point.
    {
      x: 90,
      y: 279.2,
      rows: [
        [
          c([SO_, SO_, E, E], 0), // Start
          c([SO_, E, E, N], 1),
          c([E, N, N, W], 2),
          c([N, W, W, SO_], 3),
          c([W, SO_, SO_, E], 4),
        ],
      ],
    },
    // Switching sequence — alternates QO/QS each count; closes back to Start.
    // 5×2 grid: Start,1,2,3,4 on top; _,5,6,7,8 on the bottom (box 5 under box 1).
    {
      x: 56.2,
      y: 512.9,
      rows: [
        [
          c([SO_, SO_, E, E], 0), // Start
          c([SO_, W, E, N], 1), //  QO
          c([W, SO_, N, W], 2), //  QS
          c([SO_, E, W, N], 3), //  QO
          c([E, N, N, W], 4), //    QS
        ],
        [
          null,
          c([N, E, W, SO_], 5), // QO
          c([E, N, SO_, E], 6), // QS
          c([N, W, E, SO_], 7), // QO
          c([W, SO_, SO_, E], 8), // QS
        ],
      ],
    },
  ];

  // ── Text: grouped centred blocks (one draggable box per paragraph) ─────────
  // x = horizontal offset from centred (0 = centred). y = css top = baseline − fs.
  type Para = { x: number; y: number; fs: number; lh: number; html: string };
  let PARAS: Para[] = $state([
    {
      x: 0,
      y: 30.8,
      fs: 15,
      lh: 18,
      html:
        "Gamma, aka quarter-time, is based on two often forgotten modes:<br>" +
        "<strong>Quarter-Opp</strong> and <strong>Quarter-Same</strong>.<br>" +
        "Quarter-Opp has variations of parallel and antiparallel.",
    },
    {
      x: 0,
      y: 242.9,
      fs: 15,
      lh: 18,
      html: "In Quarter-Same, this doesn’t happen:",
    },
    {
      x: 0,
      y: 408.4,
      fs: 16,
      lh: 19.2,
      html:
        "When in gamma, you can move to any other variation of gamma.<br>" +
        "These examples are continuous, but non-continuous sequence are also possible.",
    },
    {
      x: 0,
      y: 466,
      fs: 16,
      lh: 19.2,
      html: "Here’s one that switches between Quarter-Opp and Quarter-Same:",
    },
    {
      x: 0,
      y: 745.1,
      fs: 16,
      lh: 19.2,
      html:
        "<strong>Practice using <span class=\"cy\">Dual</span><span class=\"pu\">-Shifts</span> " +
        "to create other non-continuous γ→γ variations!</strong>",
    },
  ]);

  // Left row labels (γ→γ glyph over the italic mode name) + QO column headers,
  // at the proof's own coordinates (glyph line 21.7pt above the mode name).
  type Label = { x: number; y: number; w: number; fs: number; t: string; i?: boolean };
  let LABELS: Label[] = $state([
    { x: 8, y: 151.6, w: 72, fs: 18, t: "γ→γ" },
    { x: 8, y: 173.3, w: 72, fs: 13, i: true, t: "Quarter-Opp" },
    { x: 8, y: 306.1, w: 72, fs: 18, t: "γ→γ" },
    { x: 8, y: 327.8, w: 72, fs: 13, i: true, t: "Quarter-Same" },
    { x: 190.6, y: 104.1, w: 100, fs: 14, i: true, t: "Parallel" },
    { x: 290.6, y: 104.1, w: 100, fs: 14, i: true, t: "Antiparallel" },
    { x: 390.6, y: 104.1, w: 100, fs: 14, i: true, t: "Parallel" },
    { x: 490.6, y: 104.1, w: 100, fs: 14, i: true, t: "Antiparallel" },
  ]);

  // Edit mode: dump paragraph + label coords for CoordsPanel's Copy button.
  const r1 = (n: number) => Math.round(n * 10) / 10;
  $effect(() =>
    registerEditSource("Gamma (p5)", () => {
      const P = PARAS.map((p, i) => `  para[${i}]: x: ${r1(p.x)}, y: ${r1(p.y)}`).join("\n");
      const L = LABELS.map((l) => `  ${JSON.stringify(l.t)}: x: ${r1(l.x)}, y: ${r1(l.y)}`).join("\n");
      return `PARAS\n${P}\n\nLABELS\n${L}`;
    })
  );
</script>

<div class="gamma-page">
  <!-- Three strips of real pictographs. All adornments (float arrows, Start/count
       numerals, γ→γ position glyphs, elementals) are renderer-owned. -->
  {#each STRIPS as strip, si (si)}
    {#each strip.rows as row, ri (ri)}
      {#each row as cell, ci (ci)}
        {#if cell}
          <div
            class="pbox"
            style="left:{(strip.x + ci * BOX) * S}px; top:{(strip.y + ri * BOX) * S}px; width:{BOX *
              S}px; height:{BOX * S}px"
          >
            <PictographContainer
              pictographData={box(cell.m, cell.step)}
              gridMode={GridMode.DIAMOND}
              bluePropTypeOverride={PropType.HAND}
              redPropTypeOverride={PropType.HAND}
              showGrid={true}
              showTKA={false}
              showPositions={cell.step > 0}
              showElemental={cell.step > 0}
              showReversals={false}
              showTnD={false}
              showNonRadialPoints={false}
              showHandPoints={true}
              stepNumberOverride={true}
              darkMode={false}
              printMode={true}
              disableTransitions={true}
            />
          </div>
        {/if}
      {/each}
    {/each}
  {/each}

  <!-- Grouped centred paragraphs (one box each, like the original PDF). -->
  {#each PARAS as p, i (i)}
    <p
      class="para"
      class:edit={guideEdit.on}
      class:selected={guideEdit.selectedId === `gamma-para-${i}`}
      style="transform: translateX({p.x * S}px); top:{p.y * S}px; font-size:{p.fs *
        S}px; line-height:{p.lh * S}px"
      use:ptDrag={pt(`gamma-para-${i}`, "paragraph", p)}
    >
      {@html p.html}
    </p>
  {/each}

  <!-- Left row labels (γ→γ + mode name) and the QO column headers. -->
  {#each LABELS as l, i (i)}
    <span
      class="label"
      class:i={l.i}
      class:edit={guideEdit.on}
      class:selected={guideEdit.selectedId === `gamma-label-${i}`}
      style="left:{l.x * S}px; top:{l.y * S}px; width:{l.w * S}px; font-size:{l.fs * S}px"
      use:ptDrag={pt(`gamma-label-${i}`, l.t, l)}>{l.t}</span
    >
  {/each}
</div>

<style>
  /* Absolute layer over the whole GuidePage sheet; coords map straight to pt×S. */
  .gamma-page {
    position: absolute;
    inset: 0;
    color: #141414;
  }

  /* Each pictograph box carries its own hairline; adjacent boxes share the edge
     (border-box → coincident 1px lines) and the empty switch cell draws none. */
  .pbox {
    position: absolute;
    border: 1px solid #c4c4cc;
    background: #fff;
    box-sizing: border-box;
    overflow: hidden;
  }

  /* Centred paragraph blocks — full sheet width, one box per paragraph. */
  .para {
    position: absolute;
    left: 0;
    right: 0;
    margin: 0;
    text-align: center;
    font-family: "Cambria", Georgia, "Times New Roman", serif;
  }
  .para :global(.cy) {
    color: #36c3ff;
  }
  .para :global(.pu) {
    color: #6f2da8;
  }

  /* Row labels (γ→γ glyph over the italic mode name) + column headers, centred
     in their own column like the proof. */
  .label {
    position: absolute;
    font-family: "Cambria", Georgia, "Times New Roman", serif;
    font-weight: 700;
    line-height: 1;
    white-space: nowrap;
    text-align: center;
  }
  .label.i {
    font-weight: 400;
    font-style: italic;
  }

  /* ── Edit mode affordances ─────────────────────────────────────────────── */
  .para.edit,
  .label.edit {
    outline: 1px dashed rgba(55, 48, 163, 0.4);
    cursor: move;
  }
  .para.selected,
  .label.selected {
    outline: 1.5px solid #3730a3;
    outline-offset: 1px;
  }
</style>
