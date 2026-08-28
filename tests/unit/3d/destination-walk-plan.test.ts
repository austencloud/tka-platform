import { describe, expect, it } from "vitest";

import {
  createDestinationWalkPlan,
  sampleDestinationWalkPlan,
} from "$lib/shared/3d/locomotion/destination-walk-plan";

describe("destination walk plan", () => {
  it("puts every requested footfall at an evenly spaced mark", () => {
    const plan = createDestinationWalkPlan({
      from: { x: -1, z: 2 },
      to: { x: 3, z: 5 },
      steps: 5,
      cadence: 2,
    });

    expect(plan.distance).toBeCloseTo(5, 10);
    expect(plan.stepLength).toBeCloseTo(1, 10);
    expect(plan.duration).toBeCloseTo(2.5, 10);

    for (let step = 0; step <= plan.steps; step++) {
      const sample = sampleDestinationWalkPlan(plan, step);
      expect(sample.position.x).toBeCloseTo(-1 + (4 * step) / 5, 10);
      expect(sample.position.z).toBeCloseTo(2 + (3 * step) / 5, 10);
    }
  });

  it("reaches the destination exactly without an overshoot correction", () => {
    const destination = { x: 1.25, z: -3.75 };
    const plan = createDestinationWalkPlan({
      from: { x: 0, z: 0 },
      to: destination,
      steps: 6,
    });

    const atStrike = sampleDestinationWalkPlan(plan, 6);
    const afterDelayedFrame = sampleDestinationWalkPlan(plan, 6.08);

    expect(atStrike.position).toEqual(destination);
    expect(afterDelayedFrame.position).toEqual(destination);
    expect(afterDelayedFrame.speed).toBe(0);
    expect(afterDelayedFrame.arrived).toBe(true);
  });

  it("depends on gait progress, not on how frames partition elapsed time", () => {
    const plan = createDestinationWalkPlan({
      from: { x: 2, z: -1 },
      to: { x: -4, z: 7 },
      steps: 8,
    });

    const oneFrame = sampleDestinationWalkPlan(plan, 3.625);
    const manyFrames = [0.2, 0.65, 1.4, 2.1, 3.625]
      .map((step) => sampleDestinationWalkPlan(plan, step))
      .at(-1)!;

    expect(manyFrames).toEqual(oneFrame);
  });

  it("clamps observations before departure without walking backwards", () => {
    const plan = createDestinationWalkPlan({
      from: { x: 4, z: 9 },
      to: { x: 4, z: 1 },
      steps: 10,
    });

    const sample = sampleDestinationWalkPlan(plan, -0.25);
    expect(sample.position).toEqual(plan.from);
    expect(sample.step).toBe(0);
    expect(sample.remainingSteps).toBe(10);
  });

  it("rejects requests that cannot define a real walk", () => {
    const base = {
      from: { x: 0, z: 0 },
      to: { x: 4, z: 0 },
      steps: 6,
    };

    expect(() => createDestinationWalkPlan({ ...base, steps: 0 })).toThrow(
      "positive integer"
    );
    expect(() => createDestinationWalkPlan({ ...base, steps: 2.5 })).toThrow(
      "positive integer"
    );
    expect(() =>
      createDestinationWalkPlan({ ...base, cadence: Number.NaN })
    ).toThrow("cadence");
    expect(() =>
      createDestinationWalkPlan({ ...base, to: { ...base.from } })
    ).toThrow("destination");
    expect(() =>
      createDestinationWalkPlan({
        ...base,
        from: { x: Number.POSITIVE_INFINITY, z: 0 },
      })
    ).toThrow("finite");
    expect(() =>
      sampleDestinationWalkPlan(createDestinationWalkPlan(base), NaN)
    ).toThrow("step must be finite");
  });
});
