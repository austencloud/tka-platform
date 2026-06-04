import { describe, it, expect } from "vitest";
import { migrateEffectsConfig } from "./migrations";
import { EFFECTS_CONFIG_VERSION } from "./effects-config";

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

  it("migrates v4 motion to v5 shape, then v5 motion is discarded in v6 with fresh echo defaults", () => {
    // v4 motion block flows through the v4→v5 expander, then the v5→v6
    // migration discards it and reseeds echo defaults. The intermediate
    // motion shape is irrelevant to the final output.
    const v4 = {
      version: 4,
      motion: { blur: 0.6, speedLines: 0.8, threshold: 0.3 },
    };
    const out = migrateEffectsConfig(v4);
    expect(out.version).toBe(EFFECTS_CONFIG_VERSION);
    expect((out as any).motion).toBeUndefined();
    expect(out.echo.intensity).toBe(0.7);
    expect(out.echo.decay).toBe(4);
    expect(out.echo.shape).toBe("staff");
  });

  it("migrates v5 motion block to v6 echo with fresh defaults", () => {
    const v5 = {
      version: 5,
      motion: {
        blur: 0.6, speedLines: 0.8, threshold: 0.3,
        color: "#ff0", colorMode: "solid" as const,
        length: 0.7, count: 8,
      },
    };
    const out = migrateEffectsConfig(v5);
    expect(out.version).toBe(EFFECTS_CONFIG_VERSION);
    expect((out as any).motion).toBeUndefined();
    expect(out.echo.intensity).toBe(0.7);
    expect(out.echo.decay).toBe(4);
    expect(out.echo.interval).toBe(1);
    expect(out.echo.shape).toBe("staff");
    expect(out.echo.colorMode).toBe("solid");
    expect(out.echo.color).toBe("#ffffff");
    expect(out.echo.thickness).toBe(3);
  });

  it("migrates v5 tipEffectMap motion entries to echo", () => {
    const v5 = {
      version: 5,
      tipEffectMap: {
        "*": { effect: "motion" },
        "0": { effect: "motion" },
        "1-0": { effect: "sparkles" },
      },
    };
    const out = migrateEffectsConfig(v5);
    expect(out.tipEffectMap["*"]?.effect).toBe("echo");
    expect(out.tipEffectMap["0"]?.effect).toBe("echo");
    expect(out.tipEffectMap["1-0"]?.effect).toBe("sparkles");
  });

  it("migrates v5 activePresets.motion → v6 activePresets.echo", () => {
    const v5 = {
      version: 5,
      activePresets: { motion: "motion-anime", sparkles: "sparkles-fairy-dust" },
    };
    const out = migrateEffectsConfig(v5);
    expect((out.activePresets as any).motion).toBeUndefined();
    expect(out.activePresets.echo).toBe("motion-anime");
    expect(out.activePresets.sparkles).toBe("sparkles-fairy-dust");
  });

  it("migrates v6 bloom stub to v7 per-tip halo shape", () => {
    // Old stub: {intensity, threshold, radius(0-1 normalized)}.
    // New: {intensity, radius(8-200 px), color, palette, colorMode, falloff, pulse, pulseRate}.
    const v6 = {
      version: 6,
      bloom: { intensity: 0.6, threshold: 0.8, radius: 0.5 },
    };
    const out = migrateEffectsConfig(v6);
    expect(out.version).toBe(EFFECTS_CONFIG_VERSION);
    expect(out.bloom.intensity).toBe(0.6); // preserved
    // old 0.5 → 0.5*200+8 = 108
    expect(out.bloom.radius).toBe(108);
    expect((out.bloom as any).threshold).toBeUndefined();
    expect(out.bloom.color).toBe("#f472b6");
    expect(out.bloom.palette).toEqual(["#f472b6", "#fbbf24", "#22d3ee"]);
    expect(out.bloom.colorMode).toBe("solid");
    expect(out.bloom.falloff).toBe("smooth");
    expect(out.bloom.pulse).toBe(0);
    expect(out.bloom.pulseRate).toBe(1);
  });

  it("clamps v6 bloom radius at the 8-200 px bounds during v7 migration", () => {
    const outLow = migrateEffectsConfig({
      version: 6,
      bloom: { intensity: 0.5, threshold: 0.7, radius: 0 },
    });
    expect(outLow.bloom.radius).toBe(8);
    const outHigh = migrateEffectsConfig({
      version: 6,
      bloom: { intensity: 0.5, threshold: 0.7, radius: 1 },
    });
    expect(outHigh.bloom.radius).toBe(200);
  });

  it("leaves v6 tipEffectMap entries pointing at bloom valid through v7 migration", () => {
    const v6 = {
      version: 6,
      tipEffectMap: {
        "*": { effect: "bloom" },
        "1-1": { effect: "sparkles" },
      },
      bloom: { intensity: 0.4, threshold: 0.5, radius: 0.25 },
    };
    const out = migrateEffectsConfig(v6);
    expect(out.tipEffectMap["*"]?.effect).toBe("bloom");
    expect(out.tipEffectMap["1-1"]?.effect).toBe("sparkles");
    expect(out.bloom.radius).toBe(58); // 0.25*200+8
  });

  it("leaves a current-version v7 bloom untouched", () => {
    const v7 = {
      version: EFFECTS_CONFIG_VERSION,
      bloom: {
        intensity: 0.9,
        radius: 40,
        color: "#ff00ff",
        palette: ["#aaa", "#bbb", "#ccc"],
        colorMode: "palette" as const,
        falloff: "ring" as const,
        pulse: 0.5,
        pulseRate: 2,
      },
    };
    const out = migrateEffectsConfig(v7);
    expect(out.bloom.intensity).toBe(0.9);
    expect(out.bloom.radius).toBe(40);
    expect(out.bloom.colorMode).toBe("palette");
    expect(out.bloom.falloff).toBe("ring");
    expect(out.bloom.palette).toEqual(["#aaa", "#bbb", "#ccc"]);
  });

  it("leaves a current-version v6 echo untouched", () => {
    const v6 = {
      version: EFFECTS_CONFIG_VERSION,
      echo: {
        intensity: 0.9, decay: 6, interval: 0.5,
        shape: "tips" as const,
        colorMode: "rainbow" as const,
        color: "#22d3ee", thickness: 5,
      },
    };
    const out = migrateEffectsConfig(v6);
    expect(out.echo.intensity).toBe(0.9);
    expect(out.echo.shape).toBe("tips");
    expect(out.echo.colorMode).toBe("rainbow");
  });

  it("migrates v8 → v9 by seeding default bubbles intent", () => {
    const v8 = {
      version: 8,
      // No bubbles block - must seed from defaults.
    };
    const out = migrateEffectsConfig(v8);
    expect(out.version).toBe(EFFECTS_CONFIG_VERSION);
    expect(out.bubbles).toBeDefined();
    expect(out.bubbles.palette).toBe("soap");
    expect(out.bubbles.ambientEmission).toBeGreaterThan(0);
    expect(out.bubbles.motionEmission).toBeGreaterThan(0);
    expect(out.bubbles.buoyancy).toBeGreaterThan(0);
    expect(out.bubbles.trackingMode).toBe("both_ends");
    expect(out.activePresets.bubbles).toBe(null);
  });

  it("preserves existing bubbles values through v8 → v9 merge", () => {
    const v8 = {
      version: 8,
      bubbles: {
        palette: "oil" as const,
        customColor: "#ff00ff",
        ambientEmission: 0.9,
        motionEmission: 0.1,
        intensity: 0.8,
        sizeJitter: 0.6,
        buoyancy: 0.7,
        trackingMode: "left_end" as const,
      },
    };
    const out = migrateEffectsConfig(v8);
    expect(out.bubbles.palette).toBe("oil");
    expect(out.bubbles.ambientEmission).toBe(0.9);
    expect(out.bubbles.buoyancy).toBe(0.7);
    expect(out.bubbles.trackingMode).toBe("left_end");
  });

  it("migrates v9 → v10 by seeding default petals intent", () => {
    const v9 = {
      version: 9,
      // No petals block - must seed from defaults.
    };
    const out = migrateEffectsConfig(v9);
    expect(out.version).toBe(EFFECTS_CONFIG_VERSION);
    expect(out.petals).toBeDefined();
    expect(out.petals.palette).toBe("blossom");
    expect(out.petals.ambientEmission).toBeGreaterThan(0);
    expect(out.petals.motionEmission).toBeGreaterThan(0);
    expect(out.petals.swayAmplitude).toBeGreaterThan(0);
    expect(out.petals.fallSpeed).toBeGreaterThan(0);
    expect(out.petals.trackingMode).toBe("both_ends");
    expect(out.activePresets.petals).toBe(null);
  });

  it("preserves existing petals values through v9 → v10 merge", () => {
    const v9 = {
      version: 9,
      petals: {
        palette: "autumn" as const,
        customColor: "#ff8800",
        ambientEmission: 0.8,
        motionEmission: 0.2,
        intensity: 0.9,
        swayAmplitude: 0.9,
        fallSpeed: 0.7,
        trackingMode: "right_end" as const,
      },
    };
    const out = migrateEffectsConfig(v9);
    expect(out.petals.palette).toBe("autumn");
    expect(out.petals.ambientEmission).toBe(0.8);
    expect(out.petals.swayAmplitude).toBe(0.9);
    expect(out.petals.fallSpeed).toBe(0.7);
    expect(out.petals.trackingMode).toBe("right_end");
  });

  it("migrates v10 → v11 by seeding default smoke intent", () => {
    const v10 = {
      version: 10,
      // No smoke block - must seed from defaults.
    };
    const out = migrateEffectsConfig(v10);
    expect(out.version).toBe(EFFECTS_CONFIG_VERSION);
    expect(out.smoke).toBeDefined();
    expect(out.smoke.palette).toBe("incense");
    expect(out.smoke.ambientEmission).toBeGreaterThan(0);
    expect(out.smoke.motionEmission).toBeGreaterThan(0);
    expect(out.smoke.curlStrength).toBeGreaterThan(0);
    expect(out.smoke.riseSpeed).toBeGreaterThan(0);
    expect(out.smoke.trackingMode).toBe("both_ends");
    expect(out.activePresets.smoke).toBe(null);
  });

  it("preserves existing smoke values through v10 → v11 merge", () => {
    const v10 = {
      version: 10,
      smoke: {
        palette: "genie" as const,
        customColor: "#a060ff",
        ambientEmission: 0.2,
        motionEmission: 1.0,
        intensity: 0.7,
        curlStrength: 0.9,
        riseSpeed: 0.8,
        trackingMode: "right_end" as const,
      },
    };
    const out = migrateEffectsConfig(v10);
    expect(out.smoke.palette).toBe("genie");
    expect(out.smoke.motionEmission).toBe(1.0);
    expect(out.smoke.curlStrength).toBe(0.9);
    expect(out.smoke.riseSpeed).toBe(0.8);
    expect(out.smoke.trackingMode).toBe("right_end");
  });

  it("v10 → v11 migration does not touch tipEffectMap entries", () => {
    const v10 = {
      version: 10,
      tipEffectMap: {
        "*": { effect: "petals" },
        "0-0": { effect: "bubbles" },
      },
    };
    const out = migrateEffectsConfig(v10);
    expect(out.tipEffectMap["*"]?.effect).toBe("petals");
    expect(out.tipEffectMap["0-0"]?.effect).toBe("bubbles");
  });

  it("migrates v11 → v12 by seeding default ink intent", () => {
    const v11 = {
      version: 11,
      // No ink block - must seed from defaults.
    };
    const out = migrateEffectsConfig(v11);
    expect(out.version).toBe(EFFECTS_CONFIG_VERSION);
    expect(out.ink).toBeDefined();
    expect(out.ink.palette).toBe("watercolor");
    expect(out.ink.ambientEmission).toBe(0.2);
    expect(out.ink.motionEmission).toBe(0.8);
    expect(out.ink.intensity).toBe(0.6);
    expect(out.ink.viscosity).toBe(0.3);
    expect(out.ink.splatterIntensity).toBe(0.3);
    expect(out.ink.trackingMode).toBe("both_ends");
    expect(out.activePresets.ink).toBe(null);
  });

  it("preserves existing ink values through v11 → v12 merge", () => {
    const v11 = {
      version: 11,
      ink: {
        palette: "neon" as const,
        customColor: "#ff2080",
        ambientEmission: 0.1,
        motionEmission: 1.0,
        intensity: 0.9,
        viscosity: 0.2,
        splatterIntensity: 0.4,
        trackingMode: "right_end" as const,
      },
    };
    const out = migrateEffectsConfig(v11);
    expect(out.ink.palette).toBe("neon");
    expect(out.ink.motionEmission).toBe(1.0);
    expect(out.ink.viscosity).toBe(0.2);
    expect(out.ink.trackingMode).toBe("right_end");
  });

  it("v11 → v12 migration does not touch tipEffectMap entries", () => {
    const v11 = {
      version: 11,
      tipEffectMap: {
        "*": { effect: "smoke" },
        "0-0": { effect: "petals" },
      },
    };
    const out = migrateEffectsConfig(v11);
    expect(out.tipEffectMap["*"]?.effect).toBe("smoke");
    expect(out.tipEffectMap["0-0"]?.effect).toBe("petals");
  });

  it("migrates pre-v16 led.brightness 5 (stale old default) to 3", () => {
    const v15 = {
      version: 15,
      led: {
        brightness: 5, patternId: "rainbow", patternSpeed: 2.0,
        primaryColor: "#ff0000", secondaryColor: "#00ff00", colorMode: "unified" as const,
      },
    };
    const out = migrateEffectsConfig(v15);
    expect(out.version).toBe(EFFECTS_CONFIG_VERSION);
    expect(out.led.brightness).toBe(3);
    // Only brightness remaps - the rest of the user's led settings survive.
    expect(out.led.patternId).toBe("rainbow");
    expect(out.led.patternSpeed).toBe(2.0);
  });

  it("preserves a deliberate pre-v16 led.brightness 1-4", () => {
    const v15 = {
      version: 15,
      led: {
        brightness: 2, patternId: "solid", patternSpeed: 1.0,
        primaryColor: "#00ff88", secondaryColor: "#ffffff", colorMode: "unified" as const,
      },
    };
    const out = migrateEffectsConfig(v15);
    expect(out.led.brightness).toBe(2);
  });

  it("preserves a deliberate post-v16 led.brightness 5", () => {
    const current = {
      version: EFFECTS_CONFIG_VERSION,
      led: {
        brightness: 5, patternId: "solid", patternSpeed: 1.0,
        primaryColor: "#00ff88", secondaryColor: "#ffffff", colorMode: "unified" as const,
      },
    };
    const out = migrateEffectsConfig(current);
    expect(out.led.brightness).toBe(5);
  });

  it("deep-merges a partial pulse block over defaults", () => {
    const v15 = {
      version: 15,
      pulse: { intensity: 0.9 },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = migrateEffectsConfig(v15 as any);
    expect(out.pulse.intensity).toBe(0.9);
    expect(out.pulse.trigger).toBe("beat");
    expect(out.pulse.palette).toBe("sonar");
  });
});
