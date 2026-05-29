import { describe, it, expect } from "vitest";
import type { BackJob, PlacedBitmap, GradientSpec } from "../back-job";

describe("BackJob", () => {
  it("plain-data fields are JSON-serializable (excluding ImageBitmap handles)", () => {
    const grad: GradientSpec = { type: "linear", angleDeg: 180, stops: [{ offset: 0, color: "#000" }] };
    const job = {
      width: 1644, height: 2244, bleedPx: 72,
      borderGradient: grad, bgGradient: grad,
      decorations: null,
      mandalaOptions: { offsetX: 0, offsetY: 0 } as BackJob["mandalaOptions"],
      bitmaps: [] as PlacedBitmap[],
    };
    expect(() => JSON.stringify(job)).not.toThrow();
    expect(job.width).toBe(1644);
  });
});
