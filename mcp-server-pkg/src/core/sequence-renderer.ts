/**
 * Sequence Renderer for MCP Server
 *
 * Composites multiple pictographs into a single "choreo card" image.
 * Matches the app's ImageComposer output with:
 * - Header with word text and difficulty badge (Georgia Bold)
 * - Footer with username, notes, and birthday
 * - Step numbers overlaid on pictographs (top-left corner)
 * - Smart cell borders between occupied cells
 */

import { getStandaloneRenderer, type RenderVisibilityOptions } from "./standalone-renderer.js";

// canvas is an optional dependency - dynamically import to avoid crash if not installed
let canvasModule: typeof import("canvas") | null = null;
async function getCanvas() {
  if (!canvasModule) {
    try {
      canvasModule = await import("canvas");
    } catch {
      throw new Error(
        "The 'canvas' package is required for sequence rendering but is not installed. " +
        "Install it with: npm install canvas"
      );
    }
  }
  return canvasModule;
}
type Canvas = import("canvas").Canvas;
type CanvasRenderingContext2D = import("canvas").CanvasRenderingContext2D;
import { detectReversals, type SequenceStep } from "./sequence-builder.js";
import {
  renderWordHeader,
  renderUserInfo,
  calculateHeaderHeight,
  calculateFooterHeight,
  renderLOOPGlyph,
  LOOPComponent,
  type UserExportInfo,
  type LetterStyle,
} from "./text-renderer.js";

// Re-export LOOPComponent for consumers
export { LOOPComponent };
import { calculateDifficultyLevel } from "./difficulty-calculator.js";

/**
 * Layout table for start-column grid mode.
 * Matches WITH_START_COLUMN from packages/render-composition/src/layout-tables.ts.
 * Key = beat count (not including start position), value = [totalColumns, rows].
 */
const START_COLUMN_LAYOUTS: Record<number, [number, number]> = {
  0: [1, 1], 1: [2, 1], 2: [2, 2], 3: [2, 3], 4: [3, 2],
  5: [3, 3], 6: [4, 2], 7: [3, 4], 8: [3, 4], 9: [4, 3],
  10: [3, 5], 11: [4, 4], 12: [4, 4], 13: [4, 5], 14: [4, 5],
  15: [4, 5], 16: [5, 4], 17: [5, 5], 18: [5, 5], 19: [5, 5],
  20: [5, 5], 21: [5, 6], 22: [5, 6], 23: [5, 6], 24: [5, 6],
  25: [5, 7], 26: [5, 7], 27: [5, 7], 28: [5, 7], 29: [5, 8],
  30: [5, 8], 31: [5, 8], 32: [5, 8], 33: [5, 9], 34: [5, 9],
  35: [5, 9], 36: [5, 9], 37: [5, 10], 38: [5, 10], 39: [5, 10],
  40: [5, 10], 41: [5, 11], 42: [5, 11], 43: [5, 11], 44: [5, 11],
  45: [5, 12], 46: [5, 12], 47: [5, 12], 48: [5, 12], 49: [5, 13],
  50: [5, 13], 51: [5, 13], 52: [5, 13], 53: [5, 14], 54: [5, 14],
  55: [5, 14], 56: [5, 14], 57: [5, 15], 58: [5, 15], 59: [5, 15],
  60: [5, 15], 61: [5, 16], 62: [5, 16], 63: [5, 16], 64: [5, 16],
};

function getStartColumnLayout(stepCount: number): [number, number] {
  return START_COLUMN_LAYOUTS[stepCount] ?? START_COLUMN_LAYOUTS[64] ?? [5, 16];
}

/**
 * Turn allocation per step (blue and red get independent values)
 */
export interface TurnAllocation {
  blue: (number | "fl")[];
  red: (number | "fl")[];
}

export interface SequenceRenderOptions {
  layout: "grid" | "strip";
  cellSize: number;
  padding: number;
  showStepNumbers: boolean;
  showWord: boolean;
  darkMode: boolean;
  // New options for visual parity
  showDifficulty?: boolean;
  userName?: string;
  notes?: string;
  birthday?: Date;
  // Difficulty level (for badge display and orientation calculation)
  level?: number;
  // Turn allocations per step (indexed by step number - 1, since step 0 is start position)
  // Each motion gets its own random turn value
  turnAllocation?: TurnAllocation;
  // LOOP components for the pie chart glyph (top-right corner)
  loopComponents?: LOOPComponent[];
  // Show reversal indicators (direction change dots on left edge)
  showReversals?: boolean;
  // LOOP sequence info - which beats are derived (transformed) vs seed (original)
  // Used for header text styling only - pictographs are not dimmed
  derivedBeatIndices?: number[];
  // Original seed word for LOOP sequences (displayed prominently in header)
  seedWord?: string;
}

