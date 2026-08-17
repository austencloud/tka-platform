const STEP_COLUMN_CANDIDATES = [1, 2, 4, 6, 8] as const;

export interface FuseWorkspaceSplitInput {
  availableWidth: number;
  cardBoxHeight: number;
  stepCount: number;
  previewIdealWidth: number;
  minLeft: number;
  maxLeft: number;
  cardHorizontalChrome: number;
}

export interface FuseWorkspaceSplit {
  splitPx: number;
  stepColumns: number;
}

function stepColumnCandidates(stepCount: number): readonly number[] {
  const twoRowCeiling = Math.max(1, Math.ceil(stepCount / 2));
  return STEP_COLUMN_CANDIDATES.filter((columns) => columns <= twoRowCeiling);
}

function emptyStepCells(stepCount: number, stepColumns: number): number {
  return Math.max(
    0,
    Math.ceil(stepCount / stepColumns) * stepColumns - stepCount
  );
}

function clampSplit(px: number, minLeft: number, maxLeft: number): number {
  const safeMax = Math.max(minLeft, maxLeft);
  return Math.round(Math.min(safeMax, Math.max(minLeft, px)));
}

export function getFuseSourceCellSize(
  leftWidth: number,
  cardBoxHeight: number,
  stepCount: number,
  stepColumns: number,
  cardHorizontalChrome: number
): number {
  const gridColumns = stepColumns + 1;
  const rows = Math.max(Math.ceil(stepCount / stepColumns), 2);
  const boxWidth = Math.max(0, leftWidth - cardHorizontalChrome);
  return Math.min(boxWidth / gridColumns, cardBoxHeight / rows);
}

export function getBestFuseStepColumns(
  leftWidth: number,
  cardBoxHeight: number,
  stepCount: number,
  cardHorizontalChrome: number
): number {
  const candidates = stepColumnCandidates(stepCount);
  let best = candidates[0] ?? 1;
  let bestCell = -1;

  for (const stepColumns of candidates) {
    const cell = getFuseSourceCellSize(
      leftWidth,
      cardBoxHeight,
      stepCount,
      stepColumns,
      cardHorizontalChrome
    );
    if (
      cell > bestCell + 0.5 ||
      (Math.abs(cell - bestCell) <= 0.5 &&
        (emptyStepCells(stepCount, stepColumns) <
          emptyStepCells(stepCount, best) ||
          (emptyStepCells(stepCount, stepColumns) ===
            emptyStepCells(stepCount, best) &&
            stepColumns > best)))
    ) {
      bestCell = cell;
      best = stepColumns;
    }
  }

  return best;
}

export interface FuseRecipeColumnFitInput {
  /** Recipe column's narrowest usable width. */
  recipeMinWidth: number;
  /** Path column's HARD floor, not its comfortable one. */
  pathHardMinWidth: number;
  /** Result canvas's floor. */
  canvasFloor: number;
  /** Gap between two adjacent workspace columns. */
  columnGap: number;
}

/**
 * The narrowest workspace that can hold the recipe as a third column.
 *
 * Each panel's HARD floor, deliberately. The alternative host is a sheet that
 * overlays the workspace from the right and covers most of the result preview,
 * so a workspace where the three columns merely get tight still shows the user
 * more than one where the animation they are tuning is behind the panel. Gating
 * on the path column's COMFORTABLE width instead put this seam ~220px too high,
 * which sent a 1462px workspace — 4K at 150% scaling, window not maximized — to
 * the sheet.
 */
export function fuseRecipeColumnFloor(input: FuseRecipeColumnFitInput): number {
  return (
    input.recipeMinWidth +
    input.pathHardMinWidth +
    input.canvasFloor +
    2 * input.columnGap
  );
}

export function fitsFuseRecipeColumn(
  containerWidth: number,
  input: FuseRecipeColumnFitInput
): boolean {
  return containerWidth >= fuseRecipeColumnFloor(input);
}

/**
 * Finds the desktop seam where both visual work areas reach the same share of
 * their height-derived ideal. The source ideal is the width that makes its
 * pictograph cells square. The result ideal is the width that lets its square
 * animation frame use the available height. Any surplus or deficit is shared
 * in that ratio, so neither pane grows by starving the other.
 */
export function resolveBalancedFuseWorkspaceSplit(
  input: FuseWorkspaceSplitInput
): FuseWorkspaceSplit {
  const {
    availableWidth,
    cardBoxHeight,
    stepCount,
    previewIdealWidth,
    minLeft,
    maxLeft,
    cardHorizontalChrome,
  } = input;
  const candidates = stepColumnCandidates(stepCount);
  const fallback = clampSplit(availableWidth * 0.5, minLeft, maxLeft);

  if (availableWidth <= 0 || cardBoxHeight <= 0 || previewIdealWidth <= 0) {
    return {
      splitPx: fallback,
      stepColumns: getBestFuseStepColumns(
        fallback,
        Math.max(0, cardBoxHeight),
        stepCount,
        cardHorizontalChrome
      ),
    };
  }

  let bestSplit = fallback;
  let bestColumns = candidates[0] ?? 1;
  let bestCell = -1;
  let bestPreviewSize = -1;

  for (const stepColumns of candidates) {
    const gridColumns = stepColumns + 1;
    const rows = Math.max(Math.ceil(stepCount / stepColumns), 2);
    const sourceIdealWidth =
      (gridColumns / rows) * cardBoxHeight + cardHorizontalChrome;
    const idealTotal = sourceIdealWidth + previewIdealWidth;
    const negotiatedSplit =
      idealTotal > 0
        ? (availableWidth * sourceIdealWidth) / idealTotal
        : fallback;
    const splitPx = clampSplit(negotiatedSplit, minLeft, maxLeft);
    const cell = getFuseSourceCellSize(
      splitPx,
      cardBoxHeight,
      stepCount,
      stepColumns,
      cardHorizontalChrome
    );
    const previewSize = Math.min(
      previewIdealWidth,
      Math.max(0, availableWidth - splitPx)
    );

    if (
      cell > bestCell + 0.5 ||
      (Math.abs(cell - bestCell) <= 0.5 &&
        (previewSize > bestPreviewSize + 0.5 ||
          (Math.abs(previewSize - bestPreviewSize) <= 0.5 &&
            (emptyStepCells(stepCount, stepColumns) <
              emptyStepCells(stepCount, bestColumns) ||
              (emptyStepCells(stepCount, stepColumns) ===
                emptyStepCells(stepCount, bestColumns) &&
                stepColumns > bestColumns)))))
    ) {
      bestCell = cell;
      bestPreviewSize = previewSize;
      bestSplit = splitPx;
      bestColumns = stepColumns;
    }
  }

  return { splitPx: bestSplit, stepColumns: bestColumns };
}
