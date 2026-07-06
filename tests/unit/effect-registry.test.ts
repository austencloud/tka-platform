import { describe, it, expect } from "vitest";
import {
  EFFECTS,
  EFFECT_COLORS,
  EFFECT_LABELS,
  type EffectMeta,
} from "../../src/lib/shared/animation-engine/components/effects-panel/effect-registry";

describe("effect-registry", () => {
  it("has all 16 effects in stable order", () => {
    const ids = EFFECTS.map((e) => e.id);
    expect(ids).toEqual([
      "trails",
      "fire",
      "led",
      "charcoal",
      "zap",
      "sparkles",
      "ghost",
      "bloom",
      "goo",
      "bubbles",
      "petals",
      "smoke",
      "ink",
      "silk",
      "animal",
      "pulse",
    ]);
  });

  it("every entry has id, label, icon, color", () => {
    for (const e of EFFECTS) {
      expect(e.id).toMatch(/^[a-z]+$/);
      expect(e.label.length).toBeGreaterThan(0);
      expect(e.icon).toMatch(/^fa-/);
      expect(e.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("EFFECT_COLORS maps every effect id to its hex color", () => {
    for (const e of EFFECTS) {
      expect(EFFECT_COLORS[e.id]).toBe(e.color);
    }
  });

  it("EFFECT_LABELS maps every effect id to its display label", () => {
    for (const e of EFFECTS) {
      expect(EFFECT_LABELS[e.id]).toBe(e.label);
    }
  });

  it("effect ids are unique", () => {
    const ids = EFFECTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("EffectMeta type is re-exported", () => {
    const sample: EffectMeta = EFFECTS[0]!;
    expect(sample.id).toBe("trails");
  });
});
