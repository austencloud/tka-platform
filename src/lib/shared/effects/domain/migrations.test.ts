import { describe, it, expect } from "vitest";
import { migrateEffectsConfig } from "./migrations";
import { EFFECTS_CONFIG_VERSION } from "./EffectsConfig";

describe("migrateEffectsConfig", () => {
  it("migrates v1 → current with default zap colors", () => {
    const v1 = { version: 1 };
    const out = migrateEffectsConfig(v1);
    expect(out.version).toBe(EFFECTS_CONFIG_VERSION);
    expect(out.zap.leftColor).toBe("#88ccff");
    expect(out.zap.rightColor).toBe("#88ccff");
  });

  it("migrates v2 zap.color to v3 zap.leftColor + rightColor", () => {
    const v2 = {
      version: 2,
      zap: { intensity: 0.9, color: "#ff00ff", frequency: 10, mode: "arc", branching: 0.4 },
    };
    const out = migrateEffectsConfig(v2);
    expect(out.version).toBe(EFFECTS_CONFIG_VERSION);
    expect(out.zap.leftColor).toBe("#ff00ff");
    expect(out.zap.rightColor).toBe("#ff00ff");
    expect((out.zap as any).color).toBeUndefined();
  });

  it("leaves a current-version zap untouched", () => {
    const current = {
      version: EFFECTS_CONFIG_VERSION,
      zap: { intensity: 0.5, leftColor: "#aaaaaa", rightColor: "#bbbbbb", frequency: 5, mode: "arc", branching: 0.2 },
    };
    const out = migrateEffectsConfig(current);
    expect(out.zap.leftColor).toBe("#aaaaaa");
    expect(out.zap.rightColor).toBe("#bbbbbb");
  });

  it("migrates v3 sparkles.rainbow=true to v4 colorMode=rainbow", () => {
    const v3 = {
      version: 3,
      sparkles: {
        rate: 0.6, size: 0.4, lifetime: 1.0,
        color: "#ff00ff", rainbow: true,
      },
    };
    const out = migrateEffectsConfig(v3);
    expect(out.version).toBe(EFFECTS_CONFIG_VERSION);
    expect(out.sparkles.colorMode).toBe("rainbow");
    expect(out.sparkles.color).toBe("#ff00ff");
    expect((out.sparkles as any).rainbow).toBeUndefined();
    expect(out.sparkles.palette).toEqual(["#fbbf24", "#f59e0b", "#fde047"]);
    expect(out.sparkles.spread).toBe(8);
    expect(out.sparkles.gravity).toBe(0.3);
    expect(out.sparkles.mode).toBe("stream");
  });

  it("migrates v3 sparkles.rainbow=false to v4 colorMode=solid", () => {
    const v3 = {
      version: 3,
      sparkles: {
        rate: 0.5, size: 0.5, lifetime: 1.2,
        color: "#fbbf24", rainbow: false,
      },
    };
    const out = migrateEffectsConfig(v3);
    expect(out.sparkles.colorMode).toBe("solid");
    expect((out.sparkles as any).rainbow).toBeUndefined();
  });

  it("leaves a current-version v4 sparkles untouched", () => {
    const v4 = {
      version: EFFECTS_CONFIG_VERSION,
      sparkles: {
        rate: 0.7, size: 0.6, lifetime: 2.0,
        color: "#67e8f9",
        palette: ["#aaa", "#bbb", "#ccc"],
        colorMode: "palette" as const,
        spread: 12, gravity: 0.8, mode: "burst" as const,
      },
    };
    const out = migrateEffectsConfig(v4);
    expect(out.sparkles.colorMode).toBe("palette");
    expect(out.sparkles.palette).toEqual(["#aaa", "#bbb", "#ccc"]);
    expect(out.sparkles.mode).toBe("burst");
  });

  it("migrates v4 motion to v5 with default color/colorMode/length/count", () => {
    const v4 = {
      version: 4,
      motion: { blur: 0.6, speedLines: 0.8, threshold: 0.3 },
    };
    const out = migrateEffectsConfig(v4);
    expect(out.version).toBe(EFFECTS_CONFIG_VERSION);
    expect(out.motion.blur).toBe(0.6);
    expect(out.motion.speedLines).toBe(0.8);
    expect(out.motion.threshold).toBe(0.3);
    expect(out.motion.color).toBe("#ffffff");
    expect(out.motion.colorMode).toBe("solid");
    expect(out.motion.length).toBe(0.5);
    expect(out.motion.count).toBe(6);
  });

  it("preserves user motion fields when already at v5", () => {
    const v5 = {
      version: EFFECTS_CONFIG_VERSION,
      motion: {
        blur: 0.2, speedLines: 0.9, threshold: 0.5,
        color: "#ff00ff", colorMode: "velocity" as const,
        length: 1.0, count: 10,
      },
    };
    const out = migrateEffectsConfig(v5);
    expect(out.motion.colorMode).toBe("velocity");
    expect(out.motion.color).toBe("#ff00ff");
    expect(out.motion.count).toBe(10);
  });
});
