<script lang="ts">
  /**
   * 2-Turns (Dashes / Static) — Level 2 body page (manifest
   * `two-turns-dash-static`), faithful to the source artboard (level-2.pdf page
   * 23). Self-titled (Dashes + Static heads). Three strips:
   *
   *   Dash (quarters) — start S(in) → ¼ → ½ → ¾ → end N(out), broken into the
   *                     four parts the proof calls out; = DASH s→n IN→OUT CCW
   *                     turns=2 (up → down → up on a vertical dash).
   *   Dash (halves)   — the same dash sampled in half (start/halfway/end).
   *   Static (halves) — start E(in) → halfway (360°, out at 180°) → end E(in)
   *                     = STATIC E IN→IN CCW turns=2 (in → out → in, a 360° turn
   *                     in place).
   *
   * Every frame renders the red staff+arrow drawing lifted vector-exact from that
   * artboard frame via LiftedTurnFrame (strips p23_s0 / p23_s1 / p23_s2 in
   * lifted-turn-arrows.ts). The end-direction arrows — the dash bow, the static
   * 360° loop — are Austen's own drawings, not the app motion-arrow assets, so
   * they match the guide 1:1 (including the compound near-cycloid dash slices
   * that a glyph map could only approximate). The combined frame of each strip is
   * the click-to-animate target; the animation is built from the real motion data
   * (redStaff), independent of the lifted display.
   */
  import SelectionHit from "$lib/shared/selection/SelectionHit.svelte";
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
  import LiftedTurnFrame from "../_components/LiftedTurnFrame.svelte";
  import { bakeReversals } from "../../level-1/_data/guide-sequence-adapter";
  import { getGuideSequenceClick } from "../../level-1/_data/guide-data-context";
  import { getGuideActiveStep } from "../../level-1/_data/guide-active-step.svelte";

  const S = 816 / 612;
  const { NORTH: N, EAST: E, SOUTH: SO_ } = GridLocation;
  const { IN, OUT } = Orientation;
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
    id: `l2tds-${id}`,
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

  const dashQCombined = redStaff("dash-q-full", MotionType.DASH, SO_, N, IN, OUT, CCW, 2);
  const dashHCombined = redStaff("dash-h-full", MotionType.DASH, SO_, N, IN, OUT, CCW, 2);
  const staticCombined = redStaff("static-full", MotionType.STATIC, E, E, IN, IN, CCW, 2);

  // ── Strip model ────────────────────────────────────────────────────────────
  // Every frame is the lifted artboard drawing (LiftedTurnFrame frameKey =
  // `${liftBase}_f${index}`). The last frame of a strip is the combined result
  // and carries an animKey (click-to-animate the real motion).
  type Frame = { left: number; frameLabel?: string; thumbLabel?: string; animKey?: string };
  type Strip = { y: number; size: number; capY: number; thumbY: number; liftBase: string; frames: Frame[] };

  const dashQuarters: Strip = {
    y: 158,
    size: 74,
    capY: 133,
    thumbY: 150,
    liftBase: "p23_s0",
    frames: [
      { left: 21, frameLabel: "start", thumbLabel: "in" },
      { left: 121 },
      { left: 221, frameLabel: "halfway" },
      { left: 321 },
      { left: 421, frameLabel: "end", thumbLabel: "out" },
      { left: 523, animKey: "l2tds-dash-q" },
    ],
  };
  const dashHalves: Strip = {
    y: 348,
    size: 88,
    capY: 320,
    thumbY: 336,
    liftBase: "p23_s1",
    frames: [
      { left: 86, frameLabel: "start", thumbLabel: "in" },
      { left: 206, frameLabel: "halfway" },
      { left: 326, frameLabel: "end", thumbLabel: "out" },
      { left: 446, animKey: "l2tds-dash-h" },
    ],
  };
  const staticHalves: Strip = {
    y: 625,
    size: 100,
    capY: 598,
    thumbY: 616,
    liftBase: "p23_s2",
    frames: [
      { left: 95, frameLabel: "start", thumbLabel: "in" },
      { left: 215, frameLabel: "halfway", thumbLabel: "out" },
      { left: 335, frameLabel: "end", thumbLabel: "in" },
      { left: 455, animKey: "l2tds-static" },
    ],
  };
  const STRIPS = [dashQuarters, dashHalves, staticHalves];

  const connectors = (strip: Strip) => {
    const out: { x: number; y: number; equals: boolean }[] = [];
    const midY = strip.y + strip.size / 2;
    for (let i = 0; i < strip.frames.length - 1; i++) {
      const rightEdge = strip.frames[i]!.left + strip.size;
      const nextLeft = strip.frames[i + 1]!.left;
      out.push({ x: (rightEdge + nextLeft) / 2, y: midY, equals: i === strip.frames.length - 2 });
    }
    return out;
  };

  const ARROW_W = 14.5;

  // ── Click-to-animate ────────────────────────────────────────────────────────
  const ANIM = {
    "l2tds-dash-q": { data: dashQCombined, word: "Dash with 2 turns", startLoc: SO_ },
    "l2tds-dash-h": { data: dashHCombined, word: "Dash with 2 turns", startLoc: SO_ },
    "l2tds-static": { data: staticCombined, word: "Static with 2 turns", startLoc: E },
  } as const;
  const animStep = (data: ReturnType<typeof redStaff>, stepNumber: number, startLoc: GridLocation): StepData =>
    ({
      ...data,
      id: `${data.id}-anim-${stepNumber}`,
      stepNumber,
      motions: {
        blue: createPlaceholderMotion(MotionColor.BLUE, { location: startLoc, orientation: IN }),
        red: data.motions.red,
      },
    }) as unknown as StepData;
  const rowSteps = (key: string): StepData[] => {
    const cfg = ANIM[key as keyof typeof ANIM];
    const start = animStep(stat(`${key}-start`, cfg.startLoc, IN), 0, cfg.startLoc);
    const combined = animStep(cfg.data, 1, cfg.startLoc);
    return [start, ...bakeReversals([combined])];
  };

  // ── Text (pt coords, proof wording verbatim) ────────────────────────────────
  type Para = { y: number; fs: number; lh: number; html: string };
  const PARAS: Para[] = [
    {
      y: 46,
      fs: 15.5,
      lh: 18.5,
      html: "Now let’s add a double turn to a dash.<br>It’s relatively complex, so we’ll break it down into four parts.<br><em>(These arrows refer to the pinky end on the first half,<br>then to the thumb end on the second half.)</em>",
    },
    {
      y: 265,
      fs: 14.5,
      lh: 18,
      html: "As with all dashes, it’s important to travel in a straight handpath even though the prop is rotating.<br>Here is the same motion broken in half:",
    },
    {
      y: 439,
      fs: 15.5,
      lh: 19,
      html: "A base dash starting from thumb in ends with thumb out, therefore<br><strong>A dash with 2 turns also ends with thumb out. (in → out)</strong><br><strong>For a vertical dash such as this, you can use up/down as indicators. (up → down → up)</strong>",
    },
    {
      y: 537,
      fs: 15.5,
      lh: 19,
      html: "Finally, a static motion with 2 turns is simply a 360° turn in place.<br>It’s necessary to use negative space or a turn to achieve this.",
    },
    {
      y: 729,
      fs: 16,
      lh: 20,
      html: "A static motion has 0 thumb switches, therefore<br><strong>A static motion with 2 turns has 2 thumb switches (in → out → in).</strong>",
    },
  ];

  type Run = { x: number; y: number; fs: number; style: "title" | "mode" | "cap"; t: string; centered?: boolean };
  const RUNS: Run[] = [
    { x: 0, y: 5, fs: 34, style: "title", t: "Dashes", centered: true },
    { x: 22, y: 524, fs: 30, style: "mode", t: "Static" },
    { x: 77, y: 616, fs: 13, style: "cap", t: "thumbs:" },
  ];
