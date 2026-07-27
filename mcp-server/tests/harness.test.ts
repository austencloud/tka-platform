import { describe, expect, it } from "vitest";

// Guards the harness itself. Audit round 1 found the auth tests had been written
// into a directory the root runner excludes, so the suite that was meant to
// prove the endpoint was closed would never have run. If this file stops
// executing, nothing else in this package is trustworthy either.
describe("test harness", () => {
	it("executes tests in this package", () => {
		expect(true).toBe(true);
	});

	it("runs in a node environment, not jsdom", () => {
		expect(typeof process.versions.node).toBe("string");
		expect(typeof (globalThis as { window?: unknown }).window).toBe("undefined");
	});
});