const DEFAULT_OPTIONS: SequenceRenderOptions = {
  layout: "grid",
  cellSize: 900,
  padding: 8,
  showStepNumbers: true,
  showWord: true,
  darkMode: true,
  showDifficulty: true,
  level: 1,
  showReversals: true,
};

/**
 * - Level 1-2: "in" (radial)
 * - Level 3: "clock" (non-radial)
 */
function getStartOrientationForLevel(level: number): string {
  return level === 3 ? "clock" : "in";
}

/**
 * Returns a PNG buffer.
 */
export async function renderSequenceToImage(
  steps: SequenceStep[],
  word: string,
  options: Partial<SequenceRenderOptions> = {}
): Promise<Buffer> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const renderer = getStandaloneRenderer();

  // Include all steps (including step 0 start position)
  // Apply reversal detection if showReversals is enabled
  const isLoop = !!(opts.loopComponents && opts.loopComponents.length > 0);
  const letterSteps = opts.showReversals ? detectReversals(steps, isLoop) : steps;

  if (letterSteps.length === 0) {
    throw new Error("No steps to render");
  }

  // Use provided level for difficulty badge
  const difficultyLevel = opts.level ?? 1;

  // Get base orientation based on level
  const baseOrientation = getStartOrientationForLevel(difficultyLevel);

  // Turn allocation (per step, per color)
  const turnAllocation = opts.turnAllocation;

  // Check if we need header and footer
  const hasHeader = !!(opts.showWord || opts.showDifficulty);
  // Footer always shows (with defaults) - "Created with TKA Composer" center text is always present
  const hasFooter = true;

  // Calculate layout dimensions
  const { width, height, columns, rows, headerHeight, footerHeight, gridStartY } = calculateLayout(
    letterSteps.length,
    opts,
    hasHeader,
    hasFooter
  );

  // Create main canvas
  const { createCanvas } = await getCanvas();
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Fill background for grid area
  ctx.fillStyle = opts.darkMode ? "#0a0a0f" : "#ffffff";
  ctx.fillRect(0, headerHeight, width, height - headerHeight - footerHeight);

  // Render each pictograph
  const visibilityOptions: RenderVisibilityOptions = {
    darkMode: opts.darkMode,
    size: opts.cellSize,
    showTKA: true,
    showGrid: true,
    showBlueMotion: true,
    showRedMotion: true,
    showTND: false,
    showPositions: false,
    showReversals: opts.showReversals ?? false,
    showNonRadialPoints: false,
  };

  for (let i = 0; i < letterSteps.length; i++) {
    const step = letterSteps[i];
    if (!step) continue;

    // Calculate cell position using the offset layout
    const { row, col } = calculateStepPosition(i, columns);
    const x = col * opts.cellSize;
    const y = gridStartY + row * opts.cellSize;

    // Convert step to pictograph input format
    // Step 0 is start position (always 0 turns)
    // Other steps get their turns from the allocation array (indexed by stepNumber - 1)
    const allocationIndex = step.stepNumber - 1;
    const blueTurns = step.stepNumber === 0 ? 0 : (turnAllocation?.blue[allocationIndex] ?? 0);
    const redTurns = step.stepNumber === 0 ? 0 : (turnAllocation?.red[allocationIndex] ?? 0);

    const pictographInput = {
      letter: step.letter,
      startPosition: step.startPosition,
      endPosition: step.endPosition,
      blueMotion: {
        motionType: step.blueMotion.motionType,
        rotationDirection: step.blueMotion.rotationDirection || "no_rotation",
        startLocation: step.blueMotion.startLocation,
        endLocation: step.blueMotion.endLocation,
        color: "blue",
        turns: blueTurns,
        startOrientation: step.blueMotion.startOrientation || baseOrientation,
      },
      redMotion: {
        motionType: step.redMotion.motionType,
        rotationDirection: step.redMotion.rotationDirection || "no_rotation",
        startLocation: step.redMotion.startLocation,
        endLocation: step.redMotion.endLocation,
        color: "red",
        turns: redTurns,
        startOrientation: step.redMotion.startOrientation || baseOrientation,
      },
      // Reversal indicators (if detected)
      blueReversal: step.blueReversal,
      redReversal: step.redReversal,
    };

    try {
      // Render individual pictograph
      const pngBuffer = await renderer.renderToPng(pictographInput, visibilityOptions);

      // Load and draw onto composite canvas
      const { loadImage } = await getCanvas();
      const img = await loadImage(pngBuffer);
      ctx.drawImage(img, x, y, opts.cellSize, opts.cellSize);

      // Note: Derived beats in LOOP sequences are distinguished in the header text
      // (smaller font, secondary color) but the pictographs themselves are NOT dimmed
      // to maintain readability

      // Draw step number overlaid on pictograph (top-left corner)
      if (opts.showStepNumbers) {
        drawOverlaidStepNumber(ctx, step.stepNumber, x, y, opts.cellSize, opts.darkMode);
      }
    } catch (error) {
      // Draw error placeholder
      ctx.fillStyle = "rgba(255, 0, 0, 0.2)";
      ctx.fillRect(x, y, opts.cellSize, opts.cellSize);
      ctx.fillStyle = opts.darkMode ? "#ff6b6b" : "#dc3545";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Error", x + opts.cellSize / 2, y + opts.cellSize / 2);
    }
  }

  // Draw smart cell borders between occupied cells
  drawSmartCellBorders(ctx, columns, rows, opts.cellSize, letterSteps.length, gridStartY, opts.darkMode);

  // Draw word header if enabled
  if (hasHeader && headerHeight > 0) {
    // For LOOP sequences, use the seedWord (original word) for the header display
    // instead of the full loopWord (which includes derived/transformed letters)
    const headerWord = opts.seedWord ?? word;

    // Build letter styles from seed word only (for LOOP sequences)
    // This shows ONLY the original letters, not the transformed portion
    const seedLetters = opts.seedWord
      ? letterSteps.filter((s) => s.stepNumber > 0 && !opts.derivedBeatIndices?.includes(s.stepNumber))
      : letterSteps.filter((s) => s.stepNumber > 0);

    // Filter out bridge letters from styles since they aren't displayed in the header.
    // Without this, bridge styles (dimmed) get applied to the wrong header characters
    // because the styles array is longer than the displayed word.
    const letterStyles: LetterStyle[] = opts.showWord
      ? seedLetters
          .filter((s) => !s.isBridge)
          .map((s) => ({
            letter: s.letter,
            isBridge: false,
            isDerived: false,
          }))
      : [];

    renderWordHeader(
      ctx,
      opts.showWord ? headerWord : "",
      width,
      headerHeight,
      difficultyLevel,
      opts.showDifficulty ?? true,
      opts.darkMode,
      letterStyles.length > 0 ? letterStyles : undefined,
      opts.loopComponents // Pass LOOP components for glyph
    );
  }

  // Draw user info footer (always shown with defaults)
  if (hasFooter && footerHeight > 0) {
    const userInfo: UserExportInfo = {
      userName: opts.userName,
      notes: opts.notes,
      birthday: opts.birthday,
      word, // Pass word for contextual captions
    };
    renderUserInfo(ctx, userInfo, width, height, footerHeight, opts.darkMode);
  }

  return canvas.toBuffer("image/png");
}

