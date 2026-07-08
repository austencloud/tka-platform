import { describe, it, expect, vi } from "vitest";
import { captureTunnelPoster, POSTER_SIZE } from "./tunnel-poster";

function fakeSource(w: number, h: number): HTMLCanvasElement {
  return { width: w, height: h } as HTMLCanvasElement;
}

describe("captureTunnelPoster", () => {
  it("draws the source into a POSTER_SIZE square and returns a webp data URL", () => {
    const drawImage = vi.fn();
    const toDataURL = vi.fn(() => "data:image/webp;base64,AAAA");
    const ctx = { drawImage, clearRect: vi.fn() } as unknown as CanvasRenderingContext2D;
    const target = { width: 0, height: 0, getContext: () => ctx, toDataURL } as unknown as HTMLCanvasElement;
    const makeCanvas = () => target;

    const url = captureTunnelPoster(fakeSource(800, 800), makeCanvas);

    expect(target.width).toBe(POSTER_SIZE);
    expect(target.height).toBe(POSTER_SIZE);
    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(toDataURL).toHaveBeenCalledWith("image/webp", expect.any(Number));
    expect(url).toBe("data:image/webp;base64,AAAA");
  });

  it("returns empty string when the source has no dimensions", () => {
    expect(captureTunnelPoster(fakeSource(0, 0), () => ({} as HTMLCanvasElement))).toBe("");
  });
});
