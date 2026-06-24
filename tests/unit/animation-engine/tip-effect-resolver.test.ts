import { describe, it, expect } from "vitest";
import {
  resolveEffect,
  resolveEffort,
  type TipEffectMap,
  type TipEffortMap,
} from "../../../src/lib/shared/animation-engine/domain/types/tip-effect-types";
import {
  setCellWide,
  setPerHand,
  setPerTip,
  resolveTipEffect as resolveEffectFn,
  resolveTipEffort as resolveEffortFn,
} from "../../../src/lib/shared/animation-engine/services/tip-effect-resolver";

describe("resolveEffect (pure function)", () => {
  it("returns 'none' when both maps are empty", () => {
    expect(resolveEffect(0, 0, undefined, {})).toBe("none");
  });

  it("returns 'none' when cell map is empty and global map is empty", () => {
    expect(resolveEffect(0, 0, {}, {})).toBe("none");
  });

  it("resolves cell-wide '*' key", () => {
    const cell: TipEffectMap = { "*": { effect: "fire" } };
    expect(resolveEffect(0, 0, cell, {})).toBe("fire");
    expect(resolveEffect(1, 2, cell, {})).toBe("fire");
  });

  it("resolves per-hand key ('0', '1')", () => {
    const cell: TipEffectMap = {
      "0": { effect: "charcoal" },
      "1": { effect: "led" },
    };
    expect(resolveEffect(0, 0, cell, {})).toBe("charcoal");
    expect(resolveEffect(0, 1, cell, {})).toBe("charcoal");
    expect(resolveEffect(1, 0, cell, {})).toBe("led");
  });

  it("resolves per-tip key ('0-0', '0-1', '1-0')", () => {
    const cell: TipEffectMap = {
      "0-0": { effect: "fire" },
      "0-1": { effect: "trails" },
    };
    expect(resolveEffect(0, 0, cell, {})).toBe("fire");
    expect(resolveEffect(0, 1, cell, {})).toBe("trails");
  });

  it("per-tip overrides per-hand", () => {
    const cell: TipEffectMap = {
      "0": { effect: "charcoal" },
      "0-1": { effect: "led" },
    };
    // tip 0 falls through to per-hand
    expect(resolveEffect(0, 0, cell, {})).toBe("charcoal");
    // tip 1 matches per-tip, overriding per-hand
    expect(resolveEffect(0, 1, cell, {})).toBe("led");
  });

  it("per-hand overrides cell-wide", () => {
    const cell: TipEffectMap = {
      "*": { effect: "fire" },
      "1": { effect: "trails" },
    };
    expect(resolveEffect(0, 0, cell, {})).toBe("fire");
    expect(resolveEffect(1, 0, cell, {})).toBe("trails");
  });

  it("cell map takes priority over global map", () => {
    const cell: TipEffectMap = { "*": { effect: "fire" } };
    const global: TipEffectMap = { "*": { effect: "led" } };
    expect(resolveEffect(0, 0, cell, global)).toBe("fire");
  });

  it("falls through cell to global when cell has no match", () => {
    const cell: TipEffectMap = { "1": { effect: "fire" } };
    const global: TipEffectMap = { "*": { effect: "led" } };
    // prop 0 has no cell match, falls through to global
    expect(resolveEffect(0, 0, cell, global)).toBe("led");
    // prop 1 matches cell
    expect(resolveEffect(1, 0, cell, global)).toBe("fire");
  });

  it("falls through to global when cell map is undefined", () => {
    const global: TipEffectMap = { "0-0": { effect: "trails" } };
    expect(resolveEffect(0, 0, undefined, global)).toBe("trails");
  });

  it("global per-tip overrides global per-hand", () => {
    const global: TipEffectMap = {
      "0": { effect: "charcoal" },
      "0-1": { effect: "fire" },
    };
    expect(resolveEffect(0, 0, undefined, global)).toBe("charcoal");
    expect(resolveEffect(0, 1, undefined, global)).toBe("fire");
  });
});

