import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DARK_MONOCHROME_IMAGE_COLOR,
  drawMonochromeImage,
} from "../src/tinted-image.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe.each([
  "main-thread CanvasRenderingContext2D",
  "worker OffscreenCanvasRenderingContext2D",
])("drawMonochromeImage in a %s", () => {
  it("uses source-in alpha tinting for dark glyphs", () => {
    const scratchContext = {
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      globalCompositeOperation: "source-over",
      fillStyle: "",
    };

    class MockOffscreenCanvas {
      constructor(
        readonly width: number,
        readonly height: number
      ) {}

      getContext() {
        return scratchContext;
      }
    }

    vi.stubGlobal("OffscreenCanvas", MockOffscreenCanvas);

    const destination = {
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    const image = {} as CanvasImageSource;

    drawMonochromeImage(destination, image, 10, 20, 30.25, 40.5, true);

    expect(scratchContext.drawImage).toHaveBeenCalledWith(
      image,
      0,
      0,
      30.25,
      40.5
    );
    expect(scratchContext.globalCompositeOperation).toBe("source-in");
    expect(scratchContext.fillStyle).toBe(DARK_MONOCHROME_IMAGE_COLOR);
    expect(scratchContext.fillRect).toHaveBeenCalledWith(0, 0, 31, 41);
    expect(destination.drawImage).toHaveBeenCalledWith(
      expect.any(MockOffscreenCanvas),
      0,
      0,
      30.25,
      40.5,
      10,
      20,
      30.25,
      40.5
    );
  });
});
