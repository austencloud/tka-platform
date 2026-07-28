import { describe, it, expect } from "vitest";
import {
  shouldUseDoorway,
  COLLECTIONS_DOORWAY_THRESHOLD,
  sampleCount,
} from "$lib/features/creators/components/profile/stage/doorway-policy";

describe("shouldUseDoorway", () => {
  it("always returns true for the archive, even when tiny", () => {
    expect(shouldUseDoorway("archive", 0)).toBe(true);
    expect(shouldUseDoorway("archive", 3)).toBe(true);
    expect(shouldUseDoorway("archive", 505)).toBe(true);
  });

  it("keeps collections inline at and below the threshold", () => {
    expect(shouldUseDoorway("collections", COLLECTIONS_DOORWAY_THRESHOLD)).toBe(false);
    expect(shouldUseDoorway("collections", COLLECTIONS_DOORWAY_THRESHOLD - 1)).toBe(false);
  });

  it("flips collections to a doorway strictly above the threshold", () => {
    expect(shouldUseDoorway("collections", COLLECTIONS_DOORWAY_THRESHOLD + 1)).toBe(true);
  });

  it("uses 60 as the collections threshold", () => {
    expect(COLLECTIONS_DOORWAY_THRESHOLD).toBe(60);
  });
});

describe("sampleCount", () => {
  it("never exceeds the column cap, so the sample stays one row", () => {
    expect(sampleCount(505, 8)).toBe(8);
    expect(sampleCount(505, 4)).toBe(4);
  });

  it("shows everything when there is less than a row", () => {
    expect(sampleCount(3, 8)).toBe(3);
  });

  it("returns zero for an empty band", () => {
    expect(sampleCount(0, 8)).toBe(0);
  });
});
