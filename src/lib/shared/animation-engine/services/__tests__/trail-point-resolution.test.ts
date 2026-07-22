import { afterEach, describe, expect, it } from "vitest";
import {
  getDefaultTrailPointConfig,
  resolveTrailPointConfig,
  setTrailPointOverrideProvider,
} from "../../domain/types/trail-point-types";
import { getTipPoints } from "../../domain/types/prop-tip-points";
import {
  calculateTrailSourceEndpoint,
  type PropEndpointConfig,
} from "../prop-position-calculator";
import { TrailCapturer } from "../trail-capturer";
import {
  DEFAULT_TRAIL_SETTINGS,
  TrackingMode,
} from "../../domain/types/trail-types";
import type { PropState } from "$lib/shared/foundation/domain/types/prop-state";

afterEach(() => {
  setTrailPointOverrideProvider(null);
});

describe("canonical trail point resolution", () => {
  it("anchors the fan's five effect points to its rendered SVG boundary", () => {
    expect(getTipPoints("fan").points).toEqual([
      { dx: 84, dy: -118 },
      { dx: 115, dy: -67 },
      { dx: 150, dy: 0 },
      { dx: 115, dy: 67 },
      { dx: 84, dy: 118 },
    ]);
  });

  it("uses the fan's center rib instead of an arbitrary edge rib", () => {
    expect(getDefaultTrailPointConfig("fan")).toEqual({
      left: { type: "tip", index: 2 },
      right: { type: "tip", index: 2 },
    });
  });

  it("anchors both buugeng trails to the animated SVG terminals", () => {
    expect(getTipPoints("buugeng").points).toEqual([
      { dx: 150, dy: 0 },
      { dx: -150, dy: 0 },
    ]);
    expect(getTipPoints("bigbuugeng").points).toEqual([
      { dx: 300, dy: 0 },
      { dx: -300, dy: 0 },
    ]);
  });

  it("tracks both buugeng terminals instead of its former diagonal interior points", () => {
    expect(getDefaultTrailPointConfig("buugeng")).toEqual({
      left: { type: "tip", index: 0 },
      right: { type: "tip", index: 1 },
    });
  });

  it("preserves both ordered endpoints for genuinely two-ended props", () => {
    expect(getDefaultTrailPointConfig("staff")).toEqual({
      left: { type: "tip", index: 0 },
      right: { type: "tip", index: 1 },
    });
  });

  it("keeps an explicit lab assignment authoritative", () => {
    setTrailPointOverrideProvider((propType) =>
      propType === "fan"
        ? {
            left: { type: "tip", index: 4 },
            right: { type: "tip", index: 4 },
          }
        : null
    );

    expect(resolveTrailPointConfig("FAN")).toEqual({
      left: { type: "tip", index: 4 },
      right: { type: "tip", index: 4 },
    });
  });

  it("resolves HAND mode to a single prop-center source for any prop", () => {
    const handConfig = {
      left: { type: "none" },
      right: { type: "custom", dx: 0, dy: 0 },
    };
    expect(resolveTrailPointConfig("staff", TrackingMode.HAND)).toEqual(handConfig);
    expect(resolveTrailPointConfig("fan", TrackingMode.HAND)).toEqual(handConfig);
    expect(resolveTrailPointConfig("club", TrackingMode.HAND)).toEqual(handConfig);
  });

  it("lets HAND override even an explicit lab tip assignment", () => {
    setTrailPointOverrideProvider(() => ({
      left: { type: "tip", index: 4 },
      right: { type: "tip", index: 4 },
    }));

    expect(resolveTrailPointConfig("fan", TrackingMode.HAND)).toEqual({
      left: { type: "none" },
      right: { type: "custom", dx: 0, dy: 0 },
    });
  });
});

