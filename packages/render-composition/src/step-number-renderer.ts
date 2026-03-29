const VIEW_BOX_SIZE = 950;
const STEP_NUMBER_X = 50;
const STEP_NUMBER_Y = 50;
const NUMBER_FONT_SIZE = 100;
const LABEL_FONT_SIZE = 80;

export function renderStepNumber(
  ctx: CanvasRenderingContext2D,
  stepNumber: number,
  cellX: number,
  cellY: number,
  cellSize: number,
  darkMode: boolean
): void {
  if (stepNumber === null || stepNumber === undefined || stepNumber === -1) return;

  const scale = cellSize / VIEW_BOX_SIZE;
  const isLabel = stepNumber === 0 || stepNumber === -2;
  const fontSize = (isLabel ? LABEL_FONT_SIZE : NUMBER_FONT_SIZE) * scale;
  const text = stepNumber === 0 ? "Start" : stepNumber === -2 ? "End" : stepNumber.toString();

  ctx.save();
  ctx.font = `bold ${fontSize}px Georgia, serif`;
  ctx.fillStyle = darkMode ? "#ffffff" : "#231f20";
  ctx.textAlign = "start";
  ctx.textBaseline = "hanging";
  ctx.fillText(text, cellX + STEP_NUMBER_X * scale, cellY + STEP_NUMBER_Y * scale);
  ctx.restore();
}
