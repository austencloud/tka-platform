import { describe, it, expect, vi } from "vitest";
import { buildHeaderActions, type ViewerHeaderProfile } from "./viewer-actions";

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
  onDownload: () => {},
  onOpenInComposer: () => {},
  openAppHref: "/browse/gallery",
};

describe("buildHeaderActions", () => {
  it("scan + guest: only funnel actions, no owner/engagement", () => {
    const a = buildHeaderActions(makeCtx(), "scan", wiring);
    expect(a.onRemix).toBeTypeOf("function");
    expect(a.remixLabel).toBe("Open in Composer");
    expect(a.onDownload).toBeTypeOf("function");
    expect(a.onOpenApp).toBeTypeOf("function");
    expect(a.onFavoriteToggle).toBeUndefined();
    expect(a.onSave).toBeUndefined();
    expect(a.onVideoUpload).toBeUndefined();
    expect(a.onPublish).toBeUndefined();
    expect(a.onDeleteRequest).toBeUndefined();
    expect(a.showPractice).toBe(false);
  });

  it("full + guest: engagement offered (login-prompt), no owner management", () => {
    const a = buildHeaderActions(makeCtx(), "full", wiring);
    expect(a.onFavoriteToggle).toBeTypeOf("function");
    expect(a.onRemix).toBeTypeOf("function");
    expect(a.remixLabel).toBeUndefined();
    expect(a.showPractice).toBe(true);
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

  it("scan + signed-in owner: engagement + management appear on scan too", () => {
    const a = buildHeaderActions(
      makeCtx({ isOwned: true, isSaved: true, isLoggedIn: true }),
      "scan",
      wiring,
    );
    expect(a.onOpenApp).toBeTypeOf("function");
    expect(a.onFavoriteToggle).toBeTypeOf("function");
    expect(a.onPublish).toBeTypeOf("function");
    expect(a.onDeleteRequest).toBeTypeOf("function");
  });
});
