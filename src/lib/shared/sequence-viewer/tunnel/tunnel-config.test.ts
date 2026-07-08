import { describe, it, expect } from "vitest";
import {
  DEFAULT_CONFIG,
  MAX_IMAGES,
  MAX_IMAGES_RM,
  SPEED_LADDER,
  TUNNEL_PRESETS,
  clampConfig,
  coerceSpeedOverrides,
  coerceSpeedPattern,
  configKey,
  configsEqual,
  copyModulators,
  effectiveSpeed,
  generateCopyOps,
  getPreset,
  imageCount,
  matchPreset,
  propCount,
  type TunnelConfig,
} from "./tunnel-config";

const cfg = (over: Partial<TunnelConfig>): TunnelConfig => ({ ...DEFAULT_CONFIG, ...over });

describe("symmetry generators — image + prop counts", () => {
  it("fold scales the rotational set (2 props per image)", () => {
    expect(propCount(cfg({ fold: 1 }))).toBe(2);
    expect(propCount(cfg({ fold: 2 }))).toBe(4);
    expect(propCount(cfg({ fold: 4 }))).toBe(8);
    expect(propCount(cfg({ fold: 8 }))).toBe(16);
  });

  it("mirror and flip each double the set (dihedral closure)", () => {
    expect(imageCount(cfg({ fold: 4, mirror: true }))).toBe(8);
    expect(imageCount(cfg({ fold: 4, flip: true }))).toBe(8);
    expect(imageCount(cfg({ fold: 2, mirror: true, flip: true }))).toBe(8);
    expect(imageCount(cfg({ fold: 4, mirror: true, flip: true }))).toBe(16);
  });

  it("copy op list has exactly imageCount − 1 entries (base drawn separately)", () => {
    for (const c of [cfg({ fold: 4 }), cfg({ fold: 8, mirror: true }), cfg({ fold: 2, flip: true })]) {
      expect(generateCopyOps(c).length).toBe(imageCount(c) - 1);
    }
  });
});

describe("per-copy modulators do not change the count", () => {
  it("invert / echo / stagger / speed leave imageCount alone", () => {
    const base = cfg({ fold: 4 });
    for (const mod of [
      { invert: true },
      { echo: true },
      { staggerSteps: 3 },
      { speedPattern: "alternating" },
    ] satisfies Partial<TunnelConfig>[]) {
      expect(imageCount(cfg({ fold: 4, ...mod }))).toBe(imageCount(base));
    }
  });
});

describe("baked modulators — Invert / Echo on alternate arms", () => {
  it("Invert appends invert to odd arms only", () => {
    const ops = generateCopyOps(cfg({ fold: 4, invert: true })); // arms 1,2,3
    const hasInvert = (i: number) => ops[i]!.some((o) => o.kind === "invert");
    expect(hasInvert(0)).toBe(true); // arm 1
    expect(hasInvert(1)).toBe(false); // arm 2
    expect(hasInvert(2)).toBe(true); // arm 3
  });

  it("Echo appends rewind to odd arms only", () => {
    const ops = generateCopyOps(cfg({ fold: 4, echo: true }));
    expect(ops[0]!.some((o) => o.kind === "rewind")).toBe(true);
    expect(ops[1]!.some((o) => o.kind === "rewind")).toBe(false);
  });
});

describe("sample-time modulators — Stagger / Speed", () => {
  it("Stagger accumulates by arm index", () => {
    const mods = copyModulators(cfg({ fold: 4, staggerSteps: 2 })); // arms 1,2,3
    expect(mods.map((m) => m.staggerSteps)).toEqual([2, 4, 6]);
  });

  it("Stagger 0 = no offset", () => {
    const mods = copyModulators(cfg({ fold: 4, staggerSteps: 0 }));
    expect(mods.every((m) => m.staggerSteps === 0)).toBe(true);
  });

  it("alternating cycles arms through 2× / ½× / 1× (the legacy Speed behavior)", () => {
    const mods = copyModulators(cfg({ fold: 8, speedPattern: "alternating" })); // arms 1..7
    expect(mods.slice(0, 3).map((m) => m.speed)).toEqual([2, 0.5, 1]);
  });

  it("off = every arm at 1×", () => {
    const mods = copyModulators(cfg({ fold: 4, speedPattern: "off" }));
    expect(mods.every((m) => m.speed === 1)).toBe(true);
  });

  it("accelerando sweeps first copy slow → last copy fast", () => {
    const mods = copyModulators(cfg({ fold: 4, speedPattern: "accelerando" })); // 3 copies
    const rates = mods.map((m) => m.speed);
    expect(rates[0]).toBe(0.5); // first copy slowest
    expect(rates[rates.length - 1]).toBe(2); // last copy fastest
    expect(rates[0]!).toBeLessThanOrEqual(rates[1]!);
    expect(rates[1]!).toBeLessThanOrEqual(rates[2]!);
  });

  it("a per-performer override wins over the pattern (only that arm)", () => {
    const c = cfg({ fold: 4, speedPattern: "off", speedOverrides: { 2: 4 } });
    const mods = copyModulators(c); // arms 1,2,3
    expect(mods.map((m) => m.speed)).toEqual([1, 4, 1]);
    // effectiveSpeed agrees for the pinned arm and the pattern arms.
    expect(effectiveSpeed(c, 2, imageCount(c))).toBe(4);
    expect(effectiveSpeed(c, 1, imageCount(c))).toBe(1);
  });
});

