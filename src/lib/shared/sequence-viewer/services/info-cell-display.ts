import { calculateLayout } from "$lib/shared/render/services/layout-calculator";

export type InfoCellChoice = "qr" | "mandala" | "none";

export interface InfoCellGeometryArgs {
  stepCount: number;
  includeStartPosition: boolean;
  startPositionLayout: "row" | "column";
  /** STEP column override (pre start-column), null/undefined = auto layout table. */
  columnCount?: number | null;
}

/**
 * Number of empty "info" cells available for QR / mandala fill, computed for the
 * contention case (as if both want in). Row layout exposes the trailing cells of
 * row 1 (cols - 1); column layout exposes the trailing cells of col 1 (rows - 1).
 * Mirrors the geometry the live card (choreo-card-layout-state) and the export
 * (card-front-assembler) both render, including the 6-count column accommodation.
 */
export function getInfoCellCount(args: InfoCellGeometryArgs): number {
  const { stepCount, includeStartPosition, startPositionLayout, columnCount } = args;

  // One-count cards (single beat + start) have no spare cell; the info-cell
  // scheme is anchored to the start position.
  if (stepCount <= 1) return 0;
  if (!includeStartPosition) return 0;

  let cols: number;
  let rows: number;
  if (columnCount != null && columnCount > 0) {
    cols = startPositionLayout === "column" ? columnCount + 1 : columnCount;
    if (startPositionLayout === "row") {
      rows = 1 + Math.ceil(stepCount / cols);
    } else {
      const stepsPerRow = cols - 1;
      const firstRowSteps = Math.min(stepsPerRow, stepCount);
      const remaining = stepCount - firstRowSteps;
      rows = 1 + (remaining > 0 ? Math.ceil(remaining / stepsPerRow) : 0);
    }
  } else {
    [cols, rows] = calculateLayout(stepCount, includeStartPosition, startPositionLayout);
  }

  // Column-layout accommodation (mirrors choreo-card-layout-state.svelte.ts:128):
  // the 6-count column layout gains a row so QR + mandala both fit.
  if (startPositionLayout === "column" && stepCount === 6 && rows === 2) {
    rows = 3;
  }

  const count = startPositionLayout === "row" ? cols - 1 : rows - 1;
  return Math.max(0, count);
}

export interface ResolveInfoCellArgs extends InfoCellGeometryArgs {
  /** Global QR toggle (the user's showQRCode setting / incoming prop). */
  showQRCode: boolean;
  /** Global mandala toggle. */
  showMandala: boolean;
  /** Per-length choice for the single info cell. */
  infoCellChoice: InfoCellChoice;
  /** Guests cannot mint a scannable QR — a "qr" pick degrades to "mandala". */
  isAuthenticated: boolean;
}

/**
 * Resolve effective QR / mandala visibility. Only one info cell + both toggles on
 * (genuine contention) routes through the per-card choice; every other case
 * returns the globals untouched, so non-contention paths (a card with only mandala
 * on, multi-cell cards, hidden start position) are unaffected.
 *
 * Guest QR suppression applies in EVERY regime, not just one-spot contention: a
 * guest can't mint a scannable QR (it needs an account-owned short code), so QR
 * is forced off. That matters for the mandala fill — with QR off, the slot it
 * would have reserved flows into getMandalaPlacements, which then fills all
 * available info cells instead of leaving the QR cell blank. This is the single
 * funnel both the preview (ChoreoCard) and the export (card-render-options) pass
 * through, so they stay in lockstep.
 */
export function resolveInfoCellDisplay(
  args: ResolveInfoCellArgs
): { showQRCode: boolean; showMandala: boolean } {
  const { showQRCode, showMandala, infoCellChoice, isAuthenticated } = args;

  if (!showQRCode || !showMandala) {
    return { showQRCode: showQRCode && isAuthenticated, showMandala };
  }
  if (getInfoCellCount(args) !== 1) {
    return { showQRCode: showQRCode && isAuthenticated, showMandala };
  }

  const choice: InfoCellChoice =
    infoCellChoice === "qr" && !isAuthenticated ? "mandala" : infoCellChoice;

  switch (choice) {
    case "qr":
      return { showQRCode: true, showMandala: false };
    case "mandala":
      return { showQRCode: false, showMandala: true };
    case "none":
      return { showQRCode: false, showMandala: false };
  }
}
