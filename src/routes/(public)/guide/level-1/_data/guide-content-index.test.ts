import { describe, it, expect } from "vitest";
import { guideTargetForLetter, GUIDE_CODEX_SLUG } from "./guide-content-index";

describe("guide-content-index", () => {
  it("maps a Type 1 base letter to its codex cell", () => {
    expect(guideTargetForLetter("A")).toEqual({ slug: "codex", cellKey: "A-0" });
  });

  it("maps a Greek Type 2 letter to its codex cell", () => {
    expect(guideTargetForLetter("Σ")).toEqual({ slug: "codex", cellKey: "Σ-0" });
  });

  it("maps a dash (Type 3) letter to its double-dash codex id", () => {
    expect(guideTargetForLetter("W-")).toEqual({ slug: "codex", cellKey: "W--0" });
  });

  it("returns null for an unknown label", () => {
    expect(guideTargetForLetter("ZZ")).toBeNull();
  });

  it("exposes the codex hub slug", () => {
    expect(GUIDE_CODEX_SLUG).toBe("codex");
  });
});
