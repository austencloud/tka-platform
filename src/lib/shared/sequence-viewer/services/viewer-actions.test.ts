import { describe, it, expect, vi } from "vitest";
import { buildHeaderActions } from "./viewer-actions";

function makeCtx(over: Partial<Record<string, unknown>> = {}) {
  return {
    isFavorite: false,
    isSaved: true,
    isPublished: false,
    isOwned: false,
    isLoggedIn: false,
    practiceActive: false,
    invokeGatedAction: vi.fn((_id: string, run: () => void) => run()),
    handleFavoriteToggle: vi.fn(),
    handleSave: vi.fn(),
    handleEdit: vi.fn(),
    handlePublishAction: vi.fn(),
    handleUnpublishAction: vi.fn(),
    handleVideoUpload: vi.fn(),
    enterPracticeMode: vi.fn(),
    exitPracticeMode: vi.fn(),
    ...over,
  } as never;
}

const wiring = {
  onDeleteRequest: () => {},
};

describe("buildHeaderActions", () => {
  it("guest: engagement offered (login-prompt via gated actions), no owner management", () => {
    const a = buildHeaderActions(makeCtx(), "full", wiring);
    expect(a.onFavoriteToggle).toBeTypeOf("function");
    expect(a.onSave).toBeTypeOf("function");
    expect(a.onRemix).toBeTypeOf("function");
    expect(a.showPractice).toBe(true);
    expect(a.onPracticeToggle).toBeTypeOf("function");
    expect(a.onPublish).toBeUndefined();
    expect(a.onUnpublish).toBeUndefined();
    expect(a.onDeleteRequest).toBeUndefined();
    expect(a.onVideoUpload).toBeUndefined();
  });

  it("owner + signed in + saved: management actions light up", () => {
    const a = buildHeaderActions(
      makeCtx({ isOwned: true, isSaved: true, isLoggedIn: true }),
      "full",
      wiring,
    );
    expect(a.onPublish).toBeTypeOf("function");
    expect(a.onUnpublish).toBeTypeOf("function");
    expect(a.onDeleteRequest).toBeTypeOf("function");
    expect(a.onVideoUpload).toBeTypeOf("function");
  });

  it("owner not yet saved: no publish/delete (gate is isOwned && isSaved)", () => {
    const a = buildHeaderActions(
      makeCtx({ isOwned: true, isSaved: false, isLoggedIn: true }),
      "full",
      wiring,
    );
    expect(a.onPublish).toBeUndefined();
    expect(a.onDeleteRequest).toBeUndefined();
    expect(a.onSave).toBeTypeOf("function");
  });
});
