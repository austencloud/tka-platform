import { describe, it, expect } from "vitest";
import { getRegistration, EFFECTS } from "../effect-registry";

describe("effect-registry", () => {
  it("returns registration for every effect in EFFECTS", () => {
    for (const meta of EFFECTS) {
      const reg = getRegistration(meta.id);
      expect(reg).toBeDefined();
      expect(reg!.meta.id).toBe(meta.id);
      expect(reg!.presetGroup).toBeDefined();
      expect(Array.isArray(reg!.presetGroup.presets)).toBe(true);
    }
  });

  it("returns undefined for unknown effect id", () => {
    expect(getRegistration("bogus")).toBeUndefined();
  });

  it("each registration has a customizeComponent loader", () => {
    for (const meta of EFFECTS) {
      const reg = getRegistration(meta.id);
      expect(typeof reg!.customizeComponent).toBe("function");
    }
  });
});
