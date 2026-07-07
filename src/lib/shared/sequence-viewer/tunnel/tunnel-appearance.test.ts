import { describe, it, expect } from "vitest";
import {
  DEFAULT_SKIN,
  APPEARANCE_PRESETS,
  MAX_SKINS,
  skinForArm,
  copyPropTypes,
  coerceSkins,
  skinsEqual,
  type PerformerSkin,
} from "./tunnel-appearance";

describe("skinForArm — cycling", () => {
  const two: PerformerSkin[] = [
    { blueProp: "staff", redProp: "staff" },
    { blueProp: "sword", redProp: "sword" },
  ];

  it("1 skin = uniform for every arm", () => {
    for (const arm of [0, 1, 5, 15]) {
      expect(skinForArm([DEFAULT_SKIN], arm)).toEqual(DEFAULT_SKIN);
    }
  });

  it("2 skins alternate by arm index (arm 0 = center = skin 0)", () => {
    expect(skinForArm(two, 0)).toBe(two[0]);
    expect(skinForArm(two, 1)).toBe(two[1]);
    expect(skinForArm(two, 2)).toBe(two[0]);
    expect(skinForArm(two, 3)).toBe(two[1]);
  });

  it("empty list falls back to the default skin", () => {
    expect(skinForArm([], 0)).toEqual(DEFAULT_SKIN);
  });
});

describe("copyPropTypes — uncustomized copies inherit the global prop", () => {
  const cast: PerformerSkin[] = [
    { blueProp: "staff", redProp: "staff" },
    { blueProp: "sword", redProp: "sword" },
  ];

  it("returns null for every arm while uncustomized (copy omits an explicit type → engine falls back to the global prop)", () => {
    for (const arm of [1, 2, 3, 7]) {
      expect(copyPropTypes(false, cast, arm)).toBeNull();
    }
  });

  it("returns the cycled performer skin once customized", () => {
    expect(copyPropTypes(true, cast, 1)).toBe(cast[1]);
    expect(copyPropTypes(true, cast, 2)).toBe(cast[0]);
    expect(copyPropTypes(true, cast, 3)).toBe(cast[1]);
  });

  it("regression: a reset (customized → false) drops per-copy types so no copy keeps the old prop", () => {
    // Customized: copies carry a real (possibly non-global) type.
    expect(copyPropTypes(true, cast, 1)).not.toBeNull();
    // Reset flips the flag; the SAME stale skin list must no longer be read.
    expect(copyPropTypes(false, cast, 1)).toBeNull();
  });
});

describe("coerceSkins — hardening persisted data", () => {
  it("drops non-objects, defaults missing props, always yields >=1", () => {
    expect(coerceSkins(undefined)).toEqual([DEFAULT_SKIN]);
    expect(coerceSkins([])).toEqual([DEFAULT_SKIN]);
    expect(coerceSkins([{ blueProp: "club" }])).toEqual([{ blueProp: "club", redProp: "staff" }]);
    expect(coerceSkins([null, 3, "x"])).toEqual([DEFAULT_SKIN]);
  });

  it("caps the list length at MAX_SKINS", () => {
    const long = Array(99).fill({ blueProp: "staff", redProp: "staff" });
    expect(coerceSkins(long).length).toBe(MAX_SKINS);
  });
});

describe("APPEARANCE_PRESETS", () => {
  it("every preset has >=1 skin and a stable id", () => {
    for (const p of APPEARANCE_PRESETS) {
      expect(p.appearance.length).toBeGreaterThan(0);
      expect(typeof p.id).toBe("string");
      expect(p.id.length).toBeGreaterThan(0);
    }
  });

  it("preset ids are unique", () => {
    const ids = APPEARANCE_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("skinsEqual", () => {
  it("true only when every hand of every skin matches in order", () => {
    const a: PerformerSkin[] = [{ blueProp: "staff", redProp: "sword" }];
    expect(skinsEqual(a, [{ blueProp: "staff", redProp: "sword" }])).toBe(true);
    expect(skinsEqual(a, [{ blueProp: "staff", redProp: "staff" }])).toBe(false);
    expect(skinsEqual(a, [...a, DEFAULT_SKIN])).toBe(false);
  });
});
