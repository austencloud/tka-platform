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

  it("preserves the explicit reflection axis used by the icon renderers", () => {
    clearLoopDisplayCache();
    const display = resolveLoopDisplay({
      id: "diagonal-reflection-wire-test",
      loopSpec: {
        blue: {
          mirrored: {
            period: 2,
            reflectionAxis: "northeast-southwest",
          },
        },
        red: {
          mirrored: {
            period: 2,
            reflectionAxis: "northeast-southwest",
          },
        },
      },
    } as any);

    expect(display.reflectionAxis).toBe("northeast-southwest");
  });

  it("keeps legacy Flipped specs on the east-west axis", () => {
    clearLoopDisplayCache();
    const display = resolveLoopDisplay({
      id: "legacy-flipped-wire-test",
      loopSpec: {
        blue: { flipped: { period: 2 } },
        red: { flipped: { period: 2 } },
      },
    } as any);

    expect(display.reflectionAxis).toBe("east-west");
  });
});

describe("resolveLoopDisplay — overlayComponents", () => {
  it("populates overlayComponents from spec components whose mode is overlay", () => {
    clearLoopDisplayCache();
    const display = resolveLoopDisplay({
      id: "overlay-wire-test",
      loopSpec: {
        blue: {
          mirrored: { period: 2 },
          inverted: { period: 4, mode: "overlay" },
        },
        red: {
          mirrored: { period: 2 },
          inverted: { period: 4, mode: "overlay" },
        },
      },
    } as any);

    expect(display.overlayComponents).toBeDefined();
    expect(display.overlayComponents!.has(LOOPComponent.INVERTED)).toBe(true);
    expect(display.overlayComponents!.has(LOOPComponent.MIRRORED)).toBe(false);
  });

  it("leaves overlayComponents undefined/empty when nothing is in overlay mode", () => {
    clearLoopDisplayCache();
    const display = resolveLoopDisplay({
      id: "no-overlay-wire-test",
      loopSpec: {
        blue: { rotated: { period: 2 }, mirrored: { period: 2 } },
        red: { rotated: { period: 2 }, mirrored: { period: 2 } },
      },
    } as any);

    expect(
      display.overlayComponents === undefined || display.overlayComponents!.size === 0
    ).toBe(true);
  });
});
