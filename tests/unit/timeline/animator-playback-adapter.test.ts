import { describe, it, expect, vi } from "vitest";

import {
  computeOverallProgress,
  computeCurrentBeat,
  computeElapsed,
  computeSeekTarget,
} from "$lib/shared/timeline/adapters/animator-playback-adapter.svelte";

describe("animator-playback-adapter", () => {
  describe("computeOverallProgress", () => {
    it("returns 0 at step 1 (start of first beat)", () => {
      expect(computeOverallProgress(1, 4)).toBeCloseTo(0);
    });

    it("returns 0.5 at step 3 of 4 beats", () => {
      expect(computeOverallProgress(3, 4)).toBeCloseTo(0.5);
    });

    it("returns ~1 at the end of the last beat", () => {
      expect(computeOverallProgress(4.99, 4)).toBeCloseTo(0.9975);
    });

    it("returns 0 when currentStep < 1 (start position hold)", () => {
      expect(computeOverallProgress(0.5, 4)).toBe(0);
    });

    it("handles single-beat sequence", () => {
      expect(computeOverallProgress(1.5, 1)).toBeCloseTo(0.5);
    });

    it("clamps to 0 when totalSteps is 0", () => {
      expect(computeOverallProgress(1, 0)).toBe(0);
    });
  });

  describe("computeCurrentBeat", () => {
    it("returns 1 at step 1.0", () => {
      expect(computeCurrentBeat(1.0)).toBe(1);
    });

    it("returns 1 at step 1.5 (mid first beat)", () => {
      expect(computeCurrentBeat(1.5)).toBe(1);
    });

    it("returns 3 at step 3.2", () => {
      expect(computeCurrentBeat(3.2)).toBe(3);
    });

    it("returns 0 during start position hold", () => {
      expect(computeCurrentBeat(0.5)).toBe(0);
    });
  });

  describe("computeElapsed", () => {
    const durations = [1.0, 1.0, 1.0, 1.0]; // 4 beats, 1s each

    it("returns 0 at beat 1 start", () => {
      expect(computeElapsed(1.0, durations)).toBeCloseTo(0);
    });

    it("returns 0.5 at beat 1 midpoint", () => {
      expect(computeElapsed(1.5, durations)).toBeCloseTo(0.5);
    });

    it("returns 2.0 at beat 3 start", () => {
      expect(computeElapsed(3.0, durations)).toBeCloseTo(2.0);
    });

    it("handles variable durations", () => {
      const varDurations = [2.0, 1.0, 3.0]; // 6s total
      // Step 2.5 = start of beat 2 + 0.5 = 2.0s + 0.5 * 1.0s = 2.5s
      expect(computeElapsed(2.5, varDurations)).toBeCloseTo(2.5);
    });

    it("returns 0 during start position hold", () => {
      expect(computeElapsed(0.5, durations)).toBe(0);
    });
  });

  describe("computeSeekTarget", () => {
    it("maps 0 to step 1", () => {
      expect(computeSeekTarget(0, 4)).toBeCloseTo(1);
    });

    it("maps 0.5 to step 3", () => {
      expect(computeSeekTarget(0.5, 4)).toBeCloseTo(3);
    });

    it("maps 1 to the end", () => {
      expect(computeSeekTarget(1, 4)).toBeCloseTo(5);
    });

    it("clamps below 0", () => {
      expect(computeSeekTarget(-0.5, 4)).toBeCloseTo(1);
    });
  });
});
