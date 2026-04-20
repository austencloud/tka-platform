import { describe, it, expect } from "vitest";
import {
  resolveBubbles2D,
  resolvePetals2D,
  resolveSmoke2D,
  resolveSparkles2D,
  resolveZap2D,
} from "./canvas2d-translator";
import type {
  BubblesIntent,
  PetalsIntent,
  SmokeIntent,
  SparklesIntent,
  ZapIntent,
} from "../domain/EffectsConfig";
import { SMOKE_PALETTES } from "../domain/SmokePalettes";

describe("resolveZap2D — per-hand color", () => {
  it("preserves leftColor and rightColor in the output params", () => {
    const intent: ZapIntent = {
      intensity: 0.7,
      leftColor: "#ff0000",
      rightColor: "#0000ff",
      frequency: 12,
      mode: "arc",
      branching: 0.3,
    };
    const out = resolveZap2D(intent);
    expect(out.leftColor).toBe("#ff0000");
    expect(out.rightColor).toBe("#0000ff");
  });
});

describe("resolveSparkles2D — extended fields", () => {
  it("preserves colorMode, palette, spread, gravity, mode in output params", () => {
    const intent: SparklesIntent = {
      rate: 0.7,
      size: 0.6,
      lifetime: 1.5,
      color: "#67e8f9",
      palette: ["#aaa", "#bbb", "#ccc"],
      colorMode: "palette",
      spread: 12,
      gravity: 0.8,
      mode: "burst",
    };
    const out = resolveSparkles2D(intent);
    expect(out.colorMode).toBe("palette");
    expect(out.palette).toEqual(["#aaa", "#bbb", "#ccc"]);
    expect(out.spread).toBe(12);
    expect(out.gravity).toBe(0.8);
    expect(out.mode).toBe("burst");
    expect(out.poolSize).toBeGreaterThan(0);
    expect(out.baseRadius).toBeGreaterThan(0);
  });
});

describe("resolveBubbles2D — palette resolution + defaults", () => {
  it("resolves the soap palette for intent.palette === 'soap'", () => {
    const intent: BubblesIntent = {
      ambientEmission: 0.3,
      motionEmission: 0.5,
      intensity: 0.6,
      palette: "soap",
      customColor: "#c8e0ff",
      sizeJitter: 0.4,
      buoyancy: 0.5,
      trackingMode: "both_ends",
    };
    const out = resolveBubbles2D(intent);
    expect(out.resolvedPalette.id).toBe("soap");
    expect(out.resolvedPalette.rim).toBe("#c8e0ff");
    expect(out.poolSize).toBeGreaterThan(0);
    expect(out.ambientSpawnRate).toBeGreaterThan(0);
    expect(out.motionSpawnRate).toBeGreaterThan(0);
  });

  it("resolves a custom palette from customColor", () => {
    const intent: BubblesIntent = {
      ambientEmission: 0.3,
      motionEmission: 0.5,
      intensity: 0.6,
      palette: "custom",
      customColor: "#ff8800",
      sizeJitter: 0.4,
      buoyancy: 0.5,
      trackingMode: "both_ends",
    };
    const out = resolveBubbles2D(intent);
    expect(out.resolvedPalette.id).toBe("custom");
    // Rim = base hex, round-tripped through HSL → should be near original.
    expect(out.resolvedPalette.rim.toLowerCase()).toBe("#ff8800");
  });

  it("marks oil palette as iridescent", () => {
    const intent: BubblesIntent = {
      ambientEmission: 0.3,
      motionEmission: 0.5,
      intensity: 0.6,
      palette: "oil",
      customColor: "#000000",
      sizeJitter: 0.4,
      buoyancy: 0.5,
      trackingMode: "both_ends",
    };
    const out = resolveBubbles2D(intent);
    expect(out.resolvedPalette.iridescent).toBe(true);
  });
});

