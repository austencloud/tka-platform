import { describe, it, expect, vi } from "vitest";

import {
	computeOverallProgress3D,
	computeSeek3D,
} from "$lib/shared/timeline/adapters/character-playback-adapter.svelte";

describe("character-playback-adapter", () => {
	describe("computeOverallProgress3D", () => {
		it("returns 0 at step 0, progress 0", () => {
			expect(computeOverallProgress3D(0, 0, 8)).toBeCloseTo(0);
		});

		it("returns correct progress mid-sequence", () => {
			// Step 3 of 8, 50% through the beat = (3 + 0.5) / 8 = 0.4375
			expect(computeOverallProgress3D(3, 0.5, 8)).toBeCloseTo(0.4375);
		});

		it("returns ~1 at last step, progress ~1", () => {
			expect(computeOverallProgress3D(7, 0.99, 8)).toBeCloseTo(0.99875);
		});

		it("returns 0 when totalSteps is 0", () => {
			expect(computeOverallProgress3D(0, 0, 0)).toBe(0);
		});

		it("handles single step", () => {
			expect(computeOverallProgress3D(0, 0.5, 1)).toBeCloseTo(0.5);
		});
	});

	describe("computeSeek3D", () => {
		it("maps 0 to step 0, progress 0", () => {
			const result = computeSeek3D(0, 8);
			expect(result.stepIndex).toBe(0);
			expect(result.stepProgress).toBeCloseTo(0);
		});

		it("maps 0.5 to step 4, progress 0", () => {
			const result = computeSeek3D(0.5, 8);
			expect(result.stepIndex).toBe(4);
			expect(result.stepProgress).toBeCloseTo(0);
		});

		it("maps 0.4375 to step 3, progress 0.5", () => {
			const result = computeSeek3D(0.4375, 8);
			expect(result.stepIndex).toBe(3);
			expect(result.stepProgress).toBeCloseTo(0.5);
		});

		it("clamps to last step at progress 1", () => {
			const result = computeSeek3D(1, 8);
			expect(result.stepIndex).toBe(7);
			expect(result.stepProgress).toBeCloseTo(1);
		});

		it("clamps negative to step 0", () => {
			const result = computeSeek3D(-0.5, 8);
			expect(result.stepIndex).toBe(0);
			expect(result.stepProgress).toBeCloseTo(0);
		});
	});
});
