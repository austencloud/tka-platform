<script lang="ts">
  /**
   * Real-pictograph diagrams for the Type 1 (dual-shift) 1|1 breakdown,
   * mirroring OneOneType1Page.svelte's four `STRIPS` (D, I, N, V) exactly -
   * same motions/turns/orientations, the print artboard is the source of
   * truth for this data. Both hands turn simultaneously on every strip, so
   * the halfway frame uses TurnStrip's dual-pose kind (two staves in one
   * cell) rather than buildHalvedStep - matching the print artboard, which
   * also renders these via the raw halfwayPose interpolator rather than the
   * halved-pictograph pipeline.
   *
   * Types 2 through 6 are left as their original TODO markers: their source
   * artboards (OneOneType23Page.svelte, OneOneType456Page.svelte) were not
   * part of this task's assigned data sources, so no motion data has been
   * copied for them here - inventing it would violate the "never invent
   * motions" rule.
   */
  import GuideSection from "../../../level-1/_components/GuideSection.svelte";
  import TurnStrip, { type TurnStripFrame } from "../../_components/TurnStrip.svelte";
  import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
  import {
    MotionType,
    MotionColor,
    Orientation,
    RotationDirection,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { GridMode, GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import type { HalfwayMotion } from "../../_data/halfway-pose";
  import { bakeReversals } from "../../../level-1/_data/guide-sequence-adapter";

  const { NORTH: N, EAST: E, SOUTH: SO_, WEST: W } = GridLocation;
  const { IN, OUT } = Orientation;
  const CW = RotationDirection.CLOCKWISE;
  const CCW = RotationDirection.COUNTER_CLOCKWISE;
  const NOROT = RotationDirection.NO_ROTATION;
  const B = MotionColor.BLUE;
  const R = MotionColor.RED;
  const PRO = MotionType.PRO;
  const ANTI = MotionType.ANTI;

  const mo = (
    color: MotionColor,
    type: MotionType,
    from: GridLocation,
    to: GridLocation,
    rot: RotationDirection,
    so: Orientation,
    eo: Orientation,
    turns = 0
  ) =>
    createMotionData({
      motionType: type,
      rotationDirection: rot,
      startLocation: from,
      endLocation: to,
      startOrientation: so,
      endOrientation: eo,
      turns,
      color,
      propType: PropType.STAFF,
      gridMode: GridMode.DIAMOND,
    });
  const stat = (color: MotionColor, loc: GridLocation, ori: Orientation) =>
    mo(color, MotionType.STATIC, loc, loc, NOROT, ori, ori);

  type Hand = { type: MotionType; from: GridLocation; to: GridLocation; rot: RotationDirection };
  const H = (type: MotionType, from: GridLocation, to: GridLocation, rot: RotationDirection): Hand => ({ type, from, to, rot });
  const half = (t: MotionType): number => (t === ANTI ? 1 : 0) + 1;
  const endOf = (t: MotionType): Orientation => (half(t) % 2 === 0 ? IN : OUT);

  function makeStrip(opts: { id: string; word: string; endThumb: string; halfThumb?: string; blue: Hand; red: Hand }) {
    const bEnd = endOf(opts.blue.type);
    const rEnd = endOf(opts.red.type);
    const hm = (h: Hand, eo: Orientation): HalfwayMotion => ({
      type: h.type,
      from: h.from,
      to: h.to,
      rot: h.rot,
      startOri: IN,
      endOri: eo,
      turns: 1,
    });
    const step = (id: string, blue: ReturnType<typeof mo>, red: ReturnType<typeof mo>) => ({
      id: `l2oo1-${opts.id}-${id}`,
      letter: null,
      gridMode: GridMode.DIAMOND,
      motions: { blue, red },
    });
    const startStep = step("start", stat(B, opts.blue.from, IN), stat(R, opts.red.from, IN)) as unknown as StepData;
    const endStep = step("end", stat(B, opts.blue.to, bEnd), stat(R, opts.red.to, rEnd)) as unknown as StepData;
    const combinedData = step(
      "full",
      mo(B, opts.blue.type, opts.blue.from, opts.blue.to, opts.blue.rot, IN, bEnd, 1),
      mo(R, opts.red.type, opts.red.from, opts.red.to, opts.red.rot, IN, rEnd, 1)
    );
    const combinedStep = { ...combinedData, stepNumber: 1 } as unknown as StepData;
    const animKey = `l2oo1-${opts.id}`;
    const rowSteps = [
      { ...startStep, stepNumber: 0 } as unknown as StepData,
      ...bakeReversals([combinedStep]),
    ];
    const frames: TurnStripFrame[] = [
      { kind: "start", step: { ...startStep, stepNumber: 0 } as unknown as StepData, frameLabel: "start", thumbLabel: "in" },
      {
        kind: "dual-pose",
        poses: [
          { motion: hm(opts.blue, bEnd), color: B, t: 0.5 },
          { motion: hm(opts.red, rEnd), color: R, t: 0.5 },
        ],
        frameLabel: "halfway",
        thumbLabel: opts.halfThumb,
      },
      { kind: "end", step: { ...endStep, stepNumber: 0 } as unknown as StepData, frameLabel: "end", thumbLabel: opts.endThumb },
      { kind: "combined", step: combinedStep, animKey, word: opts.word, rowSteps },
    ];
    return frames;
  }

  const dFrames = makeStrip({
    id: "d", word: "D-One-One", endThumb: "out",
    blue: H(PRO, N, W, CCW), red: H(PRO, N, E, CW),
  });
  const iFrames = makeStrip({
    id: "i", word: "I-One-One", endThumb: "mixed",
    blue: H(ANTI, E, SO_, CCW), red: H(PRO, E, SO_, CW),
  });
  const nFrames = makeStrip({
    id: "n", word: "N-One-One", endThumb: "in", halfThumb: "out",
    blue: H(ANTI, SO_, E, CW), red: H(ANTI, W, N, CCW),
  });
  const vFrames = makeStrip({
    id: "v", word: "V-One-One", endThumb: "mixed",
    blue: H(ANTI, W, N, CCW), red: H(PRO, SO_, W, CW),
  });
</script>

<GuideSection id="one-one-turns" title="1|1 Turns">
  <div class="section-body">
    <p>
      For a turn on both props, add a "1" in both the high and the low slot. This can also be written as 1|1. Here are some cherry-picked examples of 1|1 in each Type. Since you know all the mechanisms involved, explanation is kept to a minimum.
    </p>

    <h3>Type 1</h3>
    <p>Pause at the halfway point of each motion while learning. This will ensure accurate timing.</p>
  </div>

  <TurnStrip frames={dFrames} caption="D-One-One: both hands with a turn, start, halfway, end, full motion" />
  <TurnStrip frames={iFrames} caption="I-One-One: both hands with a turn, start, halfway, end, full motion" />
  <TurnStrip frames={nFrames} caption="N-One-One: both hands with a turn, start, halfway, end, full motion" />
  <TurnStrip frames={vFrames} caption="V-One-One: both hands with a turn, start, halfway, end, full motion" />

  <div class="section-body">
    <h3>Type 2</h3>
    <!-- TODO: add diagram - X-Same One-One, X-Opp One-One -->

    <h3>Type 3</h3>
    <!-- TODO: add diagram - Theta-Dash Same One-One, Theta-Dash Opp One-One, Delta-Dash Same One-One, Delta-Dash Opp One-One -->

    <h3>Type 4</h3>
    <!-- TODO: add diagram - Phi-Same One-One, Phi-Opp One-One -->

    <h3>Type 5</h3>
    <!-- TODO: add diagram - Psi-Dash Same One-One, Psi-Dash Opp One-One -->

    <h3>Type 6</h3>
    <!-- TODO: add diagram - Gamma Opp One-One (two variations) -->
  </div>
</GuideSection>

<style>
  /* Prose measure + rhythm mirror level-1's FlowFrame `.flow-p`/`.flow-h3`.
     TurnStrip calls stay OUTSIDE these wrappers, as direct GuideSection
     children, so their own grid-column breakout (TurnStrip.svelte) still
     applies. */
  .section-body :global(p) {
    max-width: 34rem;
    margin: 0 auto 1.1rem;
    text-align: center;
    text-wrap: balance;
  }
  .section-body :global(p:last-child) {
    margin-bottom: 0;
  }
  .section-body :global(h3) {
    text-align: center;
    text-wrap: balance;
    margin: 1.75rem 0 0.35rem;
  }
  .section-body :global(h3:first-child) {
    margin-top: 0;
  }
</style>
