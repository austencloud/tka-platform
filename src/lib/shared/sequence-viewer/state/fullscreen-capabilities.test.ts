import { describe, it, expect, vi, afterEach } from "vitest";
import {
  supportsNativeFullscreen,
  requestNativeFullscreen,
  exitNativeFullscreen,
} from "./fullscreen-capabilities";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("supportsNativeFullscreen", () => {
  it("is false when the element exposes no fullscreen method (iPhone Safari)", () => {
    const el = {} as HTMLElement;
    expect(supportsNativeFullscreen(el)).toBe(false);
  });

  it("is true when requestFullscreen exists", () => {
    const el = { requestFullscreen: () => Promise.resolve() } as unknown as HTMLElement;
    expect(supportsNativeFullscreen(el)).toBe(true);
  });

  it("is true when the webkit-prefixed method exists", () => {
    const el = { webkitRequestFullscreen: () => undefined } as unknown as HTMLElement;
    expect(supportsNativeFullscreen(el)).toBe(true);
  });
});

describe("requestNativeFullscreen", () => {
  it("calls requestFullscreen and resolves true", async () => {
    const fn = vi.fn(() => Promise.resolve());
    const el = { requestFullscreen: fn } as unknown as HTMLElement;
    await expect(requestNativeFullscreen(el)).resolves.toBe(true);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("returns false when unsupported (no throw)", async () => {
    const el = {} as HTMLElement;
    await expect(requestNativeFullscreen(el)).resolves.toBe(false);
  });

  it("returns false when the request rejects (user gesture / permission)", async () => {
    const el = { requestFullscreen: () => Promise.reject(new Error("denied")) } as unknown as HTMLElement;
    await expect(requestNativeFullscreen(el)).resolves.toBe(false);
  });
});

describe("exitNativeFullscreen", () => {
  it("no-ops without throwing when nothing is fullscreen", async () => {
    vi.stubGlobal("document", {});
    await expect(exitNativeFullscreen()).resolves.toBeUndefined();
  });
});
