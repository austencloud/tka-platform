import type { LayoutRegion } from "$lib/shared/media-composition/domain/media-layout-schema";

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MediaFitInput {
  sourceWidth: number;
  sourceHeight: number;
  regionWidth: number;
  regionHeight: number;
  fit: LayoutRegion["fit"];
}

export interface MediaFitResult {
  /** Destination rectangle relative to the region. Cover may extend past it. */
  drawRect: PixelRect;
  /** Source pixels visible after the region clips the destination rectangle. */
  visibleSourceRect: PixelRect;
}

function assertPositive(label: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive finite number`);
  }
}

/**
 * One geometry owner for browser preview and the future frame evaluator.
 * Coordinates are source/destination pixels, with centered positioning.
 */
export function calculateMediaFit(input: MediaFitInput): MediaFitResult {
  assertPositive("sourceWidth", input.sourceWidth);
  assertPositive("sourceHeight", input.sourceHeight);
  assertPositive("regionWidth", input.regionWidth);
  assertPositive("regionHeight", input.regionHeight);

  if (input.fit === "fill") {
    return {
      drawRect: {
        x: 0,
        y: 0,
        width: input.regionWidth,
        height: input.regionHeight,
      },
      visibleSourceRect: {
        x: 0,
        y: 0,
        width: input.sourceWidth,
        height: input.sourceHeight,
      },
    };
  }

  const scaleX = input.regionWidth / input.sourceWidth;
  const scaleY = input.regionHeight / input.sourceHeight;
  const scale =
    input.fit === "cover" ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);
  const drawWidth = input.sourceWidth * scale;
  const drawHeight = input.sourceHeight * scale;
  const drawX = (input.regionWidth - drawWidth) / 2;
  const drawY = (input.regionHeight - drawHeight) / 2;

  if (input.fit === "contain") {
    return {
      drawRect: { x: drawX, y: drawY, width: drawWidth, height: drawHeight },
      visibleSourceRect: {
        x: 0,
        y: 0,
        width: input.sourceWidth,
        height: input.sourceHeight,
      },
    };
  }

  const visibleWidth = input.regionWidth / scale;
  const visibleHeight = input.regionHeight / scale;
  return {
    drawRect: { x: drawX, y: drawY, width: drawWidth, height: drawHeight },
    visibleSourceRect: {
      x: (input.sourceWidth - visibleWidth) / 2,
      y: (input.sourceHeight - visibleHeight) / 2,
      width: visibleWidth,
      height: visibleHeight,
    },
  };
}
