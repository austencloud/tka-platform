import { describe, it, expect } from "vitest";
import { buildViewerShareDetails } from "./viewer-orchestrator-model";

describe("share URL carries viewer state", () => {
  it("appends state params from getStateParams to the built URL", () => {
    const details = buildViewerShareDetails({
      sequence: null,
      bpm: 60,
      darkMode: false,
      fallbackUrl: "https://example.com/sequence/EHWE",
      buildUrl: () => "https://example.com/sequence/EHWE",
      getStateParams: () => ({ set: { pane: "card", fx: "sparkles" }, remove: [] }),
    });
    const url = new URL(details.url);
    expect(url.searchParams.get("pane")).toBe("card");
    expect(url.searchParams.get("fx")).toBe("sparkles");
  });

  it("keeps the built URL's path (short-code hosts) while appending state params", () => {
    const details = buildViewerShareDetails({
      sequence: { word: "EHWE", steps: [] } as never,
      bpm: 60,
      darkMode: false,
      fallbackUrl: "https://example.com/sequence/inline",
      buildUrl: () => "https://example.com/sequence/EHWE?bpm=60",
      getStateParams: () => ({ set: { pane: "card", s: "d1:abc" }, remove: [] }),
    });
    const url = new URL(details.url);
    expect(url.pathname).toBe("/sequence/EHWE");
    expect(url.searchParams.get("bpm")).toBe("60");
    expect(url.searchParams.get("s")).toBe("d1:abc");
  });
});
