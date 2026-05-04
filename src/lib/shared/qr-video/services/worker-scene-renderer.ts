import type { FramePropState } from "../domain/qr-video-types";

const GRID_HALFWAY_POINT_OFFSET = 150;
const VIEWBOX_SIZE = 950;

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

export function renderScene(
  ctx: OffscreenCanvasRenderingContext2D,
  canvasSize: number,
  gridImage: ImageBitmap,
  bluePropImage: ImageBitmap,
  redPropImage: ImageBitmap,
  blueProp: FramePropState | null,
  redProp: FramePropState | null,
  bluePropViewBox: { width: number; height: number },
  redPropViewBox: { width: number; height: number }
): void {
  ctx.clearRect(0, 0, canvasSize, canvasSize);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  ctx.drawImage(gridImage, 0, 0, canvasSize, canvasSize);

  if (blueProp) {
    drawProp(ctx, canvasSize, blueProp, bluePropImage, bluePropViewBox);
  }
  if (redProp) {
    drawProp(ctx, canvasSize, redProp, redPropImage, redPropViewBox);
  }
}
