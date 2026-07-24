import { PURPLE_STROKE } from "../domain/mandala-constants";

type MandalaCanvasContext =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;

export interface MandalaOverlapCompositeOptions {
  targetContext: MandalaCanvasContext;
  overlapMaskContext: OffscreenCanvasRenderingContext2D;
  overlapMaskCanvas: OffscreenCanvas;
  otherMaskCanvas: OffscreenCanvas;
  width: number;
  height: number;
  color?: string;
  alpha?: number;
  shadowBlur?: number;
}

/**
 * Intersect two already-painted hand masks, color that intersection purple,
 * then place it over the normal blue and red strokes.
 */
export function compositeMandalaOverlap({
  targetContext,
  overlapMaskContext,
  overlapMaskCanvas,
  otherMaskCanvas,
  width,
  height,
  color = PURPLE_STROKE,
  alpha = 0.9,
  shadowBlur,
}: MandalaOverlapCompositeOptions): void {
  overlapMaskContext.setTransform(1, 0, 0, 1, 0, 0);
  overlapMaskContext.globalCompositeOperation = "destination-in";
  overlapMaskContext.drawImage(otherMaskCanvas, 0, 0);

  overlapMaskContext.globalCompositeOperation = "source-in";
  overlapMaskContext.fillStyle = color;
  overlapMaskContext.fillRect(0, 0, width, height);

  targetContext.save();
  targetContext.setTransform(1, 0, 0, 1, 0, 0);
  targetContext.globalCompositeOperation = "source-over";
  targetContext.globalAlpha = alpha;
  if (shadowBlur !== undefined) {
    targetContext.shadowColor = color;
    targetContext.shadowBlur = shadowBlur;
  }
  targetContext.drawImage(overlapMaskCanvas, 0, 0);
  targetContext.restore();
}
