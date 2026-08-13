/**
 * Layout Calculation
 *
 * Provides pixel-perfect layout calculations matching the desktop application.
 * Implements the exact same layout tables and algorithms used in
 * the desktop ImageExportLayoutHandler.
 *
 * Critical: All layout tables are copied exactly from the desktop version.
 */

const BASE_BEAT_SIZE = 144;

const LAYOUT_WITH_START_POSITION: Record<number, [number, number]> = { // eslint-disable-line @typescript-eslint/no-unused-vars
  0: [1, 1], 1: [2, 1], 2: [3, 1], 3: [4, 1], 4: [3, 2], 5: [3, 2],
  6: [4, 2], 7: [5, 2], 8: [5, 2], 9: [5, 3], 10: [6, 2], 11: [5, 3],
  12: [4, 4], 13: [5, 4], 14: [5, 4], 15: [5, 4], 16: [5, 4], 17: [5, 5],
  18: [5, 5], 19: [5, 5], 20: [6, 4], 21: [5, 6], 22: [5, 6], 23: [5, 6],
  24: [7, 4], 25: [5, 7], 26: [5, 7], 27: [5, 7], 28: [5, 7], 29: [5, 8],
  30: [8, 4], 31: [5, 8], 32: [9, 4], 33: [5, 9], 34: [5, 9], 35: [5, 9],
  36: [10, 4], 37: [5, 10], 38: [5, 10], 39: [5, 10], 40: [11, 4],
  41: [5, 11], 42: [5, 11], 43: [5, 11], 44: [5, 11], 45: [5, 12],
  46: [5, 12], 47: [5, 12], 48: [5, 12], 49: [5, 13], 50: [5, 13],
  51: [5, 13], 52: [5, 13], 53: [5, 14], 54: [5, 14], 55: [5, 14],
  56: [5, 14], 57: [5, 15], 58: [5, 15], 59: [5, 15], 60: [5, 15],
  61: [5, 16], 62: [5, 16], 63: [5, 16], 64: [5, 16],
};

const LAYOUT_WITHOUT_START_POSITION: Record<number, [number, number]> = {
  0: [1, 1], 1: [1, 1], 2: [2, 1], 3: [3, 1], 4: [2, 2], 5: [2, 2],
  6: [3, 2], 7: [4, 2], 8: [4, 2], 9: [3, 3], 10: [5, 2], 11: [4, 3],
  12: [3, 4], 13: [4, 4], 14: [4, 4], 15: [4, 4], 16: [4, 4], 17: [4, 5],
  18: [9, 2], 19: [4, 5], 20: [5, 4], 21: [4, 6], 22: [4, 6], 23: [4, 6],
  24: [6, 4], 25: [4, 7], 26: [4, 7], 27: [4, 7], 28: [7, 4], 29: [4, 8],
  30: [4, 8], 31: [4, 8], 32: [8, 4], 33: [4, 9], 34: [4, 9], 35: [4, 9],
  36: [9, 4], 37: [4, 10], 38: [4, 10], 39: [4, 10], 40: [10, 4],
  41: [4, 11], 42: [4, 11], 43: [4, 11], 44: [11, 4], 45: [4, 12],
  46: [4, 12], 47: [4, 12], 48: [12, 4], 49: [4, 13], 50: [4, 13],
  51: [4, 13], 52: [13, 4], 53: [4, 14], 54: [4, 14], 55: [4, 14],
  56: [14, 4], 57: [4, 15], 58: [4, 15], 59: [4, 15], 60: [15, 4],
  61: [4, 16], 62: [4, 16], 63: [4, 16], 64: [16, 4],
};

// Derived from WITHOUT_START by adding 1 row
const LAYOUT_WITH_START_ROW: Record<number, [number, number]> =
  Object.fromEntries(
    Object.entries(LAYOUT_WITHOUT_START_POSITION).map(
      ([stepCount, [cols, rows]]) => [stepCount, [cols, rows + 1]]
    )
  ) as Record<number, [number, number]>;

const LAYOUT_WITH_START_COLUMN: Record<number, [number, number]> = {
  0: [1, 1], 1: [2, 1], 2: [3, 1], 3: [4, 1],
  4: [3, 2], 5: [3, 3], 6: [4, 2], 7: [3, 4], 8: [5, 2], 9: [4, 3],
  10: [3, 5], 11: [4, 4], 12: [4, 4], 13: [4, 5], 14: [4, 5], 15: [4, 5],
  16: [5, 4], 17: [5, 5], 18: [5, 5], 19: [5, 5], 20: [5, 5],
  21: [5, 6], 22: [5, 6], 23: [5, 6], 24: [5, 6],
  25: [5, 7], 26: [5, 7], 27: [5, 7], 28: [5, 7],
  29: [5, 8], 30: [5, 8], 31: [5, 8], 32: [5, 8],
  33: [5, 9], 34: [5, 9], 35: [5, 9], 36: [5, 9],
  37: [5, 10], 38: [5, 10], 39: [5, 10], 40: [5, 10],
  41: [5, 11], 42: [5, 11], 43: [5, 11], 44: [5, 11],
  45: [5, 12], 46: [5, 12], 47: [5, 12], 48: [5, 12],
  49: [5, 13], 50: [5, 13], 51: [5, 13], 52: [5, 13],
  53: [5, 14], 54: [5, 14], 55: [5, 14], 56: [5, 14],
  57: [5, 15], 58: [5, 15], 59: [5, 15], 60: [5, 15],
  61: [5, 16], 62: [5, 16], 63: [5, 16], 64: [5, 16],
};

