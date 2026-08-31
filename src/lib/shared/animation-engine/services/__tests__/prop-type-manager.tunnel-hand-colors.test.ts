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

  it("reloads the base prop textures when an exact pair changes", async () => {
    const loadPropTextures = vi.fn(() => Promise.resolve());
    const manager = new PropTypeManager();
    manager.updateRefs({
      propTextureService: {
        state: {
          blueDimensions: { width: 100, height: 20 },
          redDimensions: { width: 100, height: 20 },
        },
        loadPropTextures,
      } as never,
      animationRenderer: {
        prepareBluePropCrossfade: vi.fn(),
        prepareRedPropCrossfade: vi.fn(),
        startBluePropCrossfade: vi.fn(),
        startRedPropCrossfade: vi.fn(),
      } as never,
    });
    const state = {
      currentBluePropType: "staff",
      currentRedPropType: "staff",
      setBluePropDimensions: vi.fn(),
      setRedPropDimensions: vi.fn(),
    } as never;
    const frame = () => ({}) as never;
    const baseProps = {
      blueProp: null,
      redProp: null,
      additionalLayers: [],
      tunnelSpectrum: false,
    };

    manager.handleAdditionalLayers(
      {
        ...baseProps,
        tunnelPropColors: { blue: "#123456", red: "#abcdef" },
      },
      state,
      frame,
      true
    );
    await vi.waitFor(() => expect(loadPropTextures).toHaveBeenCalledTimes(1));
    expect(loadPropTextures).toHaveBeenLastCalledWith("staff", "staff", true, {
      blue: "#123456",
      red: "#abcdef",
    });

    manager.handleAdditionalLayers(
      {
        ...baseProps,
        tunnelPropColors: { blue: "#654321", red: "#fedcba" },
      },
      state,
      frame,
      true
    );
    await vi.waitFor(() => expect(loadPropTextures).toHaveBeenCalledTimes(2));
    expect(loadPropTextures).toHaveBeenLastCalledWith("staff", "staff", true, {
      blue: "#654321",
      red: "#fedcba",
    });
  });
});
