import { describe, it, expect } from "vitest";
import {
	applyWeightEasing,
	applyTimeEasing,
	applyLabanEasing,
} from "$lib/features/effort-lab/domain/laban-easing";

describe("applyWeightEasing", () => {
	it("returns 0 at t=0 for any weight", () => {
		expect(applyWeightEasing(0, 0)).toBe(0);
		expect(applyWeightEasing(0, 0.5)).toBe(0);
		expect(applyWeightEasing(0, 1)).toBe(0);
	});

	it("returns 1 at t=1 for any weight", () => {
		expect(applyWeightEasing(1, 0)).toBe(1);
		expect(applyWeightEasing(1, 0.5)).toBe(1);
		expect(applyWeightEasing(1, 1)).toBe(1);
	});

	it("light weight (0) progresses more gently at midpoint than strong (1)", () => {
		const light = applyWeightEasing(0.3, 0.0);
		const strong = applyWeightEasing(0.3, 1.0);
		expect(light).toBeGreaterThan(strong);
	});

	it("clamps output to 0-1 range", () => {
		for (let w = 0; w <= 1; w += 0.2) {
			for (let t = 0; t <= 1; t += 0.1) {
				const result = applyWeightEasing(t, w);
				expect(result).toBeGreaterThanOrEqual(0);
				expect(result).toBeLessThanOrEqual(1);
			}
		}
	});
});

describe("applyTimeEasing", () => {
	it("returns 0 at t=0 for any time value", () => {
		expect(applyTimeEasing(0, 0)).toBe(0);
		expect(applyTimeEasing(0, 1)).toBe(0);
	});

	it("returns 1 at t=1 for any time value", () => {
		expect(applyTimeEasing(1, 0)).toBe(1);
		expect(applyTimeEasing(1, 1)).toBe(1);
	});

	it("sustained (0) is more evenly distributed than sudden (1)", () => {
		const sustained = applyTimeEasing(0.5, 0.0);
		const sudden = applyTimeEasing(0.5, 1.0);
		expect(Math.abs(sustained - 0.5)).toBeLessThan(Math.abs(sudden - 0.5));
	});

	it("clamps output to 0-1 range", () => {
		for (let tm = 0; tm <= 1; tm += 0.2) {
			for (let t = 0; t <= 1; t += 0.1) {
				const result = applyTimeEasing(t, tm);
				expect(result).toBeGreaterThanOrEqual(0);
				expect(result).toBeLessThanOrEqual(1);
			}
		}
	});
});

describe("applyLabanEasing", () => {
	it("composes weight and time", () => {
		const composed = applyLabanEasing(0.5, 0.3, 0.7);
		const manual = applyWeightEasing(applyTimeEasing(0.5, 0.7), 0.3);
		expect(composed).toBeCloseTo(manual, 10);
	});

	it("identity at boundaries", () => {
		expect(applyLabanEasing(0, 0.5, 0.5)).toBe(0);
		expect(applyLabanEasing(1, 0.5, 0.5)).toBe(1);
	});

	it("all four quadrant presets produce distinct midpoint values", () => {
		const lightSustained = applyLabanEasing(0.5, 0.2, 0.2);
		const lightSudden = applyLabanEasing(0.5, 0.2, 0.8);
		const strongSustained = applyLabanEasing(0.5, 0.8, 0.2);
		const strongSudden = applyLabanEasing(0.5, 0.8, 0.8);
		const values = [lightSustained, lightSudden, strongSustained, strongSudden];
		const unique = new Set(values.map((v) => v.toFixed(4)));
		expect(unique.size).toBe(4);
	});
});
