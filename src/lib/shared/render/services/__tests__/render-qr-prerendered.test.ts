import { describe, it, expect, vi } from "vitest";
import { ImageComposer } from "../image-composer";

// A pre-rendered QR must be drawn without invoking the QR generator. We assert
// the generator is never called when a bitmap is supplied, and IS the source of
// the draw. Uses a minimal stub canvas context to capture drawImage calls.
function stubCtx() {
  const calls: unknown[][] = [];
  return {
    calls,
    ctx: {
      fillStyle: "",
      font: "",
      textAlign: "",
      textBaseline: "",
      fillRect: () => {},
      drawImage: (...args: unknown[]) => calls.push(args),
      // The "Scan to play" caption draws via save/font/fillText/restore.
      save: () => {},
      restore: () => {},
      fillText: (...args: unknown[]) => calls.push(["fillText", ...args]),
    } as unknown as CanvasRenderingContext2D,
  };
}

describe("renderQRCode pre-rendered path", () => {
  it("draws the supplied image and never calls the generator", async () => {
    const generateAsImage = vi.fn();
    const composer = new ImageComposer(
      {} as never, {} as never, {} as never, {} as never, {} as never, {} as never,
      { generateAsImage } as never, // qrCodeGenerator
    );
    const fakeQr = { width: 10, height: 10 } as unknown as CanvasImageSource;
    const { ctx, calls } = stubCtx();
    // @ts-expect-error private method invoked for unit coverage
    await composer.renderQRCode(ctx, { steps: [] } as never, { col: 0, row: 0 }, 300, 0, false,
      undefined, undefined, 0, undefined, undefined, fakeQr);
    expect(generateAsImage).not.toHaveBeenCalled();
    expect(calls.some((c) => c[0] === fakeQr)).toBe(true);
  });
});
