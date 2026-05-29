import { describe, it, expect } from "vitest";
import { EFFECT_PLUGINS, EFFECT_PLUGIN_BY_ID } from "./registry";

describe("EFFECT_PLUGINS registry", () => {
  it("has a unique id per entry", () => {
    const ids = EFFECT_PLUGINS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every entry declares a valid kind, configKey, and createRenderer", () => {
    for (const p of EFFECT_PLUGINS) {
      expect(["canvas2d", "webgl", "led", "trails"]).toContain(p.kind);
      expect(typeof p.configKey).toBe("string");
      expect(p.configKey.length).toBeGreaterThan(0);
      expect(typeof p.createRenderer).toBe("function");
    }
  });

  it("by-id lookup resolves every entry", () => {
    for (const p of EFFECT_PLUGINS) {
      expect(EFFECT_PLUGIN_BY_ID[p.id]).toBe(p);
    }
  });
});
