/**
 * Locks the motion-aware ("hybrid") mandala geometry the card backs now render
 * with (feedback 2mHuY6Au): motionAware resolves the hand-path shape PER
 * MOTION — pro traces the arc, anti traces the concave petal — instead of one
 * global shape. The card-back seam (CardBack.svelte pathShape="hybrid" +
 * buildBackJob pathOptions.motionAware) depends on these outputs actually
 * differing for anti motions and matching for pro-only sequences.
 */
import { describe, it, expect } from "vitest";
import { calculate } from "$lib/shared/mandala/services/mandala-geometry-calculator";
import type { StepLike } from "$lib/shared/mandala/services/types";

const TIP = { dx: 120, dy: 0 }; // MANDALA_STANDARD_TIP_DX — the card-back tip (also skips the module cache)

function step(motionType: "pro" | "anti", turns = 0): StepLike {
  return {
    motions: {
      blue: {
        motionType,
        rotationDirection: "cw",
        startLocation: "n",
        endLocation: "e",
        turns,
      },
      red: {
        motionType,
        rotationDirection: "ccw",
        startLocation: "s",
        endLocation: "w",
        turns,
      },
    },
  };
}

const allD = (p: ReturnType<typeof calculate>) =>
  [...p.blue, ...p.red].map((s) => s.d).join("|");

describe("motion-aware mandala geometry (card-back hybrid shape)", () => {
  it("anti motions trace a different (concave) path than the arc default", () => {
    const steps = [step("anti"), step("anti")];
    const arc = calculate(steps, undefined, undefined, undefined, TIP);
    const aware = calculate(steps, undefined, undefined, { motionAware: true }, TIP);
    expect(allD(aware)).not.toBe(allD(arc));
  });

  it("pro motions are arc under motionAware — identical to the default", () => {
    const steps = [step("pro"), step("pro")];
    const arc = calculate(steps, undefined, undefined, undefined, TIP);
    const aware = calculate(steps, undefined, undefined, { motionAware: true }, TIP);
    expect(allD(aware)).toBe(allD(arc));
  });

  it("a per-motion pathShape override still wins over motionAware", () => {
    const overridden: StepLike[] = [
      {
        motions: {
          blue: {
            motionType: "anti",
            rotationDirection: "cw",
            startLocation: "n",
            endLocation: "e",
            turns: 0,
            pathShape: "arc",
          },
          red: null,
        },
      },
    ];
    const arc = calculate(overridden, undefined, undefined, undefined, TIP);
    const aware = calculate(overridden, undefined, undefined, { motionAware: true }, TIP);
    expect(allD(aware)).toBe(allD(arc));
  });
});
