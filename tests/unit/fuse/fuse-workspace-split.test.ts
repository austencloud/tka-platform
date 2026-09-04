import { describe, expect, it } from "vitest";
import {
  FUSE_LIVE_GRID_GAP,
  fitsFuseRecipeColumn,
  fuseRecipeColumnFloor,
  getBestFuseStepColumns,
  getFittedFuseCellSize,
  resolveBalancedFuseWorkspaceSplit,
} from "$lib/features/fuse/services/fuse-workspace-split";

// FuseLayout's constants. Kept here so a change to any of them has to face the
// sizes below rather than silently moving the seam.
const FIT = {
  recipeMinWidth: 400,
  pathHardMinWidth: 330,
  canvasFloor: 548,
  columnGap: 14,
};

describe("Fuse recipe column fit", () => {
  it("hosts the recipe as a column on a 4K-at-150% workspace", () => {
    // 1462px is the Fuse slot on a 3840x2160 monitor at 150% scaling with the
    // window not maximized. Gating on the path column's comfortable width put
    // the floor at 1548 and sent this size to the sheet, which overlays and
    // covers most of the result preview.
    expect(fitsFuseRecipeColumn(1462, FIT)).toBe(true);
  });

  it("still hosts the recipe as a column at every larger desktop size", () => {
    for (const width of [1548, 1680, 1920, 2560, 3840]) {
      expect(fitsFuseRecipeColumn(width, FIT)).toBe(true);
    }
  });

  it("falls back to the sheet only when a column would break a hard floor", () => {
    const floor = fuseRecipeColumnFloor(FIT);

    expect(floor).toBe(1306);
    expect(fitsFuseRecipeColumn(floor, FIT)).toBe(true);
    expect(fitsFuseRecipeColumn(floor - 1, FIT)).toBe(false);
    expect(fitsFuseRecipeColumn(1280, FIT)).toBe(false);
  });

  it("keeps recipe editing beside the preview in a 1440px laptop slot", () => {
    // A 1440px viewport leaves Fuse a 1322px grid content box after app chrome
    // and workspace padding. The old 1328px seam missed by six pixels and
    // replaced the useful three-column view with a 480px overlay.
    expect(fitsFuseRecipeColumn(1322, FIT)).toBe(true);
  });

  it("leaves the canvas its full floor and the paths above their hard floor at the seam", () => {
    // What the split solver is handed once the recipe takes its width off the
    // top: the canvas must still clear CANVAS_FLOOR, the paths MIN_LEFT.
    for (const containerWidth of [1306, 1322, 1462, 1548]) {
      const available = containerWidth - FIT.recipeMinWidth - 2 * FIT.columnGap;
      const paths = available - FIT.canvasFloor;

      expect(paths).toBeGreaterThanOrEqual(FIT.pathHardMinWidth);
    }
  });
});

describe("Fuse desktop workspace split", () => {
  it("fits every pictograph and grid seam inside the notation stage", () => {
    const columns = 3;
    const rows = 4;
    const stageWidth = 300;
    const stageHeight = 400;
    const cellSize = getFittedFuseCellSize(
      stageWidth,
      stageHeight,
      columns,
      rows
    );

    expect(
      cellSize * columns + FUSE_LIVE_GRID_GAP * (columns - 1)
    ).toBeLessThanOrEqual(stageWidth);
    expect(cellSize * rows + FUSE_LIVE_GRID_GAP * (rows - 1)).toBe(stageHeight);
  });

  it("shrinks cells to fit a tight stage instead of enforcing an overflow floor", () => {
    expect(getFittedFuseCellSize(120, 60, 3, 4)).toBe(14.25);
  });

  it("balances an eight-step source workbench against the 4K preview ideal", () => {
    const result = resolveBalancedFuseWorkspaceSplit({
      availableWidth: 3752,
      cardBoxHeight: 837,
      stepCount: 8,
      previewIdealWidth: 2018,
      minLeft: 1050,
      maxLeft: 2000,
      cardHorizontalChrome: 44,
    });

    expect(result.stepColumns).toBe(4);
    expect(result.splitPx).toBeGreaterThanOrEqual(1900);
    expect(result.splitPx).toBeLessThanOrEqual(1960);
    expect(3752 - result.splitPx).toBeGreaterThanOrEqual(1790);
  });

  it("gives a shorter four-step card less width than the animation stage", () => {
    const result = resolveBalancedFuseWorkspaceSplit({
      availableWidth: 2490,
      cardBoxHeight: 487,
      stepCount: 4,
      previewIdealWidth: 1298,
      minLeft: 760,
      maxLeft: 1400,
      cardHorizontalChrome: 44,
    });

    expect(result.stepColumns).toBe(2);
    expect(result.splitPx).toBeLessThan(2490 - result.splitPx);
  });

  it("chooses the most legible source arrangement inside a constrained width", () => {
    const result = resolveBalancedFuseWorkspaceSplit({
      availableWidth: 3752,
      cardBoxHeight: 837,
      stepCount: 16,
      previewIdealWidth: 2018,
      minLeft: 1050,
      maxLeft: 2000,
      cardHorizontalChrome: 44,
    });

    expect(result.stepColumns).toBe(6);
    expect(result.splitPx).toBeLessThanOrEqual(2000);
  });

  it("keeps manual seam grid selection aligned with the visible cell size", () => {
    expect(getBestFuseStepColumns(1930, 837, 8, 44)).toBe(4);
    expect(getBestFuseStepColumns(900, 487, 4, 44)).toBe(2);
  });
});
