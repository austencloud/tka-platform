/**
 * Sequence Renderer for MCP Server
 *
 * Composites multiple pictographs into a single "word card" image.
 * Supports grid and strip layouts.
 */

import { createCanvas, type Canvas, type CanvasRenderingContext2D } from "canvas";
import { getStandaloneRenderer, type RenderVisibilityOptions } from "./standalone-renderer.js";
import type { SequenceStep } from "./sequence-builder.js";

export interface SequenceRenderOptions {
  layout: "grid" | "strip";
  cellSize: number;
  padding: number;
  showStepNumbers: boolean;
  showWord: boolean;
  darkMode: boolean;
}

const DEFAULT_OPTIONS: SequenceRenderOptions = {
  layout: "grid",
  cellSize: 150,
  padding: 8,
  showStepNumbers: true,
  showWord: true,
  darkMode: true,
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

  // Calculate layout dimensions
  const { width, height, columns, rows, headerHeight } = calculateLayout(
    letterSteps.length,
    opts
  );

  // Create main canvas
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Fill background
  ctx.fillStyle = opts.darkMode ? "#1a1a2e" : "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Draw word header if enabled
  let contentStartY = opts.padding;
  if (opts.showWord && word) {
    contentStartY = drawWordHeader(ctx, word, width, opts);
  }

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
    const x = opts.padding + col * (opts.cellSize + opts.padding);
    const y = contentStartY + row * (opts.cellSize + opts.padding + (opts.showStepNumbers ? 20 : 0));

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
        startOrientation: "in",
      },
      redMotion: {
        motionType: step.redMotion.motionType,
        rotationDirection: step.redMotion.rotationDirection || "no_rotation",
        startLocation: step.redMotion.startLocation,
        endLocation: step.redMotion.endLocation,
        color: "red",
        turns: 0,
        startOrientation: "in",
      },
    };

    try {
      // Render individual pictograph
      const pngBuffer = await renderer.renderToPng(pictographInput, visibilityOptions);

      // Load and draw onto composite canvas
      const { loadImage } = await import("canvas");
      const img = await loadImage(pngBuffer);
      ctx.drawImage(img, x, y, opts.cellSize, opts.cellSize);

      // Draw step number below
      if (opts.showStepNumbers) {
        drawStepNumber(ctx, step.stepNumber, x, y + opts.cellSize, opts.cellSize, opts.darkMode);
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

  return canvas.toBuffer("image/png");
}

function calculateLayout(
  stepCount: number,
  opts: SequenceRenderOptions
): {
  width: number;
  height: number;
  columns: number;
  rows: number;
  headerHeight: number;
} {
  const headerHeight = opts.showWord ? 40 : 0;
  const stepNumberHeight = opts.showStepNumbers ? 20 : 0;

  if (opts.layout === "strip") {
    // Single row layout
    const columns = stepCount;
    const rows = 1;
    const width = opts.padding * 2 + columns * (opts.cellSize + opts.padding) - opts.padding;
    const height = opts.padding * 2 + headerHeight + opts.cellSize + stepNumberHeight;
    return { width, height, columns, rows, headerHeight };
  }

  // Grid layout - try to make it roughly square
  const columns = Math.ceil(Math.sqrt(stepCount));
  const rows = Math.ceil(stepCount / columns);
  const width = opts.padding * 2 + columns * (opts.cellSize + opts.padding) - opts.padding;
  const height =
    opts.padding * 2 +
    headerHeight +
    rows * (opts.cellSize + opts.padding + stepNumberHeight) -
    opts.padding;

  return { width, height, columns, rows, headerHeight };
}

function drawWordHeader(
  ctx: CanvasRenderingContext2D,
  word: string,
  canvasWidth: number,
  opts: SequenceRenderOptions
): number {
  const headerHeight = 40;

  // Draw header background
  ctx.fillStyle = opts.darkMode ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)";
  ctx.fillRect(0, 0, canvasWidth, headerHeight);

  // Draw word text
  ctx.fillStyle = opts.darkMode ? "#ffffff" : "#1a1a2e";
  ctx.font = "bold 24px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(word, canvasWidth / 2, headerHeight / 2);

  return headerHeight + opts.padding;
}

function drawStepNumber(
  ctx: CanvasRenderingContext2D,
  stepNumber: number,
  x: number,
  y: number,
  cellWidth: number,
  darkMode: boolean
): void {
  ctx.fillStyle = darkMode ? "rgba(255, 255, 255, 0.6)" : "rgba(0, 0, 0, 0.6)";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(`Beat ${stepNumber}`, x + cellWidth / 2, y + 4);
}
