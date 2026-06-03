import { describe, it, expect } from "vitest";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import {
  queryGalleryDeck,
  resolveGalleryCards,
  GALLERY_SOURCE_ID,
  type GalleryFilters,
  type GalleryLoaders,
} from "../gallery-deck-source";

function seq(over: Partial<SequenceData> & { id: string }): SequenceData {
  return {
    id: over.id,
    name: over.name ?? over.word ?? over.id,
    word: over.word ?? over.id,
    steps: over.steps ?? [{}, {}, {}, {}] as never,
    sequenceLength: over.sequenceLength,
    level: over.level,
    loopType: over.loopType,
    period: over.period,
    tags: over.tags ?? [],
  } as SequenceData;
}

function loaders(list: SequenceData[]): GalleryLoaders {
  return {
    list: async () => list,
    fetchByIds: async (ids) => list.filter((s) => ids.includes(s.id!)),
  };
}

describe("gallery-deck-source", () => {
  it("stamps gallery cards with the gallery source id + position", async () => {
    const { cards } = await queryGalleryDeck({}, 10, "Fire Drums", loaders([
      seq({ id: "a", word: "AB" }),
      seq({ id: "b", word: "CD" }),
    ]));
    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({
      sequenceId: "a",
      sourceCatalogId: GALLERY_SOURCE_ID,
      position: 1,
      footer: { center: "Fire Drums" },
    });
    expect(cards[1]!.position).toBe(2);
  });

  it("caps at the requested size", async () => {
    const list = Array.from({ length: 5 }, (_, i) => seq({ id: `s${i}` }));
    const { cards, sequences } = await queryGalleryDeck({}, 3, "", loaders(list));
    expect(cards).toHaveLength(3);
    expect(sequences).toHaveLength(3);
  });

  it("dedups by id", async () => {
    const { cards } = await queryGalleryDeck({}, 10, "", loaders([
      seq({ id: "dup" }),
      seq({ id: "dup" }),
      seq({ id: "other" }),
    ]));
    expect(cards.map((c) => c.sequenceId)).toEqual(["dup", "other"]);
  });

  it("filters by level + length client-side", async () => {
    const { cards } = await queryGalleryDeck(
      { levels: [2], lengths: [8] },
      10,
      "",
      loaders([
        seq({ id: "keep", level: 2, sequenceLength: 8 }),
        seq({ id: "wrong-level", level: 1, sequenceLength: 8 }),
        seq({ id: "wrong-len", level: 2, sequenceLength: 4 }),
      ]),
    );
    expect(cards.map((c) => c.sequenceId)).toEqual(["keep"]);
  });

  it("filters by loop type + period bucket", async () => {
    const filters: GalleryFilters = { loopTypes: ["rotated"], period: "quartered" };
    const { cards } = await queryGalleryDeck(filters, 10, "", loaders([
      seq({ id: "keep", loopType: "rotated" as never, period: 4 }),
      seq({ id: "wrong-loop", loopType: "mirrored" as never, period: 4 }),
      seq({ id: "wrong-period", loopType: "rotated" as never, period: 2 }),
    ]));
    expect(cards.map((c) => c.sequenceId)).toEqual(["keep"]);
  });

  it("resolveGalleryCards returns sequences for the given ids", async () => {
    const list = [seq({ id: "x" }), seq({ id: "y" }), seq({ id: "z" })];
    const out = await resolveGalleryCards(["x", "z"], loaders(list));
    expect(out.map((s) => s.id)).toEqual(["x", "z"]);
  });
});
