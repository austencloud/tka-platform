import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { PROP_GEOMETRY } = vi.hoisted(() => ({
  PROP_GEOMETRY: {
    staff: { width: 270, height: 83.1 },
    fan: { width: 300, height: 239.4 },
    club: { width: 300, height: 39.63 },
    buugeng: { width: 300, height: 155.26 },
  } as Record<string, { width: number; height: number }>,
}));

vi.mock("$lib/shared/animation-engine/services/svg-generator", () => {
  const propSvg = async (propType: string) => {
    const dimensions = PROP_GEOMETRY[propType];
    if (!dimensions) throw new Error(`Unknown test prop: ${propType}`);
    return {
      svg: `<svg viewBox="0 0 ${dimensions.width} ${dimensions.height}"></svg>`,
      ...dimensions,
    };
  };

  return {
    generateBluePropSvg: propSvg,
    generateRedPropSvg: propSvg,
    generatePropSvg: propSvg,
    generateGridSvg: async () => "<svg></svg>",
  };
});

import { Canvas2DImageLoader } from "../canvas-2d-image-loader";

class ImmediatelyLoadedImage {
  width = 0;
  height = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  #src = "";

  set src(value: string) {
    this.#src = value;
    queueMicrotask(() => this.onload?.());
  }

  get src(): string {
    return this.#src;
  }
}

describe("Canvas2DImageLoader prop crossfade snapshots", () => {
  beforeEach(() => {
    vi.stubGlobal("Image", ImmediatelyLoadedImage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retains the outgoing image, bounds, and type before loading the target", async () => {
    const loader = new Canvas2DImageLoader();
    const staff = await loader.loadPerColorPropImages("staff", "staff");

    expect(loader.getPreviousBlueProp()).toBeNull();
    expect(loader.getPreviousRedProp()).toBeNull();

    await loader.loadPerColorPropImages("fan", "fan");

    expect(loader.getPreviousBlueProp()).toEqual({
      image: staff.blue,
      dimensions: PROP_GEOMETRY.staff,
      propType: "staff",
    });
    expect(loader.getPreviousRedProp()).toEqual({
      image: staff.red,
      dimensions: PROP_GEOMETRY.staff,
      propType: "staff",
    });
    expect(loader.getBluePropType()).toBe("fan");
    expect(loader.getRedPropType()).toBe("fan");
    expect(loader.getBluePropDimensions()).toEqual(PROP_GEOMETRY.fan);
    expect(loader.getRedPropDimensions()).toEqual(PROP_GEOMETRY.fan);
  });

  it("keeps per-color outgoing geometry independent and clears it atomically", async () => {
    const loader = new Canvas2DImageLoader();
    await loader.loadPerColorPropImages("staff", "club");
    await loader.loadPerColorPropImages("fan", "buugeng");

    expect(loader.getPreviousBlueProp()?.dimensions).toEqual(
      PROP_GEOMETRY.staff
    );
    expect(loader.getPreviousBlueProp()?.propType).toBe("staff");
    expect(loader.getPreviousRedProp()?.dimensions).toEqual(PROP_GEOMETRY.club);
    expect(loader.getPreviousRedProp()?.propType).toBe("club");

    loader.clearPreviousBlueProp();
    loader.clearPreviousRedProp();

    expect(loader.getPreviousBlueProp()).toBeNull();
    expect(loader.getPreviousRedProp()).toBeNull();
  });
});
