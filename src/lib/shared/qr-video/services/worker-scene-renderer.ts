import type { FramePropState } from "../domain/qr-video-types";

const GRID_HALFWAY_POINT_OFFSET = 150;
const VIEWBOX_SIZE = 950;

const DARK_BG = "#0a0a0f";
const STEP_NUM_COLOR = "#ffffff";
const STEP_NUM_FONT = "bold 100px Georgia";
const STEP_NUM_X = 65;
const STEP_NUM_Y = 130;

const GLYPH_X = 50;
const GLYPH_Y = 770;
const GLYPH_MAX_SIZE = 130;

function drawProp(
  ctx: OffscreenCanvasRenderingContext2D,
  canvasSize: number,
  propState: FramePropState,
  propImage: ImageBitmap,
  viewBoxDimensions: { width: number; height: number }
): void {
  const centerX = canvasSize / 2;
  const centerY = canvasSize / 2;
  const inwardFactor = 0.95;
  const gridScaleFactor = canvasSize / VIEWBOX_SIZE;
  const scaledHalfwayRadius = GRID_HALFWAY_POINT_OFFSET * gridScaleFactor;

  let x: number, y: number;
  if (propState.x !== undefined && propState.y !== undefined) {
    x = centerX + propState.x * scaledHalfwayRadius * inwardFactor;
    y = centerY + propState.y * scaledHalfwayRadius * inwardFactor;
  } else {
    x = centerX + Math.cos(propState.centerPathAngle) * scaledHalfwayRadius * inwardFactor;
    y = centerY + Math.sin(propState.centerPathAngle) * scaledHalfwayRadius * inwardFactor;
  }

  const propWidth = viewBoxDimensions.width * gridScaleFactor;
  const propHeight = viewBoxDimensions.height * gridScaleFactor;
  const propCenterX = viewBoxDimensions.width / 2;
  const propCenterY = viewBoxDimensions.height / 2;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(propState.staffRotationAngle);
  ctx.drawImage(
    propImage,
    -propCenterX * gridScaleFactor,
    -propCenterY * gridScaleFactor,
    propWidth,
    propHeight
  );
  ctx.restore();
}

export interface SceneOverlay {
  stepIndex: number;
  isStartPosition: boolean;
  letterGlyphs: ImageBitmap[];
}

export function renderScene(
  ctx: OffscreenCanvasRenderingContext2D,
  canvasSize: number,
  gridImage: ImageBitmap,
  bluePropImage: ImageBitmap,
  redPropImage: ImageBitmap,
  blueProp: FramePropState | null,
  redProp: FramePropState | null,
  bluePropViewBox: { width: number; height: number },
  redPropViewBox: { width: number; height: number },
  overlay?: SceneOverlay
): void {
  const scale = canvasSize / VIEWBOX_SIZE;

  ctx.clearRect(0, 0, canvasSize, canvasSize);
  ctx.fillStyle = DARK_BG;
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  ctx.drawImage(gridImage, 0, 0, canvasSize, canvasSize);

  if (blueProp) {
    drawProp(ctx, canvasSize, blueProp, bluePropImage, bluePropViewBox);
  }
  if (redProp) {
    drawProp(ctx, canvasSize, redProp, redPropImage, redPropViewBox);
  }

  if (!overlay) return;

  ctx.save();
  ctx.scale(scale, scale);

  const { stepIndex, isStartPosition, letterGlyphs } = overlay;
  const stepNumber = isStartPosition ? 0 : stepIndex + 1;

  ctx.fillStyle = STEP_NUM_COLOR;
  ctx.font = STEP_NUM_FONT;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(stepNumber === 0 ? "Start" : String(stepNumber), STEP_NUM_X, STEP_NUM_Y - 80);

  if (stepIndex >= 0 && stepIndex < letterGlyphs.length) {
    const glyph = letterGlyphs[stepIndex]!;
    const aspect = glyph.width / glyph.height;
    const drawW = aspect >= 1 ? GLYPH_MAX_SIZE : GLYPH_MAX_SIZE * aspect;
    const drawH = aspect >= 1 ? GLYPH_MAX_SIZE / aspect : GLYPH_MAX_SIZE;
    ctx.drawImage(glyph, GLYPH_X, GLYPH_Y, drawW, drawH);
  }

  ctx.restore();
}
