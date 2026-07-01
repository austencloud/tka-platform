/**
 * Choreo sheet PDF exporter.
 *
 * Builds a print-ready landscape US-Letter PDF (792×612pt) from a sheet and its
 * hydrated sequences. Each step cell is rasterized once at 300 DPI through the
 * existing card render stack (PictographPreparer → Canvas2DDirectRenderer),
 * embedded as a PNG, and positioned by the shared geometry + planner — the same
 * `getSheetPageLayout()` + `planSheet()` the live preview uses, so the PDF lays
 * out identically. Identical pictographs embed once (keyed by rendered identity).
 *
 * Step numbers and block separators are drawn as vector text/lines by pdf-lib so
 * they stay crisp at any zoom.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage } from "pdf-lib";
import { getSheetPageLayout, type SheetPageGeometry } from "../domain/sheet-page-layout";
import { planSheet, type SheetPage } from "./sheet-row-planner";
import { SHEET_CELL_VISIBILITY } from "./sheet-cell-config";
import type { ChoreoSheet } from "../domain/types/choreo-sheet";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { RenderCanvas } from "$lib/shared/render/services/types";
import { Canvas2DDirectRenderer } from "$lib/shared/render/services/canvas-2d-direct-renderer";
import { pictographPreparer } from "$lib/shared/pictograph/shared/services/pictograph-preparer";
import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

const PRINT_DPI = 300;

// Pixel size of one rasterized cell. A ~1.28" cell at 300 DPI is ~384px — crisp
// for print, cheap to embed.
function cellRasterSizePx(geo: SheetPageGeometry): number {
  return Math.max(1, Math.round((geo.cellSizePt / 72) * PRINT_DPI));
}

// Identity key for raster de-dup: identical letter + blue/red motion + reversals
// + prop types render to identical pixels, so they share one embedded PNG. This
// mirrors what the preparer's own cache keys on.
function cellRasterKey(step: StepData, blueProp: PropType, redProp: PropType): string {
  const motions = step.motions ?? {};
  const fingerprint = (m: (typeof motions)["blue"]): string =>
    m
      ? [m.motionType, m.startLocation, m.endLocation, m.rotationDirection, m.turns, m.startOrientation, m.endOrientation].join(",")
      : "none";
  return [
    step.letter ?? "none",
    step.gridMode ?? "",
    fingerprint(motions.blue),
    fingerprint(motions.red),
    step.blueReversal ? "B" : "",
    step.redReversal ? "R" : "",
    blueProp,
    redProp,
  ].join("|");
}

// RenderCanvas is an OffscreenCanvas in workers/modern browsers, HTMLCanvasElement
// on the fallback path. Both encode to PNG bytes, just via different APIs.
async function canvasToPngBytes(canvas: RenderCanvas): Promise<Uint8Array> {
  if (typeof OffscreenCanvas !== "undefined" && canvas instanceof OffscreenCanvas) {
    const blob = await canvas.convertToBlob({ type: "image/png" });
    return new Uint8Array(await blob.arrayBuffer());
  }
  const html = canvas as HTMLCanvasElement;
  const blob: Blob = await new Promise((resolve, reject) =>
    html.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas.toBlob returned null"))), "image/png"),
  );
  return new Uint8Array(await blob.arrayBuffer());
}

// Draw the step number in the cell's top-left corner. pdf-lib's y is the text
// baseline measured from the page bottom, so we sit it one font-height down from
// the cell's top edge.
function drawStepNumber(
  page: import("pdf-lib").PDFPage,
  font: PDFFont,
  value: number,
  cellX: number,
  cellBottomY: number,
  cellSizePt: number,
): void {
  const fontSize = Math.max(6, cellSizePt * 0.16);
  page.drawText(String(value), {
    x: cellX + cellSizePt * 0.06,
    y: cellBottomY + cellSizePt - fontSize - cellSizePt * 0.04,
    size: fontSize,
    font,
    color: rgb(0.1, 0.1, 0.1),
  });
}

export async function buildChoreoSheetPDF(
  sheet: ChoreoSheet,
  hydrated: readonly SequenceData[], // normalized rows, in order (see ChoreoSheetView)
  onProgress?: (done: number, total: number) => void,
  breakSequenceIds: Set<string> = new Set(),
): Promise<Blob> {
  const geo = getSheetPageLayout(sheet.layout);
  const pages: SheetPage[] = planSheet(hydrated, sheet.layout);

  // Match the live preview's prop types — PictographContainer falls back to the
  // user's settings when no override is given, so the print uses the same.
  const blueProp = settingsService.settings.bluePropType ?? PropType.STAFF;
  const redProp = settingsService.settings.redPropType ?? PropType.STAFF;

  const renderer = new Canvas2DDirectRenderer();
  await renderer.initialize();
  const rasterPx = cellRasterSizePx(geo);

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  // Count non-blank cells up front so progress is meaningful card-by-card.
  let total = 0;
  for (const page of pages) for (const row of page.rows) for (const cell of row.cells) if (!cell.isBlank && cell.step) total++;
  let done = 0;
  onProgress?.(done, total);

  // Embed-once cache: rendered-identity → PDFImage.
  const imageCache = new Map<string, PDFImage>();

  const separatorColor = rgb(0.4, 0.4, 0.4);
  const cellStroke = rgb(0.8, 0.8, 0.8); // ≈ preview rgba(0,0,0,0.18) on white
  const blankStroke = rgb(0.92, 0.92, 0.92);
  const breakColor = rgb(0.9, 0.24, 0.24);
  const stride = geo.cellSizePt + geo.gutterPt;

  let pageIndex = -1;
  for (const page of pages) {
    pageIndex++;
    const pdfPage = pdf.addPage([geo.pageWidthPt, geo.pageHeightPt]);

    for (let ri = 0; ri < page.rows.length; ri++) {
      const row = page.rows[ri]!;

      for (let ci = 0; ci < row.cells.length; ci++) {
        const cell = row.cells[ci]!;

        // pdf-lib draws from the bottom-left; the page origin is bottom-left too.
        const cellX = geo.marginXPt + ci * stride;
        const cellBottomY = geo.pageHeightPt - geo.marginYPt - ri * stride - geo.cellSizePt;

        // Outline every cell (blanks fainter) so the grid reads as discrete boxes.
        pdfPage.drawRectangle({
          x: cellX,
          y: cellBottomY,
          width: geo.cellSizePt,
          height: geo.cellSizePt,
          borderColor: cell.isBlank ? blankStroke : cellStroke,
          borderWidth: 0.75,
        });

        // Sequences flow continuously, so a boundary is a VERTICAL edge on the
        // sequence-start cell (it can land mid-row), matching the preview.
        const isFirstCell = pageIndex === 0 && ri === 0 && ci === 0;
        if (sheet.layout.groupSeparator === "rule" && cell.isSequenceStart && !isFirstCell) {
          pdfPage.drawLine({
            start: { x: cellX, y: cellBottomY },
            end: { x: cellX, y: cellBottomY + geo.cellSizePt },
            thickness: 1,
            color: separatorColor,
          });
        }

        // Break: thick red left edge + label on a sequence start that doesn't
        // connect to the sequence before it. Independent of separator style.
        if (cell.isSequenceStart && cell.sequenceId && breakSequenceIds.has(cell.sequenceId)) {
          pdfPage.drawLine({
            start: { x: cellX, y: cellBottomY },
            end: { x: cellX, y: cellBottomY + geo.cellSizePt },
            thickness: 2.5,
            color: breakColor,
          });
          pdfPage.drawText("break", {
            x: cellX + 2,
            y: cellBottomY + 2,
            size: 6,
            font,
            color: breakColor,
          });
        }

        if (cell.isBlank || !cell.step) continue;
        const step = cell.step;

        const key = cellRasterKey(step, blueProp, redProp);
        let img = imageCache.get(key);
        if (!img) {
          const prepared = await pictographPreparer.prepareSingle(step, {
            themeMode: "light",
            bluePropType: blueProp,
            redPropType: redProp,
          });
          const canvas = await renderer.renderPictograph(prepared, {
            size: rasterPx,
            visibility: { ...SHEET_CELL_VISIBILITY, darkMode: false, bluePropType: blueProp, redPropType: redProp },
          });
          const bytes = await canvasToPngBytes(canvas);
          img = await pdf.embedPng(bytes);
          imageCache.set(key, img);
        }

        pdfPage.drawImage(img, { x: cellX, y: cellBottomY, width: geo.cellSizePt, height: geo.cellSizePt });

        // Step numbers honor the sheet flag; start positions (stepNumber 0) never
        // get one, though the planner only feeds actual steps (>= 1).
        if (sheet.layout.showStepNumbers && step.stepNumber && step.stepNumber > 0) {
          drawStepNumber(pdfPage, font, step.stepNumber, cellX, cellBottomY, geo.cellSizePt);
        }

        done++;
        onProgress?.(done, total);
      }
    }
  }

  renderer.dispose();
  const bytes = await pdf.save();
  return new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
}

/** Build the sheet PDF and trigger a browser download. Mirrors downloadCodexSheetPDF. */
export async function downloadChoreoSheetPDF(
  sheet: ChoreoSheet,
  hydrated: readonly SequenceData[],
  filename = "choreo-sheet.pdf",
  onProgress?: (done: number, total: number) => void,
  breakSequenceIds: Set<string> = new Set(),
): Promise<void> {
  const blob = await buildChoreoSheetPDF(sheet, hydrated, onProgress, breakSequenceIds);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
