/**
 * Choreo-sheet page geometry.
 *
 * US-Letter, landscape (792 x 612 pt) or portrait (612 x 792 pt). Cells are
 * square (a pictograph's viewBox is square), sized by the rail-adjusted usable
 * width / column count. The annotated ("aligned") branch reserves a left rail
 * for cue timestamps and a per-band note strip, and packs bands by measured
 * height. The continuous-flow ("flow") study branch still lays out by fixed
 * `rows`/`cellsPerPage` and does its own centering.
 */
import type { ChoreoSheetLayout } from "./types/choreo-sheet";

// US Letter in points (1 inch = 72pt)
const LETTER_LONG_PT = 792; // 11"
const LETTER_SHORT_PT = 612; // 8.5"
const MARGIN_PT = 18;
const GUTTER_PT = 3;

const RAIL_WIDTH_PT = 64; // ~0.9" left column for timestamp + cue
const STRIP_FACTOR = 0.5; // note-strip base height as a fraction of a cell
const INTER_BAND_GUTTER_PT = 6;

export interface SheetPageGeometry {
  pageWidthPt: number;
  pageHeightPt: number;
  columns: number;
  cellSizePt: number; // square
  gutterPt: number;
  marginXPt: number;
  marginYPt: number;
  railWidthPt: number; // 0 when cue rail hidden
  stripBaseHeightPt: number; // 0 when note strips hidden
  interBandGutterPt: number;
  usableWidthPt: number; // grid area width (page − margins − rail)
  usableHeightPt: number; // grid area height (page − margins)
  orientation: "landscape" | "portrait";
  // Retained for the flow branch, which still lays out by fixed rows:
  rows: number;
  cellsPerPage: number;
}

type GeometryInput = Pick<
  ChoreoSheetLayout,
  "columns" | "rowsPerPage" | "orientation" | "packing" | "showCueRail" | "showNoteStrips"
>;

export function getSheetPageLayout(layout: GeometryInput): SheetPageGeometry {
  const portrait = layout.orientation === "portrait";
  const pageWidthPt = portrait ? LETTER_SHORT_PT : LETTER_LONG_PT;
  const pageHeightPt = portrait ? LETTER_LONG_PT : LETTER_SHORT_PT;

  const { columns } = layout;
  const railWidthPt = layout.showCueRail ? RAIL_WIDTH_PT : 0;

  const usableW = pageWidthPt - 2 * MARGIN_PT - railWidthPt;
  const usableH = pageHeightPt - 2 * MARGIN_PT;

  // Cell width is set by the columns fitting the rail-adjusted usable width.
  const cellSizePt = (usableW - (columns - 1) * GUTTER_PT) / columns;
  const stripBaseHeightPt = layout.showNoteStrips ? cellSizePt * STRIP_FACTOR : 0;

  // Flow-branch fixed-row values (unchanged semantics) so today's dense sheet keeps
  // rendering identically; the aligned branch ignores `rows` and packs by height.
  const rows = layout.rowsPerPage;

  return {
    pageWidthPt,
    pageHeightPt,
    columns,
    cellSizePt,
    gutterPt: GUTTER_PT,
    marginXPt: MARGIN_PT + railWidthPt, // grid starts right of the rail
    marginYPt: MARGIN_PT,
    railWidthPt,
    stripBaseHeightPt,
    interBandGutterPt: INTER_BAND_GUTTER_PT,
    usableWidthPt: usableW,
    usableHeightPt: usableH,
    orientation: portrait ? "portrait" : "landscape",
    rows,
    cellsPerPage: columns * rows,
  };
}
