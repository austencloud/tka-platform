import { beforeEach, describe, expect, it, vi } from "vitest";

const firestoreMocks = vi.hoisted(() => {
  const batch = {
    set: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn(),
  };

  return {
    batch,
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    updateDoc: vi.fn(),
    firestoreGet: vi.fn(),
    notifyLibrarySequenceUpdated: vi.fn(),
    showUserError: vi.fn(),
  };
});

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db: unknown, path: string) => ({ path })),
  doc: vi.fn((_db: unknown, path: string) => ({ path })),
  getDoc: firestoreMocks.getDoc,
  getDocs: firestoreMocks.getDocs,
  setDoc: vi.fn(),
  updateDoc: firestoreMocks.updateDoc,
  deleteDoc: vi.fn(),
  query: vi.fn((value: unknown) => value),
  orderBy: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
  serverTimestamp: vi.fn(() => "server-timestamp"),
  increment: vi.fn((value: number) => ({ incrementBy: value })),
  getCountFromServer: vi.fn(),
  writeBatch: vi.fn(() => firestoreMocks.batch),
}));

vi.mock("$lib/shared/auth/firebase", () => ({
  getFirestoreInstance: vi.fn().mockResolvedValue({}),
}));
vi.mock("$lib/shared/auth/state/auth-state.svelte", () => ({
  authState: {
    effectiveUserId: "user-1",
    user: { uid: "user-1", displayName: "Test User" },
  },
}));
vi.mock("$lib/shared/application/get-error-handler", () => ({
  getErrorHandler: () => ({ showUserError: firestoreMocks.showUserError }),
}));
vi.mock("$lib/shared/toast/state/toast-state.svelte.ts", () => ({
  toast: { info: vi.fn(), error: vi.fn() },
}));
vi.mock("$lib/shared/offline/state/sync-status-state.svelte", () => ({
  trackWrite: (operation: () => Promise<unknown>) => operation(),
}));
vi.mock("$lib/shared/foundation/services/sequence-hydrator", () => ({
  hydrate: (sequence: unknown) => sequence,
  ensureComposition: (sequence: unknown) => sequence,
}));
vi.mock("$lib/shared/firestore", () => ({
  firestoreGet: firestoreMocks.firestoreGet,
  // The repository reads through firestoreGetDetailed so it can tell "absent"
  // apart from "we never reached the server". Derive it from the same stub the
  // tests already arrange, so a resolved value still reads as found.
  firestoreGetDetailed: vi.fn(async (...args: unknown[]) => {
    const data = await (
      firestoreMocks.firestoreGet as (...a: unknown[]) => Promise<unknown>
    )(...args);
    return data ? { status: "found", data } : { status: "absent" };
  }),
  firestoreList: vi.fn(),
  stripUndefined: (value: Record<string, unknown>) =>
    Object.fromEntries(
      Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined)
    ),
}));
vi.mock("$lib/shared/create/services/orientation-cycle-detector", () => ({
  detectOrientationCycle: vi.fn(),
}));
vi.mock("$lib/shared/library/services/sequence-content-hasher", () => ({
  computeHash: vi.fn().mockResolvedValue("content-hash"),
  CONTENT_HASH_VERSION: 1,
  HASH_VERSION_V1: 1,
}));
vi.mock("$lib/shared/library/services/fork-decision", () => ({
  decideFork: vi.fn(),
}));
vi.mock("$lib/shared/library/get-tag-migrator", () => ({
  getTagMigrator: () =>
    vi.fn().mockResolvedValue({ sequenceTags: [], tagIds: [] }),
}));
vi.mock("$lib/shared/library/library-events", () => ({
  notifyLibraryMutated: vi.fn(),
  notifyLibrarySequenceAdded: vi.fn(),
  notifyLibrarySequenceUpdated: firestoreMocks.notifyLibrarySequenceUpdated,
}));
vi.mock("$lib/shared/library/services/library-recycle-bin", () => ({
  LibraryRecycleBin: class {},
}));
vi.mock("$lib/shared/library/services/library-batch-operations", () => ({
  LibraryBatchOperations: class {},
}));

import { LibraryRepository } from "$lib/shared/library/services/library-repository";

function makeSequence() {
  return {
    id: "sequence-1",
    name: "A",
    word: "A",
    steps: [{ letter: "A" }],
    stepPairings: [{}],
    thumbnails: [],
    isFavorite: false,
    isCircular: false,
    tags: [],
    metadata: { length: 0 },
  } as never;
}

