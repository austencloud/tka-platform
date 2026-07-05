import { describe, expect, it } from "vitest";
import { displayedBeatNumber } from "../step-calculator";

// Boundary attribution for glyph/labels. An integer currentStep is both the end
// of beat N-1's motion and the start of beat N's; which beat gets displayed
// depends on how playback arrived there. Silent-bug territory: a wrong label
// renders fine and lies (the step-playback dwell showed the NEXT beat's letter
// while the props held the completed beat's end position).
describe("displayedBeatNumber", () => {
	describe("continuous / seek convention (dwellOnCompletedBeat = false)", () => {
		it("attributes an integer boundary to the upcoming beat (floor)", () => {
			expect(displayedBeatNumber(2.0, false)).toBe(2);
			expect(displayedBeatNumber(1.0, false)).toBe(1);
		});

		it("attributes mid-beat positions to the in-progress beat", () => {
			expect(displayedBeatNumber(2.4, false)).toBe(2);
			expect(displayedBeatNumber(2.999, false)).toBe(2);
		});

		it("returns 0 (start position) below beat 1", () => {
			expect(displayedBeatNumber(0, false)).toBe(0);
			expect(displayedBeatNumber(0.7, false)).toBe(0);
		});
	});

	describe("step-dwell convention (dwellOnCompletedBeat = true)", () => {
		it("attributes an integer park to the beat whose motion just completed", () => {
			// Dwell at 2.0 = frozen at beat 1's end position -> show beat 1
			expect(displayedBeatNumber(2.0, true)).toBe(1);
			expect(displayedBeatNumber(5.0, true)).toBe(4);
		});

		it("treats a park at 1.0 as the start position (no motion completed yet)", () => {
			expect(displayedBeatNumber(1.0, true)).toBe(0);
		});

		it("still attributes mid-beat positions to the in-progress beat", () => {
			// Half-step dwell at 2.5 freezes mid-beat-2 -> beat 2
			expect(displayedBeatNumber(2.5, true)).toBe(2);
			expect(displayedBeatNumber(2.4, true)).toBe(2);
		});

		it("snaps float-drift near a boundary to the completed beat (epsilon)", () => {
			expect(displayedBeatNumber(3.004, true)).toBe(2);
			expect(displayedBeatNumber(2.996, true)).toBe(2);
		});

		it("never returns a negative beat", () => {
			expect(displayedBeatNumber(0, true)).toBe(0);
		});
	});
});
