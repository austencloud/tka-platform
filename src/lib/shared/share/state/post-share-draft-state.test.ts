import { describe, expect, it } from "vitest";
import { createPostShareDraftState } from "./post-share-draft-state.svelte";

const savedPresentation = {
  schemaVersion: 1 as const,
  footer: { mode: "credit" as const },
};

describe("post share draft state", () => {
  it("starts with only artifacts the host can actually produce", () => {
    const draft = createPostShareDraftState();

    draft.start({
      availableArtifacts: ["card"],
      initialArtifact: "video",
      cardPresentation: savedPresentation,
    });

    expect(draft.availableArtifacts).toEqual(["card"]);
    expect(draft.artifact).toBe("card");
    expect(draft.selectArtifact("video")).toBe(false);
    expect(draft.artifact).toBe("card");
  });

  it("resets caption and one-share footer edits every time the sheet opens", () => {
    const draft = createPostShareDraftState();
    draft.start({
      availableArtifacts: ["card", "video"],
      initialArtifact: "card",
      cardPresentation: savedPresentation,
    });
    draft.caption = "This must not leak into the next share";
    draft.captionTouched = true;
    draft.cardPresentation = {
      schemaVersion: 1,
      footer: { mode: "custom", text: "Only for this post" },
    };

    draft.start({
      availableArtifacts: ["card"],
      initialArtifact: "card",
      cardPresentation: savedPresentation,
    });

    expect(draft.caption).toBe("");
    expect(draft.captionTouched).toBe(false);
    expect(draft.cardPresentation).toEqual(savedPresentation);
    expect(draft.cardPresentationDirty).toBe(false);
  });

  it("tracks when a one-share footer is explicitly saved back to the card", () => {
    const draft = createPostShareDraftState();
    draft.start({
      availableArtifacts: ["card"],
      initialArtifact: "card",
      cardPresentation: savedPresentation,
    });
    draft.cardPresentation = {
      schemaVersion: 1,
      footer: { mode: "custom", text: "Reusable card footer" },
    };

    expect(draft.cardPresentationDirty).toBe(true);
    draft.markCardPresentationSaved();
    expect(draft.cardPresentationDirty).toBe(false);
  });
});
