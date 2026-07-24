import { beforeEach, describe, expect, it, vi } from "vitest";

const firestoreMocks = vi.hoisted(() => {
  const batch = {
    delete: vi.fn(),
    set: vi.fn(),
    update: vi.fn(),
    commit: vi.fn(async () => undefined),
  };

  return {
    batch,
    getDocs: vi.fn(),
    writeBatch: vi.fn(() => batch),
  };
});

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db: unknown, path: string) => ({ path })),
  doc: vi.fn((_db: unknown, path: string) => ({ path })),
  getDocs: firestoreMocks.getDocs,
  query: vi.fn((value: unknown) => value),
  where: vi.fn(),
  writeBatch: firestoreMocks.writeBatch,
  serverTimestamp: vi.fn(() => "server-timestamp"),
  increment: vi.fn((value: number) => ({ incrementBy: value })),
  arrayUnion: vi.fn(),
  documentId: vi.fn(() => "document-id"),
}));

vi.mock("$lib/shared/toast/state/toast-state.svelte", () => ({
  toast: { error: vi.fn(), warning: vi.fn() },
}));
vi.mock("$lib/shared/offline/state/sync-status-state.svelte", () => ({
  trackWrite: (operation: () => Promise<unknown>) => operation(),
}));
vi.mock("$lib/shared/foundation/services/sequence-hydrator", () => ({
  ensureComposition: (sequence: unknown) => sequence,
}));
vi.mock("$lib/shared/library/library-events", () => ({
  notifyLibraryMutated: vi.fn(),
}));

import { LibraryBatchOperations } from "$lib/shared/library/services/library-batch-operations";

describe("LibraryBatchOperations delete counter integrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firestoreMocks.batch.commit.mockResolvedValue(undefined);
    firestoreMocks.getDocs.mockResolvedValue({
      docs: [
        {
          id: "private-1",
          data: () => ({ visibility: "private" }),
        },
        {
          id: "public-1",
          data: () => ({ visibility: "public" }),
        },
      ],
    });
  });

  it("deletes each stored sequence and decrements its profile count atomically", async () => {
    const operations = new LibraryBatchOperations(
      async () => ({}) as never,
      () => "user-1",
      (data, id) => ({ ...data, id }) as never,
      {
        syncToPublicIndex: vi.fn(),
        updateThumbnails: vi.fn(),
        removeFromPublicIndex: vi.fn(),
      },
      vi.fn()
    );

    await operations.deleteSequences([
      "private-1",
      "public-1",
      "already-missing",
    ]);

    expect(firestoreMocks.batch.delete.mock.calls).toEqual([
      [{ path: "users/user-1/sequences/private-1" }],
      [{ path: "publicSequences/public-1" }],
      [{ path: "users/user-1/sequences/public-1" }],
    ]);
    expect(firestoreMocks.batch.set).toHaveBeenCalledWith(
      { path: "users/user-1" },
      {
        sequenceCount: { incrementBy: -2 },
        lastActivityDate: "server-timestamp",
      },
      { merge: true }
    );
    expect(firestoreMocks.batch.commit).toHaveBeenCalledOnce();
  });
});
