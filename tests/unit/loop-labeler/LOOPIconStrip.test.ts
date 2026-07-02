/**
 * Icon-picker logic for period-aware rotated glyphs.
 *
 * The Svelte component LOOPIconStrip.svelte and the canvas renderer
 * renderLoopIconStrip() both have to agree on: "when rotationPeriod is
 * quartered, the rotated slot draws fa-arrows-spin instead of fa-rotate."
 * If these ever drift the live app will show one icon and the exported
 * image a different one.
 *
 * We can't mount Svelte components in this project's test environment —
 * `document.createElement` is globally stubbed for canvas testing (see
 * tests/setup/vitest-setup.ts), so any `mount()` call fails. Instead we
 * test the shared decision rule inside the render-composition package,
 * which the Svelte component mirrors internally. If someone changes the
 * canvas rule they must update the component to match (or this test
 * breaks the integration).
 */

import { describe, it, expect, vi } from "vitest";
import { renderLoopIconStrip } from "@tka/render-composition";

/**
 * Minimal fake Canvas 2D context. renderLoopIconStrip only touches the
 * methods needed to fill a path and apply shadows. We record every fill()
 * call's current `fillStyle` plus a running command count so we can tell
 * the halved and quartered rotated paths apart (they have different
 * numbers of SVG commands).
 */
function makeFakeCtx() {
  const calls: {
    op: string;
    fillStyle?: string;
    drawOps?: number;
  }[] = [];
  let drawOpsThisPath = 0;

  let fillStyle = "";
  let shadowColor = "";
  let shadowBlur = 0;
  let shadowOffsetY = 0;

  const recordDraw = () => {
    drawOpsThisPath++;
  };

  const ctx: Partial<CanvasRenderingContext2D> = {
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(v) {
      fillStyle = String(v);
    },
    get shadowColor() {
      return shadowColor;
    },
    set shadowColor(v) {
      shadowColor = v;
    },
    get shadowBlur() {
      return shadowBlur;
    },
    set shadowBlur(v) {
      shadowBlur = v;
    },
    get shadowOffsetY() {
      return shadowOffsetY;
    },
    set shadowOffsetY(v) {
      shadowOffsetY = v;
    },
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(() => {
      drawOpsThisPath = 0;
    }),
    moveTo: vi.fn(recordDraw),
    lineTo: vi.fn(recordDraw),
    bezierCurveTo: vi.fn(recordDraw),
    quadraticCurveTo: vi.fn(recordDraw),
    arc: vi.fn(recordDraw),
    closePath: vi.fn(recordDraw),
    fill: vi.fn(() => {
      calls.push({ op: "fill", fillStyle, drawOps: drawOpsThisPath });
    }),
  };

  return { ctx: ctx as CanvasRenderingContext2D, calls };
}

