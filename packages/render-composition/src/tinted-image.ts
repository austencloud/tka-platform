type RenderContext =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;

interface ScratchCanvas {
  width: number;
  height: number;
  getContext(contextId: "2d"): RenderContext | null;
}

export const DARK_MONOCHROME_IMAGE_COLOR = "#e6e6e6";

function createScratchCanvas(
  ctx: RenderContext,
  width: number,
  height: number
): ScratchCanvas | null {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }

  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  // node-canvas exposes its constructor through ctx.canvas. This keeps the
  // shared package usable by the MCP renderer without depending on node-canvas.
  const sourceCanvas = (ctx as RenderContext & { canvas?: ScratchCanvas })
    .canvas;
  const CanvasConstructor = sourceCanvas?.constructor as
    | (new (canvasWidth: number, canvasHeight: number) => ScratchCanvas)
    | undefined;

  if (CanvasConstructor) {
    try {
      return new CanvasConstructor(width, height);
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Recolors an image from its alpha mask instead of relying on canvas filters.
 * Canvas filters are inconsistently implemented across main-thread, worker,
 * and node renderers; source-in compositing produces the same pixels in each.
 */
export function drawTintedImage(
  ctx: RenderContext,
  image: CanvasImageSource,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string
): void {
  const scratchWidth = Math.max(1, Math.ceil(width));
  const scratchHeight = Math.max(1, Math.ceil(height));
  const scratch = createScratchCanvas(ctx, scratchWidth, scratchHeight);
  const scratchCtx = scratch?.getContext("2d");

  if (!scratch || !scratchCtx) {
    ctx.drawImage(image, x, y, width, height);
    return;
  }

  scratchCtx.drawImage(image, 0, 0, width, height);
  scratchCtx.globalCompositeOperation = "source-in";
  scratchCtx.fillStyle = color;
  scratchCtx.fillRect(0, 0, scratchWidth, scratchHeight);

  ctx.drawImage(
    scratch as unknown as CanvasImageSource,
    0,
    0,
    width,
    height,
    x,
    y,
    width,
    height
  );
}

export function drawMonochromeImage(
  ctx: RenderContext,
  image: CanvasImageSource,
  x: number,
  y: number,
  width: number,
  height: number,
  darkMode: boolean,
  imageIsThemeColored = false
): void {
  if (!darkMode || imageIsThemeColored) {
    ctx.drawImage(image, x, y, width, height);
    return;
  }

  drawTintedImage(ctx, image, x, y, width, height, DARK_MONOCHROME_IMAGE_COLOR);
}
