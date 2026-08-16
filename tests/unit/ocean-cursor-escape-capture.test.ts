import { describe, expect, it } from "vitest";
import {
  automatedPursuitPassed,
  summarizeCursorEscapeCapture,
  type AutomatedPursuitReport,
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
    liveClearanceBodyLengths: 0.2,
    pursuitPressure: 0,
    phase: "coil",
    ...overrides,
  };
}

describe("cursor escape capture summary", () => {
  it("requires a smooth, single-event response for the automated chase", () => {
    const passing: AutomatedPursuitReport = {
      durationMilliseconds: 7520,
      escapeEventCount: 1,
      retargetLatencyMilliseconds: 16,
      maximumHeadingStepDegrees: 3.21,
      maximumAllowedHeadingStepDegrees: 3.21,
      retargetDegrees: 180,
      maximumPursuitPressure: 1,
      minimumLateChaseSpeedBodyLengths: 1.4,
      requiredLateChaseSpeedBodyLengths: 1.3,
      activeAfterBaseline: true,
      recoveryAfterReleaseMilliseconds: 2830,
    };

    expect(automatedPursuitPassed(passing)).toBe(true);
    expect(automatedPursuitPassed({ ...passing, escapeEventCount: 2 })).toBe(
      false
    );
    expect(
      automatedPursuitPassed({ ...passing, maximumHeadingStepDegrees: 8 })
    ).toBe(false);
    expect(
      automatedPursuitPassed({ ...passing, activeAfterBaseline: false })
    ).toBe(false);
  });

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

  it("measures smooth stage-three pursuit steering separately from the C-start", () => {
    const report = summarizeCursorEscapeCapture(
      [
        sample({ elapsed: 0.47, headingAngle: Math.PI, phase: "stabilize" }),
        sample({
          elapsed: 0.5,
          headingAngle: Math.PI,
          phase: "escape-swim",
          escapeEventId: null,
          pursuitPressure: 0.4,
          liveClearanceBodyLengths: 0.8,
        }),
        sample({
          elapsed: 0.516,
          headingAngle: Math.PI - 0.056,
          phase: "escape-swim",
          escapeEventId: null,
          pursuitPressure: 0.8,
          liveClearanceBodyLengths: 0.72,
        }),
        sample({
          elapsed: 1.5,
          headingAngle: 0.2,
          phase: "escape-swim",
          escapeEventId: null,
          pursuitPressure: 1,
          liveClearanceBodyLengths: 0.65,
        }),
      ],
      80,
      0
    );

    expect(report?.maximumStageThreeHeadingStepDegrees).toBeCloseTo(
      ((Math.PI - 0.256) * 180) / Math.PI
    );
    expect(report?.stageThreeHeadingChangeDegrees).toBeGreaterThan(160);
    expect(report?.minimumLiveClearanceBodyLengths).toBeCloseTo(0.65);
    expect(report?.maximumPursuitPressure).toBe(1);
    expect(report?.pursuedDurationMilliseconds).toBeCloseTo(1000);
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
