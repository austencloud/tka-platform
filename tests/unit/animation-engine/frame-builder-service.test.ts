import { describe, it, expect, vi } from "vitest";
import { FrameBuilder } from "$lib/shared/animation-engine/services/frame-builder";

describe("FrameBuilder", () => {
  it("calculateBeatNumber returns 0 when no sequenceData", () => {
    const svc = new FrameBuilder();
    expect(svc.calculateBeatNumber(null, null)).toBe(0);
  });

  it("calculateBeatNumber returns 1-based index when stepData found", () => {
    const step1 = { id: "s1" };
    const step2 = { id: "s2" };
    const sequenceData = { steps: [step1, step2] } as any;
    const svc = new FrameBuilder();
    expect(svc.calculateBeatNumber(sequenceData, step2 as any)).toBe(2);
  });

  it("calculateBeatNumber returns 0 when stepData not in sequence", () => {
    const step1 = { id: "s1" };
    const orphan = { id: "orphan" };
    const sequenceData = { steps: [step1] } as any;
    const svc = new FrameBuilder();
    expect(svc.calculateBeatNumber(sequenceData, orphan as any)).toBe(0);
  });

  it("calculateTurnsTuple returns default when no motions", () => {
    const svc = new FrameBuilder();
    expect(svc.calculateTurnsTuple(null, null)).toBe("(s, 0, 0)");
  });

  it("calculateTurnsTuple delegates to generator when available", () => {
    const generator = { generateTurnsTuple: vi.fn().mockReturnValue("(+, 1, 1)") };
    const stepData = { motions: { blue: {}, red: {} } } as any;
    const svc = new FrameBuilder();
    expect(svc.calculateTurnsTuple(stepData, generator as any)).toBe("(+, 1, 1)");
  });

  it("calculateTurnsTuple returns default when generator returns null", () => {
    const generator = { generateTurnsTuple: vi.fn().mockReturnValue(null) };
    const stepData = { motions: { blue: {}, red: {} } } as any;
    const svc = new FrameBuilder();
    expect(svc.calculateTurnsTuple(stepData, generator as any)).toBe("(s, 0, 0)");
  });

  it("calculateMusicalPosition returns continuous position from orchestrator", () => {
    const orchestrator = { isInitialized: () => true, getContinuousMusicalPosition: () => 2.5 } as any;
    const svc = new FrameBuilder();
    expect(svc.calculateMusicalPosition(null, null, orchestrator)).toBe("2.5");
  });

  it("calculateMusicalPosition returns null when orchestrator position is 0", () => {
    const orchestrator = { isInitialized: () => true, getContinuousMusicalPosition: () => 0 } as any;
    const svc = new FrameBuilder();
    expect(svc.calculateMusicalPosition(null, null, orchestrator)).toBeNull();
  });

  it("calculateMusicalPosition falls back to step index", () => {
    const step = { id: "s1" };
    const sequenceData = { steps: [step] } as any;
    const svc = new FrameBuilder();
    expect(svc.calculateMusicalPosition(sequenceData, step as any, null)).toBe("1.0");
  });
});
