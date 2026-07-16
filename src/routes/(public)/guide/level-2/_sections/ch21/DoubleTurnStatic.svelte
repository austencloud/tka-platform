<script lang="ts">
  /**
   * Real-pictograph diagram for the 2-turn static breakdown, mirroring
   * TwoTurnsDashStaticPage.svelte's `staticHalves` strip exactly (same motion/
   * turns/orientations — the print artboard is the source of truth for this
   * data).
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

  const { EAST: E } = GridLocation;
  const { IN } = Orientation;
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
    id: `l2a-tst-${id}`,
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

  // ── Motion data (verbatim from TwoTurnsDashStaticPage.svelte) ────────────
  // Static: E→E IN→IN CCW turns=2 — a 360° turn in place (in → out → in).
  const staticCombined = redStaff("static-full", MotionType.STATIC, E, E, IN, IN, CCW, 2);

  const ANIM = {
    "l2a-tst-static": { data: staticCombined, word: "Static with 2 turns", startLoc: E },
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

  const staticFrames: TurnStripFrame[] = [
    { kind: "start", step: animStep(stat("start", E, IN), 0, E), frameLabel: "start", thumbLabel: "in" },
    {
      kind: "half",
      step: halfOf(staticCombined, E),
      fallbackMotion: toHM(staticCombined.motions.red),
      frameLabel: "halfway",
      thumbLabel: "out",
    },
    {
      kind: "end",
      step: animStep(stat("end", E, staticCombined.motions.red.endOrientation), 0, E),
      frameLabel: "end",
      thumbLabel: "in",
    },
    {
      kind: "combined",
      step: animStep(ANIM["l2a-tst-static"].data, 1, E),
      animKey: "l2a-tst-static",
      word: ANIM["l2a-tst-static"].word,
      rowSteps: rowSteps("l2a-tst-static"),
    },
  ];
</script>

<GuideSection id="double-turn-static" title="Static">
  <p>
    A static motion with 2 turns is simply a 360° turn in place. It's necessary to use negative space or a turn to achieve this.
  </p>

  <TurnStrip frames={staticFrames} caption="Static with 2 turns, held at east — start, halfway, end, full motion" />

  <p>
    A static motion has 0 thumb switches, therefore a static motion with 2 turns has 2 thumb switches (in → out → in)
  </p>
</GuideSection>
