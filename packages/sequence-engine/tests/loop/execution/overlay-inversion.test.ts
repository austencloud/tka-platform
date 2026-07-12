import { describe, expect, it } from "vitest";
import { executeSymmetricSpec } from "../../../src/loop/execution/spec-executor.js";
import { LOOPComponent, type PropLOOPSpec } from "../../../src/loop/loop-spec.js";
import type { SequenceStep } from "../../../src/core/types/sequence-engine-types.js";

// Minimal 2-beat closed-under-mirror seed: startPos + 2 letter steps whose
// motions are pro/anti (so inversion is observable). Build hand-rolled steps
// with the fields the executors touch (motions, positions, stepNumber, letter).
// Copied verbatim from canonical-stage-order.test.ts — tests independently readable.
function step(n: number, letter: string, sp: string, ep: string, blue: any, red: any): SequenceStep {
  return { stepNumber: n, letter, startPosition: sp, endPosition: ep, motions: { blue, red } } as unknown as SequenceStep;
}
const m = (motionType: string, rotationDirection: string, startLocation: string, endLocation: string) => ({
  motionType, rotationDirection, startLocation, endLocation,
  startOrientation: "in", endOrientation: "in", turns: 0, color: "blue",
});

// Deviation from the plan's literal seed: the plan's makeSeed() ends at
// gamma5 (blue e, red s), which is NOT a valid halved-rotation pair for
// gamma13 (HALF_POSITION_MAP maps gamma13 -> gamma9, blue e / red n —
// see packages/sequence-engine/src/loop/position-maps/circular-position-maps.ts).
// canonical-stage-order.test.ts's copy never exercises ROTATED so it never
// hit this gate; this file's tests do (ROTATED period 2), so StrictRotatedExecutor's
// validateSequence throws on the plan's literal seed. Fixing the seed (per plan
// discipline: fix the seed, never weaken assertions) — red now dashes s->n in
// step 2 instead of staying static, landing the sequence on gamma9 (blue e, red n),
// the valid halved-rotation partner of gamma13. Blue's pro/ccw s->e motion (the
// thing the inversion assertions actually observe) is unchanged from the plan.
function makeSeed(): SequenceStep[] {
  return [
    step(0, "", "gamma13", "gamma13", m("static", "noRotation", "w", "w"), m("static", "noRotation", "s", "s")),
    step(1, "Z", "gamma13", "beta5", m("anti", "cw", "w", "s"), m("static", "noRotation", "s", "s")),
    step(2, "Θ", "beta5", "gamma9", m("pro", "ccw", "s", "e"), m("dash", "noRotation", "s", "n")),
  ];
}

function spec(entries: Array<[LOOPComponent, { period: number; mode?: "expand" | "overlay" }]>): PropLOOPSpec {
  return { components: new Map(entries) };
}

describe("overlay inversion", () => {
  it("applies inversion in place: same positions, motion types flipped on odd blocks", () => {
    const base = executeSymmetricSpec(makeSeed(), spec([
      [LOOPComponent.ROTATED, { period: 2 }],
      [LOOPComponent.MIRRORED, { period: 2 }],
    ]));
    const overlaid = executeSymmetricSpec(makeSeed(), spec([
      [LOOPComponent.ROTATED, { period: 2 }],
      [LOOPComponent.MIRRORED, { period: 2 }],
      [LOOPComponent.INVERTED, { period: 4, mode: "overlay" }],
    ]));

    expect(overlaid).toHaveLength(base.length); // x1 — no expansion
    const blockSize = (base.length - 1) / 4;
    for (let i = 1; i < base.length; i++) {
      // positions identical everywhere
      expect(overlaid[i]!.startPosition).toBe(base[i]!.startPosition);
      expect(overlaid[i]!.endPosition).toBe(base[i]!.endPosition);
      const odd = Math.floor((i - 1) / blockSize) % 2 === 1;
      const b = base[i]!.motions.blue.motionType;
      const o = overlaid[i]!.motions.blue.motionType;
      if (!odd || b === "dash" || b === "static") expect(o).toBe(b);
      else expect(o).toBe(b === "pro" ? "anti" : "pro");
    }
  });

  it("keeps the orientation chain continuous after overlay", () => {
    const overlaid = executeSymmetricSpec(makeSeed(), spec([
      [LOOPComponent.MIRRORED, { period: 2 }],
      [LOOPComponent.INVERTED, { period: 2, mode: "overlay" }],
    ]));
    for (let i = 2; i < overlaid.length; i++) {
      expect(overlaid[i]!.motions.blue.startOrientation).toBe(overlaid[i - 1]!.motions.blue.endOrientation);
      expect(overlaid[i]!.motions.red.startOrientation).toBe(overlaid[i - 1]!.motions.red.endOrientation);
    }
  });

  it("throws when letter count is not divisible by the overlay period", () => {
    expect(() =>
      executeSymmetricSpec(makeSeed(), spec([
        [LOOPComponent.MIRRORED, { period: 2 }], // 2 -> 4 beats
        [LOOPComponent.INVERTED, { period: 8, mode: "overlay" }], // 4 % 8 != 0
      ]))
    ).toThrow(/divisible/);
  });
});
