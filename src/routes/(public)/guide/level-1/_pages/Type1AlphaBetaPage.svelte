<script lang="ts">
  /**
   * Type 1 Dual-Shifts (Alpha, Beta) — body page 4, a faithful reproduction of
   * the proof PDF (level-1-v05.pdf, page 10). The proof's text runs render via
   * ProofTextPage (same data both routes use before a page is built); this
   * component adds the four pictograph strips the proof drew as baked images,
   * rebuilt as REAL pictographs through the current renderer.
   *
   * Strip geometry comes from the proof's own image placements (extracted from
   * the PDF operator list): 500×100pt strips of five 100pt boxes at
   * (95.3, 142.8) / (95.3, 262.0) / (92.6, 472.0) / (92.6, 588.3).
   *
   * Each box is a canonical diamond start-position pictograph (alpha = hands at
   * opposite points, beta = both hands at the same point — the renderer's beta
   * offsets place the two hands side by side) selected from startPositionManager
   * by the two hand locations, with the prop forced to HAND. Hands show the END
   * position of each count; a straight teaching arrow per moving hand shows the
   * path (start point → end point), with a SOLID triangular head matching the
   * proof's marker arrows. Rows read as four-count loops:
   *
   *   Split-Same (α→α)  both hands clockwise, opposite points   — VTG SS
   *   Tog-Same  (β→β)   both hands clockwise, same point        — VTG TS
   *   Split-Opp / Tog-Opp (α↔β) hands arc opposite ways; the SAME dual-shift
   *   is SO from a side-point start and TO from a bottom start (the proof's
   *   "depending on start position" note — confirmed against MCP VTG data).
   *
   * Type styling mirrors the proof: count numerals + "Start" bold serif, mode
   * badges (SS/TS/SO/TO) boxed bottom-right, per-box β→α / α→β headers on the
   * Opp rows, and the α→α / β→β row labels the text extraction dropped (glyph
   * font) restored as runs. printMode = white sheet.
   */
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import ProofTextPage from "./ProofTextPage.svelte";
  import { startPositionManager } from "$lib/shared/create/services/start-position-manager";
  import { GridMode, GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { guideEdit, ptDrag, pt, registerEditSource } from "../_data/guide-edit.svelte";

  const S = 816 / 612; // pt → px (4/3)

  const B = "#2e3192"; // blue = left hand
  const R = "#cc2127"; // red = right hand

  // ── Canonical positions, selected by hand locations ────────────────────────
  // The manager bakes propType STAFF onto each motion; force HAND so the
  // prepared motion carries HAND (what PropSvg's red-hand mirror reads).
  const VARIATIONS = startPositionManager.getAllStartPositionVariations(GridMode.DIAMOND);
  const handsAt = (blue: GridLocation, red: GridLocation) => {
    const p = VARIATIONS.find(
      (v) => v.motions?.blue?.endLocation === blue && v.motions?.red?.endLocation === red
    );
    return p
      ? {
          ...p,
          motions: {
            blue: p.motions?.blue ? { ...p.motions.blue, propType: PropType.HAND } : undefined,
            red: p.motions?.red ? { ...p.motions.red, propType: PropType.HAND } : undefined,
          },
        }
      : undefined;
  };

  // ── Strip geometry from the proof's image placements (pt) ──────────────────
  const BOX = 100;
  const { NORTH: N, EAST: E, SOUTH: SO_, WEST: W } = GridLocation;

  type Arrow = { color: string; from: GridLocation; to: GridLocation };
  type Box = { blue: GridLocation; red: GridLocation; header?: string; arrows: Arrow[] };
  type Strip = { x: number; y: number; badge: string; boxes: Box[] };

  // Each row = Start + a four-count loop; hands land where each count ends,
  // arrows trace each moving hand's path (read straight off the proof page).
  const STRIPS: Strip[] = [
    // Split-Same: α→α, both hands clockwise.
    {
      x: 95.3,
      y: 142.8,
      badge: "SS",
      boxes: [
        { blue: SO_, red: N, arrows: [] },
        { blue: W, red: E, arrows: [{ color: R, from: N, to: E }, { color: B, from: SO_, to: W }] },
        { blue: N, red: SO_, arrows: [{ color: B, from: W, to: N }, { color: R, from: E, to: SO_ }] },
        { blue: E, red: W, arrows: [{ color: B, from: N, to: E }, { color: R, from: SO_, to: W }] },
        { blue: SO_, red: N, arrows: [{ color: R, from: W, to: N }, { color: B, from: E, to: SO_ }] },
      ],
    },
    // Tog-Same: β→β, both hands clockwise together (parallel arrows).
    {
      x: 95.3,
      y: 262.0,
      badge: "TS",
      boxes: [
        { blue: SO_, red: SO_, arrows: [] },
        { blue: W, red: W, arrows: [{ color: B, from: SO_, to: W }, { color: R, from: SO_, to: W }] },
        { blue: N, red: N, arrows: [{ color: B, from: W, to: N }, { color: R, from: W, to: N }] },
        { blue: E, red: E, arrows: [{ color: B, from: N, to: E }, { color: R, from: N, to: E }] },
        { blue: SO_, red: SO_, arrows: [{ color: B, from: E, to: SO_ }, { color: R, from: E, to: SO_ }] },
      ],
    },
    // Split-Opp: side-point start (β at W), hands arc opposite ways.
    {
      x: 92.6,
      y: 472.0,
      badge: "SO",
      boxes: [
        { blue: W, red: W, arrows: [] },
        { blue: N, red: SO_, header: "β→α", arrows: [{ color: B, from: W, to: N }, { color: R, from: W, to: SO_ }] },
        { blue: E, red: E, header: "α→β", arrows: [{ color: B, from: N, to: E }, { color: R, from: SO_, to: E }] },
        { blue: SO_, red: N, header: "β→α", arrows: [{ color: R, from: E, to: N }, { color: B, from: E, to: SO_ }] },
        { blue: W, red: W, header: "α→β", arrows: [{ color: R, from: N, to: W }, { color: B, from: SO_, to: W }] },
      ],
    },
    // Tog-Opp: bottom start (β at S), the same shape a quarter-turn around.
    {
      x: 92.6,
      y: 588.3,
      badge: "TO",
      boxes: [
        { blue: SO_, red: SO_, arrows: [] },
        { blue: W, red: E, header: "β→α", arrows: [{ color: B, from: SO_, to: W }, { color: R, from: SO_, to: E }] },
        { blue: N, red: N, header: "α→β", arrows: [{ color: B, from: W, to: N }, { color: R, from: E, to: N }] },
        { blue: E, red: W, header: "β→α", arrows: [{ color: R, from: N, to: W }, { color: B, from: N, to: E }] },
        { blue: SO_, red: SO_, header: "α→β", arrows: [{ color: R, from: W, to: SO_ }, { color: B, from: E, to: SO_ }] },
      ],
    },
  ];

  // ── Teaching arrows in the grid's 950 viewBox space ─────────────────────────
  // Outer points sit at radius 300 from center (475, 475); arrows run along the
  // outer-point chord (like the proof's), trimmed at both ends. When both hands
  // share a path (Tog rows) the pair splits perpendicular: blue inside (toward
  // center), red outside.
  const OUTER: Record<string, { x: number; y: number }> = {
    [N]: { x: 475, y: 175 },
    [E]: { x: 775, y: 475 },
    [SO_]: { x: 475, y: 775 },
    [W]: { x: 175, y: 475 },
  };
  const TRIM = 0.16; // fraction trimmed off each end of the chord
  const PAIR_OFFSET = 40; // perpendicular split for shared-path pairs
  const ARROW_W = 26;
  const outer = (l: GridLocation) => OUTER[l] ?? { x: 475, y: 475 };

  function arrowLine(
    a: Arrow,
    shared: boolean
  ): { x1: number; y1: number; x2: number; y2: number } {
    const p0 = outer(a.from);
    const p1 = outer(a.to);
    let x1 = p0.x + (p1.x - p0.x) * TRIM;
    let y1 = p0.y + (p1.y - p0.y) * TRIM;
    let x2 = p1.x + (p0.x - p1.x) * TRIM;
    let y2 = p1.y + (p0.y - p1.y) * TRIM;
    if (shared) {
      // Perpendicular unit; sign chosen so BLUE lands nearer the center.
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const len = Math.hypot(dx, dy) || 1;
      let px = -dy / len;
      let py = dx / len;
      const mx = (x1 + x2) / 2 + px * 10;
      const my = (y1 + y2) / 2 + py * 10;
      const towardCenter =
        Math.hypot(mx - 475, my - 475) < Math.hypot((x1 + x2) / 2 - 475, (y1 + y2) / 2 - 475);
      const sign = (a.color === B) === towardCenter ? 1 : -1;
      x1 += px * PAIR_OFFSET * sign;
      y1 += py * PAIR_OFFSET * sign;
      x2 += px * PAIR_OFFSET * sign;
      y2 += py * PAIR_OFFSET * sign;
    }
    return { x1, y1, x2, y2 };
  }

  // Solid triangular head sized off the shaft, drawn as a path so it takes the
  // arrow's own color (markers can't inherit stroke everywhere we print).
  const HEAD_LEN = 78;
  const HEAD_HALF_W = 46;
  function headPath(l: { x1: number; y1: number; x2: number; y2: number }): string {
    const dx = l.x2 - l.x1;
    const dy = l.y2 - l.y1;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const bx = l.x2 - ux * HEAD_LEN;
    const by = l.y2 - uy * HEAD_LEN;
    const p1x = bx + -uy * HEAD_HALF_W;
    const p1y = by + ux * HEAD_HALF_W;
    const p2x = bx - -uy * HEAD_HALF_W;
    const p2y = by - ux * HEAD_HALF_W;
    return `M ${p1x.toFixed(1)} ${p1y.toFixed(1)} L ${l.x2.toFixed(1)} ${l.y2.toFixed(1)} L ${p2x.toFixed(1)} ${p2y.toFixed(1)} Z`;
  }
  // Shaft stops where the head begins so the tip stays crisp.
  function shaftEnd(l: { x1: number; y1: number; x2: number; y2: number }): { x: number; y: number } {
    const dx = l.x2 - l.x1;
    const dy = l.y2 - l.y1;
    const len = Math.hypot(dx, dy) || 1;
    return { x: l.x2 - (dx / len) * HEAD_LEN * 0.8, y: l.y2 - (dy / len) * HEAD_LEN * 0.8 };
  }

  // ── Labels (pt, editable) ───────────────────────────────────────────────────
  // The proof's α→α / β→β row labels used a glyph font the text extraction
  // dropped — restored here above the italic mode names (which live in
  // proof-text.ts: Split-Same y190.2, Tog-Same y308.2, SO y511.6, TO y627.9).
  type Label = { x: number; y: number; w: number; fs: number; t: string };
  let GLYPH_LABELS: Label[] = $state([
    { x: 12.7, y: 168.5, w: 70.6, fs: 16, t: "α→α" },
    { x: 15.3, y: 286.5, w: 65.4, fs: 16, t: "β→β" },
  ]);

  // Count numerals + Start (top-left of each box) and mode badges (bottom-right)
  // are derived from strip geometry, with a per-kind inset.
  const NUM_INSET = { x: 5, y: 5.5, fs: 11 };
  const BADGE_INSET = { x: 100 - 25, y: 100 - 17.5, fs: 10.5 };
  const HEADER_INSET = { y: 4, fs: 11.5 };

  // Edit mode: dump the restored label coords for CoordsPanel's Copy button.
  const r1 = (n: number) => Math.round(n * 10) / 10;
  $effect(() =>
    registerEditSource("Type 1 α/β (p4)", () =>
      GLYPH_LABELS.map((g) => `  ${JSON.stringify(g.t)}: x: ${r1(g.x)}, y: ${r1(g.y)}`).join("\n")
    )
  );
</script>

<div class="type1-page">
  <!-- The proof's own text runs (intro, mid-page, notice, practice, mode names). -->
  <ProofTextPage id="hm-type1" />

  <!-- α→α / β→β row labels (restored glyph-font runs). -->
  {#each GLYPH_LABELS as g, i (i)}
    <span
      class="glyph-label"
      class:edit={guideEdit.on}
      class:selected={guideEdit.selectedId === `t1-glyph-${i}`}
      style="left:{g.x * S}px; top:{g.y * S}px; width:{g.w * S}px; font-size:{g.fs * S}px"
      use:ptDrag={pt(`t1-glyph-${i}`, g.t, g)}>{g.t}</span
    >
  {/each}

  <!-- Four strips of five real pictographs each. -->
  {#each STRIPS as strip, si (si)}
    <div
      class="strip"
      style="left:{strip.x * S}px; top:{strip.y * S}px; width:{BOX * 5 * S}px; height:{BOX * S}px"
    >
      {#each strip.boxes as box, bi (bi)}
        {@const data = handsAt(box.blue, box.red)}
        <div class="cell">
          {#if data}
            <PictographContainer
              pictographData={data}
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
          {#if box.arrows.length}
            {@const shared = box.arrows.length === 2 && box.arrows[0]?.from === box.arrows[1]?.from && box.arrows[0]?.to === box.arrows[1]?.to}
            <svg class="arrows" viewBox="0 0 950 950" aria-hidden="true">
              {#each box.arrows as a}
                {@const l = arrowLine(a, shared)}
                {@const se = shaftEnd(l)}
                <line x1={l.x1} y1={l.y1} x2={se.x} y2={se.y} stroke={a.color} stroke-width={ARROW_W} stroke-linecap="round" />
                <path d={headPath(l)} fill={a.color} />
              {/each}
            </svg>
          {/if}
          <!-- Count numeral / Start (top-left), mode badge (bottom-right). -->
          <span class="num" style="left:{NUM_INSET.x * S}px; top:{NUM_INSET.y * S}px; font-size:{NUM_INSET.fs * S}px">
            {bi === 0 ? "Start" : bi}
          </span>
          {#if bi > 0}
            <span class="badge" style="left:{BADGE_INSET.x * S}px; top:{BADGE_INSET.y * S}px; font-size:{BADGE_INSET.fs * S}px">
              {strip.badge}
            </span>
          {/if}
          {#if box.header}
            <span class="header" style="top:{HEADER_INSET.y * S}px; font-size:{HEADER_INSET.fs * S}px">
              {box.header}
            </span>
          {/if}
        </div>
      {/each}
    </div>
  {/each}
</div>

<style>
  /* Absolute layer over the whole GuidePage sheet; coords map straight to pt×S. */
  .type1-page {
    position: absolute;
    inset: 0;
    color: #141414;
  }

  /* One strip = five abutting square cells sharing hairline dividers. */
  .strip {
    position: absolute;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    border: 1px solid #c4c4cc;
    background: #fff;
  }
  .cell {
    position: relative;
    overflow: hidden;
  }
  .cell + .cell {
    border-left: 1px solid #c4c4cc;
  }

  /* Teaching arrows, drawn in the grid's 950 viewBox space over the pictograph. */
  .arrows {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  /* Count numerals + Start — bold serif, matching the proof. */
  .num {
    position: absolute;
    font-family: "Cambria", Georgia, "Times New Roman", serif;
    font-weight: 700;
    line-height: 1;
  }
  /* Mode badge (SS/TS/SO/TO) — boxed, bottom-right, matching the proof. */
  .badge {
    position: absolute;
    font-family: ui-sans-serif, system-ui, "Segoe UI", sans-serif;
    font-weight: 600;
    line-height: 1;
    padding: 0.11em 0.22em;
    background: #e9e9ec;
    color: #2c2e35;
  }
  /* β→α / α→β box headers — bold, centred at the top of the cell. */
  .header {
    position: absolute;
    left: 0;
    right: 0;
    text-align: center;
    font-family: "Cambria", Georgia, "Times New Roman", serif;
    font-weight: 700;
    line-height: 1;
  }

  /* Restored α→α / β→β row labels — bold serif, centred over the mode names. */
  .glyph-label {
    position: absolute;
    font-family: "Cambria", Georgia, "Times New Roman", serif;
    font-weight: 700;
    line-height: 1;
    white-space: nowrap;
    text-align: center;
  }
  .glyph-label.edit {
    outline: 1px dashed rgba(55, 48, 163, 0.4);
    cursor: move;
  }
  .glyph-label.selected {
    outline: 1.5px solid #3730a3;
    outline-offset: 1px;
  }
</style>