/**
 * Calculate grid position for a step, accounting for start position offset.
 *
 * Layout pattern:
 * Row 1: [start] [1] [2] [3] ...
 * Row 2:    -    [4] [5] [6] ...  (empty cell in column 0)
 * Row 3:    -    [7] [8] [9] ...
 * @param stepIndex - Index in the steps array (0 = start position)
 * @param totalColumns - Total columns in the grid
 * @returns { row, col } position
 */
function calculateStepPosition(
  stepIndex: number,
  totalColumns: number
): { row: number; col: number } {
  if (stepIndex === 0) {
    // Start position is always at (0, 0)
    return { row: 0, col: 0 };
  }

  // Letter steps: account for start position taking column 0 of row 0
  // beatColumns = totalColumns - 1 (columns available for beats per row after the start column)
  const beatColumns = totalColumns - 1;
  const stepNumber = stepIndex - 1; // 0-based index among letter steps

  if (stepNumber < beatColumns) {
    // First row: steps go after the start position
    return { row: 0, col: stepNumber + 1 };
  }

  // Subsequent rows: start at column 1 (column 0 is empty)
  const adjustedIndex = stepNumber - beatColumns; // Index relative to row 2+
  const row = Math.floor(adjustedIndex / beatColumns) + 1;
  const col = (adjustedIndex % beatColumns) + 1;

  return { row, col };
}

