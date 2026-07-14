<script lang="ts">
  /**
   * Turns (Shifts) — Level 2 body page 2 (manifest `turns-shifts`), faithful to
   * old p3. Two teaching strips, each start → halfway → end = combined:
   *
   *   Pro  — static E thumb-in → halfway pose → static S thumb-out
   *          = PRO e→s (CW handpath, prop cw) with 1 turn, in→out.
   *   Anti — static E thumb-in → halfway pose (thumb out) → static S thumb-in
   *          = ANTI e→s (prop ccw) with 1 turn, in→in.
   *
   * Start/end/combined are REAL single-staff pictographs (red hand, STAFF); the
   * combined's turn arrow comes from the renderer (turns: 1 on the motion). The
   * halfway frame composes a bare-grid pictograph + the real staff SVG at the
   * mid-motion pose (poseAt) PLUS the end-direction arrow (poseArrow) — the app's
   * own pro-curl / anti-zigzag glyph, placed by the engine to trace the pinky
   * end's first-half arc, matching the original artboard's little red arrows.
   *
   * Header corner art is the divider's SequenceMandala facelift (iso left,
   * anti right) standing in for the original's hand-composited overlays.
   */
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import SelectionHit from "$lib/shared/selection/SelectionHit.svelte";
  import SequenceMandala from "$lib/shared/mandala/components/SequenceMandala.svelte";
  import { getSequenceSelection } from "$lib/shared/selection/sequence-selection.svelte";
  import { createMotionData, createPlaceholderMotion } from "$lib/shared/pictograph/shared/domain/models/motion-data";
  import {
    MotionType,
    MotionColor,
    Orientation,
    RotationDirection,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { GridMode, GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import { poseAt, type HalfwayMotion } from "../_data/halfway-pose";
  import { poseArrow, POSE_ARROW_RED } from "../_data/pose-arrow";
  import { bakeReversals } from "../../level-1/_data/guide-sequence-adapter";
  import { getGuideSequenceClick } from "../../level-1/_data/guide-data-context";
  import { getGuideActiveStep } from "../../level-1/_data/guide-active-step.svelte";

  const S = 816 / 612; // pt → px
  const { EAST: E, SOUTH: SO_ } = GridLocation;
  const { IN, OUT } = Orientation;
  const CW = RotationDirection.CLOCKWISE;
  const CCW = RotationDirection.COUNTER_CLOCKWISE;
  const NOROT = RotationDirection.NO_ROTATION;

  const selection = getSequenceSelection();
  const activeStep = getGuideActiveStep();
  const emitSequence = getGuideSequenceClick();

  const redStaff = (
    id: string,
    type: MotionType,
    from: GridLocation,
    to: GridLocation,
    startOri: Orientation,
    endOri: Orientation,
    rot: RotationDirection,
    turns = 0
  ) => ({
    id: `l2t-${id}`,
    letter: null,
    gridMode: GridMode.DIAMOND,
    motions: {
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
  });
  const stat = (id: string, loc: GridLocation, ori: Orientation) =>
    redStaff(id, MotionType.STATIC, loc, loc, ori, ori, NOROT);
  const bareGrid = (id: string) => ({
    id: `l2t-${id}`,
    letter: null,
    gridMode: GridMode.DIAMOND,
    motions: {
      blue: createPlaceholderMotion(MotionColor.BLUE),
      red: createPlaceholderMotion(MotionColor.RED),
    },
  });

  // The staff SVG path (renderer asset); crossbar at the +x end.
  const STAFF_D =
    "M251.4 67.7V10.1c0-4.8-4.1-8.7-9.1-8.7s-9.1 3.9-9.1 8.7v19.2H10.3c-4.9 0-8.9 3.8-8.9 8.5V41c0 4.6 4 8.5 8.9 8.5h222.9v18.2c0 4.8 4.1 8.7 9.1 8.7s9.1-3.9 9.1-8.7z";
  const RED = "#DC2626";

  // Each motion is the source of truth for its combined pictograph, its halfway
  // staff pose (poseAt), AND its end-direction arrows — one engine, so staff and
  // arrow can never drift apart.
  const PRO_M: HalfwayMotion = { type: MotionType.PRO, from: E, to: SO_, rot: CW, startOri: IN, endOri: OUT, turns: 1 };
  const ANTI_M: HalfwayMotion = { type: MotionType.ANTI, from: E, to: SO_, rot: CCW, startOri: IN, endOri: IN, turns: 1 };

  type RowDef = {
    y: number;
    motion: HalfwayMotion;
    /** bow the arc the correct side for this prop rotation. */
    flip: boolean;
    start: ReturnType<typeof redStaff>;
    end: ReturnType<typeof redStaff>;
    combined: ReturnType<typeof redStaff>;
  };
  const ROWS: RowDef[] = [
    {
      // Pro + 1 turn: e→s CW handpath, prop cw.
      y: 300,
      motion: PRO_M,
      flip: false,
      start: stat("pro-start", E, IN),
      end: stat("pro-end", SO_, OUT),
      combined: redStaff("pro-full", MotionType.PRO, E, SO_, IN, OUT, CW, 1),
    },
    {
      // Anti + 1 turn: e→s handpath, prop ccw.
      y: 560,
      motion: ANTI_M,
      flip: true,
      start: stat("anti-start", E, IN),
      end: stat("anti-end", SO_, IN),
      combined: redStaff("anti-full", MotionType.ANTI, E, SO_, IN, IN, CCW, 1),
    },
  ];
  const bareGrids = ["pro-half", "anti-half"].map(bareGrid);

  // Reader click-to-animate (combined pictograph plays Start → motion).
  const ROW_KEYS = ["l2t-pro", "l2t-anti"];
  const ROW_WORDS = ["Prospin with a turn", "Antispin with a turn"];
  const animStep = (data: ReturnType<typeof redStaff>, stepNumber: number): StepData =>
    ({
      ...data,
      id: `${data.id}-anim-${stepNumber}`,
      stepNumber,
      motions: {
        blue: createPlaceholderMotion(MotionColor.BLUE, { location: E, orientation: IN }),
        red: data.motions.red,
      },
    }) as unknown as StepData;
  const rowSteps = (row: RowDef): StepData[] => {
    const [start, ...steps] = [animStep(row.start, 0), animStep(row.combined, 1)];
    return [start!, ...bakeReversals(steps)];
  };

  // ── Layout (pt) ─────────────────────────────────────────────────────────────
  const COLS = [95, 215, 335, 455];
  const SIZE = 100;
  const rowMid = (y: number) => y + SIZE / 2;
  const FLOW_ARROWS = ROWS.flatMap((r) => [
    { x: 198, y: rowMid(r.y) },
    { x: 318, y: rowMid(r.y) },
  ]);
  const ARROW_W = 14.5;
  const EQUALS = ROWS.map((r) => ({ x: 445, y: rowMid(r.y) }));

  const HEAVY_RULE = 96;
  const HAIRLINE = 494;

  // Corner mandala forms (facelift, divider family).
  const m = (mt: string, rd: string, sl: string, el: string, so: string, eo: string) =>
    ({ motionType: mt, rotationDirection: rd, startLocation: sl, endLocation: el, startOrientation: so, endOrientation: eo });
  const mstep = (blue: unknown, red: unknown) => ({ motions: { blue, red } });
  const mseq = (steps: unknown[]) => ({ bluePropType: "staff", redPropType: "staff", steps });
  const ISO = mseq([
    mstep(m("pro", "cw", "n", "e", "in", "in"), m("pro", "cw", "s", "w", "in", "in")),
    mstep(m("pro", "cw", "e", "s", "in", "in"), m("pro", "cw", "w", "n", "in", "in")),
    mstep(m("pro", "cw", "s", "w", "in", "in"), m("pro", "cw", "n", "e", "in", "in")),
    mstep(m("pro", "cw", "w", "n", "in", "in"), m("pro", "cw", "e", "s", "in", "in")),
  ]);
  const ANTIM = mseq([
    mstep(m("anti", "ccw", "n", "e", "in", "out"), m("anti", "ccw", "s", "w", "in", "out")),
    mstep(m("anti", "ccw", "e", "s", "out", "in"), m("anti", "ccw", "w", "n", "out", "in")),
    mstep(m("anti", "ccw", "s", "w", "in", "out"), m("anti", "ccw", "n", "e", "in", "out")),
    mstep(m("anti", "ccw", "w", "n", "out", "in"), m("anti", "ccw", "e", "s", "out", "in")),
  ]);

  // ── Text (pt coords, proof wording verbatim) ────────────────────────────────
  type Para = { x?: number; y: number; fs: number; lh: number; left?: boolean; html: string };
  const PARAS: Para[] = [
    { y: 76, fs: 16, lh: 19, html: "A turn is a 180° rotation that occurs during a motion." },
    { y: 122, fs: 16, lh: 19, html: "Let’s add a single turn to a shift." },
    {
      y: 168,
      fs: 15.5,
      lh: 19,
      html: "First we’ll add 1 turn to a prospin.<br>Take note of the diagonal halfway position, and pause there for a moment before continuing.<br><em>These arrows refer to the pinky end on the first half, then to the thumb end on the second half.<br>The full arrow depicts a half-circle, from the start position’s outer point.</em>",
    },
    { y: 264, fs: 16, lh: 19, html: "Each turn adds a thumb switch." },
    {
      y: 432,
      fs: 16,
      lh: 20,
      html: "An isolation has 0 thumb switches, therefore<br><strong>A prospin with a turn has 1 thumb switch (in → out)</strong>",
    },
    {
      y: 505,
      fs: 15.5,
      lh: 19,
      html: "Now let’s add 1 turn to an antispin.<br>Again, take note of the diagonal halfway position, and pause there before continuing.",
    },
    {
      y: 700,
      fs: 16,
      lh: 20,
      html: "A base antispin has 1 thumb switch. (in → out), therefore<br><strong>An antispin with a turn has 2 thumb switches (in → out → in).</strong>",
    },
  ];

  type Run = { x: number; y: number; fs: number; style: "mode" | "frame" | "cap" | "vtg"; t: string };
  const RUNS: Run[] = [
    { x: 34, y: 118, fs: 26, style: "mode", t: "Shifts" },
    { x: 520, y: 118, fs: 20, style: "vtg", t: "VTG: 1:3" },

    // Pro strip captions
    { x: 122, y: 288, fs: 14, style: "frame", t: "start" },
    { x: 238, y: 288, fs: 14, style: "frame", t: "halfway" },
    { x: 368, y: 288, fs: 14, style: "frame", t: "end" },
    { x: 62, y: 302, fs: 13, style: "cap", t: "thumbs:" },
    { x: 128, y: 302, fs: 13, style: "cap", t: "in" },
    { x: 372, y: 302, fs: 13, style: "cap", t: "out" },
    { x: 30, y: 342, fs: 24, style: "mode", t: "Pro" },

    // Anti strip captions
    { x: 122, y: 548, fs: 14, style: "frame", t: "start" },
    { x: 238, y: 548, fs: 14, style: "frame", t: "halfway" },
    { x: 368, y: 548, fs: 14, style: "frame", t: "end" },
    { x: 62, y: 562, fs: 13, style: "cap", t: "thumbs:" },
    { x: 128, y: 562, fs: 13, style: "cap", t: "in" },
    { x: 250, y: 562, fs: 13, style: "cap", t: "out" },
    { x: 372, y: 562, fs: 13, style: "cap", t: "in" },
    { x: 26, y: 602, fs: 24, style: "mode", t: "Anti" },
  ];

  const PICTO_FLAGS = {
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

<div class="turns-page">
  <!-- Header corner art (facelift mandalas) + heavy rule under the header. -->
  <div class="corner" style="left:{40 * S}px; top:{18 * S}px; width:{62 * S}px; height:{62 * S}px">
    <SequenceMandala sequence={ISO} size={62 * S} darkMode={false} bluePropType="staff" redPropType="staff" pathShape="arc" strokeWidth={2.5} />
  </div>
  <div class="corner" style="left:{510 * S}px; top:{18 * S}px; width:{62 * S}px; height:{62 * S}px">
    <SequenceMandala sequence={ANTIM} size={62 * S} darkMode={false} bluePropType="staff" redPropType="staff" pathShape="arc" strokeWidth={2.5} />
  </div>
  <div class="rule heavy" style="left:0; top:{HEAVY_RULE * S}px; width:{612 * S}px"></div>
  <div class="rule hair" style="left:{20 * S}px; top:{HAIRLINE * S}px; width:{572 * S}px"></div>

  {#each ROWS as row, ri (ri)}
    <div class="mini" style="left:{COLS[0]! * S}px; top:{row.y * S}px; width:{SIZE * S}px; height:{SIZE * S}px">
      <PictographContainer pictographData={row.start} gridMode={GridMode.DIAMOND} redPropTypeOverride={PropType.STAFF} {...PICTO_FLAGS} />
    </div>
    {@const hp = poseAt(row.motion, 0.5)}
    {@const ha = poseArrow(row.motion, 0, 0.5, { flip: row.flip })}
    <div class="mini" style="left:{COLS[1]! * S}px; top:{row.y * S}px; width:{SIZE * S}px; height:{SIZE * S}px">
      <PictographContainer pictographData={bareGrids[ri]} gridMode={GridMode.DIAMOND} {...PICTO_FLAGS} />
      <svg class="halfway-staff" viewBox="0 0 950 950" aria-hidden="true">
        <g transform={ha.transform}><path d={ha.d} fill={POSE_ARROW_RED} /></g>
        <g transform="translate({hp.cx}, {hp.cy}) rotate({hp.deg}) translate(-126.4, -38.9)">
          <path d={STAFF_D} fill={RED} />
        </g>
      </svg>
    </div>
    <div class="mini" style="left:{COLS[2]! * S}px; top:{row.y * S}px; width:{SIZE * S}px; height:{SIZE * S}px">
      <PictographContainer pictographData={row.end} gridMode={GridMode.DIAMOND} redPropTypeOverride={PropType.STAFF} {...PICTO_FLAGS} />
    </div>
    {@const key = ROW_KEYS[ri]!}
    <div
      class="mini tka-seq-cell"
      class:is-hovered={selection?.isHovered(key)}
      class:is-selected={selection?.isSelected(key)}
      class:guide-step-active={activeStep?.key === key}
      style="left:{COLS[3]! * S}px; top:{row.y * S}px; width:{SIZE * S}px; height:{SIZE * S}px"
    >
      <PictographContainer pictographData={row.combined} gridMode={GridMode.DIAMOND} redPropTypeOverride={PropType.STAFF} {...PICTO_FLAGS} />
      <SelectionHit
        groupId={key}
        isGroupStart
        label={`Animate: ${ROW_WORDS[ri]}`}
        onselect={() => emitSequence?.({ strip: rowSteps(row), word: ROW_WORDS[ri]!, key, propType: "staff" })}
      />
    </div>
  {/each}

  {#each FLOW_ARROWS as a (a.x + "-" + a.y)}
    <svg
      class="flow-arrow"
      style="left:{a.x * S}px; top:{(a.y - 5) * S}px; width:{ARROW_W * S}px; height:{10 * S}px"
      viewBox="0 0 {ARROW_W} 10"
      aria-hidden="true"
    >
      <line x1="0" y1="5" x2={ARROW_W - 7} y2="5" stroke="#141414" stroke-width="2" />
      <polygon points="{ARROW_W - 8},1.3 {ARROW_W},5 {ARROW_W - 8},8.7" fill="#141414" />
    </svg>
  {/each}
  {#each EQUALS as eq, i (i)}
    <span class="equals" style="left:{eq.x * S}px; top:{eq.y * S}px">=</span>
  {/each}

  {#each PARAS as p, i (i)}
    <p class="para" style="top:{p.y * S}px; font-size:{p.fs * S}px; line-height:{p.lh * S}px">{@html p.html}</p>
  {/each}
  {#each RUNS as r, i (i)}
    <span class="run {r.style}" style="left:{r.x * S}px; top:{r.y * S}px; font-size:{r.fs * S}px">{r.t}</span>
  {/each}
</div>

<style>
  .turns-page {
    position: absolute;
    inset: 0;
    color: #141414;
  }
  .corner {
    position: absolute;
  }
  .mini {
    position: absolute;
    border: 1px solid #c4c4cc;
    box-sizing: border-box;
  }
  .halfway-staff {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  .flow-arrow {
    position: absolute;
  }
  .equals {
    position: absolute;
    transform: translate(-50%, -50%);
    font-family: "Cambria", Georgia, serif;
    font-size: 36px;
    font-weight: 700;
    line-height: 1;
  }
  .rule {
    position: absolute;
    background: #141414;
  }
  .rule.heavy {
    height: 2.5px;
  }
  .rule.hair {
    height: 1px;
    background: #9a9aa4;
  }
  .para {
    position: absolute;
    left: 0;
    right: 0;
    margin: 0;
    text-align: center;
    font-family: "Cambria", Georgia, "Times New Roman", serif;
    color: #141414;
  }
  .run {
    position: absolute;
    line-height: 1;
    white-space: nowrap;
  }
  .run.mode {
    font-family: var(--guide-display);
    font-style: italic;
    font-weight: 600;
  }
  .run.vtg {
    font-family: var(--guide-display);
    font-style: italic;
  }
  .run.frame,
  .run.cap {
    font-family: "Cambria", Georgia, serif;
    font-style: italic;
  }
  .run.cap {
    color: #3c3c46;
  }
</style>
