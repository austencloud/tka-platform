import { describe, it, expect } from "vitest";
import {
	formatSoloTurns,
	shortOrientation,
	formatDuration,
} from "../choreo-card-label-format";

// These tests pin the EXACT behavior the functions had inline in ChoreoCard.svelte
// at extraction time, including the deliberate quirks (0 turns -> "" so the overlay
// hides; "fl" passes through). If extraction changed anything, these fail.

describe("formatSoloTurns", () => {
	it("returns empty string for null/undefined", () => {
		expect(formatSoloTurns(null)).toBe("");
		expect(formatSoloTurns(undefined)).toBe("");
	});
	it("keeps 'fl' as 'fl'", () => {
		expect(formatSoloTurns("fl")).toBe("fl");
	});
	it("returns empty string for 0 so the overlay stays hidden", () => {
		expect(formatSoloTurns(0)).toBe("");
	});
	it("stringifies positive turns", () => {
		expect(formatSoloTurns(1)).toBe("1");
		expect(formatSoloTurns(3)).toBe("3");
		expect(formatSoloTurns(2.5)).toBe("2.5");
	});
});

describe("shortOrientation", () => {
	it("returns null for falsy input", () => {
		expect(shortOrientation(null)).toBeNull();
		expect(shortOrientation(undefined)).toBeNull();
		expect(shortOrientation("")).toBeNull();
	});
	it("maps level 1-3 orientations", () => {
		expect(shortOrientation("in")).toBe("in");
		expect(shortOrientation("out")).toBe("out");
		expect(shortOrientation("clock")).toBe("cl");
		expect(shortOrientation("counter")).toBe("cn");
	});
	it("maps level 4 interradials to 3-char forms", () => {
		expect(shortOrientation("clock_in")).toBe("cli");
		expect(shortOrientation("clock_out")).toBe("clo");
		expect(shortOrientation("counter_in")).toBe("cni");
		expect(shortOrientation("counter_out")).toBe("cno");
	});
	it("returns short unknown values unchanged", () => {
		expect(shortOrientation("xyz")).toBe("xyz");
	});
	it("truncates longer unknown values to 3 chars", () => {
		expect(shortOrientation("abcdef")).toBe("abc");
	});
});

describe("formatDuration", () => {
	it("appends the multiplier glyph", () => {
		expect(formatDuration(2)).toBe("2×");
		expect(formatDuration(1.25)).toBe("1.25×");
		expect(formatDuration(1)).toBe("1×");
	});
});
