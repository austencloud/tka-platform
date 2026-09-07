import { describe, expect, it } from "vitest";
import { buildCardPreviewRenderKey } from "./card-preview-render-key";

describe("card preview render key", () => {
  it("changes when the footer text changes", () => {
    const shared = { showNotes: true, addUserInfo: true };
    const first = buildCardPreviewRenderKey(
      { ...shared, customNotesText: "First footer", notes: "First footer" },
      {}
    );
    const second = buildCardPreviewRenderKey(
      { ...shared, customNotesText: "Second footer", notes: "Second footer" },
      {}
    );

    expect(second).not.toBe(first);
  });
});
