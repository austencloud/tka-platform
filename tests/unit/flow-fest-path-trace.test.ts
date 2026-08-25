import { describe, expect, it } from "vitest";
import {
  createTraceSubmission,
  emptyFlowFestTraces,
  imagePointToWorld,
  normalizeTraceDirection,
  parseStoredTraces,
  simplifyTrace,
  traceLengthMeters,
  validateTraceSubmission,
  type FlowFestImageTraces,
} from "../../src/routes/test/flow-fest-path-tracer/_lib/flow-fest-trace";

describe("Flow Fest path trace geometry", () => {
  it("maps orthophoto pixels into the registered world frame", () => {
    expect(imagePointToWorld({ x: 0, y: 0 })).toEqual({ x: -512, z: -512 });
    expect(imagePointToWorld({ x: 1024, y: 1024 })).toEqual({ x: 0, z: 0 });
    expect(imagePointToWorld({ x: 2048, y: 2048 })).toEqual({ x: 512, z: 512 });
  });

  it("keeps meaningful bends while removing redundant freehand samples", () => {
    const simplified = simplifyTrace(
      [
        { x: 0, y: 0 },
        { x: 5, y: 0.1 },
        { x: 10, y: 0 },
        { x: 10, y: 5 },
        { x: 10, y: 10 },
      ],
      0.5
    );

    expect(simplified).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]);
    expect(traceLengthMeters(simplified)).toBe(10);
  });

  it("normalizes a backwards stroke to the named route direction", () => {
    const normalized = normalizeTraceDirection("upper-to-middle", [
      { x: 1224, y: 794 },
      { x: 1100, y: 820 },
      { x: 900, y: 876 },
    ]);

    expect(normalized[0]).toEqual({ x: 900, y: 876 });
    expect(normalized.at(-1)).toEqual({ x: 1224, y: 794 });
  });
});

describe("Flow Fest path trace persistence", () => {
  const traces: FlowFestImageTraces = {
    "upper-to-middle": [
      { x: 900, y: 876 },
      { x: 1060, y: 830 },
      { x: 1224, y: 794 },
    ],
    "middle-to-lower": [
      { x: 1224, y: 794 },
      { x: 1400, y: 780 },
      { x: 1596, y: 764 },
    ],
  };

  it("round-trips both independent paths through browser storage", () => {
    expect(parseStoredTraces(JSON.stringify(traces))).toEqual(traces);
    expect(parseStoredTraces("not json")).toBeNull();
    expect(
      parseStoredTraces(
        JSON.stringify({
          ...traces,
          "upper-to-middle": [{ x: 900, y: 9000 }],
        })
      )
    ).toBeNull();
  });

  it("builds and validates the exact world-coordinate save payload", () => {
    const submission = createTraceSubmission(
      traces,
      "2026-08-25T12:00:00.000Z"
    );
    const validation = validateTraceSubmission(submission);

    expect(validation.valid).toBe(true);
    expect(submission.paths.upperClearingToMiddleEarth).toEqual([
      { x: -62, z: -74 },
      { x: 18, z: -97 },
      { x: 100, z: -115 },
    ]);
    expect(submission.paths.middleEarthToLowerClearing.at(-1)).toEqual({
      x: 286,
      z: -130,
    });
  });

  it("reports the missing path instead of relying on a disabled save button", () => {
    const incomplete = createTraceSubmission({
      ...emptyFlowFestTraces(),
      "upper-to-middle": traces["upper-to-middle"],
    });

    expect(validateTraceSubmission(incomplete)).toEqual({
      valid: false,
      error: "Middle-to-lower needs a drawn path.",
    });
  });
});
