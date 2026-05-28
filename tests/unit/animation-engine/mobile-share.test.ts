import { describe, it, expect, vi, beforeEach } from "vitest";
import { downloadBlob } from "$lib/shared/foundation/services/file-downloader";

describe("downloadBlob with Web Share API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("uses navigator.share when available and canShare returns true", async () => {
    const shareFn = vi.fn().mockResolvedValue(undefined);
    const canShareFn = vi.fn().mockReturnValue(true);

    Object.defineProperty(globalThis, "navigator", {
      value: { share: shareFn, canShare: canShareFn },
      writable: true,
      configurable: true,
    });

    const blob = new Blob(["video"], { type: "video/mp4" });
    const result = await downloadBlob(blob, "test.mp4");

    expect(canShareFn).toHaveBeenCalled();
    expect(shareFn).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it("falls back to anchor download when navigator.share is absent", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {},
      writable: true,
      configurable: true,
    });

    const clickFn = vi.fn();
    vi.spyOn(document, "createElement").mockReturnValue({
      set href(_: string) {},
      set download(_: string) {},
      style: {},
      click: clickFn,
    } as any);
    vi.spyOn(document.body, "appendChild").mockReturnValue({} as any);
    vi.spyOn(document.body, "removeChild").mockReturnValue({} as any);

    const blob = new Blob(["video"], { type: "video/mp4" });
    const result = await downloadBlob(blob, "test.mp4");

    expect(clickFn).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it("catches AbortError from dismissed share sheet", async () => {
    const abortError = new DOMException("Share canceled", "AbortError");
    const shareFn = vi.fn().mockRejectedValue(abortError);
    const canShareFn = vi.fn().mockReturnValue(true);

    Object.defineProperty(globalThis, "navigator", {
      value: { share: shareFn, canShare: canShareFn },
      writable: true,
      configurable: true,
    });

    const blob = new Blob(["video"], { type: "video/mp4" });
    const result = await downloadBlob(blob, "test.mp4");

    expect(result.success).toBe(true);
  });
});
