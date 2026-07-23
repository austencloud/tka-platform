// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { hasSeen, markSeen } from "../guest-first-save-guard";

const KEY_PREFIX = "tka-guest-first-save-prompt-v1:";

describe("guest-first-save-guard", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("has not been seen for a fresh uid", () => {
		expect(hasSeen("guest-1")).toBe(false);
	});

	it("marks a uid seen and persists it via localStorage", () => {
		markSeen("guest-1");

		expect(hasSeen("guest-1")).toBe(true);
		expect(localStorage.getItem(`${KEY_PREFIX}guest-1`)).toBe("1");
	});

	it("is scoped per uid - marking one guest does not mark another", () => {
		markSeen("guest-1");

		expect(hasSeen("guest-1")).toBe(true);
		expect(hasSeen("guest-2")).toBe(false);
	});

	it("markSeen is idempotent", () => {
		markSeen("guest-1");
		markSeen("guest-1");

		expect(hasSeen("guest-1")).toBe(true);
	});

	it("falls back to in-memory state when localStorage.getItem throws", () => {
		markSeen("guest-1");

		const spy = vi
			.spyOn(Storage.prototype, "getItem")
			.mockImplementation(() => {
				throw new Error("storage disabled");
			});

		// The in-memory fallback (populated by markSeen above) still reports
		// this uid as seen even though localStorage itself is throwing.
		expect(hasSeen("guest-1")).toBe(true);

		spy.mockRestore();
	});

	it("a throwing localStorage.setItem does not prevent the in-memory guard from working", () => {
		const spy = vi
			.spyOn(Storage.prototype, "setItem")
			.mockImplementation(() => {
				throw new Error("quota exceeded");
			});

		expect(() => markSeen("guest-3")).not.toThrow();
		expect(hasSeen("guest-3")).toBe(true);

		spy.mockRestore();
	});

	it("a throwing localStorage.getItem for an uid never marked seen returns false, not a repeat prompt", () => {
		const spy = vi
			.spyOn(Storage.prototype, "getItem")
			.mockImplementation(() => {
				throw new Error("storage disabled");
			});

		// Never called markSeen for "guest-4" and localStorage is unavailable -
		// the guard can only say "not seen", which is the safe (only-once
		// enforcement degrades to "always eligible", never "always blocked")
		// direction to fail in.
		expect(hasSeen("guest-4")).toBe(false);

		spy.mockRestore();
	});
});
