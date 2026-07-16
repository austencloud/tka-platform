<!--
  Half-Movement Lattice — Phase 2b review harness

  One cell per 45deg halved movement, rendered as a REAL pictograph through the
  production pipeline (buildHalvedStep -> PictographContainer), so rotation,
  mirroring, placement, and glyph scale can be reviewed movement by movement:

    Pro/Anti  — every cardinal start x both rotation directions (8 each):
                N->NE, E->SE, S->SW, W->NW (cw) and N->NW, W->SW, S->SE, E->NE (ccw)
    Dash      — every cardinal pair through center, both directions (8)
    Static    — every cardinal, both directions (8)

  The last section renders the equivalent FULL (non-halved) pictographs with the
  regular arrow assets — the scale reference the half glyphs must sit naturally
  beside. Motion recipes (turns/orientations) reuse the guide pages' proven
  combos; only locations and rotation direction vary.
-->
<script lang="ts">
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import { createMotionData, createPlaceholderMotion, type MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
  import { createArrowPlacementData } from "$lib/shared/pictograph/arrow/positioning/placement/domain/create-arrow-placement-data";
  import { calculateSegmentRotation } from "$lib/shared/pictograph/arrow/positioning/calculation/services/segment-rotation";
  import { buildHalvedStep } from "$lib/shared/animation-engine/services/build-halved-step";
  import {
    MotionType,
    MotionColor,
    Orientation,
    RotationDirection,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { GridMode, GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";

  const { NORTH: N, EAST: E, SOUTH: S, WEST: W } = GridLocation;
  const { IN, OUT } = Orientation;
  const CW = RotationDirection.CLOCKWISE;
  const CCW = RotationDirection.COUNTER_CLOCKWISE;

  const LOC_SHORT: Partial<Record<GridLocation, string>> = {
    [GridLocation.NORTH]: "N",
    [GridLocation.EAST]: "E",
    [GridLocation.SOUTH]: "S",
    [GridLocation.WEST]: "W",
    [GridLocation.NORTHEAST]: "NE",
    [GridLocation.SOUTHEAST]: "SE",
    [GridLocation.SOUTHWEST]: "SW",
    [GridLocation.NORTHWEST]: "NW",
    [GridLocation.CENTER]: "center",
  };

  // Full-motion step (red staff + invisible blue placeholder, per the
  // both-hands step contract buildHalvedStep expects).
  const fullStep = (
    id: string,
    type: MotionType,
    from: GridLocation,
    to: GridLocation,
    startOri: Orientation,
    endOri: Orientation,
    rot: RotationDirection,
    turns: number
  ): StepData =>
    ({
      id: `hm-${id}`,
      letter: null,
      stepNumber: 1,
      gridMode: GridMode.DIAMOND,
      motions: {
        blue: createPlaceholderMotion(MotionColor.BLUE, { location: E, orientation: IN }),
        red: createMotionData({
          motionType: type,
          rotationDirection: rot,
          startLocation: from,
          endLocation: to,
          startOrientation: startOri,
          endOrientation: endOri,
          turns,
          color: MotionColor.RED,
          propType: PropType.STAFF,
          gridMode: GridMode.DIAMOND,
        }),
      },
    }) as unknown as StepData;

  // ── WASD placement harness ─────────────────────────────────────────────────
  // Adjustments are authored in GLYPH-LOCAL space (the extracted asset's frame,
  // staff along +x) and shared per (motionType, turns) — the same granularity
  // as the asset files — so nudging one cell moves its 7 siblings coherently.
  // Per cell, local -> screen is rotate(R) with local y flipped when the
  // pipeline mirrors (ArrowSvg's segment scale(1,-1)). Values persist in
  // localStorage; "Copy JSON" exports them for baking into the extractor as
  // anchor nudges.
  type CellMeta = { key: string; R: number; mirrored: boolean };

  const metaOf = (half: StepData | null): CellMeta | null => {
    const m = half?.motions?.red as MotionData | undefined;
    if (!m) return null;
    return {
      key: `${m.motionType}_t${m.turns}`,
      R: calculateSegmentRotation(m.endOrientation, m.endLocation, m.startLocation),
      mirrored:
        m.motionType === MotionType.ANTI
          ? m.rotationDirection === CW
          : m.rotationDirection === CCW,
    };
  };

  const STORAGE_KEY = "half-movements-adjustments";
  let adjustments = $state<Record<string, { x: number; y: number }>>(
    (() => {
      try {
        if (typeof localStorage === "undefined") return {}; // SSR pass
        return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      } catch {
        return {};
      }
    })()
  );
  let selected = $state<string | null>(null); // cell sub (unique per cell)
  let selectedMeta = $state<CellMeta | null>(null);

  $effect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(adjustments));
  });

  /** Apply the cell's shared glyph-local adjustment as the screen-space
   *  manualAdjustment the render pipeline already honors. */
  const withAdjustment = (step: StepData, meta: CellMeta | null): StepData => {
    if (!meta) return step;
    const adj = adjustments[meta.key];
    if (!adj || (!adj.x && !adj.y)) return step;
    const rad = (meta.R * Math.PI) / 180;
    const ly = meta.mirrored ? -adj.y : adj.y;
    const sx = adj.x * Math.cos(rad) - ly * Math.sin(rad);
    const sy = adj.x * Math.sin(rad) + ly * Math.cos(rad);
    const red = step.motions.red as MotionData;
    return {
      ...step,
      motions: {
        ...step.motions,
        red: createMotionData({
          ...red,
          arrowPlacementData: createArrowPlacementData({
            ...red.arrowPlacementData,
            manualAdjustmentX: sx,
            manualAdjustmentY: sy,
          }),
        }),
      },
    } as StepData;
  };

  const selectCell = (sub: string, meta: CellMeta | null) => {
    if (!meta) return;
    if (selected === sub) {
      selected = null;
      selectedMeta = null;
    } else {
      selected = sub;
      selectedMeta = meta;
    }
  };

  const onKeydown = (e: KeyboardEvent) => {
    if (!selected || !selectedMeta) return;
    const k = e.key.toLowerCase();
    if (k === "escape") {
      selected = null;
      selectedMeta = null;
      return;
    }
    if (k === "r") {
      e.preventDefault();
      const { [selectedMeta.key]: _, ...rest } = adjustments;
      adjustments = rest;
      return;
    }
    if (k !== "w" && k !== "a" && k !== "s" && k !== "d") return;
    e.preventDefault();
    const inc = e.shiftKey ? 1 : 5;
    const dx = k === "a" ? -inc : k === "d" ? inc : 0;
    const dy = k === "w" ? -inc : k === "s" ? inc : 0;
    // Screen delta -> glyph-local (inverse of withAdjustment's transform).
    const rad = (selectedMeta.R * Math.PI) / 180;
    const u = dx * Math.cos(rad) + dy * Math.sin(rad);
    const v = -dx * Math.sin(rad) + dy * Math.cos(rad);
    const lx = u;
    const lyv = selectedMeta.mirrored ? -v : v;
    const cur = adjustments[selectedMeta.key] ?? { x: 0, y: 0 };
    adjustments = {
      ...adjustments,
      [selectedMeta.key]: { x: Math.round((cur.x + lx) * 10) / 10, y: Math.round((cur.y + lyv) * 10) / 10 },
    };
  };

  const copyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(adjustments, null, 2));
  };
  // ───────────────────────────────────────────────────────────────────────────

  type Cell = { label: string; sub: string; step: StepData | null; meta: CellMeta | null };

  const dirWord = (rot: RotationDirection) => (rot === CW ? "cw" : "ccw");

  // Guide-proven recipes: pro t1 in->out, anti t1 in->in, dash t2 in->out,
  // static t2 in->in. Locations/directions are the swept variable.
  //
  // For a shift the hand-path direction is fixed by start->end; the motion's
  // rotationDirection is the PROP rotation, which is derived: pro = same as
  // the path, anti = opposite (TurnsPage: PRO E->S carries CW, ANTI E->S
  // carries CCW). `pathCw` is the swept axis; rot falls out of it.
  const shiftCell = (type: MotionType, from: GridLocation, to: GridLocation, pathCw: boolean, turns: 1 | 2): Cell => {
    // Guide-proven end orientations: pro t1 in->out (TurnsPage), everything
    // else here in->in (TurnsPage anti, TwoTurnsShiftsPage pro/anti t2).
    const endOri = type === MotionType.PRO && turns === 1 ? OUT : IN;
    const propCw = type === MotionType.PRO ? pathCw : !pathCw;
    const rot = propCw ? CW : CCW;
    const full = fullStep(`${type}-${from}-${to}-t${turns}`, type, from, to, IN, endOri, rot, turns);
    const half = buildHalvedStep(full, 0.5);
    const mid = half?.motions?.red?.endLocation;
    return {
      label: `${LOC_SHORT[from]} → ${mid ? LOC_SHORT[mid] : "?"}`,
      sub: `${type} · half of ${LOC_SHORT[from]}→${LOC_SHORT[to]}, ${turns} turn${turns > 1 ? "s" : ""} · path ${pathCw ? "cw" : "ccw"}, prop ${dirWord(rot)}`,
      step: half,
      meta: metaOf(half),
    };
  };

  const dashCell = (from: GridLocation, to: GridLocation, rot: RotationDirection): Cell => {
    const full = fullStep(`dash-${from}-${to}-${dirWord(rot)}`, MotionType.DASH, from, to, IN, OUT, rot, 2);
    const half = buildHalvedStep(full, 0.5);
    return {
      label: `${LOC_SHORT[from]} → center`,
      sub: `dash ${dirWord(rot)} · half of ${LOC_SHORT[from]}→${LOC_SHORT[to]}, 2 turns`,
      step: half,
      meta: metaOf(half),
    };
  };

  const staticCell = (at: GridLocation, rot: RotationDirection): Cell => {
    const full = fullStep(`static-${at}-${dirWord(rot)}`, MotionType.STATIC, at, at, IN, IN, rot, 2);
    const half = buildHalvedStep(full, 0.5);
    return {
      label: `${LOC_SHORT[at]} (static)`,
      sub: `static ${dirWord(rot)} · half of 2 turns at ${LOC_SHORT[at]}`,
      step: half,
      meta: metaOf(half),
    };
  };

  // Cardinal ring, cw order. cw shift ends at the next cardinal, ccw at the previous.
  const RING = [N, E, S, W] as const;
  const cwEnd = (from: GridLocation) => RING[(RING.indexOf(from as (typeof RING)[number]) + 1) % 4]!;
  const ccwEnd = (from: GridLocation) => RING[(RING.indexOf(from as (typeof RING)[number]) + 3) % 4]!;

  const shiftCells = (type: MotionType, turns: 1 | 2): Cell[] => [
    ...RING.map((from) => shiftCell(type, from, cwEnd(from), true, turns)),
    ...RING.map((from) => shiftCell(type, from, ccwEnd(from), false, turns)),
  ];

  const OPPOSITE: [GridLocation, GridLocation][] = [
    [N, S],
    [E, W],
    [S, N],
    [W, E],
  ];

  type Section = { title: string; note: string; cells: Cell[] };
  const SECTIONS: Section[] = [
    {
      title: "Pro halves — 1 turn",
      note: "path-cw row then path-ccw row — each cell is the first half of a 1-turn prospin shift (prop rotation = path direction)",
      cells: shiftCells(MotionType.PRO, 1),
    },
    {
      title: "Anti halves — 1 turn",
      note: "path-cw row then path-ccw row — each cell is the first half of a 1-turn antispin shift (prop rotation = opposite of path)",
      cells: shiftCells(MotionType.ANTI, 1),
    },
    {
      title: "Pro halves — 2 turns",
      note: "the per-turns glyph family: 2-turn halfway uses its own drawn asset (pro_half_2.0)",
      cells: shiftCells(MotionType.PRO, 2),
    },
    {
      title: "Anti halves — 2 turns",
      note: "the per-turns glyph family: 2-turn halfway uses its own drawn asset (anti_half_2.0)",
      cells: shiftCells(MotionType.ANTI, 2),
    },
    {
      title: "Dash halves",
      note: "midpoint is always center — cw then ccw",
      cells: [
        ...OPPOSITE.map(([f, t]) => dashCell(f, t, CW)),
        ...OPPOSITE.map(([f, t]) => dashCell(f, t, CCW)),
      ],
    },
    {
      title: "Static halves",
      note: "staff stays at its point — cw then ccw",
      cells: [...RING.map((at) => staticCell(at, CW)), ...RING.map((at) => staticCell(at, CCW))],
    },
  ];

  // Art holes: every (motionType, turns) combo the engine can halve but that
  // has NO per-turns glyph yet (scripts/half-domain-coverage.mjs is the
  // authority). Each renders its current FALLBACK art — the wrong turns'
  // glyph — one representative cell per hole, as the Illustrator work list.
  const HOLE_TURNS: Record<string, (number | "fl")[]> = {
    [MotionType.PRO]: [0, 0.5, 1.5, 2.5, 3, "fl"],
    [MotionType.ANTI]: [0, 0.5, 1.5, 2.5, 3, "fl"],
    [MotionType.DASH]: [0, 0.5, 1, 1.5, 2.5, 3],
    [MotionType.STATIC]: [0, 0.5, 1, 1.5, 2.5, 3],
  };
  const HOLE_SHAPE: Record<string, [GridLocation, GridLocation]> = {
    [MotionType.PRO]: [E, S],
    [MotionType.ANTI]: [E, S],
    [MotionType.DASH]: [S, N],
    [MotionType.STATIC]: [E, E],
  };
  const holeCell = (type: MotionType, turns: number | "fl"): Cell | null => {
    const [from, to] = HOLE_SHAPE[type]!;
    const rot = type === MotionType.ANTI ? CCW : type === MotionType.PRO ? CW : CCW;
    const full = fullStep(
      `hole-${type}-${turns}`,
      type,
      from,
      to,
      IN,
      IN,
      rot,
      turns as number
    );
    const half = buildHalvedStep(full, 0.5);
    if (!half) return null;
    return {
      label: `${type} · ${turns} turn${turns === 1 ? "" : "s"}`,
      sub: `NO ART — renders fallback ${type}_half.svg`,
      step: half,
      meta: metaOf(half),
    };
  };
  const HOLES: Cell[] = Object.entries(HOLE_TURNS).flatMap(([mt, list]) =>
    list.map((t) => holeCell(mt as MotionType, t)).filter((c): c is Cell => c !== null)
  );

  // Scale reference: the SAME motions un-halved, rendered with the regular
  // arrow assets. The half glyphs should read as the same pen weight as these.
  const REFERENCE: Cell[] = [
    {
      label: "pro (full)",
      sub: "regular asset · E→S cw, 1 turn",
      step: fullStep("ref-pro", MotionType.PRO, E, S, IN, OUT, CW, 1),
      meta: null,
    },
    {
      label: "anti (full)",
      sub: "regular asset · E→S ccw, 1 turn",
      step: fullStep("ref-anti", MotionType.ANTI, E, S, IN, IN, CCW, 1),
      meta: null,
    },
    {
      label: "dash (full)",
      sub: "regular asset · S→N ccw, 2 turns",
      step: fullStep("ref-dash", MotionType.DASH, S, N, IN, OUT, CCW, 2),
      meta: null,
    },
    {
      label: "static (full)",
      sub: "regular asset · E ccw, 2 turns",
      step: fullStep("ref-static", MotionType.STATIC, E, E, IN, IN, CCW, 2),
      meta: null,
    },
  ];

  const PICTO_FLAGS = {
    stepNumberOverride: false,
    showGrid: true,
    showTKA: false,
    showPositions: false,
    showReversals: false,
    showTnD: false,
    showElemental: false,
    showNonRadialPoints: false,
    showHandPoints: true,
    darkMode: false,
    printMode: true,
    disableTransitions: true,
  } as const;