function getFallbackLayout(
  stepCount: number,
  includeStartPosition: boolean,
  startPositionLayout: "row" | "column" = "row"
): [number, number] {
  if (stepCount === 0) return [1, 1];

  const aspectRatio = 1.2;
  const idealHeight = Math.sqrt(stepCount / aspectRatio);
  const rows = Math.max(1, Math.round(idealHeight));
  const columns = Math.max(1, Math.ceil(stepCount / rows));

  if (includeStartPosition) {
    if (startPositionLayout === "column") return [columns + 1, rows];
    return [columns, rows + 1];
  }
  return [columns, rows];
}

export function validateLayout(stepCount: number, includeStartPosition: boolean): boolean {
  if (stepCount < 0) return false;
  if (stepCount > 1000) return false;
  if (typeof includeStartPosition !== "boolean") return false;
  return true;
}

export function calculateLayout(
  stepCount: number,
  includeStartPosition: boolean,
  startPositionLayout: "row" | "column" = "row"
): [number, number] {
  if (!validateLayout(stepCount, includeStartPosition)) {
    throw new Error(
      `Invalid layout parameters: stepCount=${stepCount}, includeStartPosition=${includeStartPosition}`
    );
  }

  let layoutTable: Record<number, [number, number]>;
  if (!includeStartPosition) {
    layoutTable = LAYOUT_WITHOUT_START_POSITION;
  } else if (startPositionLayout === "column") {
    layoutTable = LAYOUT_WITH_START_COLUMN;
  } else {
    layoutTable = LAYOUT_WITH_START_ROW;
  }

  if (stepCount in layoutTable) {
    return layoutTable[stepCount]!;
  }

  return getFallbackLayout(stepCount, includeStartPosition, startPositionLayout);
}

export function calculateImageDimensions(
  layout: [number, number],
  additionalHeight: number,
  stepScale: number = 1,
  stepSize?: number
): [number, number] {
  const [columns, rows] = layout;
  const actualBeatSize = stepSize ?? BASE_BEAT_SIZE * stepScale;

  const width = Math.floor(columns * actualBeatSize);
  const height = Math.floor(rows * actualBeatSize + additionalHeight);

  return [width, height];
}

export function getCurrentStepGridLayout(stepCount: number): [number, number] {
  return calculateLayout(stepCount, false);
}

export function getBaseBeatSize(): number {
  return BASE_BEAT_SIZE;
}

export function calculateImageArea(
  stepCount: number,
  includeStartPosition: boolean,
  additionalHeight: number,
  stepScale: number = 1
): number {
  const layout = calculateLayout(stepCount, includeStartPosition);
  const [width, height] = calculateImageDimensions(layout, additionalHeight, stepScale);
  return width * height;
}

export function getLayoutEfficiency(
  stepCount: number,
  includeStartPosition: boolean
): number {
  if (stepCount === 0) return 1.0;

  const layout = calculateLayout(stepCount, includeStartPosition);
  const [columns, rows] = layout;
  const totalCells = columns * rows;
  const usedCells = includeStartPosition ? stepCount + 1 : stepCount;

  return usedCells / totalCells;
}

export function getLayoutsInRange(
  minSteps: number,
  maxSteps: number,
  includeStartPosition: boolean
): Array<{
  stepCount: number;
  layout: [number, number];
  efficiency: number;
}> {
  const results = [];

  for (let stepCount = minSteps; stepCount <= maxSteps; stepCount++) {
    if (validateLayout(stepCount, includeStartPosition)) {
      const layout = calculateLayout(stepCount, includeStartPosition);
      const efficiency = getLayoutEfficiency(stepCount, includeStartPosition);
      results.push({ stepCount, layout, efficiency });
    }
  }

  return results;
}

export function calculateGalleryAspectRatio(
  stepCount: number,
  startPositionLayout: "row" | "column" = "row"
): number {
  const [columns, rows] = calculateLayout(stepCount, true, startPositionLayout);
  const additionalHeightFraction = 10 / 21;
  return columns / (rows + additionalHeightFraction);
}

export function calculateThumbnailAspectRatio(
  stepCount: number,
  options: {
    includeStartPosition?: boolean;
    hasHeader?: boolean;
    hasFooter?: boolean;
  } = {}
): number {
  const {
    includeStartPosition = true,
    hasHeader = true,
    hasFooter = true,
  } = options;

  const [columns, rows] = calculateLayout(stepCount, includeStartPosition, "column");

  let additionalHeightFraction = 0;
  if (hasHeader) additionalHeightFraction += 1 / 3;
  if (hasFooter) additionalHeightFraction += 1 / 7;

  return columns / (rows + additionalHeightFraction);
}
