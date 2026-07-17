<script lang="ts">
  /**
   * Real-pictograph diagrams for the Lam (Λ) opening/closing breakdown,
   * mirroring OpeningClosingPage.svelte's four `STRIPS` exactly - same
   * motions/turns/orientations, the print artboard is the source of truth
   * for this data. The print artboard's bonus "Continuation" column (a
   * hypothetical pro-shift showing why each variant is called opening/W or
   * closing/Y) has no corresponding prose or TODO in this article section -
   * omitted here to avoid inventing new copy around it, same judgment call
   * ch21's DoubleTurnShifts made for TwoTurnsShiftsPage's bonus antiHalves
   * strip. Both hands move on every strip (one hand always turns, the other
   * stays at its base form), so the halfway frame uses TurnStrip's
   * dual-pose kind, matching how the print artboard renders these via the
   * raw halfway-pose interpolator.
   */
  import GuideSection from "../../../level-1/_components/GuideSection.svelte";
  import SequenceShowcase from "../../../level-1/_components/SequenceShowcase.svelte";
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
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { HalfwayMotion } from "../../_data/halfway-pose";
  import { bakeReversals, stripToSequence } from "../../../level-1/_data/guide-sequence-adapter";

  const { NORTH: N, SOUTH: SO_, WEST: W } = GridLocation;
  const { IN, OUT } = Orientation;
  const CW = RotationDirection.CLOCKWISE;
  const CCW = RotationDirection.COUNTER_CLOCKWISE;
  const NOROT = RotationDirection.NO_ROTATION;
  const B = MotionColor.BLUE;
  const R = MotionColor.RED;

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

  type Hand = { type: MotionType; from: GridLocation; to: GridLocation; rot: RotationDirection; turns: number };
  const half = (h: Hand): number => (h.type === MotionType.ANTI || h.type === MotionType.DASH ? 1 : 0) + h.turns;
  const endOf = (h: Hand): Orientation => (half(h) % 2 === 0 ? IN : OUT);

  function makeStrip(opts: { id: string; word: string; blue: Hand; red: Hand }): { frames: TurnStripFrame[]; sequence: SequenceData } {
    const bEnd = endOf(opts.blue);
    const rEnd = endOf(opts.red);
    const hm = (h: Hand, eo: Orientation): HalfwayMotion => ({
      type: h.type,
      from: h.from,
      to: h.to,
      rot: h.rot,
      startOri: IN,
      endOri: eo,
      turns: h.turns,
    });
    const step = (id: string, blue: ReturnType<typeof mo>, red: ReturnType<typeof mo>) => ({
      id: `l2lam-${opts.id}-${id}`,
      letter: null,
      gridMode: GridMode.DIAMOND,
      motions: { blue, red },
    });
    const startStep = { ...step("start", stat(B, opts.blue.from, IN), stat(R, opts.red.from, IN)), stepNumber: 0 } as unknown as StepData;
    const endStep = { ...step("end", stat(B, opts.blue.to, bEnd), stat(R, opts.red.to, rEnd)), stepNumber: 0 } as unknown as StepData;
    const combinedStep = {
      ...step(
        "full",
        mo(B, opts.blue.type, opts.blue.from, opts.blue.to, opts.blue.rot, IN, bEnd, opts.blue.turns),
        mo(R, opts.red.type, opts.red.from, opts.red.to, opts.red.rot, IN, rEnd, opts.red.turns)
      ),
      stepNumber: 1,
    } as unknown as StepData;
    const animKey = `l2lam-${opts.id}`;
    const rowSteps = [startStep, ...bakeReversals([combinedStep])];
    const frames: TurnStripFrame[] = [
      { kind: "start", step: startStep, frameLabel: "start", thumbLabel: "in" },
      {
        kind: "dual-pose",
        poses: [
          { motion: hm(opts.blue, bEnd), color: B, t: 0.5 },
          { motion: hm(opts.red, rEnd), color: R, t: 0.5 },
        ],
        frameLabel: "halfway",
      },
      { kind: "end", step: endStep, frameLabel: "end", thumbLabel: bEnd === IN ? "in" : "out" },
      { kind: "combined", step: combinedStep, animKey, word: opts.word, rowSteps },
    ];
    const sequence = stripToSequence(rowSteps, { word: opts.word, name: opts.word });
    return { frames, sequence };
  }

  // Λ = static(blue @W) + dash(red s→n), the same base OpeningClosingPage draws from.
  const STAT_BLUE = (turns: number, rot: RotationDirection): Hand => ({ type: MotionType.STATIC, from: W, to: W, rot, turns });
  const DASH_RED = (turns: number, rot: RotationDirection): Hand => ({ type: MotionType.DASH, from: SO_, to: N, rot, turns });

  const { frames: highOpenFrames, sequence: highOpenSequence } = makeStrip({
    id: "hi-op", word: "Lam-High-One opening",
    blue: STAT_BLUE(0, NOROT), red: DASH_RED(1, CW),
  });
  const { frames: highCloseFrames, sequence: highCloseSequence } = makeStrip({
    id: "hi-cl", word: "Lam-High-One closing",
    blue: STAT_BLUE(0, NOROT), red: DASH_RED(1, CCW),
  });
  const { frames: lowOpenFrames, sequence: lowOpenSequence } = makeStrip({
    id: "lo-op", word: "Lam-Low-One opening",
    blue: STAT_BLUE(1, CCW), red: DASH_RED(0, NOROT),
  });
  const { frames: lowCloseFrames, sequence: lowCloseSequence } = makeStrip({
    id: "lo-cl", word: "Lam-Low-One closing",
    blue: STAT_BLUE(1, CW), red: DASH_RED(0, NOROT),
  });
