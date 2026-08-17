import { describe, expect, it } from "vitest";
import { POST_STUDIO_PRESETS } from "$lib/shared/media-composition/domain/post-studio-presets";
import { evaluatePresetFrame } from "$lib/shared/media-composition/services/frame-evaluator";
import type { SequenceTimeMap } from "$lib/shared/media-composition/domain/sequence-time-map";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";

const performancePreset = POST_STUDIO_PRESETS.find(
  (preset) => preset.id === "performance-breakdown"
)!;

const timeMap: SequenceTimeMap = {
  schemaVersion: 1,
  id: "mapped-performance",
  sequenceRef: { sequenceId: "sequence", contentHash: "revision" },
  mediaSourceId: "performance-video",
  anchors: [
    { mediaTimeSeconds: 0, sequencePosition: 0 },
    { mediaTimeSeconds: 2, sequencePosition: 1 },
    { mediaTimeSeconds: 5, sequencePosition: 3 },
    { mediaTimeSeconds: 10, sequencePosition: 5 },
  ],
  source: "manual",
  boundaryPolicy: "clamp",
  updatedAt: 1,
};

const variableDurationSteps = [
  { duration: 0.5 },
  { duration: 1.5 },
  { duration: 1 },
  { duration: 2 },
] as unknown as StepData[];

function layerAt(seconds: number, clipId: string) {
  return evaluatePresetFrame(performancePreset, 10, seconds).find(
    (layer) => layer.clipId === clipId
  );
}

describe("evaluatePresetFrame", () => {
  it("keeps the card visible through the full project", () => {
    expect(layerAt(0, "card")?.opacity).toBe(1);
    expect(layerAt(5, "card")?.opacity).toBe(1);
    expect(layerAt(10, "card")?.opacity).toBe(1);
  });

  it("shows only the performance before the overlap", () => {
    expect(layerAt(4, "performance")?.opacity).toBe(1);
    expect(layerAt(4, "performance-animation")).toBeUndefined();
  });

  it("crossfades performance and animation at the midpoint", () => {
    expect(layerAt(5, "performance")?.opacity).toBeCloseTo(0.5);
    expect(layerAt(5, "performance-animation")?.opacity).toBeCloseTo(0.5);
    expect(layerAt(5, "performance")?.sourceTimeSeconds).toBeCloseTo(5);
    expect(layerAt(5, "performance-animation")?.sourceTimeSeconds).toBeCloseTo(
      5
    );
  });

  it("shows only the animation after the overlap", () => {
    expect(layerAt(6, "performance")).toBeUndefined();
    expect(layerAt(6, "performance-animation")?.opacity).toBe(1);
  });

  it("resolves one fractional sequence position for every aligned layer", () => {
    const layers = evaluatePresetFrame(performancePreset, 10, 5, {
      timeMap,
      steps: variableDurationSteps,
      startPositionDuration: 1,
    });

    expect(layers).toHaveLength(3);
    for (const layer of layers) {
      expect(layer.sequencePosition).toBe(3);
      expect(layer.animationTimeSeconds).toBe(3);
      expect(layer.displayedBeatNumber).toBe(3);
    }
  });

  it("holds the completed pose for the whole beat in step mode", () => {
    // The studio's clock cannot dwell the way the animation engine's step mode
    // does — the video and music underneath keep running — so step here means
    // the position floors to the beat it is inside.
    const [layer] = evaluatePresetFrame(
      { ...performancePreset, animationPlaybackMode: "step" },
      10,
      4,
      { timeMap, steps: variableDurationSteps, startPositionDuration: 1 }
    );
    const [continuous] = evaluatePresetFrame(performancePreset, 10, 4, {
      timeMap,
      steps: variableDurationSteps,
      startPositionDuration: 1,
    });

    expect(continuous?.sequencePosition).toBeGreaterThan(1);
    expect(continuous?.sequencePosition).not.toBe(
      Math.floor(continuous!.sequencePosition!)
    );
    expect(layer?.sequencePosition).toBe(
      Math.floor(continuous!.sequencePosition!)
    );
  });

  it("rejects an invalid project duration", () => {
    expect(() => evaluatePresetFrame(performancePreset, 0, 0)).toThrow(
      RangeError
    );
  });
});
