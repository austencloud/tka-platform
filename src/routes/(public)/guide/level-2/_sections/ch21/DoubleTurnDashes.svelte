<script lang="ts">
  /**
   * Real-pictograph diagrams for the 2-turn dash breakdown, mirroring
   * TwoTurnsDashStaticPage.svelte's `dashQuarters` and `dashHalves` strips
   * exactly (same motion/turns/orientations — the print artboard is the
   * source of truth for this data).
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

  const { NORTH: N, SOUTH: SO_ } = GridLocation;
  const { IN, OUT } = Orientation;
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
    id: `l2a-td-${id}`,
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
  // Dash: S→N IN→OUT CCW turns=2 (a vertical dash — up/down as thumb indicators).
  const dashQCombined = redStaff("dash-q-full", MotionType.DASH, SO_, N, IN, OUT, CCW, 2);
  const dashHCombined = redStaff("dash-h-full", MotionType.DASH, SO_, N, IN, OUT, CCW, 2);

  const ANIM = {
    "l2a-td-dash-q": { data: dashQCombined, word: "Dash with 2 turns", startLoc: SO_ },
    "l2a-td-dash-h": { data: dashHCombined, word: "Dash with 2 turns", startLoc: SO_ },
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

  const dashQHM = toHM(dashQCombined.motions.red);
  const quartersFrames: TurnStripFrame[] = [
    { kind: "start", step: animStep(stat("q-start", SO_, IN), 0, SO_), frameLabel: "start", thumbLabel: "in" },
    { kind: "pose", motion: dashQHM, t: 0.25, arrowStart: 0 },
    {
      kind: "half",
      step: halfOf(dashQCombined, SO_),
      fallbackMotion: dashQHM,
      frameLabel: "halfway",
    },
    { kind: "pose", motion: dashQHM, t: 0.75, arrowStart: 0.5 },
    {
      kind: "end",
      step: animStep(stat("q-end", N, dashQCombined.motions.red.endOrientation), 0, N),
      frameLabel: "end",
      thumbLabel: "out",
    },
    {
      kind: "combined",
      step: animStep(ANIM["l2a-td-dash-q"].data, 1, SO_),
      animKey: "l2a-td-dash-q",
      word: ANIM["l2a-td-dash-q"].word,
      rowSteps: rowSteps("l2a-td-dash-q"),
    },
  ];

  const halvesFrames: TurnStripFrame[] = [
    { kind: "start", step: animStep(stat("h-start", SO_, IN), 0, SO_), frameLabel: "start", thumbLabel: "in" },
    {
      kind: "half",
      step: halfOf(dashHCombined, SO_),
      fallbackMotion: toHM(dashHCombined.motions.red),
      frameLabel: "halfway",
    },
    {
      kind: "end",
      step: animStep(stat("h-end", N, dashHCombined.motions.red.endOrientation), 0, N),
      frameLabel: "end",
      thumbLabel: "out",
    },
    {
      kind: "combined",
      step: animStep(ANIM["l2a-td-dash-h"].data, 1, SO_),
      animKey: "l2a-td-dash-h",
      word: ANIM["l2a-td-dash-h"].word,
      rowSteps: rowSteps("l2a-td-dash-h"),
    },
  ];
</script>

<GuideSection id="double-turn-dashes" title="Dashes">
  <p>
    Now let's add a double turn to a dash. It's relatively complex, so we'll break it down into four parts.
  </p>

  <TurnStrip
    frames={quartersFrames}
    caption="Dash with 2 turns, south to north, broken into quarters — start, quarter, halfway, three-quarter, end, full motion"
  />

  <p>
    A base dash starting from thumb in ends with thumb out, therefore a dash with 2 turns also ends with thumb out (in → out)
  </p>

  <p>
    For a vertical dash such as this, you can use up/down as indicators (up → down → up)
  </p>

  <p>
    As with all dashes, it's important to travel in a straight handpath even though the prop is rotating. Here is the same motion broken in half:
  </p>

  <TurnStrip
    frames={halvesFrames}
    caption="The same dash with 2 turns, broken in half — start, halfway, end, full motion"
  />
</GuideSection>
