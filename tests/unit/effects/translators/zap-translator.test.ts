import { describe, it, expect } from "vitest";
import { resolveZap2D } from "../../../../src/lib/shared/effects/translators/canvas2d-translator";
import { resolveZap3D } from "../../../../src/lib/shared/effects/translators/webgl3d-translator";
import type { ZapIntent } from "../../../../src/lib/shared/effects/domain/effects-config";

// Full current ZapIntent. Every field is required — a partial literal leaves the
// derived params undefined-driven (a missing `glow` made glowBlur NaN), and the
// translators deliberately do not defend against that: production always feeds a
// default-merged config (migrations.ts merges DEFAULT_EFFECTS_CONFIG.zap).
const baseIntent: ZapIntent = {
  intensity: 0.7,
  leftColor: "#88ccff",
  rightColor: "#ff8888",
  frequency: 12,
  mode: "arc",
  branching: 0.3,
  style: "branching",
  wobbleRate: 0.18,
  wobbleAmount: 0.5,
  glow: 0.5,
  jitter: 0.5,
};

describe("resolveZap2D", () => {
  it("passes intent through and derives sensible canvas params", () => {
    const out = resolveZap2D(baseIntent);
    expect(out.intensity).toBe(0.7);
    expect(out.leftColor).toBe("#88ccff");
    expect(out.rightColor).toBe("#ff8888");
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
