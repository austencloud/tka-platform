/**
 * Sequence Renderer for MCP Server
 *
 * Composites multiple pictographs into a single "word card" image.
 * Matches the app's ImageComposer output with:
 * - Header with word text and difficulty badge (Georgia Bold)
 * - Footer with username, notes, and birthday
 * - Step numbers overlaid on pictographs (top-left corner)
 * - Smart cell borders between occupied cells
 */

import { createCanvas, type Canvas, type CanvasRenderingContext2D } from "canvas";
import { getStandaloneRenderer, type RenderVisibilityOptions } from "./standalone-renderer.js";
import type { SequenceStep } from "./sequence-builder.js";
import {
  renderWordHeader,
  renderUserInfo,
  calculateHeaderHeight,
  calculateFooterHeight,
  type UserExportInfo,
} from "./text-renderer.js";
import { calculateDifficultyLevel } from "./difficulty-calculator.js";

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
}

const DEFAULT_OPTIONS: SequenceRenderOptions = {
  layout: "grid",
  cellSize: 150,
  padding: 8,
  showStepNumbers: true,
  showWord: true,
  darkMode: true,
  showDifficulty: true,
};

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

  // Skip step 0 (start position) for the composite - show actual letters only
  const letterSteps = steps.filter((s) => s.stepNumber > 0);

  if (letterSteps.length === 0) {
    throw new Error("No letter steps to render");
  }

  // Calculate difficulty level for the badge
  const difficultyLevel = calculateDifficultyLevel(steps);

  // Check if we need header and footer
  const hasHeader = opts.showWord || opts.showDifficulty;
  const hasFooter = opts.userName || opts.notes || opts.birthday;

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
    showVTG: false,
    showPositions: false,
    showReversals: false,
    showNonRadialPoints: false,
  };

  for (let i = 0; i < letterSteps.length; i++) {
    const step = letterSteps[i];
    if (!step) continue;

    // Calculate cell position
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x = col * opts.cellSize;
    const y = gridStartY + row * opts.cellSize;

    // Convert step to pictograph input format
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
        turns: 0,
        startOrientation: step.blueMotion.startOrientation || "in",
      },
      redMotion: {
        motionType: step.redMotion.motionType,
        rotationDirection: step.redMotion.rotationDirection || "no_rotation",
        startLocation: step.redMotion.startLocation,
        endLocation: step.redMotion.endLocation,
        color: "red",
        turns: 0,
        startOrientation: step.redMotion.startOrientation || "in",
      },
    };

    try {
      // Render individual pictograph
      const pngBuffer = await renderer.renderToPng(pictographInput, visibilityOptions);

      // Load and draw onto composite canvas
      const { loadImage } = await import("canvas");
      const img = await loadImage(pngBuffer);
      ctx.drawImage(img, x, y, opts.cellSize, opts.cellSize);

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
    renderWordHeader(
      ctx,
      opts.showWord ? word : "",
      width,
      headerHeight,
      difficultyLevel,
      opts.showDifficulty ?? true,
      opts.darkMode
    );
  }

  // Draw user info footer if we have any user info
  if (hasFooter && footerHeight > 0) {
    const userInfo: UserExportInfo = {
      userName: opts.userName,
      notes: opts.notes,
      birthday: opts.birthday,
    };
    renderUserInfo(ctx, userInfo, width, height, footerHeight, opts.darkMode);
  }

  return canvas.toBuffer("image/png");
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
    // Single row layout
    const columns = stepCount;
    const rows = 1;
    const width = columns * opts.cellSize;
    const height = headerHeight + opts.cellSize + footerHeight;
    return { width, height, columns, rows, headerHeight, footerHeight, gridStartY: headerHeight };
  }

  // Grid layout - try to make it roughly square
  const columns = Math.ceil(Math.sqrt(stepCount));
  const rows = Math.ceil(stepCount / columns);
  const width = columns * opts.cellSize;
  const height = headerHeight + rows * opts.cellSize + footerHeight;

  return { width, height, columns, rows, headerHeight, footerHeight, gridStartY: headerHeight };
}

/**
 * Draw step number overlaid on pictograph (top-left corner)
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

  // Step number text
  const text = stepNumber.toString();

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

  // Create a set of occupied cells
  const occupied = new Set<string>();
  for (let i = 0; i < stepCount; i++) {
    const col = i % columns;
    const row = Math.floor(i / columns);
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
