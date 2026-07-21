import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { calculateGridLayout } from "../../src/lib/shared/create/utils/grid-calculations";

const workspaceGridSource = readFileSync(
  resolve(
    process.cwd(),
    "src/lib/features/create/shared/workspace-panel/sequence-display/components/WorkspaceGrid.svelte"
  ),
  "utf8"
);

describe("calculateGridLayout workspace column selection", () => {
  it("uses four step columns when a tall workspace makes them larger", () => {
    const layout = calculateGridLayout(16, 719, 450, null);
    const forcedWideLayout = calculateGridLayout(16, 719, 450, null, {
      manualColumnCount: 8,
    });

    expect(layout.columns).toBe(4);
    expect(layout.rows).toBe(4);
    expect(layout.cellSize).toBeGreaterThan(forcedWideLayout.cellSize);
  });

  it("uses eight step columns when a short workspace makes them larger", () => {
    const layout = calculateGridLayout(16, 900, 250, null);
    const forcedStandardLayout = calculateGridLayout(16, 900, 250, null, {
      manualColumnCount: 4,
    });

    expect(layout.columns).toBe(8);
    expect(layout.rows).toBe(2);
    expect(layout.cellSize).toBeGreaterThan(forcedStandardLayout.cellSize);
  });

  it("preserves an explicit LOOP-aligned column count", () => {
    const layout = calculateGridLayout(16, 719, 450, null, {
      manualColumnCount: 8,
    });

    expect(layout.columns).toBe(8);
    expect(layout.rows).toBe(2);
  });

  it("keeps the wide layout for sequences that exceed the fit-all row limit", () => {
    const layout = calculateGridLayout(40, 719, 450, null);

    expect(layout.columns).toBe(8);
    expect(layout.rows).toBe(5);
  });
});

describe("WorkspaceGrid mandala placement", () => {
  it("shares capped mandala placement across both workspace layouts", () => {
    expect(workspaceGridSource.match(/getMandalaPlacements\(\{/g)).toHaveLength(
      2
    );
    expect(workspaceGridSource).not.toContain("applyVariantCycling");
    expect(workspaceGridSource).toContain("{#if cell.show !== null}");
  });
});
