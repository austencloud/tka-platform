<script lang="ts">
  /**
   * Real-pictograph diagrams for the S/T leading-following breakdown,
   * mirroring SAndTPage.svelte's four `STRIPS` (S-High, S-Low, T-High,
   * T-Low) exactly — same motions/turns/orientations, the print artboard
   * is the source of truth for this data. Both hands move on every strip,
   * so the halfway frame uses TurnStrip's dual-pose kind, matching how the
   * print artboard renders these via the raw halfway-pose interpolator.
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

  const { EAST: E, SOUTH: SO_, WEST: W } = GridLocation;
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

  type Hand = { type: MotionType; from: GridLocation; to: GridLocation; rot: RotationDirection };
  const halfTurns = (type: MotionType, turns: number): number => (type === MotionType.ANTI ? 1 : 0) + turns;
  const endOri = (type: MotionType, turns: number): Orientation => (halfTurns(type, turns) % 2 === 0 ? IN : OUT);

  function makeStrip(opts: {
    id: string;
    word: string;
    blue: Hand;
    red: Hand;
    blueTurns: number;
    redTurns: number;
  }): TurnStripFrame[] {
    const bEnd = endOri(opts.blue.type, opts.blueTurns);
    const rEnd = endOri(opts.red.type, opts.redTurns);
    const bHalf: HalfwayMotion = { type: opts.blue.type, from: opts.blue.from, to: opts.blue.to, rot: opts.blue.rot, startOri: IN, endOri: bEnd, turns: opts.blueTurns };
    const rHalf: HalfwayMotion = { type: opts.red.type, from: opts.red.from, to: opts.red.to, rot: opts.red.rot, startOri: IN, endOri: rEnd, turns: opts.redTurns };
    const step = (id: string, blue: ReturnType<typeof mo>, red: ReturnType<typeof mo>) => ({
      id: `l2st-${opts.id}-${id}`,
      letter: null,
      gridMode: GridMode.DIAMOND,
      motions: { blue, red },
    });
    const startStep = { ...step("start", stat(B, opts.blue.from, IN), stat(R, opts.red.from, IN)), stepNumber: 0 } as unknown as StepData;
    const endStep = { ...step("end", stat(B, opts.blue.to, bEnd), stat(R, opts.red.to, rEnd)), stepNumber: 0 } as unknown as StepData;
    const combinedStep = {
      ...step(
        "full",
        mo(B, opts.blue.type, opts.blue.from, opts.blue.to, opts.blue.rot, IN, bEnd, opts.blueTurns),
        mo(R, opts.red.type, opts.red.from, opts.red.to, opts.red.rot, IN, rEnd, opts.redTurns)
      ),
      stepNumber: 1,
    } as unknown as StepData;
    const animKey = `l2st-${opts.id}`;
    const rowSteps = [startStep, ...bakeReversals([combinedStep])];
    return [
      { kind: "start", step: startStep, frameLabel: "start", thumbLabel: "in" },
      {
        kind: "dual-pose",
        poses: [
          { motion: bHalf, color: B, t: 0.5 },
          { motion: rHalf, color: R, t: 0.5 },
        ],
        frameLabel: "halfway",
      },
      { kind: "end", step: endStep, frameLabel: "end", thumbLabel: "mixed" },
      { kind: "combined", step: combinedStep, animKey, word: opts.word, rowSteps },
    ];
  }

  // S = pro|pro leading/following; T = anti|anti leading/following. Both use
  // the same base blue w→s / red s→e variation SAndTPage draws from.
  const S_BLUE: Hand = { type: MotionType.PRO, from: W, to: SO_, rot: CCW };
  const S_RED: Hand = { type: MotionType.PRO, from: SO_, to: E, rot: CCW };
  const T_BLUE: Hand = { type: MotionType.ANTI, from: W, to: SO_, rot: CW };
  const T_RED: Hand = { type: MotionType.ANTI, from: SO_, to: E, rot: CW };

  const sHighFrames = makeStrip({ id: "s-hi", word: "S-High-One", blue: S_BLUE, red: S_RED, blueTurns: 1, redTurns: 0 });
  const sLowFrames = makeStrip({ id: "s-lo", word: "S-Low-One", blue: S_BLUE, red: S_RED, blueTurns: 0, redTurns: 1 });
  const tHighFrames = makeStrip({ id: "t-hi", word: "T-High-One", blue: T_BLUE, red: T_RED, blueTurns: 1, redTurns: 0 });
  const tLowFrames = makeStrip({ id: "t-lo", word: "T-Low-One", blue: T_BLUE, red: T_RED, blueTurns: 0, redTurns: 1 });
</script>

<GuideSection id="s-and-t" title="S and T">
  <p>
    S and T are a different type of hybrid. Even though their motions are a matching shift type (pro|pro, anti|anti), each has one hand leading and the other following. Though this doesn't affect their base forms, it produces additional variations when modifying their motions. S and T are the only letters that have a leader and follower while both hands share the same motion type.
  </p>

  <p>
    Fortunately, we have a tool to disambiguate hybrids: the high/low slots. For S and T, high = leading and low = following.
  </p>

  <TurnStrip frames={sHighFrames} caption="S-High-One — turn on the leading hand, start, halfway, end, full motion" />
  <TurnStrip frames={sLowFrames} caption="S-Low-One — turn on the following hand, start, halfway, end, full motion" />
  <TurnStrip frames={tHighFrames} caption="T-High-One — turn on the leading hand, start, halfway, end, full motion" />
  <TurnStrip frames={tLowFrames} caption="T-Low-One — turn on the following hand, start, halfway, end, full motion" />

  <p>
    Note that these leading/following rules do NOT apply to U and V. Even though U and V have a leader/follower, their slots refer to pro/anti.
  </p>
</GuideSection>
