import { PDFDocument, rgb } from "pdf-lib";
import type { StickerSheet, StickerUnit } from "../domain/sticker-types";
import {
  SHEET_DIMENSIONS_IN, STICKER_GAP_IN, STICKER_TILE_SIZE_PX, STICKER_DPI, } from "../domain/sticker-constants";
import { renderStickerUnitSVG } from "./sticker-unit-renderer";
import { rasterizeSvgToPng } from "./rasterize-svg";
import type { StickerMandalaLookup } from "./types";

const PDF_POINTS_PER_INCH = 72;

interface Placement {
  unit: StickerUnit;
  /** Page index (0-based). */
  page: number;
  /** Center position in inches, measured from page bottom-left (PDF coordinate space). */
  centerXIn: number;
  centerYIn: number;
}

export class StickerSheetPdfExporter {
  async export(sheet: StickerSheet, lookup: StickerMandalaLookup): Promise<Uint8Array> {
    const placements = this.computePlacements(sheet);
    const doc = await PDFDocument.create();

    const pageCount = placements.length > 0 ? Math.max(...placements.map((p) => p.page)) + 1 : 1;
    const { width: sheetWIn, height: sheetHIn } = SHEET_DIMENSIONS_IN[sheet.sheetSize];
    const pageWPts = sheetWIn * PDF_POINTS_PER_INCH;
    const pageHPts = sheetHIn * PDF_POINTS_PER_INCH;

    for (let i = 0; i < pageCount; i++) {
      doc.addPage([pageWPts, pageHPts]);
    }

    // Rasterize all stickers in parallel
    const rasterJobs = placements.map(async (placement) => {
      const paths = lookup.getPaths(placement.unit.primitiveRef.shapeHash);
      if (!paths) return null;
      const svg = renderStickerUnitSVG(placement.unit, paths);
      const png = await rasterizeSvgToPng(svg, STICKER_TILE_SIZE_PX, STICKER_TILE_SIZE_PX);
      return { placement, png };
    });
    const results = await Promise.all(rasterJobs);

    // Embed into PDF sequentially (pdf-lib is not concurrent-safe for page ops)
    for (const result of results) {
      if (!result) continue;
      const { placement, png } = result;
      const image = await doc.embedPng(png);

      const page = doc.getPage(placement.page);
      const tileSizePts = (STICKER_TILE_SIZE_PX / STICKER_DPI) * PDF_POINTS_PER_INCH; // 960/300 * 72 = 230.4
      const xPts = placement.centerXIn * PDF_POINTS_PER_INCH - tileSizePts / 2;
      const yPts = placement.centerYIn * PDF_POINTS_PER_INCH - tileSizePts / 2;

      page.drawImage(image, {
        x: xPts,
        y: yPts,
        width: tileSizePts,
        height: tileSizePts,
      });

      // Draw cut line (3" diameter circle) as a dashed thin line.
      const cutRadiusPts = 1.5 * PDF_POINTS_PER_INCH;
      page.drawCircle({
        x: placement.centerXIn * PDF_POINTS_PER_INCH,
        y: placement.centerYIn * PDF_POINTS_PER_INCH,
        size: cutRadiusPts,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.5,
        borderDashArray: [3, 3],
      });
    }

    // Registration marks: small crosses in each corner, 0.25" from page edges.
    for (let i = 0; i < pageCount; i++) {
      drawRegistrationMarks(doc.getPage(i), pageWPts, pageHPts);
    }

    return await doc.save();
  }

  private computePlacements(sheet: StickerSheet): Placement[] {
    const { width: sheetWIn, height: sheetHIn } = SHEET_DIMENSIONS_IN[sheet.sheetSize];
    const stickerDiameterIn = 3;
    const pitchIn = stickerDiameterIn + STICKER_GAP_IN;

    const cols = Math.floor((sheetWIn + STICKER_GAP_IN) / pitchIn);
    const rows = Math.floor((sheetHIn + STICKER_GAP_IN) / pitchIn);
    const perPage = cols * rows;
    if (perPage === 0) return [];

    // Centered grid: compute total packed width/height, then leading margin.
    const gridWIn = cols * stickerDiameterIn + (cols - 1) * STICKER_GAP_IN;
    const gridHIn = rows * stickerDiameterIn + (rows - 1) * STICKER_GAP_IN;
    const marginXIn = (sheetWIn - gridWIn) / 2;
    const marginYIn = (sheetHIn - gridHIn) / 2;

    // Expand each unit into its copies, flattening order.
    const flattened: StickerUnit[] = [];
    for (const unit of sheet.stickers) {
      for (let c = 0; c < unit.copies; c++) flattened.push(unit);
    }

    const placements: Placement[] = [];
    for (let idx = 0; idx < flattened.length; idx++) {
      const page = Math.floor(idx / perPage);
      const onPage = idx % perPage;
      const row = Math.floor(onPage / cols);
      const col = onPage % cols;

      // PDF coordinates have origin at bottom-left, so y grows upward.
      const centerXIn = marginXIn + col * pitchIn + stickerDiameterIn / 2;
      const centerYIn = sheetHIn - (marginYIn + row * pitchIn + stickerDiameterIn / 2);

      placements.push({ unit: flattened[idx]!, page, centerXIn, centerYIn });
    }

    return placements;
  }
}

function drawRegistrationMarks(page: ReturnType<PDFDocument["getPage"]>, widthPts: number, heightPts: number): void {
  const inset = 0.25 * PDF_POINTS_PER_INCH;
  const len = 0.15 * PDF_POINTS_PER_INCH;
  const color = rgb(0, 0, 0);
  const lw = 0.5;

  const marks: Array<[number, number]> = [
    [inset, inset],
    [widthPts - inset, inset],
    [inset, heightPts - inset],
    [widthPts - inset, heightPts - inset],
  ];

  for (const [x, y] of marks) {
    page.drawLine({
      start: { x: x - len, y },
      end: { x: x + len, y },
      thickness: lw,
      color,
    });
    page.drawLine({
      start: { x, y: y - len },
      end: { x, y: y + len },
      thickness: lw,
      color,
    });
  }
}
