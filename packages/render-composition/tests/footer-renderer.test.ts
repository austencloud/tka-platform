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

  it("renders default brand name when no notes provided", () => {
    const ctx = createMockCtx();
    renderFooter(ctx, { canvasWidth: 900, canvasHeight: 1000, footerHeight: 50, showNotes: true });
    expect(ctx.fillText).toHaveBeenCalledWith("The Kinetic Alphabet", 450, expect.any(Number));
  });

  it("renders year only for date", () => {
    const ctx = createMockCtx();
    const bday = new Date(2026, 2, 28); // March 28, 2026
    renderFooter(ctx, { canvasWidth: 900, canvasHeight: 1000, footerHeight: 50, birthday: bday, showBirthday: true });
    expect(ctx.fillText).toHaveBeenCalledWith("2026", expect.any(Number), expect.any(Number));
  });

  it("suppresses creator name for system authors", () => {
    const ctx = createMockCtx();
    renderFooter(ctx, { canvasWidth: 900, canvasHeight: 1000, footerHeight: 50, userName: "TKA Enumerator", showCreatorName: true });
    // Should NOT render "TKA Enumerator" as creator name
    const calls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
    const userNameRendered = calls.some(([text]: [string]) => text === "TKA Enumerator");
    expect(userNameRendered).toBe(false);
  });

  it("renders leftLabel instead of username when provided", () => {
    const ctx = createMockCtx();
    renderFooter(ctx, { canvasWidth: 900, canvasHeight: 1000, footerHeight: 50, userName: "Austen Cloud", leftLabel: "VTG SS 1:1", showCreatorName: true });
    const calls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
    const leftLabelRendered = calls.some(([text]: [string]) => text === "VTG SS 1:1");
    const userNameRendered = calls.some(([text]: [string]) => text === "Austen Cloud");
    expect(leftLabelRendered).toBe(true);
    expect(userNameRendered).toBe(false);
  });
});
