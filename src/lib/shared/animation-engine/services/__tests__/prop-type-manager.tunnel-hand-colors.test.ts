import { describe, expect, it, vi } from "vitest";

vi.mock("../svg-generator", () => ({
  getBaseMotionColors: () => ({
    blue: "#canonical-blue",
    red: "#canonical-red",
  }),
}));

import { PropTypeManager } from "../prop-type-manager";

describe("Tunnel pictograph hand colors", () => {
  it("loads every generated layer with the canonical blue-Left/red-Right pair when spectrum is off", async () => {
    const loads: Array<{ blue: string; red: string }> = [];
    const manager = new PropTypeManager();
    manager.updateRefs({
      animationRenderer: {
        loadAdditionalLayerPropTextures: vi.fn(
          (
            _index: number,
            _bluePropType: string,
            _redPropType: string,
            blue: string,
            red: string
          ) => {
            loads.push({ blue, red });
            return Promise.resolve();
          }
        ),
      } as never,
    });

    await manager.preloadAdditionalLayerTextures(4, false, "staff");

    expect(loads).toEqual(
      Array.from({ length: 4 }, () => ({
        blue: "#canonical-blue",
        red: "#canonical-red",
      }))
    );
  });
});
