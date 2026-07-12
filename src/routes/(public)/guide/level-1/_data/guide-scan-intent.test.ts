import { describe, it, expect } from "vitest";
import {
  setGuideScanIntent,
  consumeGuideScanIntent,
  registerCodexCellTrigger,
  fireCodexCell,
} from "./guide-scan-intent";

describe("guide-scan-intent", () => {
  it("returns null when nothing is stashed", () => {
    expect(consumeGuideScanIntent()).toBeNull();
  });

  it("stashes and returns an intent", () => {
    setGuideScanIntent({ slug: "codex", cellKey: "A-0" });
    expect(consumeGuideScanIntent()).toEqual({ slug: "codex", cellKey: "A-0" });
  });

  it("is one-shot: a second consume returns null", () => {
    setGuideScanIntent({ slug: "codex", cellKey: "Σ-0" });
    expect(consumeGuideScanIntent()).toEqual({ slug: "codex", cellKey: "Σ-0" });
    expect(consumeGuideScanIntent()).toBeNull();
  });

  it("overwrites a prior unconsumed intent", () => {
    setGuideScanIntent({ slug: "codex", cellKey: "A-0" });
    setGuideScanIntent({ slug: "codex", cellKey: "B-0" });
    expect(consumeGuideScanIntent()).toEqual({ slug: "codex", cellKey: "B-0" });
  });

  it("fireCodexCell returns false with no trigger registered", () => {
    registerCodexCellTrigger(null);
    expect(fireCodexCell("A-0")).toBe(false);
  });

  it("fireCodexCell calls the registered trigger and returns true", () => {
    let called = "";
    registerCodexCellTrigger((id) => (called = id));
    expect(fireCodexCell("A-0")).toBe(true);
    expect(called).toBe("A-0");
    registerCodexCellTrigger(null);
  });
});