</script>

<div class="tt-page">
  <div class="rule heavy" style="left:{20 * S}px; top:{515 * S}px; width:{572 * S}px"></div>

  {#each STRIPS as strip, si (si)}
    {#each strip.frames as frame, fi (fi)}
      {@const key = `${strip.liftBase}_f${fi}`}
      {#if frame.animKey}
        {@const animKey = frame.animKey}
        <div
          class="mini tka-seq-cell"
          class:is-hovered={selection?.isHovered(animKey)}
          class:is-selected={selection?.isSelected(animKey)}
          class:guide-step-active={activeStep?.key === animKey}
          style="left:{frame.left * S}px; top:{strip.y * S}px; width:{strip.size * S}px; height:{strip.size * S}px"
        >
          <LiftedTurnFrame frameKey={key} />
          <SelectionHit
            groupId={animKey}
            isGroupStart
            label={`Animate: ${ANIM[animKey as keyof typeof ANIM].word}`}
            onselect={() => emitSequence?.({ strip: rowSteps(animKey), word: ANIM[animKey as keyof typeof ANIM].word, key: animKey, propType: "staff" })}
          />
        </div>
      {:else}
        <div class="mini" style="left:{frame.left * S}px; top:{strip.y * S}px; width:{strip.size * S}px; height:{strip.size * S}px">
          <LiftedTurnFrame frameKey={key} />
        </div>
      {/if}
      {#if frame.frameLabel}
        <span class="cap frame" style="left:{frame.left * S}px; top:{strip.capY * S}px; width:{strip.size * S}px">{frame.frameLabel}</span>
      {/if}
      {#if frame.thumbLabel}
        <span class="cap thumb" style="left:{frame.left * S}px; top:{strip.thumbY * S}px; width:{strip.size * S}px">{frame.thumbLabel}</span>
      {/if}
    {/each}

    {#each connectors(strip) as c (c.x)}
      {#if c.equals}
        <span class="equals" style="left:{c.x * S}px; top:{c.y * S}px">=</span>
      {:else}
        <svg
          class="flow-arrow"
          style="left:{(c.x - ARROW_W / 2) * S}px; top:{(c.y - 5) * S}px; width:{ARROW_W * S}px; height:{10 * S}px"
          viewBox="0 0 {ARROW_W} 10"
          aria-hidden="true"
        >
          <line x1="0" y1="5" x2={ARROW_W - 7} y2="5" stroke="#141414" stroke-width="2" />
          <polygon points="{ARROW_W - 8},1.3 {ARROW_W},5 {ARROW_W - 8},8.7" fill="#141414" />
        </svg>
      {/if}
    {/each}
  {/each}

  {#each PARAS as p, i (i)}
    <p class="para" style="top:{p.y * S}px; font-size:{p.fs * S}px; line-height:{p.lh * S}px">{@html p.html}</p>
  {/each}
  {#each RUNS as r, i (i)}
    {#if r.centered}
      <span class="run {r.style} centered" style="top:{r.y * S}px; font-size:{r.fs * S}px">{r.t}</span>
    {:else}
      <span class="run {r.style}" style="left:{r.x * S}px; top:{r.y * S}px; font-size:{r.fs * S}px">{r.t}</span>
    {/if}
  {/each}
</div>

<style>
  .tt-page {
    position: absolute;
    inset: 0;
    color: #141414;
  }
  .mini {
    position: absolute;
    border: 1px solid #c4c4cc;
    box-sizing: border-box;
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
  .para {
    position: absolute;
    left: 0;
    right: 0;
    margin: 0;
    text-align: center;
    font-family: "Cambria", Georgia, "Times New Roman", serif;
    color: #141414;
  }
  .cap {
    position: absolute;
    text-align: center;
    font-family: "Cambria", Georgia, serif;
    font-style: italic;
    line-height: 1;
    font-size: 15px;
  }
  .cap.thumb {
    color: #3c3c46;
    font-size: 14px;
  }
  .run {
    position: absolute;
    line-height: 1;
    white-space: nowrap;
  }
  .run.centered {
    left: 0;
    right: 0;
    text-align: center;
  }
  .run.title {
    font-family: var(--guide-display);
    font-style: italic;
    font-weight: 700;
  }
  .run.mode {
    font-family: var(--guide-display);
    font-style: italic;
    font-weight: 600;
  }
  .run.cap {
    font-family: "Cambria", Georgia, serif;
    font-style: italic;
    color: #3c3c46;
  }
</style>
