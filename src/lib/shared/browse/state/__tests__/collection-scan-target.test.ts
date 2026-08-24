// @vitest-environment jsdom

import { describe, it, expect } from "vitest";
import { getCollectionScanTargetFromURL } from "../browse-navigation-state.svelte";

/** jsdom: rewrite the current URL without a navigation. */
function setUrl(pathAndQuery: string) {
  window.history.replaceState(null, "", pathAndQuery);
}

describe("getCollectionScanTargetFromURL", () => {
  it("parses a collection deep link with the scan flag", () => {
    setUrl("/browse/library/col_abc123?scan=1");
    expect(getCollectionScanTargetFromURL()).toEqual({
      collectionId: "col_abc123",
      scan: true,
    });
  });

  it("parses the canonical You collection route", () => {
    setUrl("/browse/you/collections/col_abc123?scan=1");
    expect(getCollectionScanTargetFromURL()).toEqual({
      collectionId: "col_abc123",
      scan: true,
    });
  });

  it("parses a collection deep link without the scan flag", () => {
    setUrl("/browse/library/col_abc123");
    expect(getCollectionScanTargetFromURL()).toEqual({
      collectionId: "col_abc123",
      scan: false,
    });
  });

  it("accepts the legacy /browse/collections/{id} segment (printed QR sheets)", () => {
    setUrl("/browse/collections/col_abc123?scan=1");
    expect(getCollectionScanTargetFromURL()).toEqual({
      collectionId: "col_abc123",
      scan: true,
    });
  });

  it("treats any other scan value as no-scan", () => {
    setUrl("/browse/library/col_abc123?scan=0");
    expect(getCollectionScanTargetFromURL()?.scan).toBe(false);
  });

  it("decodes URL-encoded collection ids", () => {
    setUrl("/browse/library/a%3Ab?scan=1");
    expect(getCollectionScanTargetFromURL()?.collectionId).toBe("a:b");
  });

  it("returns null on non-collection paths", () => {
    setUrl("/creators/user_1");
    expect(getCollectionScanTargetFromURL()).toBeNull();
    setUrl("/browse/library");
    expect(getCollectionScanTargetFromURL()).toBeNull();
    // Bare /browse/collections is the community Collections TAB url, not a
    // collection deep link.
    setUrl("/browse/collections");
    expect(getCollectionScanTargetFromURL()).toBeNull();
    setUrl("/browse/gallery");
    expect(getCollectionScanTargetFromURL()).toBeNull();
    setUrl("/");
    expect(getCollectionScanTargetFromURL()).toBeNull();
  });
});
