import { describe, it, expect, vi, beforeEach } from "vitest";

const { deleteDocMock, docMock, runTransactionMock } = vi.hoisted(() => ({
  deleteDocMock: vi.fn(),
  docMock: vi.fn((_db: unknown, path: string) => ({ __path: path })),
  runTransactionMock: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  doc: docMock,
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: deleteDocMock,
  runTransaction: runTransactionMock,
}));

vi.mock("$lib/shared/auth/firebase", () => ({
  getFirestoreInstance: vi.fn(async () => ({ __db: true })),
}));

vi.mock("$lib/shared/library/data/firestore-paths", () => ({
  getDeckReleaseCounterPath: () => "deckReleases/counter",
  getDeckReleaseManifestPath: (n: number) => `deckReleases/counter/manifests/${n}`,
  getDeckReleaseManifestsPath: () => "deckReleases/counter/manifests",
}));

import { deleteDeck, releaseDeck } from "../deck-release-store";
import type { DeckRecipe, DeckReleaseCard } from "../../domain/models/DeckRelease";

/** Run a releaseDeck transaction against a fake tx, returning the manifest that
 *  was set on the manifest doc path. */
async function captureManifest(
  cards: DeckReleaseCard[],
  recipe?: DeckRecipe,
): Promise<Record<string, unknown>> {
  let captured: Record<string, unknown> = {};
  runTransactionMock.mockImplementation(async (_db: unknown, updater: (tx: unknown) => unknown) => {
    const tx = {
      get: async () => ({ exists: () => true, data: () => ({ next: 5 }) }),
      set: (ref: { __path: string }, data: Record<string, unknown>) => {
        if (ref.__path.includes("/manifests/")) captured = data;
      },
    };
    return updater(tx);
  });
  await releaseDeck(cards, "rainbow", "Test Notes", {
    name: "Test", description: "", bluePropType: "staff", redPropType: "staff",
  }, recipe);
  return captured;
}

const CARD: DeckReleaseCard = {
  sequenceId: "s1", sourceCatalogId: "cat", stepCount: 8, word: "AB", position: 1,
  footer: {},
};

describe("releaseDeck recipe", () => {
  beforeEach(() => { runTransactionMock.mockReset(); docMock.mockClear(); });

  it("round-trips the recipe onto the manifest when provided", async () => {
    const recipe: DeckRecipe = {
      deckMode: "loop",
      startOriModes: ["radial"],
      gridModes: ["diamond"],
      reversalPattern: null,
      weights: [{ stepCount: 8, weight: 50 }],
      totalCards: 52,
      sliceTypes: ["quartered"],
    };
    const manifest = await captureManifest([CARD], recipe);
    expect(manifest.recipe).toEqual(recipe);
  });

  it("omits the recipe field on legacy releases (no recipe arg)", async () => {
    const manifest = await captureManifest([CARD]);
    expect("recipe" in manifest).toBe(false);
  });
});

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
