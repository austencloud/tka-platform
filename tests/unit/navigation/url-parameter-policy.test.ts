import { describe, expect, it } from "vitest";
import { pruneParamsForNavigation } from "$lib/shared/navigation/services/url-parameter-policy";

describe("route-scoped URL parameters", () => {
  it("drops recovery and source-route state on module navigation", () => {
    const url = new URL(
      "https://tkaflowarts.com/browse/library/item?fresh=1&scan=1&handoff=abc&keep=yes"
    );

    pruneParamsForNavigation(url, "/create/construct");

    expect(url.search).toBe("?keep=yes");
  });

  it("keeps parameters on their owning route", () => {
    const scanUrl = new URL(
      "https://tkaflowarts.com/browse/library/item?scan=1"
    );
    const labelerUrl = new URL(
      "https://tkaflowarts.com/test/loop-labeler?seq=abc&filter=pending"
    );

    pruneParamsForNavigation(scanUrl, scanUrl.pathname);
    pruneParamsForNavigation(labelerUrl, labelerUrl.pathname);

    expect(scanUrl.search).toBe("?scan=1");
    expect(labelerUrl.search).toBe("?seq=abc&filter=pending");
  });
});
