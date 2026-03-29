import { describe, it, expect } from "vitest";
import {
  PATTERN_DESCRIPTORS,
  getPatternDescriptor,
  getPatternsByCategory,
  CATEGORY_LABELS,
} from "$lib/shared/animation-engine/domain/patterns/registry";
import { evaluatePattern, hasPattern } from "$lib/shared/animation-engine/domain/patterns/evaluator";
import { createReusableContext } from "$lib/shared/animation-engine/domain/patterns/context";

describe("Pattern Registry", () => {
  it("has 22 pattern descriptors", () => {
    expect(PATTERN_DESCRIPTORS).toHaveLength(22);
  });

  it("all pattern IDs are unique", () => {
    const ids = PATTERN_DESCRIPTORS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all 6 categories have at least one pattern", () => {
    for (const category of Object.keys(CATEGORY_LABELS)) {
      const patterns = getPatternsByCategory(category as any);
      expect(patterns.length).toBeGreaterThan(0);
    }
  });

  it("getPatternDescriptor finds known pattern", () => {
    const solid = getPatternDescriptor("solid");
    expect(solid).toBeDefined();
    expect(solid!.name).toBe("Solid");
    expect(solid!.category).toBe("solid");
  });

  it("getPatternDescriptor returns undefined for unknown", () => {
    expect(getPatternDescriptor("nonexistent")).toBeUndefined();
  });
});

describe("Pattern Evaluator", () => {
  it("unknown pattern falls back to primary color", () => {
    const ctx = createReusableContext();
    ctx.primaryColor = { r: 0.5, g: 0.3, b: 0.1 };
    const color = evaluatePattern("nonexistent-pattern", ctx);
    expect(color).toEqual({ r: 0.5, g: 0.3, b: 0.1 });
  });
});
