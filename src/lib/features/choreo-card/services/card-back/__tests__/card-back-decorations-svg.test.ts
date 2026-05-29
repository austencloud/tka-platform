import { describe, it, expect } from "vitest";
import { buildDecorationsSVG } from "../card-back-decorations-svg";

const W = 1644;
const H = 2244;

// Shared structural assertions for every theme
function assertSharedStructure(svg: string, theme: string) {
  expect(svg, `${theme}: must start with <svg`).toMatch(/^<svg/);
  expect(svg, `${theme}: must end with </svg>`).toMatch(/<\/svg>$/);
  expect(svg, `${theme}: must have a single root`).not.toMatch(/<\/svg>.*<svg/s);
  expect(svg, `${theme}: must carry width="${W}"`).toContain(`width="${W}"`);
  expect(svg, `${theme}: must carry viewBox="0 0 500 700"`).toContain(`viewBox="0 0 500 700"`);
  expect(svg, `${theme}: must carry preserveAspectRatio="none"`).toContain(`preserveAspectRatio="none"`);
}

describe("buildDecorationsSVG — structural correctness", () => {
  const themes = ["cosmic", "ocean", "winter", "ember", "blossom", "forest", "autumn", "rainbow"];

  for (const theme of themes) {
    it(`${theme}: is a single-root <svg>…</svg> string with correct dimensions`, () => {
      const svg = buildDecorationsSVG(theme, W, H);
      assertSharedStructure(svg, theme);
    });
  }
});

describe("buildDecorationsSVG — theme signature markers", () => {
  it("cosmic: contains aurora-ray gradient and coma-glow gradient", () => {
    const svg = buildDecorationsSVG("cosmic", W, H);
    expect(svg).toContain("aurora-ray");
    expect(svg).toContain("coma-glow");
  });

  it("ocean: contains f1-body gradient and jelly-glow gradient", () => {
    const svg = buildDecorationsSVG("ocean", W, H);
    expect(svg).toContain("f1-body");
    expect(svg).toContain("jelly-glow");
  });

  it("winter: contains stroke=\"white\" (snowflake branches)", () => {
    const svg = buildDecorationsSVG("winter", W, H);
    expect(svg).toContain('stroke="white"');
  });

  it("ember: contains #ea580c (ember / coal-bed color)", () => {
    const svg = buildDecorationsSVG("ember", W, H);
    expect(svg).toContain("#ea580c");
  });

  it("blossom: contains #f9a8d4 (petal pink)", () => {
    const svg = buildDecorationsSVG("blossom", W, H);
    expect(svg).toContain("#f9a8d4");
  });

  it("forest: contains #0d3320 (dark tree trunk stroke)", () => {
    const svg = buildDecorationsSVG("forest", W, H);
    expect(svg).toContain("#0d3320");
  });

  it("autumn: contains a leaf <path with a fill= leaf color", () => {
    const svg = buildDecorationsSVG("autumn", W, H);
    // At least one <path with fill= a leaf color must be present
    expect(svg).toMatch(/<path[^>]*fill="#(?:D4A017|CC5500|8B0000|DAA520|CD5C5C|D2691E|6B4423)"/);
  });

  it("rainbow: SVG wrapper is present but contains no decoration elements", () => {
    const svg = buildDecorationsSVG("rainbow", W, H);
    // Wrapper present
    expect(svg).toMatch(/^<svg[^>]*><\/svg>$/);
    // No child elements
    expect(svg).not.toMatch(/<(path|circle|ellipse|line|rect|g|defs)\b/);
  });
});

describe("buildDecorationsSVG — unknown theme", () => {
  it("unknown theme returns the bare SVG wrapper with no child elements", () => {
    const svg = buildDecorationsSVG("galactic", W, H);
    assertSharedStructure(svg, "galactic");
    expect(svg).toMatch(/^<svg[^>]*><\/svg>$/);
  });
});
