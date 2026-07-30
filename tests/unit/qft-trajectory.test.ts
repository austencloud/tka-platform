import { describe, expect, it } from "vitest";
import {
  buildTrajectoryIncrements,
  traceTrajectory,
  trajectoryPosesAt,
  trajectoryPropIndexAt,
  trajectoryPropRateAt,
  trajectoryReversals,
  type QftTrajectory,
} from "../../src/lib/shared/notation/qft/qft-trajectory";

const swing: QftTrajectory = {
  radius: 1,
  handDirection: 1,
  propPhase: 2,
  propRate: [1, 1, 1, 1, -1, -1, -1, -1],
};

describe("QFT per-step trajectory", () => {
  it("integrates whole steps and fractional remainders through a reversal", () => {
    expect(trajectoryPropIndexAt(swing, 0)).toBe(2);
    expect(trajectoryPropIndexAt(swing, 3.5)).toBe(5.5);
    expect(trajectoryPropIndexAt(swing, 4)).toBe(6);
    expect(trajectoryPropIndexAt(swing, 4.5)).toBe(5.5);
    expect(trajectoryPropIndexAt(swing, 8)).toBe(2);
    expect(trajectoryPropIndexAt(swing, -0.5)).toBe(2.5);
  });

  it("keeps the pose continuous at the reversal boundary", () => {
    const before = trajectoryPosesAt(swing, 4 - 1e-7);
    const after = trajectoryPosesAt(swing, 4 + 1e-7);

    expect(
      Math.hypot(before.hand.x - after.hand.x, before.hand.y - after.hand.y)
    ).toBeLessThan(1e-6);
    expect(
      Math.hypot(before.head.x - after.head.x, before.head.y - after.head.y)
    ).toBeLessThan(1e-6);
  });

  it("returns to the same hand and head pose after the closed cycle", () => {
    const start = trajectoryPosesAt(swing, 0);
    const end = trajectoryPosesAt(swing, 8);

    expect(end.hand.x).toBeCloseTo(start.hand.x, 10);
    expect(end.hand.y).toBeCloseTo(start.hand.y, 10);
    expect(end.head.x).toBeCloseTo(start.head.x, 10);
    expect(end.head.y).toBeCloseTo(start.head.y, 10);

    const trace = traceTrajectory(swing, 32);
    expect(trace.at(-1)?.x).toBeCloseTo(trace[0]!.x, 10);
    expect(trace.at(-1)?.y).toBeCloseTo(trace[0]!.y, 10);
  });

  it("locates both reversal departures and their hand and prop bearings", () => {
    expect(trajectoryReversals(swing)).toEqual([
      {
        step: 1,
        handPosition: 8,
        propPosition: 2,
        fromRate: -1,
        toRate: 1,
      },
      {
        step: 5,
        handPosition: 4,
        propPosition: 6,
        fromRate: 1,
        toRate: -1,
      },
    ]);
  });

  it("uses each side's rate for the direction at a shared reversal position", () => {
    const increments = buildTrajectoryIncrements(swing);

    expect(increments[3]?.propArrive).toBe(6);
    expect(increments[3]?.propDirArrive).toBe(8);
    expect(increments[4]?.propDepart).toBe(6);
    expect(increments[4]?.propDirDepart).toBe(4);
  });

  it("mirrors the drawn rate when the hand direction changes", () => {
    const mirrored: QftTrajectory = { ...swing, handDirection: -1 };
    expect(trajectoryPropRateAt(mirrored, 0)).toBe(-1);
    expect(trajectoryPropRateAt(mirrored, 4)).toBe(1);
  });
});
