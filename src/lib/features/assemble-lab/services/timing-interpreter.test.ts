import { describe, it, expect } from "vitest";
import {
  computeDurations,
  type TimedStepRecord,
} from "./timing-interpreter";

function makeRecords(keydowns: number[], keyups: number[]): TimedStepRecord[] {
  return keydowns.map((kd, i) => ({ keydownTimestamp: kd, keyupTimestamp: keyups[i]! }));
}

describe("computeDurations", () => {
  describe("inter-press capture", () => {
    it("computes gaps between consecutive keydowns", () => {
      const records = makeRecords([0, 200, 500, 600], [50, 250, 550, 650]);
      const result = computeDurations(records, "inter-press", "absolute");
      expect(result).toEqual([200, 300, 100]);
    });

    it("returns empty array for single step", () => {
      const records = makeRecords([0], [50]);
      expect(computeDurations(records, "inter-press", "absolute")).toEqual([]);
    });
  });

  describe("hold-duration capture", () => {
    it("computes keyup - keydown for each step", () => {
      const records = makeRecords([0, 300, 700], [200, 500, 1000]);
      const result = computeDurations(records, "hold-duration", "absolute");
      expect(result).toEqual([200, 200, 300]);
    });
  });

  describe("absolute interpretation", () => {
    it("clamps to [100, 3000]", () => {
      const records = makeRecords([0, 10, 5000], [5, 15, 5005]);
      const result = computeDurations(records, "inter-press", "absolute");
      expect(result[0]).toBe(100);   // 10ms clamped up
      expect(result[1]).toBe(3000);  // 4990ms clamped down
    });
  });

  describe("proportional interpretation", () => {
    it("normalizes relative to average and clamps to [150, 2000]", () => {
      // Gaps: 100, 300, 200 → avg=200
      const records = makeRecords([0, 100, 400, 600], [50, 150, 450, 650]);
      const result = computeDurations(records, "inter-press", "proportional");
      // Check ratios are preserved
      expect(result[0]!).toBeLessThan(result[2]!);
      expect(result[1]!).toBeGreaterThan(result[2]!);
      // All within clamp range
      result.forEach(d => {
        expect(d).toBeGreaterThanOrEqual(150);
        expect(d).toBeLessThanOrEqual(2000);
      });
    });
  });

  describe("quantized interpretation", () => {
    it("snaps to nearest subdivision at 120 BPM, 8th notes", () => {
      // 120 BPM, 8th note = 250ms
      const records = makeRecords([0, 230, 710], [50, 280, 760]);
      const result = computeDurations(records, "inter-press", "quantized", 120, 8);
      expect(result[0]).toBe(250);
      expect(result[1]).toBe(500);
    });

    it("clamps to minimum 1 subdivision", () => {
      const records = makeRecords([0, 10], [5, 15]);
      const result = computeDurations(records, "inter-press", "quantized", 120, 8);
      expect(result[0]).toBe(250);
    });

    it("clamps to maximum 8 subdivisions", () => {
      const records = makeRecords([0, 5000], [50, 5050]);
      const result = computeDurations(records, "inter-press", "quantized", 120, 8);
      expect(result[0]).toBe(2000);
    });
  });
});
