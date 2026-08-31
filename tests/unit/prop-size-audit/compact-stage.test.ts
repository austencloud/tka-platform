import { describe, expect, it } from "vitest";

import {
  DEFAULT_FAN_BLEND,
  HAND_ORBIT,
  fanLandingMetrics,
} from "../../../src/routes/test/prop-size-audit/compact-stage";

describe("fan opposite-hand-point landing", () => {
  it("meets in the middle at 150% fan on a 75% grid", () => {
    const metrics = fanLandingMetrics(DEFAULT_FAN_BLEND);

    expect(metrics.propScale).toBe(1.5);
    expect(metrics.stageScale).toBe(0.75);
    expect(metrics.compactOrbit).toBe(HAND_ORBIT * 0.75);
    expect(metrics.inwardFanReach).toBe(225);
    expect(metrics.oppositeHandDistance).toBe(225);
    expect(metrics.landingError).toBe(0);
  });

  it("keeps the inward edge on the opposite point across the full blend", () => {
    const bigEquivalent = fanLandingMetrics(0);
    const regularFan = fanLandingMetrics(1);

    expect(bigEquivalent.propScale).toBe(2);
    expect(bigEquivalent.stageScale).toBe(1);
    expect(bigEquivalent.landingError).toBe(0);
    expect(regularFan.propScale).toBe(1);
    expect(regularFan.stageScale).toBe(0.5);
    expect(regularFan.landingError).toBe(0);
  });

  it("clamps the gate to the two exact landing endpoints", () => {
    expect(fanLandingMetrics(-1).blend).toBe(0);
    expect(fanLandingMetrics(2).blend).toBe(1);
  });
});
