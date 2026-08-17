import { describe, it, expect } from "vitest";
import {
  EFFECT_CONTROLS,
  primaryControls,
} from "./effect-control-manifest";
import { DEFAULT_EFFECTS_CONFIG } from "./defaults";
import { EFFECTS } from "$lib/shared/animation-engine/components/effects-panel/effect-registry";

describe("effect-control-manifest", () => {
  const crossStoreFields = new Set([
    "tailLength",
    "fireLeftHex",
    "fireRightHex",
  ]);

  // LED v2 is a device + strip pattern + nested look, none of which the
  // manifest's flat-field descriptors can address. Its controls live in
  // LedCustomize (device picker, pattern grid, look group), so it declares no
  // manifest controls by design.
  const withoutManifestControls = new Set(["led"]);

  it("every descriptor field exists on the effect's default intent", () => {
    for (const [effect, controls] of Object.entries(EFFECT_CONTROLS)) {
      const intent = (DEFAULT_EFFECTS_CONFIG as unknown as Record<string, Record<string, unknown>>)[effect];
      for (const c of controls) {
        if (crossStoreFields.has(c.field)) continue;
        expect(intent, `${effect}.${c.field}`).toHaveProperty(c.field);
        if (c.pairFields) {
          for (const f of c.pairFields) {
            if (!crossStoreFields.has(f)) {
              expect(intent, `${effect}.${f}`).toHaveProperty(f);
            }
          }
        }
      }
    }
  });

  it("every effect has a uniform Primary row (3-6 controls)", () => {
    for (const [effect, controls] of Object.entries(EFFECT_CONTROLS)) {
      const intent = (DEFAULT_EFFECTS_CONFIG as unknown as Record<
        string,
        Record<string, unknown>
      >)[effect]!;
      if (withoutManifestControls.has(effect)) continue;
      const n = controls.filter(
        (c) => c.tier === "primary" && (!c.showWhen || c.showWhen(intent))
      ).length;
      expect(n, effect).toBeGreaterThanOrEqual(3);
      expect(n, effect).toBeLessThanOrEqual(6);
    }
  });

  it("every canonical effect exposes a shared primary row", () => {
    for (const effect of EFFECTS) {
      if (withoutManifestControls.has(effect.id)) continue;
      expect(primaryControls(effect.id as keyof typeof EFFECT_CONTROLS).length, effect.id)
        .toBeGreaterThanOrEqual(3);
    }
  });

  it("control ids are unique within each effect", () => {
    for (const [effect, controls] of Object.entries(EFFECT_CONTROLS)) {
      const ids = controls.map((c) => c.id);
      expect(new Set(ids).size, effect).toBe(ids.length);
    }
  });
});
