
import { describe, it, expect, beforeEach } from "vitest";
import { VideoTipAdapter } from "$lib/features/video/video-trails/services/video-tip-adapter";
import type { DetectedEndpoint } from "$lib/features/video/video-trails/domain/types";

function makeEndpoint(overrides: Partial<DetectedEndpoint> = {}): DetectedEndpoint {
  return {
    x: 100, y: 100, brightness: 1.0, confidence: 1.0,
    propIndex: 0, tipIndex: 0, frameIndex: 0,
    ...overrides,
  };
}

describe("VideoTipAdapter", () => {
  let adapter: VideoTipAdapter;

  beforeEach(() => {
    adapter = new VideoTipAdapter();
  });

  describe("mapToFireTips", () => {
    it("returns zero velocity on first frame", () => {
      const tips = adapter.mapToFireTips([makeEndpoint()], 500, 0);
      expect(tips.length).toBe(1);
      expect(tips[0].velocityX).toBe(0);
      expect(tips[0].velocityY).toBe(0);
    });

    it("calculates velocity from position delta", () => {
      adapter.mapToFireTips([makeEndpoint({ x: 100, y: 100 })], 500, 0);
      const tips = adapter.mapToFireTips([makeEndpoint({ x: 200, y: 100 })], 500, 1000);
      expect(tips[0].velocityX).toBeCloseTo(100, 0);
      expect(tips[0].velocityY).toBeCloseTo(0, 0);
    });

    it("clamps dt to prevent division by zero", () => {
      adapter.mapToFireTips([makeEndpoint({ x: 100 })], 500, 1000);
      const tips = adapter.mapToFireTips([makeEndpoint({ x: 200 })], 500, 1000);
      expect(Number.isFinite(tips[0].velocityX)).toBe(true);
    });

    it("maps brightness to flameScale", () => {
      const tips = adapter.mapToFireTips([makeEndpoint({ brightness: 0.7 })], 500, 0);
      expect(tips[0].flameScale).toBe(0.7);
    });
  });

  describe("mapToTrailPoints", () => {
    it("converts endpoints to TrailPoint format", () => {
      const points = adapter.mapToTrailPoints([makeEndpoint({ x: 50, y: 75, propIndex: 1 })], 1234);
      expect(points.length).toBe(1);
      expect(points[0]).toEqual({ x: 50, y: 75, timestamp: 1234, propIndex: 1, tipIndex: 0 });
    });
  });

  describe("reset", () => {
    it("clears velocity tracking state", () => {
      adapter.mapToFireTips([makeEndpoint({ x: 100 })], 500, 0);
      adapter.reset();
      const tips = adapter.mapToFireTips([makeEndpoint({ x: 200 })], 500, 1000);
      expect(tips[0].velocityX).toBe(0);
    });
  });
});
