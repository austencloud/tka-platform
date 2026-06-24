import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GlyphImageData } from "@tka/render-composition";

// Mock getGlyphCache before importing TextRenderer
vi.mock("$lib/shared/render/get-glyph-cache", () => ({
  getGlyphCache: () => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    getGlyphDataUrl: (letter: string) => {
      const known = ["A", "B", "W", "W-", "Σ"];
      return known.includes(letter)
        ? `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iMTAwIi8+`
        : null;
    },
    isReady: () => true,
  }),
}));

// Mock Image constructor to auto-fire onload with fixed dimensions
class MockImage {
  naturalWidth = 80;
  naturalHeight = 100;
  onload: (() => void) | null = null;
  set src(_: string) {
    Promise.resolve().then(() => this.onload?.());
  }
}

vi.stubGlobal("Image", MockImage);

// Import AFTER mocks are set up
const { TextRenderer } = await import(
  "$lib/shared/render/services/text-renderer"
);

describe("TextRenderer glyph methods", () => {
  let renderer: InstanceType<typeof TextRenderer>;

  beforeEach(async () => {
    renderer = new TextRenderer();
    await renderer.preloadGlyphImages();
  });

  it("preloadGlyphImages populates glyphImageCache for known letters", () => {
    const map = renderer.buildGlyphMap("AB");
    expect(map.size).toBe(2);
    expect(map.has("A")).toBe(true);
    expect(map.has("B")).toBe(true);
  });

  it("buildGlyphMap returns GlyphImageData with correct isDash=false for plain letters", () => {
    const map = renderer.buildGlyphMap("A");
    const entry = map.get("A")!;
    expect(entry.isDash).toBe(false);
    expect(entry.naturalWidth).toBe(80);
    expect(entry.naturalHeight).toBe(100);
  });

  it("buildGlyphMap sets isDash=true for dash letters", () => {
    const map = renderer.buildGlyphMap("W-");
    const entry = map.get("W-")!;
    expect(entry).toBeDefined();
    expect(entry.isDash).toBe(true);
  });

  it("buildGlyphMap silently omits letters not in cache", () => {
    const map = renderer.buildGlyphMap("AZ");
    expect(map.has("A")).toBe(true);
    expect(map.has("Z")).toBe(false);
  });

  it("buildGlyphMap handles empty word", () => {
    const map = renderer.buildGlyphMap("");
    expect(map.size).toBe(0);
  });
});
