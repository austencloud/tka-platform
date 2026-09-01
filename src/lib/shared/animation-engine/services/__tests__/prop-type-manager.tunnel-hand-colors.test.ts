import { describe, expect, it, vi } from "vitest";

vi.mock("../svg-generator", () => ({
  getBaseMotionColors: () => ({
    left: "#canonical-blue",
    right: "#canonical-red",
  }),
}));

import { PropTypeManager } from "../prop-type-manager";

describe("Tunnel pictograph hand colors", () => {
  it("loads every generated layer with the canonical blue-Left/red-Right pair when spectrum is off", async () => {
    const loads: Array<{ left: string; right: string }> = [];
    const manager = new PropTypeManager();
    manager.updateRefs({
      animationRenderer: {
        loadAdditionalLayerPropTextures: vi.fn(
          (
            _index: number,
            _leftPropType: string,
            _rightPropType: string,
            left: string,
            right: string
          ) => {
            loads.push({ left, right });
            return Promise.resolve();
          }
        ),
      } as never,
    });

    await manager.preloadAdditionalLayerTextures(4, false, "staff");

    expect(loads).toEqual(
      Array.from({ length: 4 }, () => ({
        left: "#canonical-blue",
        right: "#canonical-red",
      }))
    );
  });

  it("reloads the base prop textures when an exact pair changes", async () => {
    const loadPropTextures = vi.fn(() => Promise.resolve());
    const manager = new PropTypeManager();
    manager.updateRefs({
      propTextureService: {
        state: {
          leftDimensions: { width: 100, height: 20 },
          rightDimensions: { width: 100, height: 20 },
        },
        loadPropTextures,
      } as never,
      animationRenderer: {
        prepareLeftPropCrossfade: vi.fn(),
        prepareRightPropCrossfade: vi.fn(),
        startLeftPropCrossfade: vi.fn(),
        startRightPropCrossfade: vi.fn(),
      } as never,
    });
    const state = {
      currentLeftPropType: "staff",
      currentRightPropType: "staff",
      setLeftPropDimensions: vi.fn(),
      setRightPropDimensions: vi.fn(),
    } as never;
    const frame = () => ({}) as never;
    const baseProps = {
      leftProp: null,
      rightProp: null,
      additionalLayers: [],
      tunnelSpectrum: false,
    };

    manager.handleAdditionalLayers(
      {
        ...baseProps,
        tunnelPropColors: { left: "#123456", right: "#abcdef" },
      },
      state,
      frame,
      true
    );
    await vi.waitFor(() => expect(loadPropTextures).toHaveBeenCalledTimes(1));
    expect(loadPropTextures).toHaveBeenLastCalledWith("staff", "staff", true, {
      left: "#123456",
      right: "#abcdef",
    });

    manager.handleAdditionalLayers(
      {
        ...baseProps,
        tunnelPropColors: { left: "#654321", right: "#fedcba" },
      },
      state,
      frame,
      true
    );
    await vi.waitFor(() => expect(loadPropTextures).toHaveBeenCalledTimes(2));
    expect(loadPropTextures).toHaveBeenLastCalledWith("staff", "staff", true, {
      left: "#654321",
      right: "#fedcba",
    });
  });
});
