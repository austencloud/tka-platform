import { describe, it, expect } from "vitest";
import { createEffectsConfigState } from "../../src/lib/shared/effects/state/effects-config-state.svelte";
import {
  PRIMARY_PARAMS,
  getPrimaryParam,
  setPrimaryParam,
} from "../../src/lib/shared/animation-engine/components/effects-panel/effect-primary-param";

describe("effect-primary-param", () => {
  it("has an entry for all 14 effects with primary params", () => {
    const ids = Object.keys(PRIMARY_PARAMS).sort();
    expect(ids).toEqual([
      "bloom",
      "bubbles",
      "charcoal",
      "fire",
      "frost",
      // Echo→Ghost and Water→Goo (5931d08ec2) — onion-skin prop sprites and the
      // goo emitter. Renamed across registry, presets, renderers, and the
      // persisted-config migrations.
      "ghost",
      "goo",
      "ink",
      "led",
      "petals",
      "smoke",
      "sparkles",
      "trails",
      "zap",
    ]);
  });

  it("each entry declares label, min, max, step, format", () => {
    for (const [id, p] of Object.entries(PRIMARY_PARAMS)) {
      expect(p.label.length, `${id} label`).toBeGreaterThan(0);
      expect(typeof p.min).toBe("number");
      expect(typeof p.max).toBe("number");
      expect(p.max).toBeGreaterThan(p.min);
      expect(typeof p.step).toBe("number");
      expect(typeof p.format(p.min)).toBe("string");
    }
  });

  it("Trails thickness round-trips through state (1-12, step 1)", () => {
    const s = createEffectsConfigState();
    setPrimaryParam("trails", s, 7);
    expect(getPrimaryParam("trails", s)).toBe(7);
    expect(PRIMARY_PARAMS.trails!.min).toBe(1);
    expect(PRIMARY_PARAMS.trails!.max).toBe(12);
    expect(PRIMARY_PARAMS.trails!.step).toBe(1);
  });

  it("Fire intensity round-trips (0.45-1, step 0.01)", () => {
    const s = createEffectsConfigState();
    setPrimaryParam("fire", s, 0.7);
    expect(getPrimaryParam("fire", s)).toBeCloseTo(0.7);
    expect(PRIMARY_PARAMS.fire!.min).toBeCloseTo(0.45);
    expect(PRIMARY_PARAMS.fire!.max).toBe(1);
    expect(PRIMARY_PARAMS.fire!.step).toBe(0.01);
  });

  it("LED brightness round-trips (1-5 integer)", () => {
    const s = createEffectsConfigState();
    setPrimaryParam("led", s, 4);
    expect(getPrimaryParam("led", s)).toBe(4);
    expect(PRIMARY_PARAMS.led!.step).toBe(1);
  });

  it.each([
    ["charcoal", 0.3],
    ["zap", 0.5],
    ["sparkles", 0.4],
    ["ghost", 0.6],
    ["bloom", 0.8],
    ["goo", 0.2],
    ["bubbles", 0.55],
    ["petals", 0.42],
  ])("%s primary param round-trips to %f", (id, value) => {
    const s = createEffectsConfigState();
    setPrimaryParam(id as string, s, value as number);
    expect(getPrimaryParam(id as string, s)).toBeCloseTo(value as number);
  });

  it("unknown effect id throws", () => {
    const s = createEffectsConfigState();
    expect(() => getPrimaryParam("nonexistent", s)).toThrow();
    expect(() => setPrimaryParam("nonexistent", s, 0.5)).toThrow();
  });
});