function calculateLayout(
  stepCount: number,
  opts: SequenceRenderOptions,
  hasHeader: boolean,
  hasFooter: boolean
): {
  width: number;
  height: number;
  columns: number;
  rows: number;
  headerHeight: number;
  footerHeight: number;
  gridStartY: number;
} {
  // Calculate header and footer heights based on cell size (matching app proportions)
  const headerHeight = hasHeader ? calculateHeaderHeight(opts.cellSize) : 0;
  const footerHeight = hasFooter ? calculateFooterHeight(opts.cellSize) : 0;

  if (opts.layout === "strip") {
    // Single row layout - all steps in one row
    const columns = stepCount;
    const rows = 1;
    const width = columns * opts.cellSize;
    const height = headerHeight + opts.cellSize + footerHeight;
    return { width, height, columns, rows, headerHeight, footerHeight, gridStartY: headerHeight };
  }

  // Grid layout using the same layout table as the app
  const letterCount = stepCount - 1; // Exclude start position
  const [totalColumns, rows] = getStartColumnLayout(letterCount);

  const width = totalColumns * opts.cellSize;
  const height = headerHeight + rows * opts.cellSize + footerHeight;

  return { width, height, columns: totalColumns, rows, headerHeight, footerHeight, gridStartY: headerHeight };
}

/**
 * Matches app's StepNumberRenderer style
 */
function drawOverlaidStepNumber(
  ctx: CanvasRenderingContext2D,
  stepNumber: number,
  x: number,
  y: number,
  cellSize: number,
  darkMode: boolean
): void {
  // Calculate font size proportional to cell size (10% of cell size)
  const fontSize = Math.max(12, Math.floor(cellSize * 0.1));
  const padding = Math.floor(cellSize * 0.02);

  // Step number text - use "start" for step 0, otherwise the number
  const text = stepNumber === 0 ? "start" : stepNumber.toString();

  // Set font for measurement
  ctx.font = `bold ${fontSize}px Georgia, Times New Roman, serif`;
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const textHeight = fontSize;

  // Calculate badge position (top-left corner with small margin)
  const badgeX = x + padding;
  const badgeY = y + padding;
  const badgePadding = Math.floor(fontSize * 0.3);
  const badgeWidth = textWidth + badgePadding * 2;
  const badgeHeight = textHeight + badgePadding;

  // Draw semi-transparent background circle/rounded rect
  ctx.fillStyle = darkMode ? "rgba(0, 0, 0, 0.7)" : "rgba(255, 255, 255, 0.85)";
  ctx.beginPath();
  const cornerRadius = badgeHeight / 2;
  // Rounded rectangle
  ctx.moveTo(badgeX + cornerRadius, badgeY);
  ctx.lineTo(badgeX + badgeWidth - cornerRadius, badgeY);
  ctx.arc(badgeX + badgeWidth - cornerRadius, badgeY + cornerRadius, cornerRadius, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(badgeX + cornerRadius, badgeY + badgeHeight);
  ctx.arc(badgeX + cornerRadius, badgeY + cornerRadius, cornerRadius, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();
  ctx.fill();

  // Draw text
  ctx.fillStyle = darkMode ? "#ffffff" : "#1f2937";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2);
}

/**
 * Matches app's smart grid border logic
 */
function drawSmartCellBorders(
  ctx: CanvasRenderingContext2D,
  columns: number,
  rows: number,
  cellSize: number,
  stepCount: number,
  gridStartY: number,
  darkMode: boolean
): void {
  ctx.strokeStyle = darkMode ? "rgba(255, 255, 255, 0.15)" : "#e0e0e0";
  ctx.lineWidth = 1;

  // Create a set of occupied cells using the offset layout
  const occupied = new Set<string>();
  for (let i = 0; i < stepCount; i++) {
    const { row, col } = calculateStepPosition(i, columns);
    occupied.add(`${col},${row}`);
  }

  const isOccupied = (col: number, row: number): boolean => occupied.has(`${col},${row}`);

  // Draw vertical lines between horizontally adjacent occupied cells
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns - 1; col++) {
      if (isOccupied(col, row) && isOccupied(col + 1, row)) {
        const x = (col + 1) * cellSize;
        ctx.beginPath();
        ctx.moveTo(x, gridStartY + row * cellSize);
        ctx.lineTo(x, gridStartY + (row + 1) * cellSize);
        ctx.stroke();
      }
    }
  }

  // Draw horizontal lines between vertically adjacent occupied cells
  for (let col = 0; col < columns; col++) {
    for (let row = 0; row < rows - 1; row++) {
      if (isOccupied(col, row) && isOccupied(col, row + 1)) {
        const y = gridStartY + (row + 1) * cellSize;
        ctx.beginPath();
        ctx.moveTo(col * cellSize, y);
        ctx.lineTo((col + 1) * cellSize, y);
        ctx.stroke();
      }
    }
  }
}