describe("renderLoopIconStrip period picker", () => {
  it("draws the rotated color when ROTATED is active (any period)", () => {
    const { ctx, calls } = makeFakeCtx();
    const components = new Set(["rotated" as const]);

    renderLoopIconStrip(ctx, components, 100, 50, 20, true, false);

    // One fill call total — and it uses the rotated brand color.
    expect(calls.some((c) => c.fillStyle === "#36c3ff")).toBe(true);
    expect(calls.length).toBe(1);
  });

  it("draws a distinct icon path for quartered rotation (fa-arrows-spin vs fa-rotate)", () => {
    // Halved (default) draws fa-rotate. Quartered draws fa-arrows-spin.
    // Those two SVG paths have different command counts, so the recorded
    // drawOps on the fill call must differ. If they ever match, the
    // slice-size branch inside renderLoopIconStrip got broken.
    const halved = makeFakeCtx();
    renderLoopIconStrip(
      halved.ctx,
      new Set(["rotated" as const]),
      100,
      50,
      20,
      true,
      false,
      "halved"
    );

    const quartered = makeFakeCtx();
    renderLoopIconStrip(
      quartered.ctx,
      new Set(["rotated" as const]),
      100,
      50,
      20,
      true,
      false,
      "quartered"
    );

    expect(halved.calls).toHaveLength(1);
    expect(quartered.calls).toHaveLength(1);
    const halvedOps = halved.calls[0]?.drawOps ?? 0;
    const quarteredOps = quartered.calls[0]?.drawOps ?? 0;
    expect(halvedOps).toBeGreaterThan(0);
    expect(quarteredOps).toBeGreaterThan(0);
    expect(quarteredOps).not.toBe(halvedOps);
  });

  it("defaults to the halved rotated path when period is omitted", () => {
    const omitted = makeFakeCtx();
    renderLoopIconStrip(
      omitted.ctx,
      new Set(["rotated" as const]),
      100,
      50,
      20,
      true,
      false
    );
    const halved = makeFakeCtx();
    renderLoopIconStrip(
      halved.ctx,
      new Set(["rotated" as const]),
      100,
      50,
      20,
      true,
      false,
      "halved"
    );

    // Undefined period and "halved" must render the same glyph so
    // existing call sites that haven't been updated yet don't regress.
    expect(omitted.calls[0]?.drawOps).toBe(halved.calls[0]?.drawOps);
  });

  it("renders all active components exactly once regardless of period", () => {
    const { ctx, calls } = makeFakeCtx();
    const components = new Set(["rotated" as const, "swapped" as const]);

    renderLoopIconStrip(ctx, components, 100, 50, 20, true, false, "quartered");

    // rotated = 1 fill, swapped = 1 fill → 2 total (both single-hue).
    expect(calls.length).toBe(2);
    // Rotated's brand color + swapped's emerald.
    const colors = calls.map((c) => c.fillStyle);
    expect(colors).toContain("#36c3ff");
    expect(colors).toContain("#2ecc71");
  });

  it("returns totalWidth accounting for all active icons and gaps", () => {
    const { ctx } = makeFakeCtx();
    const components = new Set(["rotated" as const, "swapped" as const]);

    const result = renderLoopIconStrip(
      ctx,
      components,
      100,
      50,
      20,
      true,
      false,
      "quartered"
    );

    // 2 icons × 20px + 1 gap = 40 + ≥2.
    expect(result.totalWidth).toBeGreaterThanOrEqual(42);
  });

  it("draws a distinct icon path for quartered inversion (checkerboard vs circle-half)", () => {
    const halved = makeFakeCtx();
    renderLoopIconStrip(
      halved.ctx,
      new Set(["inverted" as const]),
      100, 50, 20, true, false,
      undefined, "halved"
    );

    const quartered = makeFakeCtx();
    renderLoopIconStrip(
      quartered.ctx,
      new Set(["inverted" as const]),
      100, 50, 20, true, false,
      undefined, "quartered"
    );

    expect(halved.calls).toHaveLength(1);
    expect(quartered.calls).toHaveLength(1);
    const halvedOps = halved.calls[0]?.drawOps ?? 0;
    const quarteredOps = quartered.calls[0]?.drawOps ?? 0;
    expect(halvedOps).toBeGreaterThan(0);
    expect(quarteredOps).toBeGreaterThan(0);
    expect(quarteredOps).not.toBe(halvedOps);
  });

  it("defaults to the halved inverted path when inversionPeriod is omitted", () => {
    const omitted = makeFakeCtx();
    renderLoopIconStrip(
      omitted.ctx,
      new Set(["inverted" as const]),
      100, 50, 20, true, false
    );
    const halved = makeFakeCtx();
    renderLoopIconStrip(
      halved.ctx,
      new Set(["inverted" as const]),
      100, 50, 20, true, false,
      undefined, "halved"
    );

    expect(omitted.calls[0]?.drawOps).toBe(halved.calls[0]?.drawOps);
  });

  it("draws the inverted color for both halved and quartered inversion", () => {
    const { ctx, calls } = makeFakeCtx();
    renderLoopIconStrip(
      ctx,
      new Set(["inverted" as const]),
      100, 50, 20, true, false,
      undefined, "quartered"
    );

    expect(calls.some((c) => c.fillStyle === "#eb7d00")).toBe(true);
  });
});
