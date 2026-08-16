import { describe, it, expect, vi } from "vitest";
import {
  calculateHeaderWordSideInset,
  renderHeader,
} from "../src/header-renderer.js";
import type { GlyphImageData, LOOPComponentId } from "../src/types.js";

function createMockCtx() {
  return {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    font: "",
    textAlign: "",
    textBaseline: "",
    shadowColor: "",
    shadowBlur: 0,
    shadowOffsetY: 0,
    fillRect: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    closePath: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    measureText: vi.fn(() => ({ width: 50 })),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    drawImage: vi.fn(),
    roundRect: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

describe("renderHeader", () => {
  it("draws header background in dark mode", () => {
    const ctx = createMockCtx();
    renderHeader(ctx, {
      canvasWidth: 900,
      headerHeight: 100,
      word: "TEST",
      darkMode: true,
    });
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 900, 100);
  });

  it("draws word text centered", () => {
    const ctx = createMockCtx();
    renderHeader(ctx, {
      canvasWidth: 900,
      headerHeight: 100,
      word: "SSSS",
      darkMode: true,
    });
    expect(ctx.fillText).toHaveBeenCalledWith("SSSS", 450, 50);
  });

  it("draws difficulty badge with linear gradient", () => {
    const ctx = createMockCtx();
    renderHeader(ctx, {
      canvasWidth: 900,
      headerHeight: 100,
      word: "TEST",
      difficultyLevel: 1,
      showDifficultyBadge: true,
    });
    expect(ctx.createLinearGradient).toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalled();
  });

  it("uses a surface-specific indicator size scale", () => {
    const ctx = createMockCtx();
    renderHeader(ctx, {
      canvasWidth: 678,
      headerHeight: 90,
      word: "TEST",
      indicatorSizeScale: 8 / 15,
    });

    expect(ctx.arc).toHaveBeenCalledWith(
      expect.any(Number),
      45,
      24,
      0,
      2 * Math.PI
    );
  });

  it("skips difficulty badge when disabled", () => {
    const ctx = createMockCtx();
    renderHeader(ctx, {
      canvasWidth: 900,
      headerHeight: 100,
      word: "TEST",
      showDifficultyBadge: false,
    });
    expect(ctx.createLinearGradient).not.toHaveBeenCalled();
  });

  describe("glyph word rendering", () => {
    function makeGlyphImage(w = 80, h = 100, isDash = false): GlyphImageData {
      return {
        image: {} as CanvasImageSource,
        naturalWidth: w,
        naturalHeight: h,
        isDash,
      };
    }

    it("calls drawImage for each letter when glyphImages is provided", () => {
      const ctx = createMockCtx();
      const glyphImages = new Map<string, GlyphImageData>([
        ["A", makeGlyphImage()],
        ["B", makeGlyphImage()],
      ]);
      renderHeader(ctx, {
        canvasWidth: 900,
        headerHeight: 100,
        word: "AB",
        darkMode: true,
        glyphImages,
      });
      expect(ctx.drawImage).toHaveBeenCalledTimes(2);
    });

    it("does not call fillText for the word when glyphImages is provided", () => {
      const ctx = createMockCtx();
      const glyphImages = new Map<string, GlyphImageData>([
        ["A", makeGlyphImage()],
      ]);
      renderHeader(ctx, {
        canvasWidth: 900,
        headerHeight: 100,
        word: "A",
        darkMode: true,
        glyphImages,
      });
      const wordCall = (
        ctx.fillText as ReturnType<typeof vi.fn>
      ).mock.calls.find((args) => args[0] === "A");
      expect(wordCall).toBeUndefined();
    });

    it("does not apply a browser filter to pre-colored Node glyphs", () => {
      const ctx = createMockCtx();
      const glyphImages = new Map<string, GlyphImageData>([
        ["A", makeGlyphImage()],
      ]);
      renderHeader(ctx, {
        canvasWidth: 900,
        headerHeight: 100,
        word: "A",
        darkMode: true,
        glyphImages,
        glyphImagesAreThemeColored: true,
      });
      expect(ctx.save).not.toHaveBeenCalled();
      expect(ctx.restore).not.toHaveBeenCalled();
      expect(ctx.drawImage).toHaveBeenCalledTimes(1);
    });

    it("calls roundRect for dash letters", () => {
      const ctx = createMockCtx();
      const glyphImages = new Map<string, GlyphImageData>([
        ["W-", makeGlyphImage(80, 100, true)],
      ]);
      renderHeader(ctx, {
        canvasWidth: 900,
        headerHeight: 100,
        word: "W-",
        darkMode: true,
        glyphImages,
      });
      expect(ctx.roundRect).toHaveBeenCalled();
      expect(ctx.fill).toHaveBeenCalled();
    });

    it("does not call drawImage when glyphImages is absent", () => {
      const ctx = createMockCtx();
      renderHeader(ctx, {
        canvasWidth: 900,
        headerHeight: 100,
        word: "AB",
        darkMode: true,
      });
      expect(ctx.drawImage).not.toHaveBeenCalled();
    });

    it("renders nothing in word slot when word is empty and glyphImages provided", () => {
      const ctx = createMockCtx();
      const glyphImages = new Map<string, GlyphImageData>();
      renderHeader(ctx, {
        canvasWidth: 900,
        headerHeight: 100,
        word: "",
        darkMode: true,
        glyphImages,
      });
      expect(ctx.drawImage).not.toHaveBeenCalled();
    });

    it("skips missing letters silently", () => {
      const ctx = createMockCtx();
      const glyphImages = new Map<string, GlyphImageData>([
        ["A", makeGlyphImage()],
      ]);
      renderHeader(ctx, {
        canvasWidth: 900,
        headerHeight: 100,
        word: "AB",
        darkMode: true,
        glyphImages,
      });
      expect(ctx.drawImage).toHaveBeenCalledTimes(1);
    });

    it("shrinks long dashed words inside centered indicator-safe bounds", () => {
      const ctx = createMockCtx();
      const glyphImages = new Map<string, GlyphImageData>([
        ["A", makeGlyphImage()],
        ["W-", makeGlyphImage(80, 100, true)],
        ["B", makeGlyphImage()],
        ["Σ-", makeGlyphImage(80, 100, true)],
        ["C", makeGlyphImage()],
        ["Φ-", makeGlyphImage(80, 100, true)],
        ["D", makeGlyphImage()],
        ["τ-", makeGlyphImage(80, 100, true)],
      ]);
      const loopComponents = new Set<LOOPComponentId>(["mirrored", "inverted"]);
      const canvasWidth = 678;
      const headerHeight = 90;
      const indicatorSizeScale = 8 / 15;

      renderHeader(ctx, {
        canvasWidth,
        headerHeight,
        word: "AW-BΣ-CΦ-Dτ-",
        indicatorSizeScale,
        loopComponents,
        glyphImages,
      });

      const glyphCalls = (ctx.drawImage as ReturnType<typeof vi.fn>).mock.calls;
      const dashCalls = (ctx.roundRect as ReturnType<typeof vi.fn>).mock.calls;
      const firstGlyphLeft = glyphCalls[0]![1] as number;
      const lastDash = dashCalls.at(-1)!;
      const wordRight = (lastDash[0] as number) + (lastDash[2] as number);
      const sideInset = calculateHeaderWordSideInset({
        headerHeight,
        indicatorSizeScale,
        loopComponents,
      });

      expect(glyphCalls).toHaveLength(8);
      expect(firstGlyphLeft).toBeGreaterThanOrEqual(sideInset - 0.01);
      expect(wordRight).toBeLessThanOrEqual(canvasWidth - sideInset + 0.01);
      expect((firstGlyphLeft + wordRight) / 2).toBeCloseTo(canvasWidth / 2, 5);
      expect(glyphCalls[0]![4]).toBeLessThan(headerHeight * 0.65);
    });
  });
});
