import { describe, it, expect } from "vitest";
import {
  EFFECT_CONTROLS,
  EFFECTS_WITH_3D_RENDERER,
  primaryControls,
} from "./effect-control-manifest";
import { DEFAULT_EFFECTS_CONFIG } from "./defaults";

describe("effect-control-manifest", () => {
  it("every descriptor field exists on the effect's default intent", () => {
    for (const [effect, controls] of Object.entries(EFFECT_CONTROLS)) {
      const intent = (DEFAULT_EFFECTS_CONFIG as unknown as Record<string, Record<string, unknown>>)[effect];
      for (const c of controls) {
        expect(intent, `${effect}.${c.field}`).toHaveProperty(c.field);
        if (c.pairFields) for (const f of c.pairFields) expect(intent, `${effect}.${f}`).toHaveProperty(f);
      }
    }
  });

  it("every effect has a uniform Primary row (3-5 controls)", () => {
    for (const [effect, controls] of Object.entries(EFFECT_CONTROLS)) {
      const n = controls.filter((c) => c.tier === "primary").length;
      expect(n, effect).toBeGreaterThanOrEqual(3);
      expect(n, effect).toBeLessThanOrEqual(5);
    }
  });

  it("renderer-backed effects each expose a primary row", () => {
    for (const effect of EFFECTS_WITH_3D_RENDERER) {
      expect(primaryControls(effect).length, effect).toBeGreaterThanOrEqual(3);
    }
  });

  it("control ids are unique within each effect", () => {
    for (const [effect, controls] of Object.entries(EFFECT_CONTROLS)) {
      const ids = controls.map((c) => c.id);
      expect(new Set(ids).size, effect).toBe(ids.length);
    }
  });
});
