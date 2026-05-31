import { describe, it, expect, vi, beforeEach } from "vitest";

const { deleteDocMock, docMock } = vi.hoisted(() => ({
  deleteDocMock: vi.fn(),
  docMock: vi.fn((_db: unknown, path: string) => ({ __path: path })),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  doc: docMock,
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: deleteDocMock,
  runTransaction: vi.fn(),
}));

vi.mock("$lib/shared/auth/firebase", () => ({
  getFirestoreInstance: vi.fn(async () => ({ __db: true })),
}));

vi.mock("$lib/shared/library/data/firestore-paths", () => ({
  getDeckReleaseCounterPath: () => "deckReleases/counter",
  getDeckReleaseManifestPath: (n: number) => `deckReleases/counter/manifests/${n}`,
  getDeckReleaseManifestsPath: () => "deckReleases/counter/manifests",
}));

import { deleteDeck } from "../deck-release-store";

describe("deleteDeck", () => {
  beforeEach(() => {
    deleteDocMock.mockReset();
    docMock.mockClear();
  });

  it("deletes the manifest doc for the given deck number", async () => {
    await deleteDeck(7);
    expect(docMock).toHaveBeenCalledWith(
      expect.anything(),
      "deckReleases/counter/manifests/7",
    );
    expect(deleteDocMock).toHaveBeenCalledTimes(1);
    expect(deleteDocMock).toHaveBeenCalledWith({
      __path: "deckReleases/counter/manifests/7",
    });
  });

  it("does not touch the counter (numbers are permanent)", async () => {
    await deleteDeck(7);
    const touchedCounter = docMock.mock.calls.some(
      ([, path]) => path === "deckReleases/counter",
    );
    expect(touchedCounter).toBe(false);
  });
});