describe("trail source world-space calculation", () => {
  const endpointConfig: PropEndpointConfig = {
    canvasSize: 950,
    propDimensions: { width: 252.8, height: 77.8 },
  };
  const centeredQuarterTurn: PropState = {
    x: 0,
    y: 0,
    centerPathAngle: 0,
    staffRotationAngle: Math.PI / 2,
  };

  it("rotates the canonical fan endpoint with the prop", () => {
    const config = resolveTrailPointConfig("fan");
    const endpoint = calculateTrailSourceEndpoint(
      centeredQuarterTurn,
      endpointConfig,
      config.right,
      "fan"
    );

    expect(endpoint).toEqual({ x: 475, y: 625, tipIndex: 2 });
  });

  it("rotates both buugeng sources from the prop's true terminal radius", () => {
    const config = resolveTrailPointConfig("buugeng");
    const first = calculateTrailSourceEndpoint(
      centeredQuarterTurn,
      endpointConfig,
      config.left,
      "buugeng"
    );
    const second = calculateTrailSourceEndpoint(
      centeredQuarterTurn,
      endpointConfig,
      config.right,
      "buugeng"
    );

    expect(first).toEqual({ x: 475, y: 625, tipIndex: 0 });
    expect(second).toEqual({ x: 475, y: 325, tipIndex: 1 });
  });

  it("rotates custom offsets instead of treating them as canvas-space offsets", () => {
    const endpoint = calculateTrailSourceEndpoint(
      centeredQuarterTurn,
      endpointConfig,
      { type: "custom", dx: 40, dy: 10 },
      "fan"
    );

    expect(endpoint?.x).toBeCloseTo(465, 8);
    expect(endpoint?.y).toBeCloseTo(515, 8);
    expect(endpoint?.tipIndex).toBeNull();
  });

  it("does not invent a point for a disabled trail source", () => {
    expect(
      calculateTrailSourceEndpoint(
        centeredQuarterTurn,
        endpointConfig,
        { type: "none" },
        "fan"
      )
    ).toBeNull();
  });

  it("places the HAND source at the prop center regardless of rotation", () => {
    // custom {0,0} = prop center = hand path. A centered prop sits at the
    // canvas center (475,475 at canvasSize 950), independent of rotation.
    const handSource = resolveTrailPointConfig("staff", TrackingMode.HAND).right;
    const endpoint = calculateTrailSourceEndpoint(
      centeredQuarterTurn,
      endpointConfig,
      handSource,
      "staff"
    );
    expect(endpoint?.x).toBeCloseTo(475, 8);
    expect(endpoint?.y).toBeCloseTo(475, 8);
    expect(endpoint?.tipIndex).toBeNull();
  });
});

describe("legacy trail capture endpoint parity", () => {
  it("captures the same single fan center source as the overlay renderers", () => {
    const capturer = new TrailCapturer();
    capturer.initialize({
      canvasSize: 500,
      bluePropDimensions: { width: 252.8, height: 77.8 },
      redPropDimensions: { width: 252.8, height: 77.8 },
      bluePropType: "fan",
      trailSettings: {
        ...DEFAULT_TRAIL_SETTINGS,
        trackingMode: TrackingMode.BOTH_ENDS,
      },
    });

    const initialProp: PropState = {
      x: 0,
      y: 0,
      centerPathAngle: 0,
      staffRotationAngle: 0,
    };
    const movedProp: PropState = { ...initialProp, x: 0.1 };
    capturer.captureFrame({ blueProp: initialProp, redProp: null }, 0, 1000);
    capturer.captureFrame({ blueProp: movedProp, redProp: null }, 0.1, 1600);

    const points = capturer.getAllTrailPoints().blue;
    const expected = calculateTrailSourceEndpoint(
      movedProp,
      {
        canvasSize: 500,
        propDimensions: { width: 252.8, height: 77.8 },
      },
      resolveTrailPointConfig("fan").right,
      "fan"
    );

    expect(points).toHaveLength(1);
    expect(points[0]?.tipIndex).toBe(2);
    expect(points[0]?.x).toBeCloseTo(expected!.x, 8);
    expect(points[0]?.y).toBeCloseTo(expected!.y, 8);
  });

  it("captures a single hand-path point for a two-ended prop in HAND mode", () => {
    const capturer = new TrailCapturer();
    capturer.initialize({
      canvasSize: 500,
      bluePropDimensions: { width: 252.8, height: 77.8 },
      redPropDimensions: { width: 252.8, height: 77.8 },
      bluePropType: "staff",
      trailSettings: {
        ...DEFAULT_TRAIL_SETTINGS,
        trackingMode: TrackingMode.HAND,
      },
    });

    const initialProp: PropState = {
      x: 0,
      y: 0,
      centerPathAngle: 0,
      staffRotationAngle: 0,
    };
    const movedProp: PropState = { ...initialProp, x: 0.1 };
    capturer.captureFrame({ blueProp: initialProp, redProp: null }, 0, 1000);
    capturer.captureFrame({ blueProp: movedProp, redProp: null }, 0.1, 1600);

    const points = capturer.getAllTrailPoints().blue;
    // staff is two-ended, but HAND collapses to one prop-center source.
    const expected = calculateTrailSourceEndpoint(
      movedProp,
      { canvasSize: 500, propDimensions: { width: 252.8, height: 77.8 } },
      resolveTrailPointConfig("staff", TrackingMode.HAND).right,
      "staff"
    );

    expect(points).toHaveLength(1);
    expect(points[0]?.x).toBeCloseTo(expected!.x, 8);
    expect(points[0]?.y).toBeCloseTo(expected!.y, 8);
  });
});
