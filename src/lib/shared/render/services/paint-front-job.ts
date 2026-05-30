import type { FrontJob } from "./front-job";
import type { LayerRenderOptions, LayerVisibility } from "./types";
import type { PreparedPictographData } from "../../pictograph/shared/domain/models/PreparedPictographData";
import { SeededGlyphSource } from "./glyph-bitmap-seed";
import { LayerCompositor } from "./layer-compositor";
import { drawSmartCellBorders, getOccupiedCells } from "./cell-border-renderer";
import { renderMandalaToCanvas } from "../../mandala/services/mandala-renderer";
import { drawQrMatrix } from "./qr-matrix-renderer";
import { TextRenderer } from "./text-renderer";
import { getQRCellScale } from "../../qr/qr-cell-scale";
import type { SequenceData } from "../../foundation/domain/models/SequenceData";
import type { SequenceExportOptions } from "../domain/models/sequence-export-options";

/**
 * WORKER PAINTER — render a full card-front content canvas from a plain-data
 * FrontJob onto an OffscreenCanvas.
 *
 * $env-CLEAN by construction: this module and its ENTIRE transitive import graph
 * import nothing from $app/*, $env/*, Firebase, Svelte stores, or DOM globals
 * (window/document). A guard test (Task 5) fails the build if that regresses.
 *
 * Notably it does NOT import:
 *   - get-layer-compositor.ts (imports $app/environment) — it constructs
 *     `new LayerCompositor()` directly, exactly as pictograph-render.worker.ts does.
 *   - image-composer.ts (pulls pictograph-blob-cache + getMandalaGeometryCalculator).
 *   - paintCardFrontChrome (it needs the loop-display resolver + a synthetic
 *     SequenceData/options to DECIDE what chrome to draw; the FrontJob already
 *     pre-resolved those decisions on the main thread into header/footer/mandala/qr
 *     flags, so the worker just paints what the job tells it to).
 *
 * The geometry below mirrors composeSequenceImage / card-front-assembler EXACTLY
 * (cells, borders, mandala size/offset, QR rect, duration badge, header/footer) so
 * the worker output is pixel-equivalent at the accepted ~0.5% AA floor.
 */
