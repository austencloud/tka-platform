<script lang="ts">
  /**
   * Real-pictograph diagram for the 1-turn static breakdown, mirroring
   * DashStaticTurnsPage.svelte's static row (`ROWS[1]`) exactly — same
   * motion/turns/orientations, the print artboard is the source of truth
   * for this data.
   *
   * The second TODO on this section (the static-turn-arrow vs prospin-turn-
   * arrow comparison, `DashStaticTurnsPage`'s bottom NOTE_STATIC/NOTE_SHIFT
   * boxes) is a side-by-side compare of two unrelated full-motion
   * pictographs with no start/halfway/end chain between them — TurnStrip's
   * connector always renders a flow-arrow-then-equals between frames, which
   * would visually claim "static turn = prospin turn" (false — the point of
   * the comparison is that their ARROW SHAPES differ, not that the motions
   * are equal). Left text-only; not a fit for this primitive.
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
    id: `l2tst1-${id}`,
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

  // ── Motion data (verbatim from DashStaticTurnsPage.svelte's static row) ──
  // Static: E→E IN→OUT CCW turns=1 — a 180° turn in place (in → out).
  const staticCombined = redStaff("static-full", MotionType.STATIC, E, E, IN, OUT, CCW, 1);

  const ANIM = {
    "l2tst1-static": { data: staticCombined, word: "Static turn", startLoc: E },
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
    },
    {
      kind: "end",
      step: animStep(stat("end", E, staticCombined.motions.red.endOrientation), 0, E),
      frameLabel: "end",
      thumbLabel: "out",
    },
    {
      kind: "combined",
      step: animStep(ANIM["l2tst1-static"].data, 1, E),
      animKey: "l2tst1-static",
      word: ANIM["l2tst1-static"].word,
      rowSteps: rowSteps("l2tst1-static"),
    },
  ];
</script>

<GuideSection id="turn-static" title="Static">
  <p>
    Finally, we'll look at static turns. Here is a breakdown of a static turn starting from thumb in:
  </p>

  <TurnStrip frames={staticFrames} caption="Static turn, held at east — start, halfway, end, full motion" />

  <p>
    This can be executed at any hand point, starting from either thumb orientation, turning in either direction.
  </p>

  <p>
    Note the differences between the arrow for static turns and the arrow for prospin turns:
  </p>

  <!-- TODO: add diagram — comparison of static turn arrow vs prospin turn arrow -->

  <p>
    <strong>Static:</strong> Prop remains at its start position. The arrow forms a half circle with that position.
  </p>
  <p>
    <strong>Shift:</strong> Prop ends at an adjacent position. The arrow forms a half-circle around the empty start position.
  </p>
</GuideSection>
