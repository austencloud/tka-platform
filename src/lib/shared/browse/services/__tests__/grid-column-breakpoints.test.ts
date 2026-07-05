import { describe, it, expect } from "vitest";
import {
	MIN_COLUMNS,
	getMaxColumnsForWidth,
	getDefaultColumnsForWidth,
	clampColumnsToWidth,
} from "../grid-column-breakpoints";

// Representative widths for the breakpoint bands.
const PHONE = 375; // iPhone SE (F12 mobile simulator) → max 2
const LAPTOP = 1440; // → max 5
const MONITOR_4K = 3840; // → max 8

describe("getMaxColumnsForWidth", () => {
	it("caps small phones at 2 and widens with the viewport", () => {
		expect(getMaxColumnsForWidth(PHONE)).toBe(2);
		expect(getMaxColumnsForWidth(700)).toBe(3);
		expect(getMaxColumnsForWidth(LAPTOP)).toBe(5);
		expect(getMaxColumnsForWidth(MONITOR_4K)).toBe(8);
	});

	it("defaults a fresh visitor to the width's max (dense, not sparse)", () => {
		expect(getDefaultColumnsForWidth(MONITOR_4K)).toBe(8);
		expect(getDefaultColumnsForWidth(PHONE)).toBe(2);
	});
});

describe("clampColumnsToWidth — desired density is clamped, never mutated", () => {
	it("clamps a wide desire down to the phone max WITHOUT changing the desire", () => {
		const desired = 6;
		// On the phone the user sees 2…
		expect(clampColumnsToWidth(desired, PHONE)).toBe(2);
		// …and `desired` is the caller's own variable — the pure fn can't touch it.
		expect(desired).toBe(6);
	});

	it("restores the full desired count when the viewport widens again (the bug)", () => {
		// Regression: opening the F12 mobile simulator used to PERSIST the clamped
		// count (2), so a 4K monitor stayed pinned at 2 huge columns. The desired
		// count is now preserved, so widening re-expands to it.
		const desired = 6;
		const onPhone = clampColumnsToWidth(desired, PHONE);
		const backOn4K = clampColumnsToWidth(desired, MONITOR_4K);
		expect(onPhone).toBe(2);
		expect(backOn4K).toBe(6);
	});

	it("leaves a genuine desired-2 at 2 even on a 4K monitor", () => {
		expect(clampColumnsToWidth(2, MONITOR_4K)).toBe(2);
	});

	it("does not exceed the width's max when desired is huge", () => {
		expect(clampColumnsToWidth(99, LAPTOP)).toBe(5);
	});

	it("honors the minimum floor", () => {
		expect(clampColumnsToWidth(1, MONITOR_4K)).toBe(MIN_COLUMNS);
		expect(clampColumnsToWidth(5, MONITOR_4K, 4)).toBe(5);
		expect(clampColumnsToWidth(3, MONITOR_4K, 4)).toBe(4);
	});
});
