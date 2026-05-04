import { describe, it, expect } from "vitest";
import {
	applyEffort,
	sampleEffortCurve,
} from "../../src/lib/shared/effort/domain/effort-easing-unified";
import type { EffortId } from "../../src/lib/shared/effort/domain/effort-types";

const ALL_EFFORTS: EffortId[] = [
	"linear",
	"glide",
	"dab",
	"press",
	"punch",
	"elastic",
	"bounce",
	"anticipation",
];

describe("Unified Effort Easing", () => {
	describe("boundary invariants (all 8 efforts)", () => {
		it.each(ALL_EFFORTS)("%s returns ~0 at t=0", (id) => {
			expect(applyEffort(id, 0)).toBeCloseTo(0, 5);
		});

		it.each(ALL_EFFORTS)("%s returns ~1 at t=1", (id) => {
			expect(applyEffort(id, 1)).toBeCloseTo(1, 5);
		});

		it.each(ALL_EFFORTS)("%s output is finite for all t in [0,1]", (id) => {
			for (let i = 0; i <= 100; i++) {
				const t = i / 100;
				const value = applyEffort(id, t);
				expect(Number.isFinite(value)).toBe(true);
			}
		});
	});

	describe("Laban effort character", () => {
		it("punch (front-loaded) arrives faster than glide at t=0.5", () => {
			const glideVal = applyEffort("glide", 0.5);
			const punchVal = applyEffort("punch", 0.5);
			// Punch is front-loaded (snap at start of beat) so it's ahead of glide
			expect(punchVal).toBeGreaterThan(glideVal);
		});

		it("dab (front-loaded, sudden) arrives faster than glide (sustained) at t=0.5", () => {
			const glideVal = applyEffort("glide", 0.5);
			const dabVal = applyEffort("dab", 0.5);
			expect(dabVal).toBeGreaterThan(glideVal);
		});
	});

	describe("elastic", () => {
		it("exceeds 1.0 at some point with default params", () => {
			let foundOvershoot = false;
			for (let i = 0; i <= 200; i++) {
				const t = i / 200;
				if (applyEffort("elastic", t) > 1.0) {
					foundOvershoot = true;
					break;
				}
			}
			expect(foundOvershoot).toBe(true);
		});
	});

	describe("bounce", () => {
		it("never exceeds ~1.0", () => {
			for (let i = 0; i <= 1000; i++) {
				const t = i / 1000;
				expect(applyEffort("bounce", t)).toBeLessThanOrEqual(1.001);
			}
		});
	});

	describe("anticipation", () => {
		it("goes below 0 (pullback) with default params", () => {
			let foundPullback = false;
			for (let i = 0; i <= 200; i++) {
				const t = i / 200;
				if (applyEffort("anticipation", t) < 0) {
					foundPullback = true;
					break;
				}
			}
			expect(foundPullback).toBe(true);
		});
	});

	describe("sampleEffortCurve", () => {
		it("returns correct count (samples+1 entries)", () => {
			const samples = sampleEffortCurve("glide", 10);
			expect(samples).toHaveLength(11);
		});

		it("first sample is t=0, last is t=1", () => {
			const samples = sampleEffortCurve("elastic", 20);
			expect(samples[0].t).toBe(0);
			expect(samples[samples.length - 1].t).toBe(1);
		});
	});
});
