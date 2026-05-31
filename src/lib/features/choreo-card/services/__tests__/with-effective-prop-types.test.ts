import { describe, it, expect } from "vitest";
import { withEffectivePropTypes } from "../with-effective-prop-types";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";

function makeStep(): StepData {
  return {
    id: "s1",
    letter: "A",
    stepNumber: 1,
    duration: 1,
    blueReversal: false,
    redReversal: false,
    isBlank: false,
    motions: {
      [MotionColor.BLUE]: { motionType: "pro", rotationDirection: "cw", propType: "staff" } as never,
      [MotionColor.RED]: { motionType: "anti", rotationDirection: "ccw", propType: "staff" } as never,
    },
  } as unknown as StepData;
}

describe("withEffectivePropTypes", () => {
  it("sets blue and red motion propType to the effective prop types", () => {
    const out = withEffectivePropTypes(makeStep(), PropType.FAN, PropType.CLUB);
    expect(out.motions?.[MotionColor.BLUE]?.propType).toBe(PropType.FAN);
    expect(out.motions?.[MotionColor.RED]?.propType).toBe(PropType.CLUB);
  });

  it("does not mutate the input step", () => {
    const input = makeStep();
    withEffectivePropTypes(input, PropType.FAN, PropType.FAN);
    expect(input.motions?.[MotionColor.BLUE]?.propType).toBe("staff");
  });

  it("returns the step unchanged when a motion is missing", () => {
    const step = { ...makeStep(), motions: {} as never } as StepData;
    const out = withEffectivePropTypes(step, PropType.FAN, PropType.FAN);
    expect(out.motions).toEqual({});
  });
});
