/**
 * StepNumberRenderer
 *
 * Draws beat numbers as canvas text overlays on pictographs.
 *
 * This replaces the SVG-based StepNumber component for cached pictograph rendering,
 * allowing base pictographs to be cached without beat numbers and then have
 * beat numbers composited at draw time.
 *
 * Styling matches StepNumber.svelte exactly:
 * - Position: x=50, y=50 in 950x950 viewBox (scaled proportionally)
 * - Font: Georgia, serif, bold
 * - Size: 100 for numbers, 80 for "Start"
 * - Color: #ffffff (dark mode) or #231f20 (light mode)
 * - Text anchor: start (left-aligned)
 * - Dominant baseline: hanging (top-aligned)
 */

import type { IStepNumberRenderer } from "../contracts/IStepNumberRenderer";

import { getStepNumberRenderer } from "$lib/shared/render/getStepNumberRenderer";

/** The SVG viewBox size used in pictographs */
const VIEW_BOX_SIZE = 950;

/** X position of beat number in viewBox coordinates */
const STEP_NUMBER_X = 50;

/** Y position of beat number in viewBox coordinates */
const STEP_NUMBER_Y = 50;

/** Font size for numeric beat numbers (1, 2, 3...) */
const NUMBER_FONT_SIZE = 100;

/** Font size for "Start" and "End" text */
const LABEL_FONT_SIZE = 80;

/** Text color for dark mode (light text on dark background) */
const DARK_MODE_COLOR = "#ffffff";

/** Text color for light mode (dark text on light background) */
const LIGHT_MODE_COLOR = "#231f20";

export class StepNumberRenderer implements IStepNumberRenderer {
  drawStepNumber(
    ctx: CanvasRenderingContext2D,
    stepNumber: number,
    x: number,
    y: number,
    cellSize: number,
    isDarkMode: boolean
  ): void {
    // Don't render for invalid beat numbers
    if (stepNumber === null || stepNumber === undefined || stepNumber === -1) {
      return;
    }

    // Calculate scale factor from viewBox to cell size
    const scale = cellSize / VIEW_BOX_SIZE;

    // Determine font size based on beat number
    // stepNumber 0 = "Start", stepNumber -2 = "End", otherwise numeric
    const isLabel = stepNumber === 0 || stepNumber === -2;
    const baseFontSize = isLabel ? LABEL_FONT_SIZE : NUMBER_FONT_SIZE;
    const fontSize = baseFontSize * scale;

    // Determine text content
    const text = stepNumber === 0 ? "Start" : stepNumber === -2 ? "End" : stepNumber.toString();

    // Calculate position (scaled from viewBox coordinates)
    const textX = x + STEP_NUMBER_X * scale;
    const textY = y + STEP_NUMBER_Y * scale;

    // Save context state
    ctx.save();

    // Apply font styling to match StepNumber.svelte
    ctx.font = `bold ${fontSize}px Georgia, serif`;
    ctx.fillStyle = isDarkMode ? DARK_MODE_COLOR : LIGHT_MODE_COLOR;

    // Match SVG text-anchor="start" and dominant-baseline="hanging"
    ctx.textAlign = "start";
    ctx.textBaseline = "hanging";

    // Draw the beat number text
    ctx.fillText(text, textX, textY);

    // Restore context state
    ctx.restore();
  }
}

// DIRECT EXPORT - Use this instead of getStepNumberRenderer()
// This avoids DI container rebuilds when this file changes
export const stepNumberRenderer = new StepNumberRenderer();
