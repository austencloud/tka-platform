/**
 * Container-Aware Layout
 *
 * The "Auto" complement to the static `layout-calculator.ts` table. Given the
 * live container's raw pixel size, picks the columns×rows (and start-cell
 * placement) that renders the ChoreoCard as large as possible — cells are
 * square, so maximizing the cell edge maximizes the card area.
 *
 * Pure / DOM-free / deterministic. Used only where a live container exists
 * (the interactive viewer). Export, print, and gallery thumbnails keep the
 * deterministic table (no container, reproducible baked aspect ratios).
 *
 * The grid-shape formulas here mirror `renderAllCells` and
 * `calculateGridPosition` exactly, so a best-fit layout and the cells rendered
 * into it never disagree. The header/footer-fraction math mirrors the layout
 * state factory's `previewAspectRatio`, so both size the card by one formula.
 */

import { HEADER_HEIGHT_DIVISOR, FOOTER_HEIGHT_DIVISOR } from "@tka/render-composition";

export type StartPlacement = "row" | "column" | "none";

export interface FitLayout {
  /** Total grid columns (includes the start column under "column" placement). */
  cols: number;
  /** Total grid rows (includes the start row under "row" placement). */
  rows: number;
  /** Where the start cell sits. "none" when the start position is excluded. */
  startPlacement: StartPlacement;
}

export interface BestFitInput {
  stepCount: number;
  includeStartPosition: boolean;
  /** Raw container width in px (NOT the aspect-fitted contained width). */
  containerWidth: number;
  /** Raw container height in px. */
  containerHeight: number;
  showHeader: boolean;
  showFooter: boolean;
  /** QR needs a reserved empty info cell — constrains eligible shapes. */
  showQRCode: boolean;
}

/** Cell-edge ties within this many px are treated as equal (stability + float noise). */
const CELL_EDGE_EPSILON = 0.5;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Grid dimensions for a candidate step-column count. Mirrors the exact
 * convention in `calculateGridPosition` / `renderAllCells`:
 *  - no start:  cols = sc,     rows = ceil(steps / sc)
 *  - row:       cols = sc,     rows = 1 + ceil(steps / sc)     (start owns row 1)
 *  - column:    cols = sc + 1, rows = 1 + ceil((steps - firstRow) / sc)
 *               where firstRow = min(sc, steps)                (start owns col 1)
 */
function gridShape(
  stepCount: number,
  stepCols: number,
  includeStartPosition: boolean,
  placement: StartPlacement,
): { cols: number; rows: number } {
  const sc = Math.max(1, stepCols);
  if (!includeStartPosition || placement === "none") {
    return { cols: sc, rows: Math.max(1, Math.ceil(stepCount / sc)) };
  }
  if (placement === "row") {
    return { cols: sc, rows: 1 + Math.ceil(stepCount / sc) };
  }
  // column placement
  const firstRow = Math.min(sc, stepCount);
  const remaining = stepCount - firstRow;
  return { cols: sc + 1, rows: 1 + Math.ceil(remaining / sc) };
}

/**
 * The card's height in cell-units, including the header/footer fractions.
 * Matches the layout state factory's `previewAspectRatio` math so the picker
 * and the renderer agree on the card's aspect ratio.
 */
export function cardHeightInCells(
  cols: number,
  rows: number,
  showHeader: boolean,
  showFooter: boolean,
): number {
  const hfScale = cols >= 3 ? 1 : cols / 3;
  const headerFraction = showHeader ? (1 / HEADER_HEIGHT_DIVISOR) * hfScale : 0;
  const footerFraction = showFooter ? (1 / FOOTER_HEIGHT_DIVISOR) * hfScale : 0;
  return rows + headerFraction + footerFraction;
}

interface Candidate {
  cols: number;
  rows: number;
  startPlacement: StartPlacement;
  cellEdge: number;
  wasted: number;
  balance: number;
}

/**
 * True when `a` is a strictly better fit than `b`.
 *
 * Objective order (see 2026-07-10-auto-layout-full-grid-design.md):
 *  1. Fewest empty cells — the fullest grid wins. Prevents Auto from choosing a
 *     shape with corner/upward gaps just because it renders marginally bigger.
 *  2. Largest cell edge (within CELL_EDGE_EPSILON) — among equally-full shapes,
 *     render the biggest.
 *  3. Best balance — closest-to-square breaks any remaining tie.
 */
function isBetter(a: Candidate, b: Candidate): boolean {
  if (a.wasted !== b.wasted) return a.wasted < b.wasted;
  if (a.cellEdge > b.cellEdge + CELL_EDGE_EPSILON) return true;
  if (b.cellEdge > a.cellEdge + CELL_EDGE_EPSILON) return false;
  return a.balance < b.balance;
}

/**
 * Pick the columns×rows (and start placement) that renders the card largest in
 * the given container. Returns `null` when there is nothing to fit (non-positive
 * dimensions, no steps) or no candidate can host a required QR slot — the caller
 * then falls back to the static table.
 */
export function pickBestFitLayout(input: BestFitInput): FitLayout | null {
  const {
    stepCount,
    includeStartPosition,
    containerWidth,
    containerHeight,
    showHeader,
    showFooter,
    showQRCode,
  } = input;

  if (stepCount < 1) return null;
  if (!(containerWidth > 0) || !(containerHeight > 0)) return null;

  const placements: StartPlacement[] = includeStartPosition
    ? ["row", "column"]
    : ["none"];

  let best: Candidate | null = null;

  for (let sc = 1; sc <= stepCount; sc++) {
    for (const placement of placements) {
      const { cols, rows } = gridShape(stepCount, sc, includeStartPosition, placement);

      // The QR code is functional (the scan target), so it must have a reserved
      // empty slot. Row placement parks it at (cols, 1); column at (1, rows).
      if (showQRCode && includeStartPosition) {
        if (placement === "row" && cols < 2) continue;
        if (placement === "column" && rows < 2) continue;
      }

      const heightCells = cardHeightInCells(cols, rows, showHeader, showFooter);
      const cellEdge = Math.min(containerWidth / cols, containerHeight / heightCells);

      const usedCells = stepCount + (includeStartPosition ? 1 : 0);
      const candidate: Candidate = {
        cols,
        rows,
        startPlacement: placement,
        cellEdge,
        wasted: cols * rows - usedCells,
        balance: Math.abs(cols - rows),
      };

      if (!best || isBetter(candidate, best)) best = candidate;
    }
  }

  if (!best) return null;
  return { cols: best.cols, rows: best.rows, startPlacement: best.startPlacement };
}

/**
 * Column count for a scrolling long sequence. The card fills the container
 * width and scrolls vertically, so the column count is chosen from width alone:
 * a wider container shows more (smaller-scroll) columns, a narrower one fewer.
 * Returns the legacy default of 5 when the width is not yet known, preserving
 * behavior for export/forceContain and the first pre-measure frame.
 */
export function pickScrollColumns(
  containerWidth: number,
  opts?: { min?: number; max?: number; targetCellPx?: number },
): number {
  const { min = 4, max = 7, targetCellPx = 130 } = opts ?? {};
  if (!(containerWidth > 0)) return 5;
  return clamp(Math.round(containerWidth / targetCellPx), min, max);
}
