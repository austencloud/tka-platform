import { describe, it, expect } from "vitest";
import { getCollectionScanTargetFromURL } from "../browse-navigation-state.svelte";

/** jsdom: rewrite the current URL without a navigation. */
function setUrl(pathAndQuery: string) {
	window.history.replaceState(null, "", pathAndQuery);
}

describe("getCollectionScanTargetFromURL", () => {
	it("parses a collection deep link with the scan flag", () => {
		setUrl("/browse/collections/col_abc123?scan=1");
		expect(getCollectionScanTargetFromURL()).toEqual({
			collectionId: "col_abc123",
			scan: true,
		});
	});

	it("parses a collection deep link without the scan flag", () => {
		setUrl("/browse/collections/col_abc123");
		expect(getCollectionScanTargetFromURL()).toEqual({
			collectionId: "col_abc123",
			scan: false,
		});
	});

	it("treats any other scan value as no-scan", () => {
		setUrl("/browse/collections/col_abc123?scan=0");
		expect(getCollectionScanTargetFromURL()?.scan).toBe(false);
	});

	it("decodes URL-encoded collection ids", () => {
		setUrl("/browse/collections/a%3Ab?scan=1");
		expect(getCollectionScanTargetFromURL()?.collectionId).toBe("a:b");
	});

	it("returns null on non-collection paths", () => {
		setUrl("/browse/creators/user_1");
		expect(getCollectionScanTargetFromURL()).toBeNull();
		setUrl("/browse/collections");
		expect(getCollectionScanTargetFromURL()).toBeNull();
		setUrl("/browse/gallery");
		expect(getCollectionScanTargetFromURL()).toBeNull();
		setUrl("/");
		expect(getCollectionScanTargetFromURL()).toBeNull();
	});
});
