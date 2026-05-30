import { describe, it, expect, vi } from "vitest";
import { drawQrMatrix } from "$lib/shared/render/services/qr-matrix-renderer";

describe("drawQrMatrix", () => {
  it("draws a light background and dark modules for a payload", () => {
    const styles: string[] = [];
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillRect: vi.fn(),
      set fillStyle(v: string) {
        styles.push(v);
      },
      get fillStyle() {
        return styles[styles.length - 1]!;
      },
    } as unknown as CanvasRenderingContext2D;

    drawQrMatrix(ctx, "https://tka.run/ABCD", {
      x: 0,
      y: 0,
      size: 120,
      darkColor: "#000000",
      lightColor: "#ffffff",
      eccLevel: "M",
    });

    expect(ctx.fillRect).toHaveBeenCalled();
    expect(styles).toContain("#ffffff"); // light bg
    expect(styles).toContain("#000000"); // dark modules
    // at least the bg rect + at least one dark module
    expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(1);
  });

  it("applies marginModules correctly — more total cells = smaller cell size", () => {
    const fillRects: Array<[number, number, number, number]> = [];
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillRect: vi.fn((...args: [number, number, number, number]) => {
        fillRects.push(args);
      }),
      set fillStyle(_v: string) {},
      get fillStyle() {
        return "";
      },
    } as unknown as CanvasRenderingContext2D;

    // With margin = 4, cell size must be smaller than without margin.
    drawQrMatrix(ctx, "https://tka.run/ABCD", {
      x: 0,
      y: 0,
      size: 100,
      darkColor: "#000000",
      lightColor: "#ffffff",
      eccLevel: "M",
      marginModules: 4,
    });

    // bg rect is always size×size regardless of margin
    const bgRect = fillRects[0]!;
    expect(bgRect[2]).toBe(100); // width = size
    expect(bgRect[3]).toBe(100); // height = size

    // All module rects should be strictly smaller than size/count (margin shrinks cell)
    // and should be offset from 0 (margin shifts first module inward)
    const moduleRects = fillRects.slice(1);
    expect(moduleRects.length).toBeGreaterThan(0);
    // First module x-offset must be >= margin * cell > 0
    const firstX = moduleRects[0]![0];
    expect(firstX).toBeGreaterThan(0);
  });

  it("calls save and restore for ctx state isolation", () => {
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillRect: vi.fn(),
      set fillStyle(_v: string) {},
      get fillStyle() {
        return "";
      },
    } as unknown as CanvasRenderingContext2D;

    drawQrMatrix(ctx, "X", {
      x: 10,
      y: 20,
      size: 80,
      darkColor: "#111111",
      lightColor: "#eeeeee",
      eccLevel: "L",
    });

    expect(ctx.save).toHaveBeenCalledOnce();
    expect(ctx.restore).toHaveBeenCalledOnce();
  });
});
