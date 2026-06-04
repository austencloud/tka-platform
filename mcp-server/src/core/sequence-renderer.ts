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

import { createCanvas, type Canvas, type CanvasRenderingContext2D } from "canvas";
import { getStandaloneRenderer, type RenderVisibilityOptions } from "./standalone-renderer.js";
import { detectReversals, type SequenceStep } from "./sequence-builder-adapter.js";
import {
  renderWordHeader,
  renderUserInfo,
  calculateHeaderHeight,
  calculateFooterHeight,
  LOOPComponent,
  type UserExportInfo,
  type LetterStyle,
} from "./text-renderer.js";
import { renderStepNumber } from "@tka/render-composition";

// Re-export LOOPComponent for consumers
export { LOOPComponent };
import { calculateDifficultyLevel } from "./difficulty-calculator.js";

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
  // LOOP period as integer (2 = halved, 4 = quartered) — rendered as badge on each icon
  period?: number;
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
 * Get start orientation based on difficulty level.
 * - Level 1-2: "in" (radial)
 * - Level 3: "clock" (non-radial)
 */
function getStartOrientationForLevel(level: number): string {
  return level === 3 ? "clock" : "in";
}

/**
 * Render a sequence as a composite image.
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
  const letterSteps = opts.showReversals ? detectReversals(steps) : steps;

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
  // Footer always shows (with defaults) - "The Kinetic Alphabet" center text is always present
  const hasFooter = true;

  // Calculate layout dimensions
  const { width, height, columns, rows, headerHeight, footerHeight, gridStartY } = calculateLayout(
    letterSteps.length,
    opts,
    hasHeader,
    hasFooter
  );

  // Create main canvas
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
    const stepNum = step.stepNumber ?? step.stepNumber;
    const allocationIndex = stepNum - 1;
    const blueTurns = stepNum === 0 ? 0 : (turnAllocation?.blue[allocationIndex] ?? 0);
    const redTurns = stepNum === 0 ? 0 : (turnAllocation?.red[allocationIndex] ?? 0);

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
      const { loadImage } = await import("canvas");
      const img = await loadImage(pngBuffer);
      ctx.drawImage(img, x, y, opts.cellSize, opts.cellSize);

      // Note: Derived beats in LOOP sequences are distinguished in the header text
      // (smaller font, secondary color) but the pictographs themselves are NOT dimmed
      // to maintain readability

      // Draw step number overlaid on pictograph (top-left corner)
      if (opts.showStepNumbers) {
        renderStepNumber(ctx as unknown as globalThis.CanvasRenderingContext2D, stepNum, x, y, opts.cellSize, opts.darkMode);
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
      ? letterSteps.filter((s) => (s.stepNumber ?? s.stepNumber) > 0 && !opts.derivedBeatIndices?.includes(s.stepNumber ?? s.stepNumber))
      : letterSteps.filter((s) => (s.stepNumber ?? s.stepNumber) > 0);

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
      opts.loopComponents
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
 *
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

  // Grid layout with start position offset
  // We need to figure out how many columns based on letter count
  const letterCount = stepCount - 1; // Exclude start position

  // Calculate beat columns (columns after the start position)
  // 32+ beats use 8 columns for wider, more readable layouts
  const beatColumns =
    letterCount >= 31 ? 8 : Math.max(1, Math.ceil(Math.sqrt(letterCount)));
  const totalColumns = beatColumns + 1; // +1 for start position column

  // Calculate rows needed
  // Row 1 has beatColumns beats
  // Subsequent rows each have beatColumns beats
  const beatsInFirstRow = Math.min(letterCount, beatColumns);
  const remainingBeats = letterCount - beatsInFirstRow;
  const additionalRows = remainingBeats > 0 ? Math.ceil(remainingBeats / beatColumns) : 0;
  const rows = 1 + additionalRows;

  const width = totalColumns * opts.cellSize;
  const height = headerHeight + rows * opts.cellSize + footerHeight;

  return { width, height, columns: totalColumns, rows, headerHeight, footerHeight, gridStartY: headerHeight };
}


/**
 * Draw cell borders only between occupied cells
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
