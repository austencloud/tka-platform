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
// One cue's slot in the rail: timestamp line + a wrapped cue line. Only load-
// bearing when a band holds several cues (widening the pictograph size merges
// rows, and each merged row's cue keeps its own slot).
const RAIL_LINE_HEIGHT_PT = 26;

/**
 * Vertical space the page chrome takes off the grid, in points.
 *
 * These are RESERVATIONS, not measurements: the preview pins `.titleblock` and
 * `.runhead` to exactly these heights and the PDF advances by exactly these
 * heights, so the packer's arithmetic and what actually gets painted cannot
 * drift apart. Before they existed the packer budgeted the whole page for
 * bands, and page 1 — the one carrying a ~186pt title block — overflowed its
 * bottom margin, clipping the last row in portrait.
 *
 * The title block's height is fixed because every line is always rendered: the
 * choreographer, song, and tagline fields show placeholders when empty.
 */
export const TITLE_BLOCK_PT = 186;
export const RUNNING_HEADER_PT = 28;

/** Chrome height for a given page. Page 0 carries the title block (when shown);
 *  every page after it carries the running header. */
export function pageChromePt(pageIndex: number, showTitleBlock: boolean): number {
  if (pageIndex === 0) return showTitleBlock ? TITLE_BLOCK_PT : 0;
  return RUNNING_HEADER_PT;
}

export interface SheetPageGeometry {
  pageWidthPt: number;
  pageHeightPt: number;
  columns: number;
  cellSizePt: number; // square
  gutterPt: number;
  marginXPt: number;
  marginYPt: number;
  railWidthPt: number; // 0 when cue rail hidden
  railLineHeightPt: number; // vertical slot one cue occupies in the rail
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

  // Flow pages use every whole square row that physically fits. `rowsPerPage`
  // remains in saved layouts for backward compatibility, but treating its
  // landscape preset as a portrait cap stranded rows on a second page.
  const rows = Math.max(
    1,
    Math.floor((usableH + GUTTER_PT) / (cellSizePt + GUTTER_PT))
  );

  return {
    pageWidthPt,
    pageHeightPt,
    columns,
    cellSizePt,
    gutterPt: GUTTER_PT,
    marginXPt: MARGIN_PT + railWidthPt, // grid starts right of the rail
    marginYPt: MARGIN_PT,
    railWidthPt,
    railLineHeightPt: RAIL_LINE_HEIGHT_PT,
    stripBaseHeightPt,
    interBandGutterPt: INTER_BAND_GUTTER_PT,
    usableWidthPt: usableW,
    usableHeightPt: usableH,
    orientation: portrait ? "portrait" : "landscape",
    rows,
    cellsPerPage: columns * rows,
  };
}
