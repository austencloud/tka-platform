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

  it("renders default brand name when no notes provided", () => {
    const ctx = createMockCtx();
    renderFooter(ctx, { canvasWidth: 900, canvasHeight: 1000, footerHeight: 50, showNotes: true });
    expect(ctx.fillText).toHaveBeenCalledWith("The Kinetic Alphabet", 450, expect.any(Number));
  });

  it("renders non-personal labels in the outer lanes", () => {
    const ctx = createMockCtx();
    renderFooter(ctx, {
      canvasWidth: 900,
      canvasHeight: 1000,
      footerHeight: 50,
      leftLabel: "VTG SS 1:1",
      rightLabel: "1:1",
      showNotes: false,
    });
    const calls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
    const leftLabelRendered = calls.some(([text]: [string]) => text === "VTG SS 1:1");
    const rightLabelRendered = calls.some(([text]: [string]) => text === "1:1");
    expect(leftLabelRendered).toBe(true);
    expect(rightLabelRendered).toBe(true);
  });
});
