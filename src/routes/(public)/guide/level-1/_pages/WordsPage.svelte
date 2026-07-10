<script lang="ts">
  /**
   * Words — body page (manifest `words`), faithful to proof p31 / "1.2 - Words"
   * artboard. The 1.2 chapter opener.
   *
   * Three variations of AABB (Start + 4 steps, real staff pictographs), one per
   * starting thumb orientation — in|in, out|out, in|out (blue|red). The word
   * itself: A A forward around the CW loop (blue s→w→n, red n→e→s, pro), then
   * B B back (blue n→w→s, red s→e→n, anti — prop CW, thumb flipping out and
   * back). Pro preserves each row's starting orientation, anti flips it, so
   * the three rows differ ONLY in thumb marks — the teaching point.
   *
   * Reader: each row is one clickable strip playing Start + AABB with staffs
   * from that row's thumb orientation.
   *
   * Geometry off the artboard border scan (20px/pt): 99.9pt cells at x 90.6,
   * rows y 228/327.9/427.9. Text at PROOF_TEXT coords.
   */
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import SelectionHit from "$lib/shared/selection/SelectionHit.svelte";
  import { getSequenceSelection } from "$lib/shared/selection/sequence-selection.svelte";
  import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
  import {
    MotionType,
    MotionColor,
    Orientation,
    RotationDirection,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { GridMode, GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { getGridPositionFromLocations } from "$lib/shared/pictograph/grid/services/grid-position-deriver";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { Letter } from "$lib/shared/foundation/domain/models/letter";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import { pt, ptDrag, editText, guideEdit, registerEditSource } from "../_data/guide-edit.svelte";
  import { getGuideSequenceClick } from "../_data/guide-data-context";
  import { getGuideActiveStep } from "../_data/guide-active-step.svelte";

  const S = 816 / 612; // pt → px (4/3)
  const { NORTH: N, EAST: E, SOUTH: SO_, WEST: W } = GridLocation;
  const { IN, OUT } = Orientation;
  const CW = RotationDirection.CLOCKWISE;
  const CCW = RotationDirection.COUNTER_CLOCKWISE;

  // Reader wiring (all null on /print,/book — pages stay pristine).
  const selection = getSequenceSelection();
  const activeStep = getGuideActiveStep();
  const emitSequence = getGuideSequenceClick();

  // ── AABB: A A around (pro), B B back (anti) ─────────────────────────────────
  type Leg = { from: GridLocation; to: GridLocation; anti: boolean };
  const BLUE_LEGS: Leg[] = [
    { from: SO_, to: W, anti: false },
    { from: W, to: N, anti: false },
    { from: N, to: W, anti: true },
    { from: W, to: SO_, anti: true },
  ];
  const RED_LEGS: Leg[] = [
    { from: N, to: E, anti: false },
    { from: E, to: SO_, anti: false },
    { from: SO_, to: E, anti: true },
    { from: E, to: N, anti: true },
  ];
  const LETTERS = [Letter.A, Letter.A, Letter.B, Letter.B];

  const HP_CW = new Set(["s-w", "w-n", "n-e", "e-s"]);
  const hpDir = (from: GridLocation, to: GridLocation) => (HP_CW.has(`${from}-${to}`) ? CW : CCW);
  const flip = (o: Orientation) => (o === IN ? OUT : IN);

  // Orientation at the START of step i, given the row's starting orientation:
  // pro (steps 1-2) preserves, anti (step 3) flips into step 4, which flips back.
  const oriAt = (o0: Orientation, i: number): Orientation => (i === 3 ? flip(o0) : o0);

  const hand = (color: MotionColor, leg: Leg, so: Orientation) => {
    const dir = hpDir(leg.from, leg.to);
    return createMotionData({
      motionType: leg.anti ? MotionType.ANTI : MotionType.PRO,
      rotationDirection: leg.anti ? (dir === CW ? CCW : CW) : dir,
      startLocation: leg.from,
      endLocation: leg.to,
      startOrientation: so,
      endOrientation: leg.anti ? flip(so) : so,
      turns: 0,
      color,
      propType: PropType.STAFF,
      gridMode: GridMode.DIAMOND,
    });
  };
  const stat = (color: MotionColor, loc: GridLocation, ori: Orientation) =>
    createMotionData({
      motionType: MotionType.STATIC,
      startLocation: loc,
      endLocation: loc,
      startOrientation: ori,
      endOrientation: ori,
      color,
      propType: PropType.STAFF,
      gridMode: GridMode.DIAMOND,
    });

  type RowDef = { key: string; y: number; blueOri: Orientation; redOri: Orientation; label: string };
  const ROWS: RowDef[] = [
    { key: "w-aabb-ii", y: 228.0, blueOri: IN, redOri: IN, label: "in | in" },
    { key: "w-aabb-oo", y: 327.9, blueOri: OUT, redOri: OUT, label: "out | out" },
    { key: "w-aabb-io", y: 427.9, blueOri: IN, redOri: OUT, label: "in | out" },
  ];

  const rowStep = (r: RowDef, i: number): StepData =>
    ({
      id: `${r.key}-${i + 1}`,
      letter: LETTERS[i]!,
      gridMode: GridMode.DIAMOND,
      startPosition: getGridPositionFromLocations(BLUE_LEGS[i]!.from, RED_LEGS[i]!.from),
      endPosition: getGridPositionFromLocations(BLUE_LEGS[i]!.to, RED_LEGS[i]!.to),
      stepNumber: i + 1,
      motions: {
        blue: hand(MotionColor.BLUE, BLUE_LEGS[i]!, oriAt(r.blueOri, i)),
        red: hand(MotionColor.RED, RED_LEGS[i]!, oriAt(r.redOri, i)),
      },
    }) as unknown as StepData;

  const startBox = (r: RowDef): StepData =>
    ({
      id: `${r.key}-0`,
      letter: Letter.ALPHA,
      gridMode: GridMode.DIAMOND,
      stepNumber: 0,
      startPosition: getGridPositionFromLocations(SO_, N),
      endPosition: getGridPositionFromLocations(SO_, N),
      motions: {
        blue: stat(MotionColor.BLUE, SO_, r.blueOri),
        red: stat(MotionColor.RED, N, r.redOri),
      },
    }) as unknown as StepData;

  const rowSteps = (r: RowDef): StepData[] => [startBox(r), ...[0, 1, 2, 3].map((i) => rowStep(r, i))];

  // ── Geometry ────────────────────────────────────────────────────────────────
  const CELL = 99.9;
  const ROW_X = 90.6;

  // ── Text at proof coords ────────────────────────────────────────────────────
  type Para = { x: number; y: number; fs: number; lh: number; html: string };
  let PARAS: Para[] = $state([
    { x: 0, y: 50, fs: 15, lh: 18, html: "Let’s create more complex words using pictographs!" },
    {
      x: 0,
      y: 77.6,
      fs: 15,
      lh: 18,
      html:
        "In order to perform the words in this section correctly without finger-spinning,<br>" +
        "you must be familiar with negative space and body turns.",
    },
    {
      x: 0,
      y: 123.2,
      fs: 15,
      lh: 18,
      html:
        "If you finger-spin instead of using negative space, you’ll lose precision and<br>" +
        "the ability to check your thumb orientation on each step to see if you’re still on track.",
    },
    {
      x: 0,
      y: 168.8,
      fs: 15,
      lh: 18,
      html:
        "We’ll use the word AABB as an example. Here are three variations on AABB, starting from<br>" +
        'different thumb orientations. Use staves or <strong><span class="cR">red</span>/<span class="cB">blue</span></strong> pens to follow along.',
    },
    {
      x: 0,
      y: 547,
      fs: 15,
      lh: 18,
      html:
        "As you execute these with staves, notice that each of these sequences requires a different type<br>" +
        "of negative space, either above/below the shoulder or behind the elbow.",
    },
    {
      x: 0,
      y: 601,
      fs: 15,
      lh: 18,
      html:
        "The execution of the same word can feel completely different depending on factors like<br>" +
        "the start position, rotation direction, and thumb orientation. That’s why it’s necessary to<br>" +
        "draw the full sequence with pictographs for complete clarity.",
    },
    {
      x: 0,
      y: 673,
      fs: 15,
      lh: 18,
      html:
        "<strong>The Alphabet is primarily a system of <em>pictographs</em>,<br>" +
        "organized by letters for convenient communication.</strong>",
    },
    {
      x: 0,
      y: 727,
      fs: 15,
      lh: 18,
      html:
        "The letters do not give all of the information, and are merely intended to separate<br>" +
        "motion combinations into categories which can be further clarified with detailed pictographs.",
    },
  ]);

  const r1 = (n: number) => Math.round(n * 10) / 10;
  $effect(() =>
    registerEditSource("Words (p31)", () =>
      PARAS.map((p, i) => `  para[${i}]: x: ${r1(p.x)}, y: ${r1(p.y)}`).join("\n")
    )
  );

  const PICTO_FLAGS = {
    showGrid: true,
    showTKA: true,
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

<div class="words-page">
  <!-- "Thumbs" heading + per-row colored orientation labels. -->
  <span class="thumbs-head" style="left:{10 * S}px; top:{225.3 * S}px; width:{62 * S}px; font-size:{14 * S}px">Thumbs</span>
  {#each ROWS as r (r.key)}
    <span class="thumbs-label" style="left:{4 * S}px; top:{(r.y + 43) * S}px; width:{78 * S}px; font-size:{14 * S}px">
      <span class="cB">{r.label.split(" | ")[0]}</span>&nbsp;|&nbsp;<span class="cR">{r.label.split(" | ")[1]}</span>
    </span>
  {/each}

  <!-- Three AABB strips — one clickable row per thumb orientation. -->
  {#each ROWS as r (r.key)}
    <div
      class="strip-wrap tka-seq-cell"
      class:is-hovered={selection?.isHovered(r.key)}
      class:is-selected={selection?.isSelected(r.key)}
      style="left:{ROW_X * S}px; top:{r.y * S}px; width:{CELL * 5 * S}px; height:{CELL * S}px"
    >
      {#each [-1, 0, 1, 2, 3] as i (i)}
        <div
          class="mini cell"
          class:guide-step-active={activeStep?.key === r.key && activeStep.ringStep === i + 1}
          style="left:{(i + 1) * CELL * S}px; top:0; width:{CELL * S}px; height:{CELL * S}px"
        >
          <PictographContainer
            pictographData={i === -1 ? startBox(r) : rowStep(r, i)}
            gridMode={GridMode.DIAMOND}
            bluePropTypeOverride={PropType.STAFF}
            redPropTypeOverride={PropType.STAFF}
            stepNumberOverride={true}
            {...PICTO_FLAGS}
          />
        </div>
      {/each}
      <SelectionHit
        groupId={r.key}
        isGroupStart
        label={`Animate AABB starting thumbs ${r.label}`}
        onselect={() => emitSequence?.({ strip: rowSteps(r), word: `AABB (${r.label})`, key: r.key, propType: "staff" })}
      />
    </div>
  {/each}

  <!-- Paragraphs (proof coords). -->
  {#each PARAS as p, i (i)}
    <p
      class="para"
      class:edit={guideEdit.on}
      class:selected={guideEdit.selectedId === `w-para-${i}`}
      style="top:{p.y * S}px; font-size:{p.fs * S}px; line-height:{p.lh * S}px"
      use:ptDrag={pt(`w-para-${i}`, "para", p)}
      use:editText={{ id: `w-para-${i}`, label: "para", get: () => p.html, set: (h) => (p.html = h) }}
    >
      {@html p.html}
    </p>
  {/each}
</div>

<style>
  /* Absolute layer over the whole GuidePage sheet; coords map straight to pt×S. */
  .words-page {
    position: absolute;
    inset: 0;
    color: #141414;
  }

  .strip-wrap {
    position: absolute;
  }

  .mini {
    position: absolute;
    border: 1px solid #c4c4cc;
    box-sizing: border-box;
  }

  .thumbs-head,
  .thumbs-label {
    position: absolute;
    font-family: "Cambria", Georgia, "Times New Roman", serif;
    font-style: italic;
    text-align: center;
    line-height: 1;
    white-space: nowrap;
  }
  .thumbs-label {
    font-weight: 700;
  }
  .thumbs-label .cB,
  .para :global(.cB) {
    color: #2e3192;
  }
  .thumbs-label .cR,
  .para :global(.cR) {
    color: #cc2127;
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

  .para.edit {
    outline: 1px dashed rgba(55, 48, 163, 0.4);
    cursor: move;
  }
  .para.selected {
    outline: 1.5px solid #3730a3;
    outline-offset: 1px;
  }
</style>
