import { describe, expect, it } from "vitest";
import { PictographPreparer } from "./pictograph-preparer";
import { propPlacer } from "../../prop/services/prop-placer";
import { createMotionData } from "../domain/models/motion-data";
import { createPictographData } from "../domain/factories/create-pictograph-data";
import { Letter } from "../../../foundation/domain/models/letter";
import { GridLocation } from "../../grid/domain/enums/grid-enums";
import { PropType } from "../../prop/domain/enums/prop-type";
import {
  MotionColor,
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

const blue = createMotionData({
  motionType: MotionType.PRO,
  startLocation: GridLocation.EAST,
  endLocation: GridLocation.SOUTH,
  startOrientation: Orientation.IN,
  endOrientation: Orientation.IN,
  rotationDirection: RotationDirection.CLOCKWISE,
  color: MotionColor.BLUE,
});
const red = createMotionData({
  motionType: MotionType.PRO,
  startLocation: GridLocation.WEST,
  endLocation: GridLocation.SOUTH,
  startOrientation: Orientation.IN,
  endOrientation: Orientation.IN,
  rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
  color: MotionColor.RED,
});
const pictograph = createPictographData({
  letter: Letter.G,
  motions: { blue, red },
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
  blueBuugengFlipped: boolean;
  redBuugengFlipped: boolean;
}) {
  // A fresh preparer per call — the prepare cache is keyed, and a shared
  // instance would let one case's entry answer the other's question.
  const preparer = new PictographPreparer(
    stubArrowManager,
    stubPropLoader,
    propPlacer
  );
  const prepared = await preparer.prepareSingle(pictograph, {
    bluePropType: PropType.BUUGENG,
    redPropType: PropType.BUUGENG,
    ...options,
  });
  return prepared._prepared!.propPositions;
}

describe("PictographPreparer — buugeng chirality reaches the beta offset", () => {
  it("separates two SAME-chirality buugeng", async () => {
    const positions = await positionsFor({
      blueBuugengFlipped: false,
      redBuugengFlipped: false,
    });

    const separation =
      Math.abs(positions.blue.x - positions.red.x) +
      Math.abs(positions.blue.y - positions.red.y);
    expect(separation).toBeGreaterThan(0.5);
  });

  it("nests two OPPOSITE-chirality buugeng at the same point", async () => {
    const positions = await positionsFor({
      blueBuugengFlipped: false,
      redBuugengFlipped: true,
    });

    expect(positions.blue.x).toBeCloseTo(positions.red.x, 6);
    expect(positions.blue.y).toBeCloseTo(positions.red.y, 6);
  });

  it("nests when it is the BLUE prop that is reversed", async () => {
    const positions = await positionsFor({
      blueBuugengFlipped: true,
      redBuugengFlipped: false,
    });

    expect(positions.blue.x).toBeCloseTo(positions.red.x, 6);
    expect(positions.blue.y).toBeCloseTo(positions.red.y, 6);
  });

  it("separates again when BOTH are reversed (same chirality)", async () => {
    const positions = await positionsFor({
      blueBuugengFlipped: true,
      redBuugengFlipped: true,
    });

    const separation =
      Math.abs(positions.blue.x - positions.red.x) +
      Math.abs(positions.blue.y - positions.red.y);
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
      bluePropType: PropType.BUUGENG,
      redPropType: PropType.BUUGENG,
    };

    const same = await preparer.prepareSingle(pictograph, {
      ...base,
      blueBuugengFlipped: false,
      redBuugengFlipped: false,
    });
    const opposite = await preparer.prepareSingle(pictograph, {
      ...base,
      blueBuugengFlipped: false,
      redBuugengFlipped: true,
    });

    expect(opposite._prepared!.propPositions.blue.x).not.toBeCloseTo(
      same._prepared!.propPositions.blue.x,
      6
    );
  });
});
