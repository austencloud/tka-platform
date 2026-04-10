import { describe, it, expect } from "vitest";
import { ImagePatternLoader } from "$lib/features/poi/services/implementations/ImagePatternLoader";
import { getPixel } from "$lib/features/poi/domain/StripPattern";

// Polyfill ImageData for Node environment
if (typeof globalThis.ImageData === "undefined") {
  (globalThis as any).ImageData = class ImageData {
    readonly data: Uint8ClampedArray;
    readonly width: number;
    readonly height: number;
    constructor(dataOrWidth: Uint8ClampedArray | number, widthOrHeight: number, height?: number) {
      if (dataOrWidth instanceof Uint8ClampedArray) {
        this.data = dataOrWidth;
        this.width = widthOrHeight;
        this.height = height!;
      } else {
        this.width = dataOrWidth;
        this.height = widthOrHeight;
        this.data = new Uint8ClampedArray(this.width * this.height * 4);
      }
    }
  };
}

describe("ImagePatternLoader", () => {
  const loader = new ImagePatternLoader();

  it("converts a 3x2 image to a 3-LED 2-frame pattern", () => {
    // 3 rows (height/LEDs) x 2 columns (width/frames)
    // Pixel layout (RGBA):
    //   (0,0)=red   (1,0)=green
    //   (0,1)=blue  (1,1)=white
    //   (0,2)=black (1,2)=yellow
    const data = new Uint8ClampedArray([
      255, 0, 0, 255,     0, 255, 0, 255,   // row 0: red, green
      0, 0, 255, 255,     255, 255, 255, 255, // row 1: blue, white
      0, 0, 0, 255,       255, 255, 0, 255,   // row 2: black, yellow
    ]);
    const imageData = new ImageData(data, 2, 3);

    const pattern = loader.fromImageData(imageData, 3);

    expect(pattern.ledCount).toBe(3);
    expect(pattern.frameCount).toBe(2);

    // Frame 0 (column 0): red, blue, black
    expect(getPixel(pattern, 0, 0)).toEqual({ r: 255, g: 0, b: 0 });
    expect(getPixel(pattern, 0, 1)).toEqual({ r: 0, g: 0, b: 255 });
    expect(getPixel(pattern, 0, 2)).toEqual({ r: 0, g: 0, b: 0 });

    // Frame 1 (column 1): green, white, yellow
    expect(getPixel(pattern, 1, 0)).toEqual({ r: 0, g: 255, b: 0 });
    expect(getPixel(pattern, 1, 1)).toEqual({ r: 255, g: 255, b: 255 });
    expect(getPixel(pattern, 1, 2)).toEqual({ r: 255, g: 255, b: 0 });
  });

  it("sets metadata source to image-upload", () => {
    const imageData = new ImageData(new Uint8ClampedArray(4 * 4), 2, 2);
    const pattern = loader.fromImageData(imageData, 2);
    expect(pattern.metadata.source).toBe("image-upload");
  });
});
