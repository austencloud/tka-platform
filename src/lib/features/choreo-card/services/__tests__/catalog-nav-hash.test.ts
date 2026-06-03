import { describe, it, expect } from "vitest";
import {
	encodeNavHash,
	decodeNavHash,
	type CatalogNavState,
} from "../catalog-nav-hash";

// Pins the exact behavior these functions had inline in ChoreoCardTab.svelte at
// extraction time, including the encode/decode "#" asymmetry (encode omits it,
// decode requires it) and the empty-state -> "" contract.

describe("encodeNavHash", () => {
	it("returns empty string when nothing is selected", () => {
		expect(encodeNavHash({ catalogId: null, tndFamily: null })).toBe("");
	});
	it("encodes only catalogId", () => {
		expect(encodeNavHash({ catalogId: "abc", tndFamily: null })).toBe("catalog-nav:catalog=abc");
	});
	it("encodes only tndFamily", () => {
		expect(encodeNavHash({ catalogId: null, tndFamily: "fam1" })).toBe("catalog-nav:tndFamily=fam1");
	});
	it("encodes both, catalog first", () => {
		expect(encodeNavHash({ catalogId: "abc", tndFamily: "fam1" })).toBe(
			"catalog-nav:catalog=abc&tndFamily=fam1",
		);
	});
	it("returns the hash WITHOUT a leading '#'", () => {
		expect(encodeNavHash({ catalogId: "abc", tndFamily: null }).startsWith("#")).toBe(false);
	});
});

describe("decodeNavHash", () => {
	it("returns null for an unrelated hash", () => {
		expect(decodeNavHash("#something-else")).toBeNull();
		expect(decodeNavHash("")).toBeNull();
	});
	it("requires the leading '#' prefix (encode output alone does not decode)", () => {
		expect(decodeNavHash("catalog-nav:catalog=abc")).toBeNull();
	});
	it("decodes a full hash", () => {
		expect(decodeNavHash("#catalog-nav:catalog=abc&tndFamily=fam1")).toEqual({
			catalogId: "abc",
			tndFamily: "fam1",
		});
	});
	it("yields null fields for absent params", () => {
		expect(decodeNavHash("#catalog-nav:catalog=abc")).toEqual({
			catalogId: "abc",
			tndFamily: null,
		});
	});
});

describe("round-trip (mirrors real usage: browser prepends '#' to url.hash)", () => {
	const cases: CatalogNavState[] = [
		{ catalogId: "abc", tndFamily: "fam1" },
		{ catalogId: "only-catalog", tndFamily: null },
		{ catalogId: null, tndFamily: "only-family" },
	];
	for (const state of cases) {
		it(`survives encode -> '#' -> decode for ${JSON.stringify(state)}`, () => {
			const encoded = encodeNavHash(state);
			expect(decodeNavHash("#" + encoded)).toEqual(state);
		});
	}
});
