import { describe, it, expect } from "vitest";
import {
  DEFAULT_CONFIG,
  MAX_IMAGES,
  MAX_IMAGES_RM,
  clampConfig,
  configKey,
  copyModulators,
  generateCopyOps,
  imageCount,
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
  it("counter / echo / stagger / speed leave imageCount alone", () => {
    const base = cfg({ fold: 4 });
    for (const mod of [
      { counter: true },
      { echo: true },
      { staggerSteps: 3 },
      { speed: true },
    ] satisfies Partial<TunnelConfig>[]) {
      expect(imageCount(cfg({ fold: 4, ...mod }))).toBe(imageCount(base));
    }
  });
});

describe("baked modulators — Counter / Echo on alternate arms", () => {
  it("Counter appends invert to odd arms only", () => {
    const ops = generateCopyOps(cfg({ fold: 4, counter: true })); // arms 1,2,3
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

  it("Speed cycles alternate arms through 2× / ½× / 1×", () => {
    const mods = copyModulators(cfg({ fold: 8, speed: true })); // arms 1..7
    expect(mods.slice(0, 3).map((m) => m.speed)).toEqual([2, 0.5, 1]);
  });

  it("Speed off = every arm at 1×", () => {
    const mods = copyModulators(cfg({ fold: 4, speed: false }));
    expect(mods.every((m) => m.speed === 1)).toBe(true);
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

describe("configKey", () => {
  it("encodes every active primitive, stably", () => {
    expect(configKey(cfg({ fold: 4 }))).toBe("f4");
    expect(configKey(cfg({ fold: 8, mirror: true, flip: true, counter: true, echo: true, staggerSteps: 2, speed: true }))).toBe(
      "f8mpces2x",
    );
  });
});
