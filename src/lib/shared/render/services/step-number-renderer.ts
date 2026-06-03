/**
 * Step Number Renderer
 *
 * Draws beat numbers as canvas text overlays on pictographs.
 *
 * Styling matches StepNumber.svelte exactly:
 * - Position: x=50, y=50 in 950x950 viewBox (scaled proportionally)
 * - Font: Georgia, serif, bold
 * - Size: 100 for numbers, 80 for "Start"
 * - Color: #ffffff (dark mode) or #231f20 (light mode)
 * - Text anchor: start (left-aligned)
 * - Dominant baseline: hanging (top-aligned)
 */

const VIEW_BOX_SIZE = 950;
const STEP_NUMBER_X = 50;
const STEP_NUMBER_Y = 50;
const NUMBER_FONT_SIZE = 100;
const LABEL_FONT_SIZE = 80;
const DARK_MODE_COLOR = "#ffffff";
const LIGHT_MODE_COLOR = "#231f20";

export function drawStepNumber(
  ctx: CanvasRenderingContext2D,
  stepNumber: number,
  x: number,
  y: number,
  cellSize: number,
  isDarkMode: boolean
): void {
  if (stepNumber === null || stepNumber === undefined || stepNumber === -1) {
    return;
  }

  const scale = cellSize / VIEW_BOX_SIZE;

  const isLabel = stepNumber === 0 || stepNumber === -2;
  const baseFontSize = isLabel ? LABEL_FONT_SIZE : NUMBER_FONT_SIZE;
  const fontSize = baseFontSize * scale;

  const text = stepNumber === 0 ? "Start" : stepNumber === -2 ? "End" : stepNumber.toString();

  const textX = x + STEP_NUMBER_X * scale;
  const textY = y + STEP_NUMBER_Y * scale;

  ctx.save();
  ctx.font = `bold ${fontSize}px Gelasio, Georgia, serif`;
  ctx.fillStyle = isDarkMode ? DARK_MODE_COLOR : LIGHT_MODE_COLOR;
  ctx.textAlign = "start";
  ctx.textBaseline = "hanging";
  ctx.fillText(text, textX, textY);
  ctx.restore();
}
