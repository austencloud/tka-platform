import { describe, it, expect } from "vitest";
import { SvgAssetLoader } from "../svg-asset-loader";

describe("SvgAssetLoader grid seed", () => {
  it("seedGrids populates getGridImage without initialize()", () => {
    const loader = new SvgAssetLoader();
    const diamond = { width: 950, height: 950 } as unknown as ImageBitmap;
    loader.seedGrids({ diamond, box: null, diamondNonRadial: null, boxNonRadial: null });
    expect(loader.getGridImage("diamond")).toBe(diamond);
    expect(loader.isInitialized()).toBe(true);
  });

  it("snapshotGrids returns the four grid slots", () => {
    const loader = new SvgAssetLoader();
    const diamond = { width: 1 } as unknown as ImageBitmap;
    loader.seedGrids({ diamond, box: null, diamondNonRadial: null, boxNonRadial: null });
    const snap = loader.snapshotGrids();
    expect(snap.diamond).toBe(diamond);
    expect(snap.box).toBeNull();
  });
});
