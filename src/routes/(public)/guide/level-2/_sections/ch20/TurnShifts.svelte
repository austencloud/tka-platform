<script lang="ts">
  /**
   * Real-pictograph diagrams for the 1-turn shifts breakdown, mirroring
   * TurnsPage.svelte's `ROWS` (pro, anti) exactly — same motions/turns/
   * orientations, the print artboard is the source of truth for this data.
   */
  import GuideSection from "../../../level-1/_components/GuideSection.svelte";
  import TurnStrip, { type TurnStripFrame } from "../../_components/TurnStrip.svelte";
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
  import { bakeReversals } from "../../../level-1/_data/guide-sequence-adapter";

  const { EAST: E, SOUTH: SO_ } = GridLocation;
  const { IN, OUT } = Orientation;
  const CW = RotationDirection.CLOCKWISE;
  const CCW = RotationDirection.COUNTER_CLOCKWISE;

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
    id: `l2ts1-${id}`,
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
    redStaff(id, MotionType.STATIC, loc, loc, ori, ori, RotationDirection.NO_ROTATION);
  const toHM = (m: ReturnType<typeof redStaff>["motions"]["red"]) => ({
    type: m.motionType,
    from: m.startLocation,
    to: m.endLocation,
    rot: m.rotationDirection,
    startOri: m.startOrientation,
    endOri: m.endOrientation,
    turns: typeof m.turns === "number" ? m.turns : 0,
  });

  // ── Motion data (verbatim from TurnsPage.svelte) ─────────────────────────
  // Pro: E→S IN→OUT CW turns=1. Anti: E→S IN→IN CCW turns=1.
  const proCombined = redStaff("pro-full", MotionType.PRO, E, SO_, IN, OUT, CW, 1);
  const antiCombined = redStaff("anti-full", MotionType.ANTI, E, SO_, IN, IN, CCW, 1);

  const ANIM = {
    "l2ts1-pro": { data: proCombined, word: "Prospin with a turn", startLoc: E },
    "l2ts1-anti": { data: antiCombined, word: "Antispin with a turn", startLoc: E },
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
  const rowSteps = (key: keyof typeof ANIM): StepData[] => {
    const cfg = ANIM[key];
    const start = animStep(stat(`${key}-start`, cfg.startLoc, IN), 0, cfg.startLoc);
    const combined = animStep(cfg.data, 1, cfg.startLoc);
    return [start, ...bakeReversals([combined])];
  };
  const halfOf = (combined: ReturnType<typeof redStaff>, startLoc: GridLocation) =>
    buildHalvedStep(animStep(combined, 1, startLoc), 0.5);

  const proFrames: TurnStripFrame[] = [
    { kind: "start", step: animStep(stat("pro-start", E, IN), 0, E), frameLabel: "start", thumbLabel: "in" },
    {
      kind: "half",
      step: halfOf(proCombined, E),
      fallbackMotion: toHM(proCombined.motions.red),
      frameLabel: "halfway",
    },
    {
      kind: "end",
      step: animStep(stat("pro-end", SO_, proCombined.motions.red.endOrientation), 0, SO_),
      frameLabel: "end",
      thumbLabel: "out",
    },
    {
      kind: "combined",
      step: animStep(ANIM["l2ts1-pro"].data, 1, E),
      animKey: "l2ts1-pro",
      word: ANIM["l2ts1-pro"].word,
      rowSteps: rowSteps("l2ts1-pro"),
    },
  ];

  const antiFrames: TurnStripFrame[] = [
    { kind: "start", step: animStep(stat("anti-start", E, IN), 0, E), frameLabel: "start", thumbLabel: "in" },
    {
      kind: "half",
      step: halfOf(antiCombined, E),
      fallbackMotion: toHM(antiCombined.motions.red),
      frameLabel: "halfway",
      thumbLabel: "out",
    },
    {
      kind: "end",
      step: animStep(stat("anti-end", SO_, antiCombined.motions.red.endOrientation), 0, SO_),
      frameLabel: "end",
      thumbLabel: "in",
    },
    {
      kind: "combined",
      step: animStep(ANIM["l2ts1-anti"].data, 1, E),
      animKey: "l2ts1-anti",
      word: ANIM["l2ts1-anti"].word,
      rowSteps: rowSteps("l2ts1-anti"),
    },
  ];
</script>

<GuideSection id="turn-shifts" title="Shifts" subtitle="VTG: 1:3">
  <p>
    <strong>Turns:</strong> A turn is a 180° rotation that occurs during a motion. Let's add a single turn to a shift.
  </p>

  <p>
    First we'll add 1 turn to a prospin. Take note of the diagonal halfway position, and pause there for a moment before continuing. These arrows refer to the pinky end on the first half, then to the thumb end on the second half. The full arrow depicts a half-circle, from the start position's outer point.
  </p>

  <TurnStrip frames={proFrames} caption="Prospin with a turn, east to south — start, halfway, end, full motion" />

  <p>Each turn adds a thumb switch.</p>

  <p>
    <strong>Pro:</strong> An isolation has 0 thumb switches, therefore a prospin with a turn has 1 thumb switch (in → out)
  </p>

  <p>
    Now let's add 1 turn to an antispin. Again, take note of the diagonal halfway position, and pause there before continuing.
  </p>

  <TurnStrip frames={antiFrames} caption="Antispin with a turn, east to south — start, halfway, end, full motion" />

  <p>
    <strong>Anti:</strong> A base antispin has 1 thumb switch. (in → out), therefore an antispin with a turn has 2 thumb switches (in → out → in).
  </p>
</GuideSection>
