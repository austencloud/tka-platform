import { describe, it, expect } from "vitest";
import { resolveZap2D } from "../../../../src/lib/shared/effects/translators/canvas2d-translator";
import { resolveZap3D } from "../../../../src/lib/shared/effects/translators/webgl3d-translator";
import type { ZapIntent } from "../../../../src/lib/shared/effects/domain/effects-config";

const baseIntent: ZapIntent = {
  intensity: 0.7,
  color: "#88ccff",
  frequency: 12,
  mode: "arc",
  branching: 0.3,
};

describe("resolveZap2D", () => {
  it("passes intent through and derives sensible canvas params", () => {
    const out = resolveZap2D(baseIntent);
    expect(out.intensity).toBe(0.7);
    expect(out.color).toBe("#88ccff");
    expect(out.segments).toBeGreaterThanOrEqual(4);
    expect(out.jitterAmount).toBeGreaterThan(0);
    expect(out.glowBlur).toBeGreaterThan(0);
    expect(out.lineWidth).toBeGreaterThan(0);
  });

  it("honours an override", () => {
    const out = resolveZap2D(baseIntent, { segments: 20 });
    expect(out.segments).toBe(20);
  });
});

describe("resolveZap3D (webgl3d-translator)", () => {
  it("passes intent through and derives sensible 3D params", () => {
    const out = resolveZap3D(baseIntent);
    expect(out.intensity).toBe(0.7);
    expect(out.segments).toBeGreaterThanOrEqual(4);
    expect(out.jitterAmount).toBeGreaterThan(0);
    expect(out.pointLightIntensity).toBeGreaterThan(0);
    expect(out.regenerateEveryFrames).toBeGreaterThanOrEqual(1);
  });
});
