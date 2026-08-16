import { describe, it, expect, vi } from "vitest";
import { buildHeaderActions } from "$lib/shared/sequence-viewer/services/viewer-actions";
import { VIDEO_UPLOAD_ENABLED } from "$lib/shared/sequence-viewer/config/viewer-feature-flags";

function makeCtx(over: Partial<Record<string, unknown>> = {}) {
  return {
    isFavorite: false,
    isSaved: true,
    isSaving: false,
    isPublished: false,
    isOwned: false,
    isOwnedLibraryRecord: false,
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
    expect(a.isSaving).toBe(false);
    expect(a.onRemix).toBeTypeOf("function");
    expect(a.showPractice).toBe(true);
    expect(a.onPracticeToggle).toBeTypeOf("function");
    expect(a.onPublish).toBeUndefined();
    expect(a.onUnpublish).toBeUndefined();
    expect(a.onDeleteRequest).toBeUndefined();
    expect(a.onVideoUpload).toBeUndefined();
  });

  it("exact owned library record: management actions light up", () => {
    const a = buildHeaderActions(
      makeCtx({
        isOwned: true,
        isOwnedLibraryRecord: true,
        isSaved: true,
        isLoggedIn: true,
      }),
      "full",
      wiring
    );
    expect(a.onPublish).toBeTypeOf("function");
    expect(a.onUnpublish).toBeTypeOf("function");
    expect(a.onDeleteRequest).toBeTypeOf("function");
    expect(VIDEO_UPLOAD_ENABLED).toBe(true);
    expect(a.onVideoUpload).toBeTypeOf("function");
  });

  it("matching content without the exact owned record has no management actions", () => {
    const a = buildHeaderActions(
      makeCtx({
        isOwned: true,
        isOwnedLibraryRecord: false,
        isSaved: true,
        isLoggedIn: true,
      }),
      "full",
      wiring
    );
    expect(a.onPublish).toBeUndefined();
    expect(a.onUnpublish).toBeUndefined();
    expect(a.onDeleteRequest).toBeUndefined();
  });

  it("owner not yet saved: no publish/delete", () => {
    const a = buildHeaderActions(
      makeCtx({
        isOwned: true,
        isOwnedLibraryRecord: false,
        isSaved: false,
        isLoggedIn: true,
      }),
      "full",
      wiring
    );
    expect(a.onPublish).toBeUndefined();
    expect(a.onDeleteRequest).toBeUndefined();
    expect(a.onSave).toBeTypeOf("function");
  });
});
