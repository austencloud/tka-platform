import { describe, expect, it } from "vitest";
import {
  calculateBetaOffset as calculateBrowserBetaOffset,
  type BetaMotionInput,
  type BetaOffsetInput,
} from "$lib/shared/render/core/calculations/beta-offset";
import { getBetaOffsetSize } from "$lib/shared/render/core/constants/prop-classification";
import { calculateBetaOffset as calculatePackageBetaOffset } from "../../../packages/render-core/src/calculations/beta-offset";
import { propPlacer } from "$lib/shared/pictograph/prop/services/prop-placer";
import DefaultPropPositioner from "$lib/shared/pictograph/prop/services/default-prop-positioner";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import { Letter } from "$lib/shared/foundation/domain/models/letter";
import {
  GridLocation,
  GridMode,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  MotionColor,
  MotionType,
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

type Offset = { x: number; y: number };
type OffsetCalculator = (
  input: BetaOffsetInput,
  targetMotion: BetaMotionInput
) => Offset;
type DiagonalDirection = "upright" | "upleft" | "downright" | "downleft";

const STAFF_BOX_OFFSET = getBetaOffsetSize("staff", "box");

const calculators: ReadonlyArray<{
  name: string;
  calculate: OffsetCalculator;
}> = [
  { name: "browser render core", calculate: calculateBrowserBetaOffset },
  { name: "shared render-core package", calculate: calculatePackageBetaOffset },
];

const boxTransitions: ReadonlyArray<{
  start: string;
  partnerStart: string;
  end: string;
  expectedBlue: DiagonalDirection;
}> = [
  { start: "ne", partnerStart: "sw", end: "se", expectedBlue: "upleft" },
  { start: "ne", partnerStart: "sw", end: "nw", expectedBlue: "downright" },
  { start: "se", partnerStart: "nw", end: "ne", expectedBlue: "upright" },
  { start: "se", partnerStart: "nw", end: "sw", expectedBlue: "upright" },
  { start: "sw", partnerStart: "ne", end: "nw", expectedBlue: "upleft" },
  { start: "sw", partnerStart: "ne", end: "se", expectedBlue: "downright" },
  { start: "nw", partnerStart: "se", end: "ne", expectedBlue: "downleft" },
  { start: "nw", partnerStart: "se", end: "sw", expectedBlue: "downleft" },
];

const sequenceSteps: ReadonlyArray<{
  step: number;
  letter: string;
  blue: Omit<BetaMotionInput, "color" | "propType">;
  red: Omit<BetaMotionInput, "color" | "propType">;
  expectedBlue: DiagonalDirection | null;
}> = [
  {
    step: 1,
    letter: "K",
    blue: {
      startLocation: "sw",
      endLocation: "nw",
      endOrientation: "counter",
      motionType: "anti",
    },
    red: {
      startLocation: "ne",
      endLocation: "nw",
      endOrientation: "counter",
      motionType: "float",
    },
    expectedBlue: "upleft",
  },
  {
    step: 2,
    letter: "Φ",
    blue: {
      startLocation: "nw",
      endLocation: "nw",
      endOrientation: "in",
      motionType: "static",
    },
    red: {
      startLocation: "nw",
      endLocation: "se",
      endOrientation: "in",
      motionType: "dash",
    },
    expectedBlue: null,
  },
  {
    step: 3,
    letter: "K",
    blue: {
      startLocation: "nw",
      endLocation: "ne",
      endOrientation: "counter",
      motionType: "anti",
    },
    red: {
      startLocation: "se",
      endLocation: "ne",
      endOrientation: "counter",
      motionType: "float",
    },
    expectedBlue: "downleft",
  },
  {
    step: 4,
    letter: "Φ",
    blue: {
      startLocation: "ne",
      endLocation: "ne",
      endOrientation: "in",
      motionType: "static",
    },
    red: {
      startLocation: "ne",
      endLocation: "sw",
      endOrientation: "in",
      motionType: "dash",
    },
    expectedBlue: null,
  },
  {
    step: 5,
    letter: "K",
    blue: {
      startLocation: "ne",
      endLocation: "se",
      endOrientation: "counter",
      motionType: "anti",
    },
    red: {
      startLocation: "sw",
      endLocation: "se",
      endOrientation: "counter",
      motionType: "float",
    },
    expectedBlue: "upleft",
  },
  {
    step: 6,
    letter: "Φ",
    blue: {
      startLocation: "se",
      endLocation: "se",
      endOrientation: "in",
      motionType: "static",
    },
    red: {
      startLocation: "se",
      endLocation: "nw",
      endOrientation: "in",
      motionType: "dash",
    },
    expectedBlue: null,
  },
  {
    step: 7,
    letter: "K",
    blue: {
      startLocation: "se",
      endLocation: "sw",
      endOrientation: "counter",
      motionType: "anti",
    },
    red: {
      startLocation: "nw",
      endLocation: "sw",
      endOrientation: "counter",
      motionType: "float",
    },
    expectedBlue: "upright",
  },
  {
    step: 8,
    letter: "Φ",
    blue: {
      startLocation: "sw",
      endLocation: "sw",
      endOrientation: "in",
      motionType: "static",
    },
    red: {
      startLocation: "sw",
      endLocation: "ne",
      endOrientation: "in",
      motionType: "dash",
    },
    expectedBlue: null,
  },
];

function diagonalOffset(direction: DiagonalDirection): Offset {
  switch (direction) {
    case "upright":
      return { x: STAFF_BOX_OFFSET, y: -STAFF_BOX_OFFSET };
    case "upleft":
      return { x: -STAFF_BOX_OFFSET, y: -STAFF_BOX_OFFSET };
    case "downright":
      return { x: STAFF_BOX_OFFSET, y: STAFF_BOX_OFFSET };
    case "downleft":
      return { x: -STAFF_BOX_OFFSET, y: STAFF_BOX_OFFSET };
  }
}

function opposite(offset: Offset): Offset {
  return { x: -offset.x, y: -offset.y };
}

function withRenderFields(
  motion: Omit<BetaMotionInput, "color" | "propType">,
  color: "blue" | "red"
): BetaMotionInput {
  return { ...motion, color, propType: "staff" };
}

function createInput(
  letter: string,
  blueMotion: BetaMotionInput,
  redMotion: BetaMotionInput
): BetaOffsetInput {
  return {
    blueMotion,
    redMotion,
    letter,
    gridMode: "box",
    bluePropType: "staff",
    redPropType: "staff",
  };
}

describe.each(calculators)("$name beta-offset directions", ({ calculate }) => {
  it.each(boxTransitions)(
    "maps the $start → $end box shift to $expectedBlue for blue",
    ({ start, partnerStart, end, expectedBlue }) => {
      const blueMotion = withRenderFields(
        {
          startLocation: start,
          endLocation: end,
          endOrientation: "counter",
          motionType: "anti",
        },
        "blue"
      );
      const redMotion = withRenderFields(
        {
          startLocation: partnerStart,
          endLocation: end,
          endOrientation: "counter",
          motionType: "float",
        },
        "red"
      );
      const input = createInput("K", blueMotion, redMotion);
      const expected = diagonalOffset(expectedBlue);

      expect(calculate(input, blueMotion)).toEqual(expected);
      expect(calculate(input, redMotion)).toEqual(opposite(expected));
    }
  );

  it.each(sequenceSteps)(
    "places both props correctly in supplied sequence step $step ($letter)",
    ({ letter, blue, red, expectedBlue }) => {
      const blueMotion = withRenderFields(blue, "blue");
      const redMotion = withRenderFields(red, "red");
      const input = createInput(letter, blueMotion, redMotion);
      const expected = expectedBlue
        ? diagonalOffset(expectedBlue)
        : { x: 0, y: 0 };

      expect(calculate(input, blueMotion)).toEqual(expected);
      expect(calculate(input, redMotion)).toEqual(
        expectedBlue ? opposite(expected) : expected
      );
    }
  );
});

describe("PropPlacer final coordinates for the supplied sequence", () => {
  it.each([
    {
      step: 1,
      blueStart: GridLocation.SOUTHWEST,
      redStart: GridLocation.NORTHEAST,
      end: GridLocation.NORTHWEST,
      blueOffset: { x: -STAFF_BOX_OFFSET, y: -STAFF_BOX_OFFSET },
    },
    {
      step: 3,
      blueStart: GridLocation.NORTHWEST,
      redStart: GridLocation.SOUTHEAST,
      end: GridLocation.NORTHEAST,
      blueOffset: { x: -STAFF_BOX_OFFSET, y: STAFF_BOX_OFFSET },
    },
  ])(
    "places step $step props on opposite sides of the shared hand point",
    async ({ blueStart, redStart, end, blueOffset }) => {
      const blue = createMotionData({
        motionType: MotionType.ANTI,
        startLocation: blueStart,
        endLocation: end,
        startOrientation: Orientation.IN,
        endOrientation: Orientation.COUNTER,
        rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
        turns: 0.5,
        color: MotionColor.BLUE,
        gridMode: GridMode.BOX,
        propType: PropType.STAFF,
      });
      const red = createMotionData({
        motionType: MotionType.FLOAT,
        startLocation: redStart,
        endLocation: end,
        startOrientation: Orientation.IN,
        endOrientation: Orientation.COUNTER,
        rotationDirection: RotationDirection.NO_ROTATION,
        turns: 0,
        color: MotionColor.RED,
        gridMode: GridMode.BOX,
        propType: PropType.STAFF,
      });
      const pictograph: PictographData = {
        id: `k-beta-${blueStart}-${end}`,
        letter: Letter.K,
        gridMode: GridMode.BOX,
        motions: { blue, red },
      };
      const base = DefaultPropPositioner.calculatePosition(end, GridMode.BOX);

      const [bluePlacement, redPlacement] = await Promise.all([
        propPlacer.calculatePlacement(pictograph, blue, undefined, {
          bluePropType: PropType.STAFF,
          redPropType: PropType.STAFF,
        }),
        propPlacer.calculatePlacement(pictograph, red, undefined, {
          bluePropType: PropType.STAFF,
          redPropType: PropType.STAFF,
        }),
      ]);

      expect(bluePlacement.positionX).toBeCloseTo(base.x + blueOffset.x, 2);
      expect(bluePlacement.positionY).toBeCloseTo(base.y + blueOffset.y, 2);
      expect(redPlacement.positionX).toBeCloseTo(base.x - blueOffset.x, 2);
      expect(redPlacement.positionY).toBeCloseTo(base.y - blueOffset.y, 2);
    }
  );
});
