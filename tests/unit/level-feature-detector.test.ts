import { describe, it, expect } from "vitest";
import { detectLevelFeatures } from "$lib/shared/domain/curriculum/level-feature-detector";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

function seq(partial: Partial<SequenceData>): SequenceData {
  return {
    id: "t",
    name: "",
    word: "",
    steps: [],
    thumbnails: [],
    isFavorite: false,
    isCircular: false,
    tags: [],
    metadata: {},
    ...partial,
  } as SequenceData;
}

function stepWith(motions: unknown, position?: Record<string, string>): unknown {
  return {
    stepNumber: 1,
    duration: 1,
    blueReversal: false,
    redReversal: false,
    isBlank: false,
    motions,
    ...(position ?? {}),
  };
}

describe("detectLevelFeatures", () => {
  it("returns L1 for a plain in/out radial sequence", () => {
    const s = seq({
      gridMode: "diamond",
      steps: [stepWith({
        blue: { startLocation: "n", endLocation: "e", startOrientation: "in", endOrientation: "out", motionType: "pro" },
        red:  { startLocation: "s", endLocation: "w", startOrientation: "in", endOrientation: "out", motionType: "pro" },
      })] as unknown as SequenceData["steps"],
    });
    const report = detectLevelFeatures(s);
    expect(report.beyondLevel3).toBe(false);
    expect(report.minLevel).toBe(1);
    expect(report.features).toEqual([]);
  });

  it("does NOT flag clock/counter as L4+ (L2 per user's model; handled by existing classifier)", () => {
    const s = seq({
      gridMode: "diamond",
      steps: [stepWith({
        blue: { startLocation: "n", endLocation: "e", startOrientation: "in", endOrientation: "clock", motionType: "pro" },
        red:  { startLocation: "s", endLocation: "w", startOrientation: "in", endOrientation: "counter", motionType: "anti" },
      })] as unknown as SequenceData["steps"],
    });
    const report = detectLevelFeatures(s);
    expect(report.beyondLevel3).toBe(false);
    expect(report.minLevel).toBe(1);
  });

  it("flags center location as L4", () => {
    const s = seq({
      gridMode: "centric",
      steps: [stepWith({
        blue: { startLocation: "c", endLocation: "n", motionType: "hashOut" },
        red:  { startLocation: "s", endLocation: "e", motionType: "pro" },
      })] as unknown as SequenceData["steps"],
    });
    const report = detectLevelFeatures(s);
    expect(report.beyondLevel3).toBe(true);
    expect(report.minLevel).toBe(4);
    expect(report.features.some((f) => f.includes("center"))).toBe(true);
    expect(report.features.some((f) => f.includes("gridMode:centric"))).toBe(true);
  });

  it("flags tau/terra positions as L4", () => {
    const s = seq({
      steps: [stepWith({}, { startPosition: "tau3", endPosition: "terra1" })] as unknown as SequenceData["steps"],
    });
    const report = detectLevelFeatures(s);
    expect(report.beyondLevel3).toBe(true);
    expect(report.minLevel).toBe(4);
  });

  it("flags zeta/eta positions as L5", () => {
    const s = seq({
      gridMode: "skewed",
      steps: [stepWith({}, { startPosition: "zeta5", endPosition: "eta12" })] as unknown as SequenceData["steps"],
    });
    const report = detectLevelFeatures(s);
    expect(report.beyondLevel3).toBe(true);
    expect(report.minLevel).toBe(5);
  });

  it("flags 8point grid mode as L5", () => {
    const s = seq({ gridMode: "8point", steps: [] });
    const report = detectLevelFeatures(s);
    expect(report.beyondLevel3).toBe(true);
    expect(report.minLevel).toBe(5);
  });

  it("flags interradial orientations as L6", () => {
    const s = seq({
      steps: [stepWith({
        blue: { startOrientation: "in", endOrientation: "clockIn" },
        red:  { startOrientation: "out", endOrientation: "counterOut" },
      })] as unknown as SequenceData["steps"],
    });
    const report = detectLevelFeatures(s);
    expect(report.beyondLevel3).toBe(true);
    expect(report.minLevel).toBe(6);
  });

  it("flags trigrid grid mode as L7", () => {
    const s = seq({ gridMode: "trigrid", steps: [] });
    const report = detectLevelFeatures(s);
    expect(report.beyondLevel3).toBe(true);
    expect(report.minLevel).toBe(7);
  });

  it("flags plane on motion as L8", () => {
    const s = seq({
      steps: [stepWith({
        blue: { plane: "wall", startLocation: "n", endLocation: "e" },
        red:  { plane: "wheel", startLocation: "s", endLocation: "w" },
      })] as unknown as SequenceData["steps"],
    });
    const report = detectLevelFeatures(s);
    expect(report.beyondLevel3).toBe(true);
    expect(report.minLevel).toBe(8);
    expect(report.features.some((f) => f.includes("plane:wall"))).toBe(true);
  });

  it("returns highest minLevel when multiple features present", () => {
    const s = seq({
      gridMode: "centric",
      steps: [stepWith({
        blue: { plane: "wall", startLocation: "c", endLocation: "n" },
      })] as unknown as SequenceData["steps"],
    });
    const report = detectLevelFeatures(s);
    expect(report.minLevel).toBe(8);
  });
});