</script>

<GuideSection id="opening-closing" title="Opening / Closing">
  <div class="section-body">
    <p>
      Because of Gamma's asymmetry, Λ (Lam) presents an extra variation when adding a turn. We can't use rotational relationship to tell them apart, because there isn't one to describe. Instead, we can disambiguate them with opening and closing. This refers to the appearance of the 90° angle if we continue the rotation into a pro-shift.
    </p>
  </div>

  <div class="showcase-wrap">
    <SequenceShowcase variant="compact" render={{ propType: PropType.STAFF }} sequence={highOpenSequence} items={[]} bpm={60}>
      {#snippet strip(t)}
        <TurnStrip frames={highOpenFrames} activeT={t} caption="Opening - the dashing hand carries the turn; its spin resolves toward alpha, hands finishing apart" />
      {/snippet}
    </SequenceShowcase>
  </div>
  <div class="showcase-wrap">
    <SequenceShowcase variant="compact" render={{ propType: PropType.STAFF }} sequence={highCloseSequence} items={[]} bpm={60}>
      {#snippet strip(t)}
        <TurnStrip frames={highCloseFrames} activeT={t} caption="Closing - the dashing hand carries the turn; its spin resolves toward beta, hands finishing together" />
      {/snippet}
    </SequenceShowcase>
  </div>

  <div class="section-body">
    <p>
      Now let's add 1 turn to the static hand, leaving the dash in its base form. Since the dashing prop is not rotating, there is no rotational relationship to describe. However the rotating static prop can still be identified as opening or closing.
    </p>
  </div>

  <div class="showcase-wrap">
    <SequenceShowcase variant="compact" render={{ propType: PropType.STAFF }} sequence={lowOpenSequence} items={[]} bpm={60}>
      {#snippet strip(t)}
        <TurnStrip frames={lowOpenFrames} activeT={t} caption="Opening - the static hand carries the turn this time; its spin resolves toward alpha, hands finishing apart" />
      {/snippet}
    </SequenceShowcase>
  </div>
  <div class="showcase-wrap">
    <SequenceShowcase variant="compact" render={{ propType: PropType.STAFF }} sequence={lowCloseSequence} items={[]} bpm={60}>
      {#snippet strip(t)}
        <TurnStrip frames={lowCloseFrames} activeT={t} caption="Closing - the static hand carries the turn this time; its spin resolves toward beta, hands finishing together" />
      {/snippet}
    </SequenceShowcase>
  </div>

  <div class="section-body">
    <p>
      It's not necessary to speak all of the glyph modifications when talking about a letter. It would be cumbersome if you were required to say "Lam-Low-One-Closing". In the context of a word or sequence, you can just refer to the base letter "Lam" instead.
    </p>

    <p>
      To shorten this for code, include "op" or "cl" as a final parameter. E.g. "(0,1,op)" or "(0,1,cl)"
    </p>
  </div>
</GuideSection>

<style>
  /* Prose measure + rhythm mirror level-1's FlowFrame `.flow-p`. TurnStrip
     calls stay OUTSIDE these wrappers, as direct GuideSection children, so
     their own grid-column breakout (see TurnStrip.svelte) still applies. */
  .section-body :global(p) {
    max-width: 34rem;
    margin: 0 auto 1.1rem;
    text-align: center;
    text-wrap: balance;
  }
  .section-body :global(p:last-child) {
    margin-bottom: 0;
  }
  .showcase-wrap {
    /* The showcase inside is a container-query container (container-type:
       inline-size), so it has ZERO intrinsic width - this wrapper must get a
       DEFINITE width from the grid (width: 100% + justify-self), never
       shrink-to-fit (auto width + auto margins collapsed it to its padding). */
    grid-column: full-start / full-end;
    width: 100%;
    max-width: 76rem;
    justify-self: center;
    margin: 1.9rem 0;
    padding: 0 2rem;
  }
</style>