describe("resolveEffort (pure function)", () => {
  it("returns 'linear' when both maps are empty", () => {
    expect(resolveEffort(0, 0, undefined, {})).toBe("linear");
  });

  it("resolves cell-wide '*' key", () => {
    const cell: TipEffortMap = { "*": { effort: "punch" } };
    expect(resolveEffort(0, 0, cell, {})).toBe("punch");
  });

  it("resolves per-hand key", () => {
    const cell: TipEffortMap = { "0": { effort: "glide" } };
    expect(resolveEffort(0, 0, cell, {})).toBe("glide");
  });

  it("resolves per-tip key", () => {
    const cell: TipEffortMap = { "1-0": { effort: "bounce" } };
    expect(resolveEffort(1, 0, cell, {})).toBe("bounce");
  });

  it("per-tip overrides per-hand for effort", () => {
    const cell: TipEffortMap = {
      "0": { effort: "press" },
      "0-1": { effort: "elastic" },
    };
    expect(resolveEffort(0, 0, cell, {})).toBe("press");
    expect(resolveEffort(0, 1, cell, {})).toBe("elastic");
  });

  it("cell effort takes priority over global", () => {
    const cell: TipEffortMap = { "*": { effort: "dab" } };
    const global: TipEffortMap = { "*": { effort: "anticipation" } };
    expect(resolveEffort(0, 0, cell, global)).toBe("dab");
  });

  it("falls through to global effort when cell has no match", () => {
    const global: TipEffortMap = { "*": { effort: "bounce" } };
    expect(resolveEffort(0, 0, {}, global)).toBe("bounce");
  });
});

describe("tip-effect-resolver module functions", () => {
  describe("resolveTipEffect delegation", () => {
    it("delegates to pure function correctly", () => {
      const cell: TipEffectMap = { "0-0": { effect: "fire" } };
      expect(resolveEffectFn(0, 0, cell, {})).toBe("fire");
      expect(resolveEffectFn(0, 1, cell, {})).toBe("none");
    });
  });

  describe("resolveTipEffort delegation", () => {
    it("delegates to pure function correctly", () => {
      const global: TipEffortMap = { "*": { effort: "punch" } };
      expect(resolveEffortFn(0, 0, undefined, global)).toBe("punch");
    });
  });

  describe("setCellWide", () => {
    it("returns a new map with '*' key set", () => {
      const original: TipEffectMap = {};
      const result = setCellWide(original, "fire");
      expect(result["*"]).toEqual({ effect: "fire" });
      // original is not mutated
      expect(original["*"]).toBeUndefined();
    });

    it("preserves existing entries", () => {
      const original: TipEffectMap = { "0": { effect: "led" } };
      const result = setCellWide(original, "charcoal");
      expect(result["0"]).toEqual({ effect: "led" });
      expect(result["*"]).toEqual({ effect: "charcoal" });
    });

    it("overwrites existing '*' key", () => {
      const original: TipEffectMap = { "*": { effect: "fire" } };
      const result = setCellWide(original, "trails");
      expect(result["*"]).toEqual({ effect: "trails" });
    });
  });

  describe("setPerHand", () => {
    it("sets effect for a specific hand index", () => {
      const result = setPerHand({}, 0, "led");
      expect(result["0"]).toEqual({ effect: "led" });
    });

    it("does not mutate original", () => {
      const original: TipEffectMap = {};
      setPerHand(original, 1, "fire");
      expect(original["1"]).toBeUndefined();
    });

    it("preserves other entries", () => {
      const original: TipEffectMap = { "0": { effect: "charcoal" } };
      const result = setPerHand(original, 1, "trails");
      expect(result["0"]).toEqual({ effect: "charcoal" });
      expect(result["1"]).toEqual({ effect: "trails" });
    });
  });

  describe("setPerTip", () => {
    it("sets effect for a specific tip on a specific hand", () => {
      const result = setPerTip({}, 0, 1, "fire");
      expect(result["0-1"]).toEqual({ effect: "fire" });
    });

    it("does not mutate original", () => {
      const original: TipEffectMap = {};
      setPerTip(original, 0, 0, "led");
      expect(original["0-0"]).toBeUndefined();
    });

    it("preserves other entries", () => {
      const original: TipEffectMap = {
        "*": { effect: "charcoal" },
        "0": { effect: "fire" },
      };
      const result = setPerTip(original, 1, 2, "trails");
      expect(result["*"]).toEqual({ effect: "charcoal" });
      expect(result["0"]).toEqual({ effect: "fire" });
      expect(result["1-2"]).toEqual({ effect: "trails" });
    });
  });
});
