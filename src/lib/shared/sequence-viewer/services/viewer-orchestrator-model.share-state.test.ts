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
});
