/**
 * Physical label-sheet templates for die-cut round label paper.
 *
 * Unlike free-cut sticker sheets (which center a packed grid), pre-die-cut
 * label paper has FIXED label centers. Printing must hit those centers exactly
 * or the art lands off the cut circle. So placement is driven by the template's
 * margins + center-to-center pitch, not a computed centered grid.
 *
 * The Spartan Industrial C006 product (3" round, 6 per sheet) does not publish
 * its exact offsets. Two standard 3"-6-up layouts exist in the wild; both are
 * provided as presets and every value is user-editable so a single 1:1 test
 * print resolves which the physical sheet uses.
 */

export interface LabelTemplate {
  readonly id: string;
  readonly label: string;
  /** Sheet size in inches. */
  readonly sheetWIn: number;
  readonly sheetHIn: number;
  /** Round label diameter in inches. */
  readonly diameterIn: number;
  readonly cols: number;
  readonly rows: number;
  /** Distance from sheet left edge to the FIRST label's left edge. */
  readonly marginLeftIn: number;
  /** Distance from sheet top edge to the FIRST label's top edge. */
  readonly marginTopIn: number;
  /** Center-to-center horizontal spacing. */
  readonly pitchXIn: number;
  /** Center-to-center vertical spacing. */
  readonly pitchYIn: number;
}

/** OnlineLabels OL2279 geometry — the most common 3" round 6-up letter layout. */
export const TEMPLATE_C006_STANDARD: LabelTemplate = {
  id: "c006-standard",
  label: "C006 / OL2279",
  sheetWIn: 8.5,
  sheetHIn: 11,
  diameterIn: 3,
  cols: 2,
  rows: 3,
  marginLeftIn: 0.75,
  marginTopIn: 0.5,
  pitchXIn: 4.0,
  pitchYIn: 3.5,
};

/** Avery 94513 geometry — 0.625" margins all around, wider gaps. */
export const TEMPLATE_AVERY_94513: LabelTemplate = {
  id: "avery-94513",
  label: "Avery 94513",
  sheetWIn: 8.5,
  sheetHIn: 11,
  diameterIn: 3,
  cols: 2,
  rows: 3,
  marginLeftIn: 0.625,
  marginTopIn: 0.625,
  pitchXIn: 4.25, // 3" + 1.25" gap
  pitchYIn: 3.375, // 3" + 0.375" gap
};

export const LABEL_TEMPLATE_PRESETS: readonly LabelTemplate[] = [
  TEMPLATE_C006_STANDARD,
  TEMPLATE_AVERY_94513,
];

export interface LabelCenter {
  /** 0-based column / row. */
  col: number;
  row: number;
  /** Center position in inches from sheet top-left. */
  cxIn: number;
  cyIn: number;
}

/**
 * Compute every label center for a template, optionally nudged by a global
 * offset (inches) to correct for printer drift. Order is row-major
 * (left-to-right, top-to-bottom) to match a 6-element sheet read top-down.
 */
export function computeLabelCenters(
  t: LabelTemplate,
  nudgeXIn = 0,
  nudgeYIn = 0
): LabelCenter[] {
  const centers: LabelCenter[] = [];
  for (let row = 0; row < t.rows; row++) {
    for (let col = 0; col < t.cols; col++) {
      centers.push({
        col,
        row,
        cxIn: t.marginLeftIn + t.diameterIn / 2 + col * t.pitchXIn + nudgeXIn,
        cyIn: t.marginTopIn + t.diameterIn / 2 + row * t.pitchYIn + nudgeYIn,
      });
    }
  }
  return centers;
}
