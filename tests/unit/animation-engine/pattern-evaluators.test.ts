import { describe, it, expect } from "vitest";
import { createReusableContext } from "$lib/shared/animation-engine/domain/patterns/context";

describe("TipEvaluationContext", () => {
  it("creates a context with sensible defaults", () => {
    const ctx = createReusableContext();
    expect(ctx.time).toBe(0);
    expect(ctx.beatIndex).toBe(-1);
    expect(ctx.totalBeats).toBe(0);
    expect(ctx.prevFrameTips).toHaveLength(0);
    expect(ctx.secondaryColor).toEqual({ r: 1, g: 1, b: 1 });
  });

  it("context is mutable for reuse", () => {
    const ctx = createReusableContext();
    ctx.time = 1.5;
    ctx.propIndex = 1;
    expect(ctx.time).toBe(1.5);
    expect(ctx.propIndex).toBe(1);
  });
});
