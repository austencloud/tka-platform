import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const batch = {
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn(),
  };

  return {
    batch,
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    captureEvent: vi.fn(),
  };
});

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db: unknown, path: string) => ({ path })),
  doc: vi.fn((_db: unknown, path: string) => ({ path })),
  getDoc: mocks.getDoc,
  getDocs: mocks.getDocs,
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  query: vi.fn((value: unknown) => value),
  orderBy: vi.fn(),
  onSnapshot: vi.fn(),
  serverTimestamp: vi.fn(() => "server-timestamp"),
  writeBatch: vi.fn(() => mocks.batch),
  arrayUnion: vi.fn(),
  arrayRemove: vi.fn((value: string) => ({ remove: value })),
  increment: vi.fn((value: number) => ({ incrementBy: value })),
  documentId: vi.fn(),
  where: vi.fn(),
}));
vi.mock("$lib/shared/auth/firebase", () => ({
  getFirestoreInstance: vi.fn().mockResolvedValue({}),
}));
vi.mock("$lib/shared/toast/state/toast-state.svelte.ts", () => ({
  toast: { error: vi.fn() },
}));
vi.mock("$lib/shared/analytics/services/posthog", () => ({
  captureEvent: mocks.captureEvent,
}));
vi.mock("$lib/shared/library/services/collection-firestore-mapper", () => {
  class CollectionError extends Error {
    constructor(
      message: string,
      public code: string,
      public collectionId?: string
    ) {
      super(message);
    }
  }

  return {
    getAuthenticatedUserId: () => "user-1",
    mapDocToCollection: (data: Record<string, unknown>, id: string) => ({
      id,
      name: data["name"] ?? "",
      ownerId: "user-1",
      sequenceIds: data["sequenceIds"] ?? [],
      sequenceCount: data["sequenceCount"] ?? 0,
      isPublic: false,
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...(data["systemType"] ? { systemType: data["systemType"] } : {}),
    }),
    batchFetchSequences: vi.fn(),
    batchFetchPublicSequences: vi.fn(),
    CollectionError,
  };
});

import {
  createSmartUserCollection,
  createUserCollection,
  deleteCollection,
} from "$lib/shared/library/services/collection-manager";

describe("collection-manager profile count", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.batch.commit.mockResolvedValue(undefined);
  });

  it("creates a manual collection and increments the profile count atomically", async () => {
    await createUserCollection("Inventions");

    expect(mocks.batch.set).toHaveBeenCalledTimes(2);
    expect(mocks.batch.set.mock.calls[0][0].path).toMatch(
      /^users\/user-1\/collections\//
    );
    expect(mocks.batch.set.mock.calls[1]).toEqual([
      { path: "users/user-1" },
      {
        collectionCount: { incrementBy: 1 },
        lastActivityDate: "server-timestamp",
      },
      { merge: true },
    ]);
    expect(mocks.batch.commit).toHaveBeenCalledOnce();
  });

  it("keeps smart collection creation on the same atomic counter path", async () => {
    await createSmartUserCollection(
      "Moves",
      {
        source: "my-library",
        filters: [],
        sortMethod: "newest",
        sortDirection: "desc",
      },
      3
    );

    expect(mocks.batch.set.mock.calls[1]).toEqual([
      { path: "users/user-1" },
      {
        collectionCount: { incrementBy: 1 },
        lastActivityDate: "server-timestamp",
      },
      { merge: true },
    ]);
    expect(mocks.batch.commit).toHaveBeenCalledOnce();
  });

  it("deletes a custom collection and decrements the profile count atomically", async () => {
    mocks.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        name: "Inventions",
        sequenceIds: [],
        sequenceCount: 0,
      }),
    });

    await deleteCollection("collection-1");

    expect(mocks.getDocs).not.toHaveBeenCalled();
    expect(mocks.batch.delete).toHaveBeenCalledWith({
      path: "users/user-1/collections/collection-1",
    });
    expect(mocks.batch.set).toHaveBeenCalledWith(
      { path: "users/user-1" },
      {
        collectionCount: { incrementBy: -1 },
        lastActivityDate: "server-timestamp",
      },
      { merge: true }
    );
    expect(mocks.batch.commit).toHaveBeenCalledOnce();
  });
});
