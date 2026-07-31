import { beforeEach, describe, expect, it, vi } from "vitest";

const toArrayMock = vi.fn();
const updateMock = vi.fn().mockResolvedValue(1);
const saveSequenceWithMetadataMock = vi.fn().mockResolvedValue({});
const isDeletionIntendedMock = vi.fn();

vi.mock("$lib/shared/persistence/database/tka-database", () => ({
  db: {
    sequences: {
      filter: vi.fn(() => ({
        toArray: (...args: unknown[]) => toArrayMock(...args),
      })),
      update: (...args: unknown[]) => updateMock(...args),
    },
  },
}));
vi.mock("$lib/shared/library/get-library-repository", () => ({
  getLibraryRepository: () => ({
    saveSequenceWithMetadata: (...args: unknown[]) =>
      saveSequenceWithMetadataMock(...args),
  }),
}));
vi.mock("$lib/shared/offline/state/network-status-state.svelte", () => ({
  networkStatusState: { onOnline: vi.fn(() => vi.fn()) },
}));
vi.mock("$lib/shared/toast/state/toast-state.svelte", () => ({
  toast: { info: vi.fn() },
}));
vi.mock(
  "$lib/shared/library/services/sequence-persistence-coordinator",
  () => ({
    isSequenceDeletionIntended: (...args: unknown[]) =>
      isDeletionIntendedMock(...args),
  })
);

const { retryPendingSyncs } =
  await import("$lib/features/library/services/library-sync-retry");

function makePendingSequence(id: string) {
  return {
    id,
    name: id,
    displayName: id,
    syncStatus: "failed",
    tags: [],
    thumbnails: [],
    pendingSyncMetadata: {
      visibility: "private",
      notes: "",
    },
  };
}

describe("LibrarySyncRetry deletion intent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateMock.mockResolvedValue(1);
    saveSequenceWithMetadataMock.mockResolvedValue({});
  });

  it("does not resurrect a pending local row while permanent deletion is intended", async () => {
    toArrayMock.mockResolvedValue([
      makePendingSequence("deleting-sequence"),
      makePendingSequence("live-sequence"),
    ]);
    isDeletionIntendedMock.mockImplementation(
      (sequenceId: string) => sequenceId === "deleting-sequence"
    );

    await retryPendingSyncs();

    expect(saveSequenceWithMetadataMock).toHaveBeenCalledOnce();
    expect(saveSequenceWithMetadataMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "live-sequence" }),
      expect.objectContaining({ visibility: "private" })
    );
    expect(updateMock).toHaveBeenCalledWith("live-sequence", {
      syncStatus: "synced",
    });
    expect(updateMock).not.toHaveBeenCalledWith(
      "deleting-sequence",
      expect.anything()
    );
  });
});
