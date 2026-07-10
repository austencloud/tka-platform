import { describe, it, expect, vi, beforeEach } from "vitest";

// The loader's module invariant: everything it returns has sequenceCount
// normalized to PUBLIC members. These tests pin that behavior at the door so
// no consumer ever needs (or is tempted) to re-derive counts.

const mocks = vi.hoisted(() => ({
  getDoc: vi.fn(),
  getCountFromServer: vi.fn(),
  // Records the id chunk of each aggregate count query.
  countChunks: [] as string[][],
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db: unknown, path: string) => ({ path })),
  collectionGroup: vi.fn(),
  doc: vi.fn((_db: unknown, path: string) => ({ path })),
  documentId: vi.fn(() => "__name__"),
  getCountFromServer: mocks.getCountFromServer,
  getDoc: mocks.getDoc,
  getDocs: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn((_ref: unknown, whereClause: { chunk?: string[] }) => whereClause),
  where: vi.fn((_field: unknown, _op: string, chunk: string[]) => {
    mocks.countChunks.push(chunk);
    return { chunk };
  }),
}));
vi.mock("$lib/shared/auth/firebase", () => ({
  getFirestoreInstance: vi.fn(async () => ({})),
}));
// The real mapper drags in authState + the sequence hydrator; count
// normalization doesn't depend on mapping details, so map 1:1.
vi.mock("$lib/shared/library/services/collection-firestore-mapper", () => ({
  mapDocToCollection: (data: Record<string, unknown>, id: string) => ({ id, ...data }),
  batchFetchSequences: vi.fn(),
}));

import { getPublicCollection } from "../public-collection-loader";

function docSnap(data: Record<string, unknown>) {
  return { exists: () => true, data: () => data };
}

function storedCollection(overrides: Record<string, unknown> = {}) {
  return {
    name: "C1",
    ownerId: "o1",
    isPublic: true,
    kind: "manual",
    sequenceIds: ["a", "b", "c", "d"],
    sequenceCount: 4,
    sortOrder: 0,
    icon: "fa-folder",
    createdAt: { toDate: () => new Date() },
    updatedAt: { toDate: () => new Date() },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.countChunks = [];
});

describe("public-collection-loader count normalization", () => {
  it("replaces a manual collection's stored count with the public count", async () => {
    mocks.getDoc.mockResolvedValue(docSnap(storedCollection()));
    mocks.getCountFromServer.mockResolvedValue({ data: () => ({ count: 1 }) });

    const col = await getPublicCollection("o1", "c1");

    // Stored 4 (private-inclusive) never escapes; visitor sees 1.
    expect(col?.sequenceCount).toBe(1);
    expect(mocks.countChunks).toEqual([["a", "b", "c", "d"]]);
  });

  it("keeps a smart collection's stored count (membership derives from filterSpec)", async () => {
    mocks.getDoc.mockResolvedValue(
      docSnap(storedCollection({ kind: "smart", sequenceIds: [], sequenceCount: 7 })),
    );

    const col = await getPublicCollection("o1", "c1");

    expect(col?.sequenceCount).toBe(7);
    expect(mocks.getCountFromServer).not.toHaveBeenCalled();
  });

  it("falls back to the stored count when the aggregate query fails", async () => {
    mocks.getDoc.mockResolvedValue(docSnap(storedCollection()));
    mocks.getCountFromServer.mockRejectedValue(new Error("offline"));

    const col = await getPublicCollection("o1", "c1");

    // Slightly-high beats a broken card.
    expect(col?.sequenceCount).toBe(4);
  });

  it("short-circuits to 0 for an empty manual collection without querying", async () => {
    mocks.getDoc.mockResolvedValue(
      docSnap(storedCollection({ sequenceIds: [], sequenceCount: 0 })),
    );

    const col = await getPublicCollection("o1", "c1");

    expect(col?.sequenceCount).toBe(0);
    expect(mocks.getCountFromServer).not.toHaveBeenCalled();
  });

  it("chunks >30 member ids into multiple `in` count queries and sums them", async () => {
    const ids = Array.from({ length: 35 }, (_, i) => `s${i}`);
    mocks.getDoc.mockResolvedValue(
      docSnap(storedCollection({ sequenceIds: ids, sequenceCount: 35 })),
    );
    mocks.getCountFromServer
      .mockResolvedValueOnce({ data: () => ({ count: 20 }) })
      .mockResolvedValueOnce({ data: () => ({ count: 3 }) });

    const col = await getPublicCollection("o1", "c1");

    expect(col?.sequenceCount).toBe(23);
    expect(mocks.countChunks).toHaveLength(2);
    expect(mocks.countChunks[0]).toHaveLength(30);
    expect(mocks.countChunks[1]).toHaveLength(5);
  });
});
