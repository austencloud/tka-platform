/**
 * Static contract test for the GalleryDrill split.
 *
 * GalleryDrill.svelte was one 6,248-line file holding two nearly-disjoint
 * products. It is now a thin shell that dispatches to GalleryLanding (the
 * editorial front door) or GalleryWorkspace (the filter workspace), with a
 * single shared CategoryTile rendered by both. This test locks that split at
 * the source level so the two products cannot silently grow back into each
 * other — the same anti-drift pattern as
 * `tests/unit/sequence-viewer-shell-contract.test.ts`.
 *
 * If this test fails, move the rule/markup to the product that owns it — do
 * not loosen the assertions.
 *
 * Spec: docs/superpowers/specs/2026-08-04-gallery-split-pane-workspace-design.md
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);

const DIR = "src/lib/features/browse/gallery-home";
const DRILL = `${DIR}/GalleryDrill.svelte`;
const LANDING = `${DIR}/GalleryLanding.svelte`;
const WORKSPACE = `${DIR}/GalleryWorkspace.svelte`;
const TILE = `${DIR}/CategoryTile.svelte`;

function read(rel: string): string {
  return readFileSync(path.join(repoRoot, rel), "utf8");
}

/** The `<style>` block's contents, or "" when the component has none. */
function styleBlock(source: string): string {
  const match = source.match(/<style[^>]*>([\s\S]*)<\/style>/);
  return match?.[1] ?? "";
}

describe("GalleryDrill split contract", () => {
  it("GalleryDrill is a thin shell — no product CSS, no product markup", () => {
    const source = read(DRILL);
    const css = styleBlock(source);

    // Landing-owned selectors
    for (const selector of [".hero-", ".choice-tile", ".peek-", ".more-head"]) {
      expect(css, `GalleryDrill still styles ${selector}`).not.toContain(selector);
    }
    // Workspace-owned selectors
    for (const selector of [
      ".unified-choice-grid",
      ".value-list",
      ".level-tile",
      ".length-row",
      ".letter-chip",
      ".turn-picker",
    ]) {
      expect(css, `GalleryDrill still styles ${selector}`).not.toContain(selector);
    }
    // Tile-owned selectors
    for (const selector of [".mini-tile", ".mini-art", ".element-dot"]) {
      expect(css, `GalleryDrill still styles ${selector}`).not.toContain(selector);
    }

    // The shell owns the drill root, the search field, the band and the split
    // pane's two columns — plus a ~120-line documented prop seam. It was 6,248
    // lines; anything approaching that again means the split leaked.
    expect(source.split("\n").length).toBeLessThan(800);
  });

  it("landing and workspace CSS do not overlap", () => {
    const landing = styleBlock(read(LANDING));
    const workspace = styleBlock(read(WORKSPACE));

    // Workspace-only selectors must not appear on the landing.
    for (const selector of [
      ".unified-",
      ".desktop-filter-",
      ".value-list",
      ".level-tile",
      ".length-row",
      ".turn-picker",
    ]) {
      expect(landing, `GalleryLanding styles workspace selector ${selector}`)
        .not.toContain(selector);
    }
    // Landing-only selectors must not appear in the workspace.
    for (const selector of [".hero-grid", ".choice-tile", ".more-head"]) {
      expect(workspace, `GalleryWorkspace styles landing selector ${selector}`)
        .not.toContain(selector);
    }
  });

  it("both products render the one shared CategoryTile", () => {
    for (const rel of [LANDING, WORKSPACE]) {
      const source = read(rel);
      expect(source, `${rel} does not import CategoryTile`).toContain(
        'from "./CategoryTile.svelte"'
      );
      expect(source, `${rel} does not render CategoryTile`).toContain(
        "<CategoryTile"
      );
    }
  });

  it("the tile owns every composition — hosts never restyle its box", () => {
    const tile = styleBlock(read(TILE));
    for (const variant of [".mini-tile.unified", ".mini-tile.rail"]) {
      expect(tile, `CategoryTile is missing the ${variant} composition`)
        .toContain(variant);
    }
    // A host reaching into the tile's own box is the drift this kills.
    const workspace = styleBlock(read(WORKSPACE));
    expect(
      workspace.includes(":global(.mini-title)") ||
        workspace.includes(":global(.mini-art)"),
      "GalleryWorkspace restyles CategoryTile internals"
    ).toBe(false);
  });

  it("GalleryDrill keeps its public prop seam (consumers untouched)", () => {
    const source = read(DRILL);
    for (const prop of [
      "pool",
      "getCount",
      "onApply",
      "onShowAll",
      "onSearch",
      "showAll",
      "chooserTitle",
      "chooserHint",
      "activeLoopValues",
      "onToggleLoop",
      "loopConnective",
      "onLoopConnectiveChange",
      "activeFamilyValues",
      "onToggleFamily",
      "familyConnective",
      "onFamilyConnectiveChange",
      "variant",
      "persistSection",
      "showCollections",
      "fluidWideCanvas",
      "unifiedFilterChooser",
      "adaptiveValueLayout",
      "persistentDesktopCatalog",
      "initialSection",
      "onSectionChange",
      "isValueApplied",
      "onToggleValue",
    ]) {
      expect(source, `GalleryDrill dropped the ${prop} prop`).toMatch(
        new RegExp(`^\\s*${prop}[?]?:`, "m")
      );
    }
  });
});