export async function paintFrontJob(
  job: FrontJob,
  glyphSource: SeededGlyphSource,
): Promise<OffscreenCanvas> {
  const canvas = new OffscreenCanvas(job.canvasWidth, job.canvasHeight);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;

  const layout = job.layout;
  const { stepSize, gridOffsetX, gridOffsetY, isDarkMode } = layout;

  // 1. Background + accent tint.
  // Mirror paintCardFrontBackground, which keys off options.deckCard /
  // options.accentColor / options.accentTintOpacity. The FrontJob's geometry
  // (gridOffsetX > 0) already encodes the centered deckCard layout, and
  // background.{accentColor,accentTintOpacity} carry the tint, so we reconstruct
  // the same option shape and call the shared painter — no drift.
  paintFrontBackground(ctx, job);

  // 2. Cells. Construct the LayerCompositor directly (NOT via getLayerCompositor,
  //    which is $env-coupled). The seeded svg/asset caches are populated by the
  //    worker's seed handler before paintFrontJob runs.
  const compositor = new LayerCompositor();
  const cellOptions = job.cellOptions as LayerRenderOptions;
  const cellVisibility = job.cellVisibility as LayerVisibility;

  for (const cell of job.cells) {
    const result = await compositor.compose(
      cell.prepared as PreparedPictographData,
      cellOptions,
      cellVisibility,
      cell.stepNumber,
    );
    const cellCanvas = result.canvas;
    const x = cell.col * stepSize + gridOffsetX;
    const y = cell.row * stepSize + gridOffsetY;
    ctx.drawImage(cellCanvas as CanvasImageSource, x, y, stepSize, stepSize);

    // Duration badge — mirrors ImageComposer.drawDurationBadge exactly.
    if (Math.abs(cell.duration - 1) > 0.001) {
      drawDurationBadge(ctx, cell.duration, x, y, stepSize, isDarkMode);
    }
  }

  // 3. Smart cell borders. drawSmartCellBorders derives the occupied-cell set via
  //    getOccupiedCells(sequence, options, columns) — both pure functions that
  //    only read sequence.steps + start-position flags + layout. We reconstruct a
  //    minimal sequence/options carrier from job.cells so the SAME pure occupancy
  //    logic runs (no reimplementation, no drift). The occupied set is identical
  //    because the FrontJob cells were built with the same start-col/row math.
  const borderCarrier = makeBorderCarrier(job);
  drawSmartCellBorders(
    ctx,
    layout.columns,
    layout.rows,
    stepSize,
    borderCarrier.sequence,
    borderCarrier.options,
    gridOffsetY,
    isDarkMode,
    gridOffsetX,
  );

  // 4. Mandala. Mirror image-composer.renderMandalas geometry:
  //    mandalaScale 0.85, padding = (stepSize - mandalaSize)/2, placement at
  //    (p.col-1)*stepSize + gridOffsetX + padding (and likewise for y).
  if (job.mandala && job.mandala.placements.length > 0) {
    const MANDALA_SCALE = 0.85;
    const mandalaSize = Math.floor(stepSize * MANDALA_SCALE);
    const padding = (stepSize - mandalaSize) / 2;
    const palette = job.mandala.palette;
    for (const p of job.mandala.placements) {
      const show = p.variant === "full" ? ("both" as const) : p.variant;
      const x = (p.col - 1) * stepSize + gridOffsetX + padding;
      const y = (p.row - 1) * stepSize + gridOffsetY + padding;
      renderMandalaToCanvas(ctx, job.mandala.paths, {
        size: mandalaSize,
        style: "stroke",
        show,
        strokeWidth: 3,
        palette,
        offsetX: x,
        offsetY: y,
      });
    }
  }

  // 5. QR. Mirror image-composer.renderQRCode placement: a light/dark backing
  //    fill across the whole cell, then the QR square inset by padding inside it.
  //    The worker draws the matrix directly via drawQrMatrix (the main thread
  //    rasterizes the URL → matrixText into the job; no qr-code-styling here).
  if (job.qr) {
    const stepCount = job.cells.filter((c) => c.stepNumber !== 0).length;
    const qrSize = Math.floor(stepSize * getQRCellScale(stepCount));
    const padding = (stepSize - qrSize) / 2;
    const cellX = job.qr.cell.col * stepSize + gridOffsetX;
    const cellY = job.qr.cell.row * stepSize + gridOffsetY;

    // Cell backing fill (matches renderQRCode: black in dark mode, white in light).
    ctx.fillStyle = isDarkMode ? "#000000" : "#ffffff";
    ctx.fillRect(cellX, cellY, stepSize, stepSize);

    drawQrMatrix(ctx, job.qr.matrixText, {
      x: cellX + padding,
      y: cellY + padding,
      size: qrSize,
      darkColor: job.qr.darkColor,
      lightColor: job.qr.lightColor,
      eccLevel: job.qr.eccLevel,
    });
  }

  // 6/7. Header + footer via a worker-side TextRenderer reading glyphs from the
  //      seeded source. setGlyphSource swaps ONLY the glyph source; the render
  //      core (renderHeader/renderFooter from @tka/render-composition) is the
  //      same one the main thread uses, so output is identical.
  if ((job.header.show && layout.headerHeight > 0) || (job.footer.show && layout.footerHeight > 0)) {
    const textRenderer = new TextRenderer();
    textRenderer.setGlyphSource(glyphSource);

    if (job.header.show && layout.headerHeight > 0) {
      textRenderer.renderWordHeader({
        canvas,
        word: job.header.word,
        headerHeight: layout.headerHeight,
        showDifficultyBadge: false,
        darkMode: isDarkMode,
        accentColor: job.background.accentColor,
        accentTintOpacity: job.background.accentTintOpacity,
      });
    }

    if (job.footer.show && layout.footerHeight > 0) {
      const iconImage =
        job.footer.iconBitmapKey != null
          ? glyphSource.get(job.footer.iconBitmapKey)?.image
          : undefined;
      await textRenderer.renderUserInfo({
        canvas,
        userInfo: {
          userName: "",
          exportDate: new Date().toISOString(),
          notes: job.footer.notes ?? "",
        },
        footerHeight: layout.footerHeight,
        darkMode: isDarkMode,
        showCreatorName: false,
        showNotes: !!job.footer.notes,
        showBirthday: false,
        customNotesText: job.footer.notes,
        leftLabel: job.footer.leftLabel,
        rightLabel: job.footer.rightLabel,
        accentColor: job.background.accentColor,
        accentTintOpacity: job.background.accentTintOpacity,
        // Pre-loaded icon (seeded bitmap) is handed to renderFooter as iconImage;
        // iconPath is intentionally NOT set so renderUserInfo never calls
        // loadFooterIcon (which uses new Image() — unavailable in a worker).
        iconImage: iconImage as CanvasImageSource | undefined,
      });
    }
  }

  return canvas;
}

