import { describe, expect, it } from "vitest";

import {
  HAND_ORBIT,
  MAX_STAGE_SCALE,
  MIN_STAGE_SCALE,
  compactStageMetrics,
  matchedStageScale,
  requiredStageScale,
} from "../../../src/routes/test/prop-size-audit/compact-stage";

describe("compact stage comparison", () => {
  it("preserves the current big-prop-to-grid ratio at matched scale", () => {
    const baseReach = 130;
    const bigReach = 240;
    const scale = matchedStageScale(baseReach, bigReach);
    const metrics = compactStageMetrics(baseReach, bigReach, scale);

    expect(scale).toBeCloseTo(baseReach / bigReach, 8);
    expect(metrics.compactOrbit).toBeCloseTo(HAND_ORBIT * scale, 8);
    expect(metrics.proposedPropToGridRatio).toBeCloseTo(
      metrics.currentPropToGridRatio,
      8
    );
    expect(metrics.ratioDriftPercent).toBeCloseTo(0, 8);
  });

  it("keeps the experimental control inside its visual range", () => {
    expect(matchedStageScale(1, 100)).toBe(MIN_STAGE_SCALE);
    expect(matchedStageScale(200, 100)).toBe(MAX_STAGE_SCALE);
    expect(compactStageMetrics(130, 240, 0).stageScale).toBe(MIN_STAGE_SCALE);
    expect(compactStageMetrics(130, 240, 2).stageScale).toBe(MAX_STAGE_SCALE);
  });

  it("reports when matching would require a larger rather than compact stage", () => {
    expect(requiredStageScale(129, 126)).toBeCloseTo(129 / 126, 8);
    expect(requiredStageScale(129, 126)).toBeGreaterThan(MAX_STAGE_SCALE);
    expect(matchedStageScale(129, 126)).toBe(MAX_STAGE_SCALE);
  });

  it("falls back to a full stage when a prop has no measurable reach", () => {
    expect(matchedStageScale(0, 240)).toBe(MAX_STAGE_SCALE);
    expect(matchedStageScale(130, 0)).toBe(MAX_STAGE_SCALE);
  });
});