describe("clampConfig — budget ceiling", () => {
  it("walks Fold down first, keeping reflections when it can", () => {
    const clamped = clampConfig(cfg({ fold: 8, mirror: true, flip: true }), MAX_IMAGES);
    expect(imageCount(clamped)).toBeLessThanOrEqual(MAX_IMAGES);
    expect(clamped.fold).toBe(4);
    expect(clamped.mirror && clamped.flip).toBe(true);
  });

  it("drops reflections only when Fold 1 still overflows (reduced motion)", () => {
    const clamped = clampConfig(cfg({ fold: 8, mirror: true, flip: true }), MAX_IMAGES_RM);
    expect(imageCount(clamped)).toBeLessThanOrEqual(MAX_IMAGES_RM);
    expect(clamped.fold).toBe(1);
  });

  it("leaves an already-small config untouched", () => {
    const c = cfg({ fold: 2, mirror: true });
    expect(clampConfig(c, MAX_IMAGES)).toEqual(c);
  });
});

describe("mandala presets", () => {
  it("the default config is the Duo preset", () => {
    expect(matchPreset(DEFAULT_CONFIG)).toBe("duo");
  });

  it("every preset round-trips through matchPreset", () => {
    for (const p of TUNNEL_PRESETS) {
      expect(matchPreset(p.config)).toBe(p.id);
    }
  });

  it("every preset stays within the live budget", () => {
    for (const p of TUNNEL_PRESETS) {
      expect(imageCount(p.config)).toBeLessThanOrEqual(MAX_IMAGES);
    }
  });

  it("a custom tweak matches no preset", () => {
    expect(matchPreset(cfg({ fold: 4, flip: true, echo: true }))).toBeNull();
    expect(getPreset("mandala")?.config.mirror).toBe(true);
  });
});

describe("configsEqual (user-preset matching)", () => {
  it("is true only when all primitives match", () => {
    expect(configsEqual(cfg({ fold: 4, invert: true }), cfg({ fold: 4, invert: true }))).toBe(true);
    expect(configsEqual(cfg({ fold: 4, invert: true }), cfg({ fold: 4, echo: true }))).toBe(false);
    expect(configsEqual(cfg({ fold: 4, staggerSteps: 1 }), cfg({ fold: 4, staggerSteps: 2 }))).toBe(false);
  });

  it("distinguishes speed pattern and per-performer overrides", () => {
    expect(
      configsEqual(cfg({ fold: 4, speedPattern: "alternating" }), cfg({ fold: 4, speedPattern: "accelerando" })),
    ).toBe(false);
    expect(
      configsEqual(cfg({ fold: 4, speedOverrides: { 1: 2 } }), cfg({ fold: 4, speedOverrides: { 1: 2 } })),
    ).toBe(true);
    expect(
      configsEqual(cfg({ fold: 4, speedOverrides: { 1: 2 } }), cfg({ fold: 4, speedOverrides: { 1: 4 } })),
    ).toBe(false);
    expect(configsEqual(cfg({ fold: 4, speedOverrides: { 1: 2 } }), cfg({ fold: 4 }))).toBe(false);
  });
});

describe("configKey", () => {
  it("encodes every active primitive, stably", () => {
    expect(configKey(cfg({ fold: 4 }))).toBe("f4");
    // alternating keeps the legacy "x" glyph so pre-existing keys stay stable.
    expect(
      configKey(cfg({ fold: 8, mirror: true, flip: true, invert: true, echo: true, staggerSteps: 2, speedPattern: "alternating" })),
    ).toBe("f8mpies2x");
  });

  it("encodes accelerando and per-performer overrides distinctly", () => {
    expect(configKey(cfg({ fold: 4, speedPattern: "accelerando" }))).toBe("f4xz");
    // arm 2 pinned to 4× → SPEED_LADDER index of 4 is 4 → "t2-4".
    expect(configKey(cfg({ fold: 4, speedOverrides: { 2: 4 } }))).toBe("f4t2-4");
    expect(SPEED_LADDER.indexOf(4)).toBe(4);
  });
});

describe("speed migration + coercion", () => {
  it("coerceSpeedPattern accepts valid patterns and migrates the legacy boolean", () => {
    expect(coerceSpeedPattern("accelerando")).toBe("accelerando");
    expect(coerceSpeedPattern("alternating")).toBe("alternating");
    expect(coerceSpeedPattern("off")).toBe("off");
    // Legacy `speed: true` → alternating; anything else → off.
    expect(coerceSpeedPattern(undefined, true)).toBe("alternating");
    expect(coerceSpeedPattern(undefined, false)).toBe("off");
    expect(coerceSpeedPattern("garbage")).toBe("off");
  });

  it("coerceSpeedOverrides keeps only positive-arm ladder rates", () => {
    expect(coerceSpeedOverrides({ 1: 2, 3: 0.5 })).toEqual({ 1: 2, 3: 0.5 });
    // Off-ladder rate, zero/negative arm, and non-numeric values are dropped.
    expect(coerceSpeedOverrides({ 1: 1.7, 0: 2, "-1": 2, 2: "fast" })).toEqual({});
    expect(coerceSpeedOverrides(null)).toEqual({});
    expect(coerceSpeedOverrides("nope")).toEqual({});
  });
});