</script>

<svelte:window onkeydown={onKeydown} />

<div class="page">
  <h1>Half-Movement Lattice</h1>
  <p class="subtitle">
    Every 45° halved movement as a real pipeline pictograph
    (<code>buildHalvedStep</code> → <code>PictographContainer</code>). Click a
    cell, then <strong>WASD</strong> to move its glyph (Shift = fine,
    <strong>R</strong> = reset, <strong>Esc</strong> = deselect). One nudge
    moves the whole (motion&nbsp;type, turns) family — adjustments live in
    glyph-local space, so every cell of the family shifts relative to its own
    staff.
  </p>

  <div class="panel">
    {#if selected && selectedMeta}
      <span class="panel-live">
        editing <strong>{selectedMeta.key}</strong>
        — local ({(adjustments[selectedMeta.key]?.x ?? 0).toFixed(1)},
        {(adjustments[selectedMeta.key]?.y ?? 0).toFixed(1)})
      </span>
    {:else}
      <span class="panel-idle">no cell selected</span>
    {/if}
    <span class="panel-values">
      {#each Object.entries(adjustments) as [k, v] (k)}
        <code>{k}: ({v.x}, {v.y})</code>
      {/each}
    </span>
    <button type="button" class="copy-btn" onclick={copyJson}>Copy JSON</button>
  </div>

  {#each SECTIONS as section (section.title)}
    <h2>{section.title}</h2>
    <p class="note">{section.note}</p>
    <div class="grid">
      {#each section.cells as cell (cell.sub)}
        <div
          class="cell"
          class:selected={selected === cell.sub}
          onclick={() => selectCell(cell.sub, cell.meta)}
          onkeydown={(e) => (e.key === "Enter" || e.key === " ") && selectCell(cell.sub, cell.meta)}
          role="button"
          tabindex="0"
        >
          <div class="label">{cell.label}</div>
          <div class="stage">
            {#if cell.step}
              <PictographContainer
                pictographData={withAdjustment(cell.step, cell.meta)}
                gridMode={GridMode.DIAMOND}
                redPropTypeOverride={PropType.STAFF}
                {...PICTO_FLAGS}
              />
            {:else}
              <div class="null-step">buildHalvedStep returned null</div>
            {/if}
          </div>
          <div class="sub">{cell.sub}</div>
        </div>
      {/each}
    </div>
  {/each}

  <h2>Art holes — halvable, no drawn glyph yet</h2>
  <p class="note">
    every (motion type, turns) the engine can halve that has no per-turns asset
    — each cell renders its FALLBACK art (the wrong turns' glyph). This is the
    Illustrator work list; source of truth: scripts/half-domain-coverage.mjs
  </p>
  <div class="grid">
    {#each HOLES as cell (cell.sub + cell.label)}
      <div
        class="cell hole"
        class:selected={selected === cell.sub + cell.label}
        onclick={() => selectCell(cell.sub + cell.label, cell.meta)}
        onkeydown={(e) => (e.key === "Enter" || e.key === " ") && selectCell(cell.sub + cell.label, cell.meta)}
        role="button"
        tabindex="0"
      >
        <div class="label">{cell.label}</div>
        <div class="stage">
          {#if cell.step}
            <PictographContainer
              pictographData={withAdjustment(cell.step, cell.meta)}
              gridMode={GridMode.DIAMOND}
              redPropTypeOverride={PropType.STAFF}
              {...PICTO_FLAGS}
            />
          {/if}
        </div>
        <div class="sub hole-sub">{cell.sub}</div>
      </div>
    {/each}
  </div>

  <h2>Scale reference — regular arrows</h2>
  <p class="note">the un-halved motions with the standard arrow assets</p>
  <div class="grid">
    {#each REFERENCE as cell (cell.sub)}
      <div class="cell">
        <div class="label">{cell.label}</div>
        <div class="stage">
          <PictographContainer
            pictographData={cell.step}
            gridMode={GridMode.DIAMOND}
            redPropTypeOverride={PropType.STAFF}
            {...PICTO_FLAGS}
          />
        </div>
        <div class="sub">{cell.sub}</div>
      </div>
    {/each}
  </div>
</div>

<style>
  .page {
    min-height: 100vh;
    padding: 24px;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    color: white;
  }

  h1 {
    text-align: center;
    margin: 0 0 8px;
  }

  h2 {
    max-width: 1400px;
    margin: 32px auto 4px;
    font-size: 1.2rem;
    color: #a855f7;
  }

  .subtitle {
    max-width: 760px;
    margin: 0 auto 8px;
    text-align: center;
    color: rgba(255, 255, 255, 0.7);
    line-height: 1.5;
  }

  .subtitle code {
    background: rgba(255, 255, 255, 0.1);
    padding: 1px 5px;
    border-radius: 4px;
    font-size: 0.9em;
  }

  .note {
    max-width: 1400px;
    margin: 0 auto 12px;
    color: rgba(255, 255, 255, 0.55);
    font-size: 0.9rem;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    max-width: 1400px;
    margin: 0 auto;
  }

  .cell {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    padding: 12px;
    text-align: center;
    cursor: pointer;
  }

  .cell.selected {
    border-color: #a855f7;
    box-shadow: 0 0 0 2px rgba(168, 85, 247, 0.5);
  }

  .cell.hole {
    border-color: rgba(255, 170, 60, 0.5);
  }

  .hole-sub {
    color: #ffaa3c;
  }

  .panel {
    position: sticky;
    top: 8px;
    z-index: 10;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    max-width: 1400px;
    margin: 0 auto 16px;
    padding: 10px 16px;
    background: rgba(20, 20, 40, 0.95);
    border: 1px solid rgba(168, 85, 247, 0.4);
    border-radius: 10px;
    font-size: 0.9rem;
  }

  .panel-live strong {
    color: #a855f7;
  }

  .panel-idle {
    color: rgba(255, 255, 255, 0.5);
  }

  .panel-values {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .panel-values code {
    background: rgba(255, 255, 255, 0.08);
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 0.8rem;
  }

  .copy-btn {
    margin-left: auto;
    padding: 8px 16px;
    min-height: 44px;
    background: #a855f7;
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
  }

  .copy-btn:hover {
    background: #9333ea;
  }

  .label {
    font-weight: 600;
    margin-bottom: 8px;
  }

  .stage {
    aspect-ratio: 1;
    background: white;
    border-radius: 8px;
    overflow: hidden;
  }

  .null-step {
    display: grid;
    place-items: center;
    height: 100%;
    color: #b91c1c;
    font-size: 0.85rem;
    padding: 8px;
  }

  .sub {
    margin-top: 8px;
    font-family: monospace;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.6);
  }
</style>
