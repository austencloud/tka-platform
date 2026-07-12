import { describe, expect, it } from "vitest";
import {
  resolveLoopDisplay,
  clearLoopDisplayCache,
} from "$lib/features/loop-labeler/services/loop-display-resolver";
import { LOOPComponent } from "$lib/shared/foundation/domain/models/generation/generate-models";
import { Period } from "$lib/shared/foundation/domain/models/generation/circular-models";

describe("resolveLoopDisplay — wire-form loopSpec", () => {
  it("derives components + per-component periods from a wire spec", () => {
    clearLoopDisplayCache();
    const display = resolveLoopDisplay({
      id: "spec-wire-test",
      loopSpec: {
        blue: {
          rotated: { period: 2 },
          mirrored: { period: 2 },
          inverted: { period: 4, mode: "overlay" },
        },
        red: {
          rotated: { period: 2 },
          mirrored: { period: 2 },
          inverted: { period: 4, mode: "overlay" },
        },
      },
    } as any);

    expect(display.components).toContain(LOOPComponent.ROTATED);
    expect(display.components).toContain(LOOPComponent.MIRRORED);
    expect(display.components).toContain(LOOPComponent.INVERTED);
    expect(display.rotationPeriod).toBe(Period.HALVED);
    expect(display.inversionPeriod).toBe(Period.QUARTERED);
  });
});