describe("LibraryRepository.saveSequence atomic persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firestoreMocks.updateDoc.mockResolvedValue(undefined);
    firestoreMocks.getDoc.mockResolvedValue({
      exists: () => false,
      data: () => undefined,
    });
    firestoreMocks.getDocs.mockResolvedValue({
      empty: true,
      docs: [],
    });
    firestoreMocks.batch.commit.mockResolvedValue(undefined);
  });

  it("commits the sequence and profile counter in one batch", async () => {
    const repository = new LibraryRepository(null as never);

    await repository.saveSequence(makeSequence(), { visibility: "private" });

    expect(firestoreMocks.batch.set).toHaveBeenCalledTimes(2);
    const sequenceWrite = firestoreMocks.batch.set.mock.calls[0];
    expect(sequenceWrite[0]).toEqual({
      path: "users/user-1/sequences/sequence-1",
    });
    expect(sequenceWrite[1]).toMatchObject({
      sequenceLength: 1,
      metadata: { length: 1 },
    });

    expect(firestoreMocks.batch.set.mock.calls[1]).toEqual([
      { path: "users/user-1" },
      {
        sequenceCount: { incrementBy: 1 },
        lastActivityDate: "server-timestamp",
      },
      { merge: true },
    ]);
    expect(firestoreMocks.batch.commit).toHaveBeenCalledOnce();
  });

  it("rejects the cloud sync when the atomic batch fails", async () => {
    firestoreMocks.batch.commit.mockRejectedValueOnce(
      new Error("permission-denied")
    );
    const repository = new LibraryRepository(null as never);

    await expect(
      repository.saveSequence(makeSequence(), { visibility: "private" })
    ).rejects.toMatchObject({ code: "NETWORK", sequenceId: "sequence-1" });
    expect(firestoreMocks.showUserError).toHaveBeenCalledOnce();
  });

  it("attaches a delayed thumbnail with a field-level write", async () => {
    const publicIndexSyncer = {
      syncToPublicIndex: vi.fn().mockResolvedValue(undefined),
      updateThumbnails: vi.fn().mockResolvedValue(undefined),
      removeFromPublicIndex: vi.fn(),
    };
    firestoreMocks.firestoreGet.mockResolvedValue({
      ...makeSequence(),
      visibility: "public",
      thumbnails: ["https://assets.example.com/old.png"],
      ownerId: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const repository = new LibraryRepository(publicIndexSyncer as never);

    await repository.attachThumbnail(
      "sequence-1",
      "https://assets.example.com/new.png"
    );

    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith(
      { path: "users/user-1/sequences/sequence-1" },
      {
        thumbnails: [
          "https://assets.example.com/new.png",
          "https://assets.example.com/old.png",
        ],
        updatedAt: "server-timestamp",
      }
    );
    expect(firestoreMocks.notifyLibrarySequenceUpdated).toHaveBeenCalledWith(
      "sequence-1",
      {
        thumbnails: [
          "https://assets.example.com/new.png",
          "https://assets.example.com/old.png",
        ],
      }
    );
    expect(publicIndexSyncer.updateThumbnails).toHaveBeenCalledWith(
      "sequence-1",
      [
        "https://assets.example.com/new.png",
        "https://assets.example.com/old.png",
      ]
    );
    expect(publicIndexSyncer.syncToPublicIndex).not.toHaveBeenCalled();
    expect(firestoreMocks.batch.commit).not.toHaveBeenCalled();
  });

  it("commits a sequence deletion and profile decrement in one batch", async () => {
    firestoreMocks.firestoreGet.mockResolvedValue({
      ...makeSequence(),
      visibility: "private",
      ownerId: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const repository = new LibraryRepository(null as never);

    await repository.deleteSequence("sequence-1");

    expect(firestoreMocks.batch.delete).toHaveBeenCalledWith({
      path: "users/user-1/sequences/sequence-1",
    });
    expect(firestoreMocks.batch.set).toHaveBeenCalledWith(
      { path: "users/user-1" },
      {
        sequenceCount: { incrementBy: -1 },
        lastActivityDate: "server-timestamp",
      },
      { merge: true }
    );
    expect(firestoreMocks.batch.commit).toHaveBeenCalledOnce();
  });
});
