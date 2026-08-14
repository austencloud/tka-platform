import { describe, expect, it } from "vitest";
import {
  summarizeCursorEscapeCapture,
  type CursorEscapeCaptureSample,
} from "../../src/routes/test/ocean-motion-benchmark/cursor-escape-capture";

function sample(
  overrides: Partial<CursorEscapeCaptureSample> = {}
): CursorEscapeCaptureSample {
  return {
    elapsed: 0,
    escapeEventId: 1,
    escapeResponseEventId: null,
    x: 0,
    y: 0,
    pointerX: 0,
    pointerY: 0,
    speedBodyLengths: 1,
    headingAngle: 0,
    direction: 1,
    bodyFlex: 0.1,
    animationPhase: 0,
    clearanceBodyLengths: 0.2,
    phase: "coil",
    ...overrides,
  };
}

describe("cursor escape capture summary", () => {
  it("measures the actual distance traveled after a visible reversal", () => {
    const report = summarizeCursorEscapeCapture(
      [
        sample(),
        sample({
          elapsed: 0.05,
          x: -4,
          headingAngle: Math.PI * 0.55,
          direction: -1,
          phase: "propulsion",
        }),
        sample({
          elapsed: 0.25,
          x: -44,
          headingAngle: Math.PI,
          direction: -1,
          clearanceBodyLengths: 1,
          phase: "coast",
        }),
        sample({
          elapsed: 0.26,
          x: -44,
          headingAngle: Math.PI,
          direction: -1,
          clearanceBodyLengths: 1,
          phase: "recovery",
          escapeEventId: null,
        }),
        sample({
          elapsed: 1,
          x: -64,
          headingAngle: Math.PI,
          direction: -1,
          clearanceBodyLengths: 1.4,
          phase: "recovery",
          escapeEventId: null,
        }),
      ],
      40,
      0
    );

    expect(report?.turnLatencyMilliseconds).toBeCloseTo(50);
    expect(report?.postTurnNetDisplacementBodyLengths).toBeCloseTo(1.5);
    expect(report?.postTurnPathDistanceBodyLengths).toBeCloseTo(1.5);
    expect(report?.clearanceGainBodyLengths).toBeCloseTo(1.2);
    expect(report?.maneuverActiveMilliseconds).toBeCloseTo(260);
    expect(report?.firstManeuverDurationMilliseconds).toBeCloseTo(260);
    expect(report?.escapeEventCount).toBe(1);
    expect(report?.firstManeuverNetDisplacementBodyLengths).toBeCloseTo(1.1);
  });

  it("exposes many body waves with little translation", () => {
    const report = summarizeCursorEscapeCapture(
      [
        sample({ headingAngle: Math.PI, direction: -1 }),
        sample({
          elapsed: 0.5,
          x: -10,
          headingAngle: Math.PI,
          direction: -1,
          animationPhase: Math.PI * 4,
          phase: "recovery",
          escapeEventId: null,
        }),
        sample({
          elapsed: 1,
          x: -20,
          headingAngle: Math.PI,
          direction: -1,
          animationPhase: Math.PI * 8,
          phase: "recovery",
          escapeEventId: null,
        }),
      ],
      40,
      0
    );

    expect(report?.bodyWaveCyclesAfterTurn).toBeCloseTo(4);
    expect(report?.postTurnNetDisplacementBodyLengths).toBeCloseTo(0.5);
    expect(report?.bodyLengthsPerWaveAfterTurn).toBeCloseTo(0.125);
  });

  it("does not report a wrapped screen jump as escape distance", () => {
    const report = summarizeCursorEscapeCapture(
      [
        sample({ headingAngle: Math.PI, direction: -1, x: 20 }),
        sample({
          elapsed: 0.5,
          headingAngle: Math.PI,
          direction: -1,
          x: 10,
        }),
        sample({
          elapsed: 1,
          headingAngle: Math.PI,
          direction: -1,
          x: 900,
        }),
      ],
      40,
      0
    );

    expect(report?.wrapped).toBe(true);
    expect(report?.netDisplacementBodyLengths).toBeNull();
    expect(report?.pathDistanceBodyLengths).toBeCloseTo(0.25);
  });

  it("keeps cursor travel separate from fish travel", () => {
    const report = summarizeCursorEscapeCapture(
      [
        sample({ headingAngle: Math.PI, direction: -1 }),
        sample({
          elapsed: 0.25,
          x: -10,
          pointerX: 30,
          pointerY: 40,
          headingAngle: Math.PI,
          direction: -1,
        }),
      ],
      50,
      0
    );

    expect(report?.pointerPathBodyLengths).toBeCloseTo(1);
    expect(report?.pathDistanceBodyLengths).toBeCloseTo(0.2);
  });

  it("reports no turn when heading never crosses ninety degrees", () => {
    const report = summarizeCursorEscapeCapture(
      [sample(), sample({ elapsed: 1, x: 20, headingAngle: Math.PI * 0.4 })],
      40,
      0
    );

    expect(report?.turnLatencyMilliseconds).toBeNull();
    expect(report?.postTurnNetDisplacementBodyLengths).toBeNull();
  });

  it("measures premature escape termination before recovery begins", () => {
    const report = summarizeCursorEscapeCapture(
      [
        sample({ elapsed: 0.016 }),
        sample({ elapsed: 0.048, phase: "propulsion" }),
        sample({ elapsed: 0.096, phase: "propulsion" }),
        sample({
          elapsed: 0.112,
          phase: "recovery",
          escapeEventId: null,
        }),
        sample({
          elapsed: 0.5,
          phase: "recovery",
          escapeEventId: null,
        }),
      ],
      40,
      0
    );

    expect(report?.maneuverActiveMilliseconds).toBeCloseTo(112);
    expect(report?.firstManeuverDurationMilliseconds).toBeCloseTo(112);
  });

  it("keeps separate escape events out of the first fast-start duration", () => {
    const report = summarizeCursorEscapeCapture(
      [
        sample({ elapsed: 0.016 }),
        sample({ elapsed: 0.096, phase: "propulsion" }),
        sample({
          elapsed: 0.112,
          phase: "recovery",
          escapeEventId: null,
        }),
        sample({
          elapsed: 0.5,
          phase: "recovery",
          escapeEventId: null,
        }),
        sample({ elapsed: 0.6, escapeEventId: 2 }),
        sample({ elapsed: 0.9, escapeEventId: 2, phase: "coast" }),
        sample({
          elapsed: 1,
          phase: "recovery",
          escapeEventId: null,
        }),
      ],
      40,
      0
    );

    expect(report?.escapeEventCount).toBe(2);
    expect(report?.firstManeuverDurationMilliseconds).toBeCloseTo(112);
    expect(report?.maneuverActiveMilliseconds).toBeCloseTo(612);
  });

  it("measures the complete fast-start and sustained scamper as one response", () => {
    const report = summarizeCursorEscapeCapture(
      [
        sample({
          elapsed: 0.016,
          escapeResponseEventId: 7,
        }),
        sample({
          elapsed: 0.47,
          x: -40,
          clearanceBodyLengths: 1.2,
          phase: "stabilize",
          escapeResponseEventId: 7,
        }),
        sample({
          elapsed: 0.5,
          x: -45,
          clearanceBodyLengths: 1.32,
          phase: "escape-swim",
          escapeEventId: null,
          escapeResponseEventId: 7,
        }),
        sample({
          elapsed: 1.6,
          x: -120,
          clearanceBodyLengths: 3.2,
          phase: "escape-swim",
          escapeEventId: null,
          escapeResponseEventId: 7,
        }),
        sample({
          elapsed: 2.7,
          x: -200,
          clearanceBodyLengths: 5.2,
          phase: "escape-swim",
          escapeEventId: null,
          escapeResponseEventId: 7,
        }),
        sample({
          elapsed: 3.8,
          x: -300,
          clearanceBodyLengths: 7.7,
          phase: "escape-swim",
          escapeEventId: null,
          escapeResponseEventId: 7,
        }),
        sample({
          elapsed: 3.9,
          x: -305,
          clearanceBodyLengths: 7.82,
          phase: "recovery",
          escapeEventId: null,
          escapeResponseEventId: null,
        }),
      ],
      40,
      0
    );

    expect(report?.firstResponseDurationMilliseconds).toBeCloseTo(3900);
    expect(report?.firstResponseNetDisplacementBodyLengths).toBeCloseTo(7.5);
    expect(report?.firstResponsePathDistanceBodyLengths).toBeCloseTo(7.5);
    expect(report?.firstResponseClearanceGainBodyLengths).toBeCloseTo(7.5);
    expect(report?.firstResponseTravelEfficiency).toBeCloseTo(1);
  });
});
