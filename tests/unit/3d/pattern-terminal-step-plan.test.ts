import { describe, expect, it } from "vitest";

import { createPatternTerminalStepPlan } from "$lib/shared/3d/locomotion/pattern-terminal-step-plan";

describe("pattern terminal step planning", () => {
  it("waits for the next gait boundary and assigns the correct terminal foot", () => {
    const intent = {
      id: "shuttle:outbound-stop",
      remainingDistance: 1.35,
      targetFacing: 0,
    };

    expect(
      createPatternTerminalStepPlan({
        intent: { ...intent, remainingDistance: 2.1 },
        gaitStep: 10.2,
        cadence: 2,
        speed: 1,
      })
    ).toBeNull();

    const plan = createPatternTerminalStepPlan({
      intent,
      gaitStep: 10.2,
      cadence: 2,
      speed: 1,
    });

    expect(plan).toMatchObject({
      id: intent.id,
      startAtGaitStep: 11,
      landAtGaitStep: 13,
      terminalFoot: "right",
      cadence: 2,
      targetFacing: 0,
    });
    expect(plan!.stepDistances[0] + plan!.stepDistances[1]).toBeCloseTo(
      plan!.remainingDistance,
      10
    );
    expect(plan!.stepDistances[0]).toBeGreaterThan(plan!.stepDistances[1]);
  });

  it("keeps an exact boundary on that boundary", () => {
    const plan = createPatternTerminalStepPlan({
      intent: {
        id: "shuttle:return-stop",
        remainingDistance: 1,
        targetFacing: Math.PI,
      },
      gaitStep: 20,
      cadence: 2,
      speed: 1,
    });

    expect(plan?.startAtGaitStep).toBe(20);
    expect(plan?.landAtGaitStep).toBe(22);
    expect(plan?.terminalFoot).toBe("left");
  });

  it("does not mistake startup blend cadence for a multi-metre braking window", () => {
    const plan = createPatternTerminalStepPlan({
      intent: {
        id: "shuttle:outbound-stop",
        remainingDistance: 3.5,
        targetFacing: 0,
      },
      gaitStep: 0.1,
      cadence: 0.2,
      speed: 1,
    });

    expect(plan).toBeNull();
  });
});
