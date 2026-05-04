/**
 * Tests for EffortHapticMapper
 *
 * Verifies that each effort's easing curve produces a haptic vibration
 * pattern with the correct character. These are "silent bug" tests —
 * if the pattern generation math breaks, you won't see it, you'll
 * feel the wrong thing on a phone you're not holding during dev.
 */

import { describe, it, expect } from "vitest";
import { generatePattern, getIOSPulseCount } from "../../src/lib/features/effort-lab/services/effort-haptic-mapper";
import type { EffortId } from "../../src/lib/features/effort-lab/domain/effort-types";

// Functions imported directly from effort-haptic-mapper module

// Helper: sum all values in a pattern to get total duration
function totalDuration(pattern: number[]): number {
	return pattern.reduce((sum, v) => sum + v, 0);
}

// Helper: count vibration pulses (odd-indexed entries are pauses)
function pulseCount(pattern: number[]): number {
	let count = 0;
	for (let i = 0; i < pattern.length; i += 2) {
		if (pattern[i]! > 0) count++;
	}
	return count;
}

describe("EffortHapticMapper", () => {
	const ALL_EFFORTS: EffortId[] = [
		"linear", "glide", "dab", "press", "punch",
		"elastic", "bounce", "anticipation",
	];

	describe("every effort produces a valid pattern", () => {
		for (const effort of ALL_EFFORTS) {
			it(`${effort} produces a non-empty pattern`, () => {
				const pattern = generatePattern(effort);
				expect(pattern.length).toBeGreaterThan(0);
			});

			it(`${effort} contains only positive or zero values`, () => {
				const pattern = generatePattern(effort);
				for (const value of pattern) {
					expect(value).toBeGreaterThanOrEqual(0);
				}
			});

			it(`${effort} total duration is within reasonable bounds`, () => {
				const pattern = generatePattern(effort);
				const duration = totalDuration(pattern);
				// Should be roughly around the requested duration (400ms default),
				// but pattern trimming can shorten it
				expect(duration).toBeGreaterThan(50);
				expect(duration).toBeLessThan(800);
			});
		}
	});

	describe("effort character", () => {
		it("punch produces fewer pulses than bounce (merge makes it one hit)", () => {
			const punchPulses = pulseCount(generatePattern("punch"));
			const bouncePulses = pulseCount(generatePattern("bounce"));
			// After merging, punch should be 1-2 pulses (one big hit)
			// while bounce should have 3+ distinct impacts
			expect(punchPulses).toBeLessThanOrEqual(2);
			expect(bouncePulses).toBeGreaterThan(punchPulses);
		});

		it("linear produces exactly 4 even pulses", () => {
			const pattern = generatePattern("linear");
			// Linear pattern: [25, gap, 25, gap, 25, gap, 25]
			expect(pattern.length).toBe(7); // 4 pulses + 3 gaps
			expect(pattern[0]).toBe(25);
			expect(pattern[2]).toBe(25);
			expect(pattern[4]).toBe(25);
			expect(pattern[6]).toBe(25);
		});

		it("bounce produces multiple distinct pulses", () => {
			const pattern = generatePattern("bounce");
			const pulses = pulseCount(pattern);
			// Bounce should have at least 3 distinct impacts
			// (the standard bounce algorithm has ~4 bounces)
			expect(pulses).toBeGreaterThanOrEqual(3);
		});

		it("dab produces a short pattern (quick tap)", () => {
			const pattern = generatePattern("dab");
			const duration = totalDuration(pattern);
			// Dab is sudden and light — most of its acceleration is
			// concentrated at the end, so the pattern should be shorter
			// than the full 400ms
			expect(duration).toBeLessThan(400);
		});
	});

	describe("iOS pulse counts", () => {
		it("punch = 1 pulse (single impact)", () => {
			expect(getIOSPulseCount("punch")).toBe(1);
		});

		it("dab = 1 pulse (quick tap)", () => {
			expect(getIOSPulseCount("dab")).toBe(1);
		});

		it("bounce = 3 pulses (fixed classic bounce)", () => {
			expect(getIOSPulseCount("bounce")).toBe(3);
		});

		it("anticipation = 2 (pullback + release)", () => {
			expect(getIOSPulseCount("anticipation")).toBe(2);
		});

		it("elastic scales with frequency", () => {
			const low = getIOSPulseCount("elastic", { frequency: 0.5 });
			const high = getIOSPulseCount("elastic", { frequency: 3.0 });
			expect(high).toBeGreaterThan(low);
		});
	});

	describe("custom duration", () => {
		it("longer duration produces longer total pattern", () => {
			const short = totalDuration(generatePattern("bounce", undefined, 200));
			const long = totalDuration(generatePattern("bounce", undefined, 600));
			expect(long).toBeGreaterThan(short);
		});
	});
});
