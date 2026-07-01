/**
 * Guards the SW precache manifest generator (scripts/generate-svg-precache-manifest.cjs)
 * that feeds the install-time pictograph SVG precache (offline audit 2026-06-30 fix #1).
 * A silent regression here (wrong path separators, missing the grid probe) would
 * leave pictographs blank offline without any visible error.
 */
import { describe, it, expect } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { collectAssets } = require("../../scripts/generate-svg-precache-manifest.cjs") as {
  collectAssets: () => string[];
};

describe("svg precache manifest generator", () => {
  const assets = collectAssets();

  it("collects the essential pictograph SVG set", () => {
    // grid(7) + pictograph props(~46) + arrows(~63) + letters(~60) + numbers(7) + vtg(7)
    expect(assets.length).toBeGreaterThan(150);
  });

  it("includes the offline-render probe grid SVG", () => {
    // checkPropSvgsCached() probes this exact path to gauge offline readiness.
    expect(assets).toContain("/images/grid/diamond_grid.svg");
  });

  it("emits only root-relative, forward-slashed /images URLs", () => {
    for (const a of assets) {
      expect(a.startsWith("/images/")).toBe(true);
      expect(a).not.toContain("\\");
    }
  });

  it("is sorted and deduped", () => {
    expect(assets).toEqual([...assets].sort());
    expect(new Set(assets).size).toBe(assets.length);
  });
});
