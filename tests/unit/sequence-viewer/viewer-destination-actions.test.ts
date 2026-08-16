import { describe, expect, it, vi } from "vitest";
import { createViewerDestinationActions } from "$lib/shared/sequence-viewer/services/viewer-destination-actions";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

function createActions(options: {
  authenticated?: boolean;
  canManageVideos?: boolean;
  saveMakesVideosManageable?: boolean;
} = {}) {
  let canManageVideos = options.canManageVideos ?? false;
  const saveSequence = vi.fn(async () => {
    if (options.saveMakesVideosManageable) canManageVideos = true;
  });
  const enterVideoUpload = vi.fn();
  const showToast = vi.fn();

  const actions = createViewerDestinationActions(
    {
      playback: {} as never,
      interactive: {} as never,
      getSequence: () => ({ id: "sequence-1", steps: [] }) as SequenceData,
      getIsAuthenticated: () => options.authenticated ?? true,
      canManageSequenceVideos: () => canManageVideos,
      saveSequence,
      onClose: vi.fn(),
      enterVideoUpload,
    },
    {
      saveSequenceHandoff: vi.fn() as never,
      navigate: vi.fn(),
      showToast: showToast as never,
      showAuth: vi.fn(),
      savePendingEditSequence: vi.fn(),
      openCreateConstruct: vi.fn(),
      getReturnPath: () => "/browse/library",
    }
  );

  return { actions, saveSequence, enterVideoUpload, showToast };
}

describe("viewer video upload destination", () => {
  it("automatically saves an unsaved sequence before opening the uploader", async () => {
    const harness = createActions({ saveMakesVideosManageable: true });

    await harness.actions.handleVideoUpload();

    expect(harness.saveSequence).toHaveBeenCalledOnce();
    expect(harness.enterVideoUpload).toHaveBeenCalledOnce();
  });

  it("does not open the uploader when saving did not create an attachable record", async () => {
    const harness = createActions({ saveMakesVideosManageable: false });

    await harness.actions.handleVideoUpload();

    expect(harness.saveSequence).toHaveBeenCalledOnce();
    expect(harness.enterVideoUpload).not.toHaveBeenCalled();
  });

  it("does not save again when the sequence already has a manageable library record", async () => {
    const harness = createActions({ canManageVideos: true });

    await harness.actions.handleVideoUpload();

    expect(harness.saveSequence).not.toHaveBeenCalled();
    expect(harness.enterVideoUpload).toHaveBeenCalledOnce();
  });
});
