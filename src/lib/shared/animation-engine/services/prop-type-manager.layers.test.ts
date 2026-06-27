import { describe, it, expect, vi } from "vitest";

// getBaseMotionColors pulls the SVG generator chain; stub it to fixed colors so
// the spectrum-off assertion is deterministic and the import stays light.
vi.mock("./svg-generator", () => ({
  getBaseMotionColors: () => ({ blue: "#1111ff", red: "#ff1111" }),
}));

import { PropTypeManager } from "./prop-type-manager";

function makeManager() {
  const calls: Array<{ i: number; propType: string; blue: string; red: string }> = [];
  const renderer = {
    loadAdditionalLayerPropTextures: vi.fn(
      (i: number, propType: string, blue: string, red: string) => {
        calls.push({ i, propType, blue, red });
        return Promise.resolve();
      },
    ),
  };
  const ptm = new PropTypeManager();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ptm.updateRefs({ animationRenderer: renderer as any });
  return { ptm, renderer, calls };
}

// Regression guard for the tunnel-export "only the base pair renders" bug: the
// offscreen engine bypasses PlaybackSync.update (the live path that loads the
// per-layer prop textures), so the export must pre-load them itself.
describe("PropTypeManager.preloadAdditionalLayerTextures (tunnel export)", () => {
  it("loads one texture per layer, forwarding the export's prop type", async () => {
    const { ptm, renderer, calls } = makeManager();
    await ptm.preloadAdditionalLayerTextures(3, true, "club");
    expect(renderer.loadAdditionalLayerPropTextures).toHaveBeenCalledTimes(3);
    expect(calls.map((c) => c.i)).toEqual([0, 1, 2]);
    expect(calls.every((c) => c.propType === "club")).toBe(true);
  });

  it("spectrum on → each layer fans to a distinct color", async () => {
    const { ptm, calls } = makeManager();
    await ptm.preloadAdditionalLayerTextures(3, true, "staff");
    expect(new Set(calls.map((c) => c.blue)).size).toBe(3);
    expect(new Set(calls.map((c) => c.red)).size).toBe(3);
  });

  it("spectrum off → every layer matches the base pair color", async () => {
    const { ptm, calls } = makeManager();
    await ptm.preloadAdditionalLayerTextures(3, false, "staff");
    expect(calls.every((c) => c.blue === "#1111ff")).toBe(true);
    expect(calls.every((c) => c.red === "#ff1111")).toBe(true);
  });

  it("no-op for zero layers", async () => {
    const { ptm, renderer } = makeManager();
    await ptm.preloadAdditionalLayerTextures(0, true, "staff");
    expect(renderer.loadAdditionalLayerPropTextures).not.toHaveBeenCalled();
  });
});
