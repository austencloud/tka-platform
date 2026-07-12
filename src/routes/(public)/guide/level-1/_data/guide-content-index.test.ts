import { describe, it, expect } from "vitest";
import { guideTargetForLetter, GUIDE_CODEX_SLUG, GUIDE_CODEX_SLUG_2, isCodexSlug } from "./guide-content-index";

describe("guide-content-index", () => {
  it("maps a Type 1 base letter to codex page 1", () => {
    expect(guideTargetForLetter("A")).toEqual({ slug: "codex", cellKey: "A-0" });
  });

  it("maps a Greek Type 2 letter to codex page 1 (Types 1-2 live on sheet 1)", () => {
    expect(guideTargetForLetter("Σ")).toEqual({ slug: "codex", cellKey: "Σ-0" });
  });

  it("maps a dash (Type 3) letter to codex page 2 (Types 3-6 live on sheet 2)", () => {
    expect(guideTargetForLetter("W-")).toEqual({ slug: "codex-2", cellKey: "W--0" });
  });

  it("maps a Type 6 static letter to codex page 2", () => {
    expect(guideTargetForLetter("α")).toEqual({ slug: "codex-2", cellKey: "α-0" });
  });

  it("returns null for an unknown label", () => {
    expect(guideTargetForLetter("ZZ")).toBeNull();
  });

  it("exposes both codex page slugs", () => {
    expect(GUIDE_CODEX_SLUG).toBe("codex");
    expect(GUIDE_CODEX_SLUG_2).toBe("codex-2");
  });

  it("recognizes both codex slugs and nothing else", () => {
    expect(isCodexSlug("codex")).toBe(true);
    expect(isCodexSlug("codex-2")).toBe(true);
    expect(isCodexSlug("base-letters")).toBe(false);
  });
});
