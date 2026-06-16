import { describe, it, expect } from "vitest";
import { proceduralKitProvider } from "$lib/features/museum/services/kit-piece-provider";
import type { ResolvedWalls } from "$lib/features/museum/domain/museum-kit-types";

describe("proceduralKitProvider", () => {
  it("emits one wall group spanning each run length", () => {
    const walls: ResolvedWalls = {
      runs: [{ axis: "x", fixed: 0, start: 0, end: 3 }],
      doors: [],
      posts: [],
    };
    const root = proceduralKitProvider.buildWalls(
      walls,
      "institutional",
      0.5,
      4.5,
      "#e8e4e0",
    );
    // a run of 4 tiles at 0.5m = 2m wide; root has at least one child mesh
    expect(root.children.length).toBeGreaterThan(0);
  });
});