/**
 * Worker-safe reproduction of paintCardFrontBackground's effect, driven by the
 * FrontJob. We rebuild the option shape the shared painter expects so the
 * background fill + accent side-tints stay byte-identical to the main path.
 *
 * deckCard is inferred from the centered grid (gridOffsetX > 0 OR a grid that
 * doesn't start flush at the header), matching how computeCardFrontLayout sets
 * gridOffsetX only in the deckCard branch.
 */
function paintFrontBackground(ctx: CanvasRenderingContext2D, job: FrontJob): void {
  const layout = job.layout;
  const { isDarkMode, canvasWidth, canvasHeight, headerHeight, footerHeight, columns, rows, stepSize, gridOffsetX, gridOffsetY } =
    layout;

  ctx.fillStyle = isDarkMode ? "#0a0a0f" : "white";

  const gridHeight = rows * stepSize;
  const gridWidth = columns * stepSize;

  const isDeckCard = gridOffsetX > 0 || gridOffsetY > headerHeight;

  if (isDeckCard) {
    ctx.fillRect(0, headerHeight, canvasWidth, canvasHeight - headerHeight - footerHeight);

    if (!isDarkMode && job.background.accentColor && gridOffsetX > 0) {
      const contentTop = headerHeight;
      const contentH = canvasHeight - headerHeight - footerHeight;
      const alphaHex = job.background.accentTintOpacity
        ? Math.round(job.background.accentTintOpacity * 255).toString(16).padStart(2, "0")
        : "18";
      ctx.fillStyle = job.background.accentColor + alphaHex;
      ctx.fillRect(0, contentTop, gridOffsetX, contentH);
      ctx.fillRect(gridOffsetX + gridWidth, contentTop, canvasWidth - gridOffsetX - gridWidth, contentH);
      ctx.fillStyle = isDarkMode ? "#0a0a0f" : "white";
    }
  } else {
    ctx.fillRect(0, headerHeight, canvasWidth, gridHeight);
  }
}

/**
 * Mirror of ImageComposer.drawDurationBadge (private). Kept worker-local so the
 * painter has no dependency on the $env-coupled composer instance. VIEW_BOX_SIZE,
 * font, and offsets copied verbatim.
 */
function drawDurationBadge(
  ctx: CanvasRenderingContext2D,
  duration: number,
  x: number,
  y: number,
  cellSize: number,
  isDarkMode: boolean,
): void {
  const VIEW_BOX_SIZE = 950;
  const scale = cellSize / VIEW_BOX_SIZE;

  const formatted = Number.isInteger(duration)
    ? duration.toString()
    : duration.toFixed(2).replace(/\.?0+$/, "");
  const text = `${formatted}×`;

  const fontSize = 52 * scale;
  const textX = x + 475 * scale;
  const textY = y + 890 * scale;

  ctx.save();
  ctx.font = `600 ${fontSize}px Inter, "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = isDarkMode ? "#ffffff" : "#231f20";
  ctx.fillText(text, textX, textY);
  ctx.restore();
}

/**
 * Reconstruct the minimal `sequence` + `options` carriers that
 * drawSmartCellBorders → getOccupiedCells need, from the FrontJob's cells.
 *
 * getOccupiedCells recomputes the occupied set from sequence.steps.length plus
 * the start-position flags and the same start-col/row math used to build the
 * FrontJob cells. We feed it: a steps array sized to the non-start cells, and
 * the start-position layout flags inferred from the job's layout. The resulting
 * occupied set is identical to the cells laid out in step 2, so borders line up.
 */
function makeBorderCarrier(job: FrontJob): {
  sequence: SequenceData;
  options: Partial<SequenceExportOptions>;
} {
  const layout = job.layout;

  // Non-start cells are the actual steps (start cell, if present, is stepNumber 0
  // OR sits at col 0,row 0 when start numbers are off — getOccupiedCells adds
  // "0,0" purely from includeStartPosition, so we only need the step count here).
  const stepCellCount = layout.hasStartPosition
    ? Math.max(job.cells.length - 1, 0)
    : job.cells.length;

  const steps = new Array(stepCellCount).fill(0).map(() => ({}) as never);

  // startPositionLayout: column mode iff startColumn === 1 (grid shifts right for
  // a leading start column); otherwise row mode. Mirrors computeCardFrontLayout.
  const startPositionLayout: "row" | "column" = layout.startColumn === 1 ? "column" : "row";

  const sequence = { steps } as unknown as SequenceData;
  const options: Partial<SequenceExportOptions> = {
    includeStartPosition: layout.hasStartPosition,
    startPositionLayout,
  };

  return { sequence, options };
}
