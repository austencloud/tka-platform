import { describe, it, expect } from "vitest";
import {
	setPendingScanIntent,
	consumePendingScanIntent,
} from "../pending-scan-intent.svelte";

describe("pending scan intent", () => {
	it("returns null when nothing was set", () => {
		expect(consumePendingScanIntent()).toBeNull();
	});

	it("returns the stashed id once, then clears (one-shot)", () => {
		setPendingScanIntent("col_1");
		expect(consumePendingScanIntent()).toBe("col_1");
		expect(consumePendingScanIntent()).toBeNull();
	});

	it("a later set overwrites an unconsumed earlier one", () => {
		setPendingScanIntent("col_1");
		setPendingScanIntent("col_2");
		expect(consumePendingScanIntent()).toBe("col_2");
	});
});
