import { describe, it, expect, vi } from "vitest";
import { renderHeader } from "../src/header-renderer.js";

function createMockCtx() {
  return {
    fillStyle: "", strokeStyle: "", lineWidth: 0, font: "",
    textAlign: "", textBaseline: "", shadowColor: "", shadowBlur: 0, shadowOffsetY: 0,
    fillRect: vi.fn(), fillText: vi.fn(), strokeText: vi.fn(),
    beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
    arc: vi.fn(), stroke: vi.fn(), fill: vi.fn(), closePath: vi.fn(),
    save: vi.fn(), restore: vi.fn(), measureText: vi.fn(() => ({ width: 50 })),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  } as unknown as CanvasRenderingContext2D;
}

describe("renderHeader", () => {
  it("draws header background in dark mode", () => {
    const ctx = createMockCtx();
    renderHeader(ctx, { canvasWidth: 900, headerHeight: 100, word: "TEST", darkMode: true });
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 900, 100);
  });

  it("draws word text centered", () => {
    const ctx = createMockCtx();
    renderHeader(ctx, { canvasWidth: 900, headerHeight: 100, word: "SSSS", darkMode: true });
    expect(ctx.fillText).toHaveBeenCalledWith("SSSS", 450, 50);
  });

  it("draws difficulty badge with linear gradient", () => {
    const ctx = createMockCtx();
    renderHeader(ctx, { canvasWidth: 900, headerHeight: 100, word: "TEST", difficultyLevel: 1, showDifficultyBadge: true });
    expect(ctx.createLinearGradient).toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalled();
  });

  it("skips difficulty badge when disabled", () => {
    const ctx = createMockCtx();
    renderHeader(ctx, { canvasWidth: 900, headerHeight: 100, word: "TEST", showDifficultyBadge: false });
    expect(ctx.createLinearGradient).not.toHaveBeenCalled();
  });
});
