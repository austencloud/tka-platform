import { describe, it, expect } from "vitest";
import { StickerUnitRenderer } from "$lib/features/sticker-lab/services/implementations/StickerUnitRenderer";
import { createDefaultStickerUnit } from "$lib/features/sticker-lab/domain/sticker-types";
import type { MandalaPaths } from "$lib/shared/mandala/domain/mandala-types";
import {
  STICKER_TILE_SIZE_PX,
  STICKER_ART_DIAMETER_PX,
} from "$lib/features/sticker-lab/domain/sticker-constants";

const emptyPaths: MandalaPaths = { blue: [], red: [], purple: [] };

describe("StickerUnitRenderer", () => {
  const renderer = new StickerUnitRenderer();

  it("renders an SVG at the full tile size (art + bleed)", () => {
    const unit = createDefaultStickerUnit({ sourceLoop: null });
    const svg = renderer.renderSVG(unit, emptyPaths);
    expect(svg).toContain(`viewBox="0 0 ${STICKER_TILE_SIZE_PX} ${STICKER_TILE_SIZE_PX}"`);
  });

  it("transparent background produces no background rect", () => {
    const unit = createDefaultStickerUnit({ sourceLoop: null, background: "transparent" });
    const svg = renderer.renderSVG(unit, emptyPaths);
    expect(svg).not.toMatch(/<rect[^>]*fill="#ffffff"/i);
    expect(svg).not.toMatch(/url\(#sticker-bg-gradient/);
  });

  it("white background produces a solid white circle at art diameter", () => {
    const unit = createDefaultStickerUnit({ sourceLoop: null, background: "white" });
    const svg = renderer.renderSVG(unit, emptyPaths);
    expect(svg).toMatch(/<circle[^>]*fill="#ffffff"/i);
    expect(svg).toContain(`r="${STICKER_ART_DIAMETER_PX / 2}"`);
  });

  it("radial-gradient background defines a gradient and uses it as fill", () => {
    const unit = createDefaultStickerUnit({ sourceLoop: null, background: "radial-gradient" });
    const svg = renderer.renderSVG(unit, emptyPaths);
    expect(svg).toContain("<radialGradient");
    expect(svg).toMatch(/fill="url\(#sticker-bg-gradient[^)]*\)"/);
  });

  it("variant=blue passes show=blue to the mandala renderer", () => {
    const unit = createDefaultStickerUnit({ sourceLoop: null, variant: "blue" });
    const svg = renderer.renderSVG(unit, {
      blue: [{ d: "M0 0 L10 10", tipIndex: 0 }],
      red: [{ d: "M0 0 L20 20", tipIndex: 0 }],
      purple: [],
    });
    // Only blue path (from position coordinates) should appear. Red should not.
    expect(svg).toContain("M0 0 L10 10");
    expect(svg).not.toContain("M0 0 L20 20");
  });

  it("variant=red renders only the red path", () => {
    const unit = createDefaultStickerUnit({ sourceLoop: null, variant: "red" });
    const svg = renderer.renderSVG(unit, {
      blue: [{ d: "M0 0 L10 10", tipIndex: 0 }],
      red: [{ d: "M0 0 L20 20", tipIndex: 0 }],
      purple: [],
    });
    expect(svg).not.toContain("M0 0 L10 10");
    expect(svg).toContain("M0 0 L20 20");
  });

  it("variant=full renders blue, red, and purple paths", () => {
    const unit = createDefaultStickerUnit({ sourceLoop: null, variant: "full" });
    const svg = renderer.renderSVG(unit, {
      blue: [{ d: "M0 0 L10 10", tipIndex: 0 }],
      red: [{ d: "M0 0 L20 20", tipIndex: 0 }],
      purple: [{ d: "M0 0 L30 30", tipIndex: 0 }],
    });
    expect(svg).toContain("M0 0 L10 10");
    expect(svg).toContain("M0 0 L20 20");
    expect(svg).toContain("M0 0 L30 30");
  });
});