describe("resolvePetals2D — palette resolution + defaults", () => {
  it("resolves the blossom palette for intent.palette === 'blossom'", () => {
    const intent: PetalsIntent = {
      ambientEmission: 0.5,
      motionEmission: 0.4,
      intensity: 0.6,
      palette: "blossom",
      customColor: "#ffb0c8",
      swayAmplitude: 0.6,
      fallSpeed: 0.4,
      trackingMode: "both_ends",
    };
    const out = resolvePetals2D(intent);
    expect(out.resolvedPalette.id).toBe("blossom");
    expect(out.resolvedPalette.tints.length).toBeGreaterThan(0);
    expect(out.resolvedPalette.sprites.length).toBeGreaterThan(0);
    expect(out.poolSize).toBeGreaterThan(0);
    expect(out.ambientSpawnRate).toBeGreaterThan(0);
    expect(out.motionSpawnRate).toBeGreaterThan(0);
    expect(out.fallBaseSpeed).toBeGreaterThan(0);
    expect(out.swayBaseSpeed).toBeGreaterThan(0);
  });

  it("resolves a custom palette from customColor", () => {
    const intent: PetalsIntent = {
      ambientEmission: 0.5,
      motionEmission: 0.4,
      intensity: 0.6,
      palette: "custom",
      customColor: "#ff8800",
      swayAmplitude: 0.6,
      fallSpeed: 0.4,
      trackingMode: "both_ends",
    };
    const out = resolvePetals2D(intent);
    expect(out.resolvedPalette.id).toBe("custom");
    expect(out.resolvedPalette.tints.length).toBe(3);
    // Base tint = customColor, round-tripped should match.
    expect(out.resolvedPalette.tints[0]!.toLowerCase()).toBe("#ff8800");
  });

  it("marks ash palette with emberEdge flag", () => {
    const intent: PetalsIntent = {
      ambientEmission: 0.3,
      motionEmission: 0.7,
      intensity: 0.5,
      palette: "ash",
      customColor: "#000000",
      swayAmplitude: 0.7,
      fallSpeed: 0.5,
      trackingMode: "both_ends",
    };
    const out = resolvePetals2D(intent);
    expect(out.resolvedPalette.emberEdge).toBeDefined();
    expect(out.resolvedPalette.emberEdge!.chance).toBeGreaterThan(0);
  });
});

describe("resolveSmoke2D — palette carries behavior", () => {
  function baseIntent(overrides: Partial<SmokeIntent> = {}): SmokeIntent {
    return {
      ambientEmission: 0.5,
      motionEmission: 0.4,
      intensity: 0.5,
      palette: "incense",
      customColor: "#e0e0e0",
      curlStrength: 0.5,
      riseSpeed: 0.5,
      trackingMode: "both_ends",
      ...overrides,
    };
  }

  it("resolves the incense palette colors + behavior multipliers", () => {
    const out = resolveSmoke2D(baseIntent());
    expect(out.resolvedPalette.id).toBe("incense");
    expect(out.resolvedPalette.core).toBe("#d8d8d8");
    expect(out.resolvedPalette.edge).toBe("#f0f0f0");
    expect(out.lifetimeSeconds).toBe(SMOKE_PALETTES.incense.lifetime);
    expect(out.poolSize).toBe(1024);
    expect(out.ambientSpawnRate).toBeGreaterThan(0);
    expect(out.motionSpawnRate).toBeGreaterThan(0);
    expect(out.blendMode).toBe("source-over");
  });

  it("applies palette.curlBias to intent.curlStrength", () => {
    // fog has curlBias 0.5; intent 0.8 × 0.5 = 0.4
    const out = resolveSmoke2D(baseIntent({ palette: "fog", curlStrength: 0.8 }));
    expect(out.resolvedCurlStrength).toBeCloseTo(0.4, 6);
    expect(out.lifetimeSeconds).toBe(6.0);
  });

  it("applies palette.riseBias to intent.riseSpeed and scales by riseBaseSpeed", () => {
    // genie has riseBias 0.9; intent 1.0 × 0.9 × 280 = 252
    // (2D uses 280 px/s base — Boussinesq buoyancy target)
    const out = resolveSmoke2D(baseIntent({ palette: "genie", riseSpeed: 1.0 }));
    expect(out.resolvedRiseSpeed).toBeCloseTo(252.0, 4);
    expect(out.riseBaseSpeed).toBe(280);
  });

  it("derives a custom palette from customColor with neutral behavior defaults", () => {
    const out = resolveSmoke2D(
      baseIntent({ palette: "custom", customColor: "#ff8800" }),
    );
    expect(out.resolvedPalette.id).toBe("custom");
    // Custom lifetime/curlBias/riseBias are neutral defaults (7.0 / 0.5 / 0.5).
    expect(out.lifetimeSeconds).toBe(7.0);
    // resolvedCurlStrength = 0.5 × 0.5 = 0.25
    expect(out.resolvedCurlStrength).toBeCloseTo(0.25, 6);
    // Core = base, edge = +15% L lightened → distinct colors.
    expect(out.resolvedPalette.core).not.toBe(out.resolvedPalette.edge);
  });

  it("exposes the genie hueShift flag on the resolved palette", () => {
    // Flag is set on the palette so renderers can branch on it once
    // 1i.iii lands. Current renderer ignores it; the data still flows.
    const out = resolveSmoke2D(baseIntent({ palette: "genie" }));
    expect(out.resolvedPalette.hueShift).toBe(true);
  });

  it("allows overrides to replace any resolved default field", () => {
    const out = resolveSmoke2D(baseIntent(), { poolSize: 512, baseRadius: 30 });
    expect(out.poolSize).toBe(512);
    expect(out.baseRadius).toBe(30);
  });
});
