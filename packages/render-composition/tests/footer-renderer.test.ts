import { describe, it, expect, vi } from "vitest";
import { renderFooter } from "../src/footer-renderer.js";

function createMockCtx() {
  return {
    fillStyle: "", strokeStyle: "", lineWidth: 0, font: "",
    textAlign: "", textBaseline: "",
    fillRect: vi.fn(), fillText: vi.fn(),
    beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
    measureText: vi.fn(() => ({ width: 50 })),
  } as unknown as CanvasRenderingContext2D;
}

describe("renderFooter", () => {
  it("draws footer at bottom of canvas", () => {
    const ctx = createMockCtx();
    renderFooter(ctx, { canvasWidth: 900, canvasHeight: 1000, footerHeight: 50 });
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 950, 900, 50);
  });

  it("renders username left-aligned", () => {
    const ctx = createMockCtx();
    renderFooter(ctx, { canvasWidth: 900, canvasHeight: 1000, footerHeight: 50, userName: "Austen Cloud", showCreatorName: true });
    expect(ctx.fillText).toHaveBeenCalledWith("Austen Cloud", expect.any(Number), expect.any(Number));
  });

  it("renders default notes when none provided", () => {
    const ctx = createMockCtx();
    renderFooter(ctx, { canvasWidth: 900, canvasHeight: 1000, footerHeight: 50, showNotes: true });
    expect(ctx.fillText).toHaveBeenCalledWith("Created using TKA Composer", 450, expect.any(Number));
  });

  it("formats birthday with cake emoji", () => {
    const ctx = createMockCtx();
    const bday = new Date(2026, 2, 28); // March 28, 2026
    renderFooter(ctx, { canvasWidth: 900, canvasHeight: 1000, footerHeight: 50, birthday: bday, showBirthday: true });
    expect(ctx.fillText).toHaveBeenCalledWith("🎂 3-28-2026", expect.any(Number), expect.any(Number));
  });
});
