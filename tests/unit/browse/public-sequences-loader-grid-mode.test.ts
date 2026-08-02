import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDocs: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db: unknown, path: string) => ({ path })),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: mocks.getDocs,
  orderBy: vi.fn((field: string, direction: string) => ({ field, direction })),
  query: vi.fn((reference: unknown) => reference),
}));

vi.mock("$lib/shared/auth/firebase", () => ({
  getFirestoreInstance: vi.fn(async () => ({})),
}));

vi.mock("$lib/shared/library/data/firestore-paths", () => ({
  getPublicSequencesPath: vi.fn(() => "publicSequences"),
}));

vi.mock("$lib/shared/offline/state/network-status-state.svelte", () => ({
  networkStatusState: { isOnline: true },
}));

import { applyFilter } from "$lib/shared/browse/services/browse-filter";
import { PublicSequencesLoader } from "$lib/shared/browse/services/public-sequences-loader";
import { BrowseFilterType } from "$lib/shared/persistence/domain/enums/filtering-enums";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PublicSequencesLoader grid mode mapping", () => {
  it("preserves Box so the gallery grid-mode filter can discover it", async () => {
    mocks.getDocs.mockResolvedValue({
      forEach: (visit: (doc: { id: string; data: () => unknown }) => void) => {
        visit({
          id: "box-sequence",
          data: () => ({
            id: "box-sequence",
            sourceRef: "users/austen/sequences/box-sequence",
            ownerId: "austen",
            ownerDisplayName: "Austen",
            name: "Box sequence",
            word: "AB",
            thumbnails: [],
            sequenceLength: 2,
            difficultyLevel: "beginner",
            level: 1,
            gridMode: "box",
            forkCount: 0,
            viewCount: 0,
            starCount: 0,
            tags: [],
            isForked: false,
            publishedAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          }),
        });
      },
    });

    const sequences = await new PublicSequencesLoader().refreshFromFirestore();

    expect(sequences[0]?.gridMode).toBe("box");
    expect(
      applyFilter(sequences, BrowseFilterType.GRID_MODE, "box").map(
        (sequence) => sequence.id
      )
    ).toEqual(["box-sequence"]);
  });
});
