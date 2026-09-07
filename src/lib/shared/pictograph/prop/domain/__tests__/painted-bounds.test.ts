import { describe, expect, it } from "vitest";
import { paintedPixelBounds } from "../painted-bounds";

function buffer(width: number, height: number, painted: [number, number, number][]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (const [x, y, alpha] of painted) data[(y * width + x) * 4 + 3] = alpha;
  return data;
}

describe("paintedPixelBounds", () => {
  it("hugs the painted pixels and ignores the clear fringe", () => {
    const data = buffer(10, 4, [
      [2, 1, 255],
      [6, 2, 200],
      [9, 3, 12], // antialiasing fringe below the threshold
    ]);
    expect(paintedPixelBounds(data, 10, 4)).toEqual({
      x: 2,
      y: 1,
      width: 5,
      height: 2,
    });
  });

  it("is null for a blank capture", () => {
    expect(paintedPixelBounds(buffer(4, 4, []), 4, 4)).toBeNull();
  });
});
