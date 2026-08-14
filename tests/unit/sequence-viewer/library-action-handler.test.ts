import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  saveSequence: vi.fn(),
  ensureGuestIdentity: vi.fn(),
  showToast: vi.fn(() => "pending-toast"),
  removeToast: vi.fn(),
  onGuestSaveSucceeded: vi.fn(),
  hasMatchingContent: vi.fn(async () => false),
  getSequence: vi.fn(async () => null),
  computeHash: vi.fn(async () => "content-hash-1"),
  authState: { user: { uid: "viewer-test-user" } },
}));

vi.mock("$lib/shared/library/services/collection-manager", () => ({
  isFavorite: vi.fn(async () => false),
  toggleFavorite: vi.fn(async () => undefined),
}));

vi.mock("$lib/shared/library/get-library-repository", () => ({
  getLibraryRepository: () => ({
    hasMatchingContent: mocks.hasMatchingContent,
    getSequence: mocks.getSequence,
    publishSequence: vi.fn(async () => undefined),
    unpublishSequence: vi.fn(async () => undefined),
    deleteSequence: vi.fn(async () => undefined),
  }),
}));

vi.mock("$lib/features/library/get-library-save-service", () => ({
  getLibrarySaveService: () => ({ saveSequence: mocks.saveSequence }),
}));

vi.mock("$lib/shared/foundation/domain/models/sequence-data", () => ({
  createSequenceData: (sequence: unknown) => sequence,
}));

vi.mock(
  "$lib/shared/animation-engine/state/animation-visibility-state.svelte",
  () => ({
    getAnimationVisibilityManager: () => ({ getPathShape: () => "arc" }),
  })
);

vi.mock("$lib/shared/auth/state/auth-state.svelte", () => ({
  authState: mocks.authState,
}));

vi.mock("$lib/shared/library/services/sequence-content-hasher", () => ({
  computeHash: mocks.computeHash,
}));

vi.mock("$lib/shared/auth/services/guest-identity", () => ({
  ensureGuestIdentity: mocks.ensureGuestIdentity,
}));

vi.mock("$lib/shared/toast/state/toast-state.svelte", () => ({
  showToast: mocks.showToast,
  removeToast: mocks.removeToast,
}));

vi.mock("$lib/shared/pictograph/prop/domain/enums/prop-type", () => ({
  PropType: { STAFF: "staff" },
}));

vi.mock(
  "$lib/shared/onboarding/state/post-save-activation-state.svelte",
  () => ({
    postSaveActivation: {
      onGuestSaveSucceeded: mocks.onGuestSaveSucceeded,
    },
  })
);

import { createLibraryActionHandler } from "$lib/shared/sequence-viewer/state/library-action-handler.svelte";
import { LibraryError } from "$lib/shared/library/domain/library-error";

const sequence = {
  id: "sequence-1",
  word: "AB",
  steps: [{ letter: "A" }, { letter: "B" }],
  metadata: {},
};

function makeHandler() {
  const handler = createLibraryActionHandler({
    getSequence: () => sequence as never,
    getIsOwned: () => true,
    getBluePropType: () => undefined,
    getRedPropType: () => undefined,
    getCatDogModeEnabled: () => false,
    getHapticService: () => ({ trigger: vi.fn() }) as never,
    onDeleteSuccess: vi.fn(),
  });
  handler.syncSavedState(sequence as never);
  return handler;
}

describe("sequence viewer library action feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.saveSequence.mockReset();
    mocks.ensureGuestIdentity.mockReset().mockResolvedValue(undefined);
    mocks.showToast.mockReset().mockReturnValue("pending-toast");
    mocks.hasMatchingContent.mockReset().mockResolvedValue(false);
    mocks.getSequence.mockReset().mockResolvedValue(null);
    mocks.computeHash.mockReset().mockResolvedValue("content-hash-1");
  });

  it("shows pending feedback immediately and settles as saved once persistence resolves", async () => {
    let resolveSave!: (result: {
      persisted: boolean;
      sequenceId: string;
    }) => void;
    mocks.saveSequence.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        })
    );
    const handler = makeHandler();

    const save = handler.handleSave();

    expect(handler.isSaving).toBe(true);
    expect(handler.isSaved).toBe(false);
    expect(mocks.showToast).toHaveBeenCalledWith({
      message: "Saving to library…",
      type: "info",
      duration: 0,
      announcement: "polite",
    });

    await vi.waitFor(() => expect(mocks.saveSequence).toHaveBeenCalledOnce());
    await handler.handleSave();
    expect(mocks.saveSequence).toHaveBeenCalledOnce();

    resolveSave({ persisted: true, sequenceId: "saved-sequence-1" });
    await save;

    expect(handler.isSaving).toBe(false);
    expect(handler.isSaved).toBe(true);
    expect(mocks.removeToast).toHaveBeenCalledWith(
      "pending-toast",
      "programmatic"
    );
    expect(mocks.showToast).toHaveBeenCalledWith("Saved to library", "success");
    expect(mocks.onGuestSaveSucceeded).toHaveBeenCalledWith("saved-sequence-1");
  });

  it("restores Save and replaces the pending toast when persistence fails", async () => {
    const error = new Error("Library is unavailable");
    mocks.saveSequence.mockRejectedValue(error);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const handler = makeHandler();

    await handler.handleSave();

    expect(handler.isSaving).toBe(false);
    expect(handler.isSaved).toBe(false);
    expect(mocks.removeToast).toHaveBeenCalledWith(
      "pending-toast",
      "programmatic"
    );
    expect(mocks.showToast).toHaveBeenCalledWith(
      "Library is unavailable",
      "error"
    );
    consoleError.mockRestore();
  });

  it("settles as Saved when duplicate detection confirms the sequence is already present", async () => {
    mocks.saveSequence.mockRejectedValue(
      new LibraryError(
        "This exact sequence is already in your library",
        "ALREADY_EXISTS"
      )
    );
    const handler = makeHandler();

    await handler.handleSave();

    expect(handler.isSaving).toBe(false);
    expect(handler.isSaved).toBe(true);
    expect(mocks.showToast).toHaveBeenCalledWith("Already in library", "info");
  });

  it("detects a saved generated sequence even when its live model has no content hash", async () => {
    mocks.hasMatchingContent.mockResolvedValue(true);
    const handler = makeHandler();

    await vi.waitFor(() => expect(handler.isSaved).toBe(true));

    expect(mocks.computeHash).toHaveBeenCalledWith(sequence);
    expect(mocks.hasMatchingContent).toHaveBeenCalledWith("content-hash-1");
    expect(handler.isOwnedLibraryRecord).toBe(false);
  });

  it("confirms management ownership only when the current ID is an owned library record", async () => {
    mocks.hasMatchingContent.mockResolvedValue(true);
    mocks.getSequence.mockResolvedValue({
      ...sequence,
      ownerId: "viewer-test-user",
      contentHash: "content-hash-1",
    });
    const handler = makeHandler();

    await vi.waitFor(() => expect(handler.isOwnedLibraryRecord).toBe(true));

    expect(mocks.getSequence).toHaveBeenCalledWith("sequence-1");
    expect(handler.isSaved).toBe(true);
  });
});
