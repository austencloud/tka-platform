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
  import { createMotionData, createPlaceholderMotion } from "$lib/shared/pictograph/shared/domain/models/motion-data";
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

  type Cell = { label: string; sub: string; step: StepData | null };

  const dirWord = (rot: RotationDirection) => (rot === CW ? "cw" : "ccw");

  // Guide-proven recipes: pro t1 in->out, anti t1 in->in, dash t2 in->out,
  // static t2 in->in. Locations/directions are the swept variable.
  //
  // For a shift the hand-path direction is fixed by start->end; the motion's
  // rotationDirection is the PROP rotation, which is derived: pro = same as
  // the path, anti = opposite (TurnsPage: PRO E->S carries CW, ANTI E->S
  // carries CCW). `pathCw` is the swept axis; rot falls out of it.
  const shiftCell = (type: MotionType, from: GridLocation, to: GridLocation, pathCw: boolean): Cell => {
    const endOri = type === MotionType.PRO ? OUT : IN;
    const propCw = type === MotionType.PRO ? pathCw : !pathCw;
    const rot = propCw ? CW : CCW;
    const full = fullStep(`${type}-${from}-${to}`, type, from, to, IN, endOri, rot, 1);
    const half = buildHalvedStep(full, 0.5);
    const mid = half?.motions?.red?.endLocation;
    return {
      label: `${LOC_SHORT[from]} → ${mid ? LOC_SHORT[mid] : "?"}`,
      sub: `${type} · half of ${LOC_SHORT[from]}→${LOC_SHORT[to]}, 1 turn · path ${pathCw ? "cw" : "ccw"}, prop ${dirWord(rot)}`,
      step: half,
    };
  };

  const dashCell = (from: GridLocation, to: GridLocation, rot: RotationDirection): Cell => {
    const full = fullStep(`dash-${from}-${to}-${dirWord(rot)}`, MotionType.DASH, from, to, IN, OUT, rot, 2);
    return {
      label: `${LOC_SHORT[from]} → center`,
      sub: `dash ${dirWord(rot)} · half of ${LOC_SHORT[from]}→${LOC_SHORT[to]}, 2 turns`,
      step: buildHalvedStep(full, 0.5),
    };
  };

  const staticCell = (at: GridLocation, rot: RotationDirection): Cell => {
    const full = fullStep(`static-${at}-${dirWord(rot)}`, MotionType.STATIC, at, at, IN, IN, rot, 2);
    return {
      label: `${LOC_SHORT[at]} (static)`,
      sub: `static ${dirWord(rot)} · half of 2 turns at ${LOC_SHORT[at]}`,
      step: buildHalvedStep(full, 0.5),
    };
  };

  // Cardinal ring, cw order. cw shift ends at the next cardinal, ccw at the previous.
  const RING = [N, E, S, W] as const;
  const cwEnd = (from: GridLocation) => RING[(RING.indexOf(from as (typeof RING)[number]) + 1) % 4]!;
  const ccwEnd = (from: GridLocation) => RING[(RING.indexOf(from as (typeof RING)[number]) + 3) % 4]!;

  const shiftCells = (type: MotionType): Cell[] => [
    ...RING.map((from) => shiftCell(type, from, cwEnd(from), true)),
    ...RING.map((from) => shiftCell(type, from, ccwEnd(from), false)),
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
      title: "Pro halves",
      note: "path-cw row then path-ccw row — each cell is the first half of a 1-turn prospin shift (prop rotation = path direction)",
      cells: shiftCells(MotionType.PRO),
    },
    {
      title: "Anti halves",
      note: "path-cw row then path-ccw row — each cell is the first half of a 1-turn antispin shift (prop rotation = opposite of path)",
      cells: shiftCells(MotionType.ANTI),
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

  // Scale reference: the SAME motions un-halved, rendered with the regular
  // arrow assets. The half glyphs should read as the same pen weight as these.
  const REFERENCE: Cell[] = [
    {
      label: "pro (full)",
      sub: "regular asset · E→S cw, 1 turn",
      step: fullStep("ref-pro", MotionType.PRO, E, S, IN, OUT, CW, 1),
    },
    {
      label: "anti (full)",
      sub: "regular asset · E→S ccw, 1 turn",
      step: fullStep("ref-anti", MotionType.ANTI, E, S, IN, IN, CCW, 1),
    },
    {
      label: "dash (full)",
      sub: "regular asset · S→N ccw, 2 turns",
      step: fullStep("ref-dash", MotionType.DASH, S, N, IN, OUT, CCW, 2),
    },
    {
      label: "static (full)",
      sub: "regular asset · E ccw, 2 turns",
      step: fullStep("ref-static", MotionType.STATIC, E, E, IN, IN, CCW, 2),
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

<div class="page">
  <h1>Half-Movement Lattice</h1>
  <p class="subtitle">
    Every 45° halved movement as a real pipeline pictograph
    (<code>buildHalvedStep</code> → <code>PictographContainer</code>). Check each
    cell: staff at the midpoint, half arrow rotated/mirrored to match the
    movement, glyph at the same visual weight as the reference row at the bottom.
  </p>

  {#each SECTIONS as section (section.title)}
    <h2>{section.title}</h2>
    <p class="note">{section.note}</p>
    <div class="grid">
      {#each section.cells as cell (cell.sub)}
        <div class="cell">
          <div class="label">{cell.label}</div>
          <div class="stage">
            {#if cell.step}
              <PictographContainer
                pictographData={cell.step}
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
