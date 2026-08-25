import { describe, expect, it } from "vitest";

import {
  CollectedFilmSchema,
  FILM_COLLECTION_SCHEMA_VERSION,
  FILM_COLLECTION_STORAGE_KEY,
  type CollectedFilm,
} from "../film-collection-types";

function entry(overrides: Partial<CollectedFilm> = {}): unknown {
  return {
    id: "film-1",
    name: "Star of Five",
    createdAt: 1_756_000_000_000,
    poster: "data:image/webp;base64,xxx",
    film: {
      id: "star-of-five-r1",
      title: "Star of Five",
      version: 3,
      scenes: [{ id: "star-reveal", title: "Star reveal" }],
    },
    durationSeconds: 16,
    sceneCount: 1,
    ...overrides,
  };
}

describe("CollectedFilmSchema", () => {
  it("round-trips a saved film", () => {
    const parsed = CollectedFilmSchema.parse(entry());
    expect(parsed.name).toBe("Star of Five");
    expect(parsed.sceneCount).toBe(1);
    expect(parsed.film.id).toBe("star-of-five-r1");
  });

  it("preserves the authored document verbatim through passthrough", () => {
    // The collection must not strip fields it does not model. The director's
    // schema is the authority on the document's shape; this layer only carries
    // it. A lossy parse here would silently corrupt saved films on every read.
    const parsed = CollectedFilmSchema.parse(entry());
    expect((parsed.film as Record<string, unknown>).scenes).toEqual([
      { id: "star-reveal", title: "Star reveal" },
    ]);
  });

  it("accepts an empty poster, because capture is allowed to fail", () => {
    expect(() => CollectedFilmSchema.parse(entry({ poster: "" }))).not.toThrow();
  });

  it("rejects an entry with no name", () => {
    expect(() => CollectedFilmSchema.parse(entry({ name: "" }))).toThrow();
  });

  it("rejects a film document missing its identity", () => {
    const bad = entry() as Record<string, unknown>;
    bad.film = { title: "No id", version: 3 };
    expect(() => CollectedFilmSchema.parse(bad)).toThrow();
  });

  it("rejects a negative scene count", () => {
    expect(() => CollectedFilmSchema.parse(entry({ sceneCount: -1 }))).toThrow();
  });

  it("pins the storage key and version so guest saves are not orphaned", () => {
    // Changing either silently drops every guest's saved films on next load:
    // LocalCollectionRepository reads a version mismatch as empty. A change
    // here is a migration, not an edit.
    expect(FILM_COLLECTION_STORAGE_KEY).toBe("tka:film-collection");
    expect(FILM_COLLECTION_SCHEMA_VERSION).toBe(1);
  });
});
