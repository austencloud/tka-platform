import { describe, expect, it } from "vitest";
import { PictographPreparer } from "./pictograph-preparer";
import { propPlacer } from "../../prop/services/prop-placer";
import { createMotionData } from "../domain/models/motion-data";
import { createPictographData } from "../domain/factories/create-pictograph-data";
import { Letter } from "../../../foundation/domain/models/letter";
import { GridLocation } from "../../grid/domain/enums/grid-enums";
import { PropType } from "../../prop/domain/enums/prop-type";
import {
  HandSide,
  MotionType,
  Orientation,
  RotationDirection,
} from "../domain/enums/pictograph-enums";

// Two buugeng of OPPOSITE chirality nest into an infinity symbol at a shared
// hand point, so the beta separation offset must not fire. Two buugeng of the
// SAME chirality do not nest, and the offset is what makes each prop's two ends
// readable.
//
// The gate itself lives in render-core (calculateBetaOffset Gate 4) and was
// always correct — but the preparer built its prop-settings object out of prop
// TYPES only, so the calc read both props as unflipped and the gate could never
// fire in the app. This test locks the wiring, not the gate.

const left = createMotionData({
  motionType: MotionType.PRO,
  startLocation: GridLocation.EAST,
  endLocation: GridLocation.SOUTH,
  startOrientation: Orientation.IN,
  endOrientation: Orientation.IN,
  rotationDirection: RotationDirection.CLOCKWISE,
  hand: HandSide.LEFT,
});
const right = createMotionData({
  motionType: MotionType.PRO,
  startLocation: GridLocation.WEST,
  endLocation: GridLocation.SOUTH,
  startOrientation: Orientation.IN,
  endOrientation: Orientation.IN,
  rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
  hand: HandSide.RIGHT,
});
const pictograph = createPictographData({
  letter: Letter.G,
  motions: { left, right },
});

// The preparer only needs arrows and prop SVGs to exist; this test is about the
// prop POSITIONS, which come from the real PropPlacer.
const stubArrowManager = {
  coordinateArrowLifecycle: async () => ({
    positions: {},
    assets: {},
    mirroring: {},
  }),
} as never;

const stubPropLoader = {
  loadPropSvg: async () => ({
    svgData: {
      svgContent: "<svg />",
      viewBox: { width: 100, height: 100 },
      center: { x: 50, y: 50 },
    },
  }),
} as never;

async function positionsFor(options: {
  leftBuugengFlipped: boolean;
  rightBuugengFlipped: boolean;
}) {
  // A fresh preparer per call — the prepare cache is keyed, and a shared
  // instance would let one case's entry answer the other's question.
  const preparer = new PictographPreparer(
    stubArrowManager,
    stubPropLoader,
    propPlacer
  );
  const prepared = await preparer.prepareSingle(pictograph, {
    leftPropType: PropType.BUUGENG,
    rightPropType: PropType.BUUGENG,
    ...options,
  });
  const positions = prepared._prepared!.propPositions;
  if (!positions.left || !positions.right) {
    throw new Error("Expected prepared positions for both hands");
  }
  return { left: positions.left, right: positions.right };
}

describe("PictographPreparer — buugeng chirality reaches the beta offset", () => {
  it("separates two SAME-chirality buugeng", async () => {
    const positions = await positionsFor({
      leftBuugengFlipped: false,
      rightBuugengFlipped: false,
    });

    const separation =
      Math.abs(positions.left.x - positions.right.x) +
      Math.abs(positions.left.y - positions.right.y);
    expect(separation).toBeGreaterThan(0.5);
  });

  it("nests two OPPOSITE-chirality buugeng at the same point", async () => {
    const positions = await positionsFor({
      leftBuugengFlipped: false,
      rightBuugengFlipped: true,
    });

    expect(positions.left.x).toBeCloseTo(positions.right.x, 6);
    expect(positions.left.y).toBeCloseTo(positions.right.y, 6);
  });

  it("nests when it is the BLUE prop that is reversed", async () => {
    const positions = await positionsFor({
      leftBuugengFlipped: true,
      rightBuugengFlipped: false,
    });

    expect(positions.left.x).toBeCloseTo(positions.right.x, 6);
    expect(positions.left.y).toBeCloseTo(positions.right.y, 6);
  });

  it("separates again when BOTH are reversed (same chirality)", async () => {
    const positions = await positionsFor({
      leftBuugengFlipped: true,
      rightBuugengFlipped: true,
    });

    const separation =
      Math.abs(positions.left.x - positions.right.x) +
      Math.abs(positions.left.y - positions.right.y);
    expect(separation).toBeGreaterThan(0.5);
  });

  it("does not serve the unflipped result from cache after a flip", async () => {
    // One instance, two questions — the cache key has to tell them apart.
    const preparer = new PictographPreparer(
      stubArrowManager,
      stubPropLoader,
      propPlacer
    );
    const base = {
      leftPropType: PropType.BUUGENG,
      rightPropType: PropType.BUUGENG,
    };

    const same = await preparer.prepareSingle(pictograph, {
      ...base,
      leftBuugengFlipped: false,
      rightBuugengFlipped: false,
    });
    const opposite = await preparer.prepareSingle(pictograph, {
      ...base,
      leftBuugengFlipped: false,
      rightBuugengFlipped: true,
    });

    const sameLeft = same._prepared!.propPositions.left;
    const oppositeLeft = opposite._prepared!.propPositions.left;
    if (!sameLeft || !oppositeLeft) {
      throw new Error("Expected prepared left-hand positions");
    }

    expect(oppositeLeft.x).not.toBeCloseTo(sameLeft.x, 6);
  });
});
