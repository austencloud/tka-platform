import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { PROP_GEOMETRY } = vi.hoisted(() => ({
  PROP_GEOMETRY: {
    staff: { width: 270, height: 83.1 },
    fan: { width: 300, height: 239.4 },
    club: { width: 258.67, height: 34.17 },
    buugeng: { width: 300, height: 155.26 },
  } as Record<string, { width: number; height: number }>,
}));

const { fakeSvgCache } = vi.hoisted(() => {
  const images = new Map<string, HTMLImageElement>();
  const pending = new Map<string, Promise<HTMLImageElement>>();

  return {
    fakeSvgCache: {
      async getImage(_svg: string, key: string): Promise<HTMLImageElement> {
        const cached = images.get(key);
        if (cached) return cached;

        const loading = pending.get(key);
        if (loading) return loading;

        const promise = new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error("Test image failed to load"));
          image.src = key;
        });
        pending.set(key, promise);

        try {
          const image = await promise;
          images.set(key, image);
          return image;
        } finally {
          pending.delete(key);
        }
      },
      clear(): void {
        images.clear();
        pending.clear();
      },
    },
  };
});

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

vi.mock("$lib/shared/render/services/svg-image-cache", () => ({
  getSvgImageCache: () => fakeSvgCache,
}));

import { Canvas2DImageLoader } from "../canvas-2d-image-loader";

class ImmediatelyLoadedImage {
  static sourceAssignments = 0;

  width = 0;
  height = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  #src = "";

  set src(value: string) {
    this.#src = value;
    ImmediatelyLoadedImage.sourceAssignments += 1;
    queueMicrotask(() => this.onload?.());
  }

  get src(): string {
    return this.#src;
  }

  decode(): Promise<void> {
    return Promise.resolve();
  }
}

describe("Canvas2DImageLoader prop crossfade snapshots", () => {
  beforeEach(() => {
    ImmediatelyLoadedImage.sourceAssignments = 0;
    vi.stubGlobal("Image", ImmediatelyLoadedImage);
  });

  afterEach(() => {
    fakeSvgCache.clear();
    vi.unstubAllGlobals();
  });

  it("decodes identical prop sprites once across animation engines", async () => {
    const first = new Canvas2DImageLoader();
    const second = new Canvas2DImageLoader();

    const [firstImages, secondImages] = await Promise.all([
      first.loadPerColorPropImages("staff", "staff"),
      second.loadPerColorPropImages("staff", "staff"),
    ]);

    expect(ImmediatelyLoadedImage.sourceAssignments).toBe(1);
    expect(secondImages.blue).toBe(firstImages.blue);
    expect(secondImages.red).toBe(firstImages.red);
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
