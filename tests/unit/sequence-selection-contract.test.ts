/**
 * Static contract for the unified sequence-selection primitive.
 *
 * The guide sequence strips and the choreo sheet render whole-sequence hover/select
 * through the SAME SelectionHit + `.tka-seq-cell` classes + SequenceSelection scope,
 * so the two surfaces cannot drift back into hand-rolled selection markup (see
 * docs/superpowers/specs/2026-07-08-unified-sequence-selection-design.md).
 *
 * If this fails, fix the host to use the primitive — do not loosen the assertions.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);
const read = (rel: string) => readFileSync(path.join(repoRoot, rel), "utf8");

const GUIDE_PAGES = [
  "src/routes/(public)/guide/level-1/_pages/Type1AlphaBetaPage.svelte",
  "src/routes/(public)/guide/level-1/_pages/Type2ShiftsPage.svelte",
  "src/routes/(public)/guide/level-1/_pages/Type3CrossShiftsPage.svelte",
  "src/routes/(public)/guide/level-1/_pages/GammaPage.svelte",
  "src/routes/(public)/guide/level-1/_pages/Type456Page.svelte",
];
const CHOREO_CELL =
  "src/lib/features/write/components/sheet/SheetPreviewCell.svelte";
const CHOREO_PREVIEW =
  "src/lib/features/write/components/sheet/SheetPreviewPages.svelte";

describe("unified sequence-selection contract", () => {
  it("every guide page that emits a sequence uses SelectionHit + .tka-seq-cell", () => {
    for (const rel of GUIDE_PAGES) {
      const src = read(rel);
      if (!src.includes("emitSequence")) continue; // page has no interactive strips
      expect(src, `${rel} must import/use SelectionHit`).toContain(
        "SelectionHit"
      );
      expect(src, `${rel} must apply tka-seq-cell`).toContain("tka-seq-cell");
    }
  });

  it("no guide page reintroduces the hand-rolled .seq-hit button", () => {
    for (const rel of GUIDE_PAGES) {
      expect(read(rel), `${rel} must not contain a raw seq-hit`).not.toContain(
        'class="seq-hit"'
      );
    }
  });

  it("the choreo sheet uses the primitive and dropped .cell-select", () => {
    const src = read(CHOREO_CELL);
    expect(src).toContain("SelectionHit");
    expect(src).toContain("tka-seq-cell");
    expect(src, "cell-select hit must be gone").not.toContain(
      'class="cell-select"'
    );
    expect(src, "hand-rolled selected ::after must be gone").not.toContain(
      ".cell.selected::after"
    );
  });

  it("the preview imports the canonical sheet visibility contract", () => {
    const src = read(CHOREO_PREVIEW);
    expect(src).toContain(
      'import { SHEET_CELL_VISIBILITY } from "../../services/sheet-cell-config";'
    );
    expect(src).toContain("SHEET_CELL_VISIBILITY.handPointVisibility");
  });

  it("keeps the aligned preview content inside one reachable packing branch", () => {
    const src = read(CHOREO_PREVIEW);
    const alignedConditions = src.match(/layout\.packing === ["']aligned["']/g);

    expect(alignedConditions).toHaveLength(1);
    expect(src).toMatch(
      /\{#if layout\.packing === "aligned"\}\s*\{#if bandPages\.length === 0\}/
    );
    expect(src).not.toContain('{:else if layout.packing === "aligned"}');
  });
});
