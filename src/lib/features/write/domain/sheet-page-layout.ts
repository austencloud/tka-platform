/**
 * Landscape choreo-sheet page geometry.
 *
 * v1: US-Letter landscape (792 x 612 pt). Cells are square (a pictograph's
 * viewBox is square), sized by the page width / column count, then clamped so the
 * row count also fits the page height. The grid is centered on both axes.
 * paperSize / orientation are reserved for future variants (A4, portrait).
 */
import type { ChoreoSheetLayout } from "./types/choreo-sheet";

// US Letter in points (1 inch = 72pt)
const LETTER_LONG_PT = 792; // 11"
const LETTER_SHORT_PT = 612; // 8.5"
const MARGIN_PT = 18;
const GUTTER_PT = 3;

export interface SheetPageGeometry {
  pageWidthPt: number;
  pageHeightPt: number;
  columns: number;
  rows: number;
  cellSizePt: number; // square
  gutterPt: number;
  marginXPt: number;
  marginYPt: number;
  cellsPerPage: number;
}

type GeometryInput = Pick<ChoreoSheetLayout, "columns" | "rowsPerPage" | "paperSize" | "orientation">;

export function getSheetPageLayout(layout: GeometryInput): SheetPageGeometry {
  // v1: letter landscape only.
  const pageWidthPt = LETTER_LONG_PT;
  const pageHeightPt = LETTER_SHORT_PT;
  const { columns } = layout;
  const rows = layout.rowsPerPage;

  const usableW = pageWidthPt - 2 * MARGIN_PT;
  const usableH = pageHeightPt - 2 * MARGIN_PT;
  const widthBound = (usableW - (columns - 1) * GUTTER_PT) / columns;
  const heightBound = (usableH - (rows - 1) * GUTTER_PT) / rows;
  const cellSizePt = Math.min(widthBound, heightBound);

  const gridW = columns * cellSizePt + (columns - 1) * GUTTER_PT;
  const gridH = rows * cellSizePt + (rows - 1) * GUTTER_PT;

  return {
    pageWidthPt,
    pageHeightPt,
    columns,
    rows,
    cellSizePt,
    gutterPt: GUTTER_PT,
    marginXPt: (pageWidthPt - gridW) / 2,
    marginYPt: (pageHeightPt - gridH) / 2,
    cellsPerPage: columns * rows,
  };
}
