import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  loadPrimitiveCatalog,
  getCatalogEntry,
  _resetCatalogForTesting,
} from "$lib/features/sticker-lab/services/implementations/PrimitiveCatalogReader";

vi.mock("$lib/features/sticker-lab/data/primitive-catalog.json", () => ({
  default: {
    version: 1,
    generatedAt: 0,
    totalEntries: 2,
    entries: [
      {
        shapeHash: "h1",
        ultraHash: "h1",
        displayName: "Shape 1",
        paths: null,
        sourceLoop: { sequenceId: "h1", word: "A", loopType: "rotated-loop" },
        symmetryOrder: 1,
        ultraCount: 1,
      },
      {
        shapeHash: "h2",
        ultraHash: "h2",
        displayName: "Shape 2",
        paths: null,
        sourceLoop: { sequenceId: "h2", word: "B", loopType: "rotated-loop" },
        symmetryOrder: 1,
        ultraCount: 1,
      },
    ],
  },
}));

describe("PrimitiveCatalogReader", () => {
  beforeEach(() => _resetCatalogForTesting());

  it("loads catalog and returns all entries", async () => {
    const catalog = await loadPrimitiveCatalog();
    expect(catalog.entries).toHaveLength(2);
  });

  it("getCatalogEntry returns null before load", () => {
    expect(getCatalogEntry("h1")).toBeNull();
  });

  it("getCatalogEntry returns the correct entry after load", async () => {
    await loadPrimitiveCatalog();
    expect(getCatalogEntry("h1")!.displayName).toBe("Shape 1");
    expect(getCatalogEntry("h2")!.displayName).toBe("Shape 2");
  });

  it("getCatalogEntry returns null for unknown hash", async () => {
    await loadPrimitiveCatalog();
    expect(getCatalogEntry("not-a-real-hash")).toBeNull();
  });

  it("concurrent calls share one in-flight promise (same object reference)", async () => {
    const [a, b] = await Promise.all([loadPrimitiveCatalog(), loadPrimitiveCatalog()]);
    expect(a).toBe(b);
  });
});
