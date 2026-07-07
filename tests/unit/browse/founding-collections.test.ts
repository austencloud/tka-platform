import { describe, it, expect } from "vitest";
import {
  FOUNDING_SMART_COLLECTIONS,
  toSyntheticCollection,
  isFoundingId,
  getFoundingCollection,
} from "$lib/features/browse/collections/config/founding-collections";

describe("founding collections config", () => {
  it("declares exactly three founding collections with underscore ids", () => {
    expect(FOUNDING_SMART_COLLECTIONS.map((c) => c.id)).toEqual([
      "founding_tka-1",
      "founding_tka-2",
      "founding_tka-3",
    ]);
    for (const c of FOUNDING_SMART_COLLECTIONS) {
      expect(isFoundingId(c.id)).toBe(true);
      expect(c.id.includes(":")).toBe(false);
      expect(c.filterSpec.source).toBe("community");
      expect(c.filterSpec.filters.length).toBeGreaterThan(0);
    }
  });

  it("declares the expected cached counts", () => {
    expect(FOUNDING_SMART_COLLECTIONS.map((c) => c.sequenceCount)).toEqual([19, 57, 95]);
  });

  it("adapts to a read-only smart LibraryCollection", () => {
    const syn = toSyntheticCollection(FOUNDING_SMART_COLLECTIONS[1]!);
    expect(syn.kind).toBe("smart");
    expect(syn.systemType).toBe("founding");
    expect(syn.sequenceCount).toBe(57);
    expect(syn.filterSpec).toBe(FOUNDING_SMART_COLLECTIONS[1]!.filterSpec);
  });

  it("resolves a founding id back to its config", () => {
    expect(getFoundingCollection("founding_tka-3")?.name).toContain("TKA 3");
    expect(getFoundingCollection("nope")).toBeUndefined();
  });
});
