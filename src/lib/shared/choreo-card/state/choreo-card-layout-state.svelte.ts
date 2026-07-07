/**
 * choreo-card-layout-state.svelte.ts
 *
 * Reactive layout derivations extracted from ChoreoCard.svelte.
 * Computes column/row counts, aspect ratio, header/footer sizing,
 * and font scales from sequence data and composition settings.
 */

import { calculateLayout } from "$lib/shared/render/services/layout-calculator";
import {
  pickBestFitLayout,
  pickScrollColumns,
  type FitLayout,
} from "$lib/shared/render/services/container-aware-layout";
import { getMandalaPlacements } from "$lib/shared/sequence-viewer/services/get-mandala-placements";
import { simplifyAndTruncate } from "$lib/shared/foundation/utils/word-simplifier";
import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
import {
  HEADER_HEIGHT_DIVISOR, FOOTER_HEIGHT_DIVISOR,
  BADGE_SIZE_SCALE, BADGE_PADDING_SCALE, BADGE_NUMBER_FONT_SCALE,
  HEADER_WORD_FONT_SCALE, HEADER_WORD_FONT_MIN_SCALE,
  FOOTER_FONT_SCALE, FOOTER_MARGIN_SCALE,
  STEP_NUMBER_FONT_RATIO, STEP_NUMBER_FONT_MAX,
} from "@tka/render-composition";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

export interface ChoreoCardLayoutDeps {
  /** The sequence being displayed */
  readonly sequence: SequenceData;
  /** Whether to include the start position cell */
  readonly includeStartPosition: boolean;
  /** Override auto-calculated column count (null = auto) */
  readonly columnCount: number | null;
  /** Whether header is visible */
  readonly showHeader: boolean;
  /** Whether footer is visible */
  readonly showFooter: boolean;
  /** Whether QR code is visible */
  readonly showQRCode: boolean;
  /** Whether mandalas are enabled */
  readonly showMandala: boolean;
  /** Force contain mode */
  readonly forceContain: boolean;
  /** Blue motion visibility */
  readonly showBlueMotion: boolean;
  /** Red motion visibility */
  readonly showRedMotion: boolean;
  /** Per-instance override for start-position layout */
  readonly startPositionLayoutOverride: "row" | "column" | null;
  /** Reactive composition version counter (bumped by observer) */
  readonly compositionVersion: number;
  /** Cell width from ResizeObserver */
  readonly cellWidth: number;
  /** Whether mixed durations are present */
  readonly hasMixedDurations: boolean;
  /** Max duration units in any single row */
  readonly durationColCount: number;
  /** Raw container width (px) for container-aware Auto layout. 0 = not measured. */
  readonly containerWidth: number;
  /** Raw container height (px) for container-aware Auto layout. 0 = not measured. */
  readonly containerHeight: number;
}

export function createChoreoCardLayoutState(getDeps: () => ChoreoCardLayoutDeps) {
  const compositionManager = getImageCompositionManager();

  const SCROLL_THRESHOLD = 16;

  // Whether the sequence exceeds scroll threshold (independent of forceContain)
  const isLongSequence = $derived((getDeps().sequence?.steps?.length ?? 0) > SCROLL_THRESHOLD);
  const needsScroll = $derived(!getDeps().forceContain && isLongSequence);

  // Container-aware "Auto" layout. When the card is on Auto (no manual/composition
  // column override), is a uniform grid, isn't a long scroll sequence, and the
  // live container has been measured, pick the columns×rows + start placement that
  // renders the card largest in that container. Returns null in every other case,
  // so the derivations below fall back to the static table. This is the ONLY seam
  // that consults the container — export/print/thumbnail have no container, get
  // null here, and stay on the deterministic table.
  const autoFit = $derived.by<FitLayout | null>(() => {
    const deps = getDeps();
    void deps.compositionVersion;
    const stepCount = deps.sequence?.steps?.length ?? 0;
    if (stepCount < 1) return null;
    // Export / print previews (forceContain) keep the deterministic table so the
    // on-screen preview matches the compositor-rendered PNG, which uses the table.
    if (deps.forceContain) return null;
    if (deps.hasMixedDurations) return null; // uniform grids only
    if (deps.columnCount !== null && deps.columnCount > 0) return null; // manual override
    if (stepCount >= 4 && compositionManager.getColumnCountForStepCount(stepCount) !== null) {
      return null; // per-length composition override
    }
    if (isLongSequence) return null; // scroll path handled below
    const cw = deps.containerWidth;
    const ch = deps.containerHeight;
    if (!(cw > 0) || !(ch > 0)) return null; // not measured yet → table fallback
    return pickBestFitLayout({
      stepCount,
      includeStartPosition: deps.includeStartPosition,
      containerWidth: cw,
      containerHeight: ch,
      showHeader: deps.showHeader,
      showFooter: deps.showFooter,
      showQRCode: deps.showQRCode,
    });
  });

  // Start-position layout - "row" puts start in a top row spanning all columns,
  // "column" puts start in a left column. On Auto the best-fit picker chooses
  // placement for the container; otherwise the composition setting applies.
  const startPositionLayout = $derived.by<"row" | "column">(() => {
    const af = autoFit;
    const deps = getDeps();
    if (af && deps.includeStartPosition && af.startPlacement !== "none") {
      return af.startPlacement;
    }
    void deps.compositionVersion;
    if (deps.startPositionLayoutOverride) return deps.startPositionLayoutOverride;
    const stepCount = deps.sequence?.steps?.length ?? 0;
    if (stepCount === 0) return compositionManager.startPositionLayout;
    return compositionManager.getStartPositionLayoutForStepCount(stepCount);
  });

  // Effective columns - synchronously computed from best-fit or the layout tables
  const baseColumns = $derived.by(() => {
    const af = autoFit;
    if (af) return af.cols;
    const deps = getDeps();
    void deps.compositionVersion;
    const seq = deps.sequence;
    if (!seq?.steps?.length) return 0;
    const stepCount = seq.steps.length;
    const spl = startPositionLayout;

    if (deps.columnCount !== null && deps.columnCount > 0) {
      return deps.includeStartPosition && spl === "column" ? deps.columnCount + 1 : deps.columnCount;
    }
    // Check per-length column count from global composition settings (4+ steps only)
    if (stepCount >= 4) {
      const compositionCols = compositionManager.getColumnCountForStepCount(stepCount);
      if (compositionCols !== null && compositionCols > 0) {
        return deps.includeStartPosition && spl === "column" ? compositionCols + 1 : compositionCols;
      }
    }
    // Long sequences: width-adaptive columns while scrolling; fixed 5 for the
    // export/forceContain (deterministic) path and the pre-measure frame.
    if (isLongSequence) {
      if (needsScroll && deps.containerWidth > 0) return pickScrollColumns(deps.containerWidth);
      return 5;
    }
    const [cols] = calculateLayout(stepCount, deps.includeStartPosition, spl);
    return cols;
  });

  // Effective rows
  const baseRows = $derived.by(() => {
    const af = autoFit;
    if (af) return af.rows;
    const deps = getDeps();
    void deps.compositionVersion;
    const seq = deps.sequence;
    if (!seq?.steps?.length) return 0;
    const stepCount = seq.steps.length;
    const cols = baseColumns;
    const spl = startPositionLayout;
    const hasCompositionOverride = stepCount >= 4
      && compositionManager.getColumnCountForStepCount(stepCount) !== null;

    if (cols > 0 && (deps.columnCount !== null || isLongSequence || hasCompositionOverride)) {
      if (deps.includeStartPosition && spl === "row") {
        return 1 + Math.ceil(stepCount / cols);
      }
      const stepsPerRow = deps.includeStartPosition ? cols - 1 : cols;
      const firstRowSteps = Math.min(stepsPerRow, stepCount);
      const remainingSteps = stepCount - firstRowSteps;
      return 1 + Math.ceil(remainingSteps / stepsPerRow);
    }

    const [, rws] = calculateLayout(stepCount, deps.includeStartPosition, spl);

    // Column layout only: mandala fill needs at least one col-1 empty between
    // start and QR.
    if (
      deps.showMandala
      && deps.showQRCode
      && deps.includeStartPosition
      && spl === "column"
      && stepCount === 6
      && rws === 2
    ) {
      return 3;
    }
    return rws;
  });

  // Compute mandala placements + optional 4-count horizontal layout override.
  const mandalaResult = $derived.by(() => {
    const deps = getDeps();
    return getMandalaPlacements({
      stepCount: deps.sequence?.steps?.length ?? 0,
      cols: baseColumns,
      rows: baseRows,
      includeStartPosition: deps.includeStartPosition,
      showQRCode: deps.showQRCode,
      blueVisible: deps.showBlueMotion,
      redVisible: deps.showRedMotion,
      mandalaEnabled: deps.showMandala,
      startPositionLayout,
    });
  });
  const mandalaLayoutOverride = $derived(mandalaResult.layoutOverride);
  const mandalaPlacements = $derived(mandalaResult.placements);

  // Final effective dims
  const effectiveColumns = $derived(mandalaLayoutOverride?.cols ?? baseColumns);
  const effectiveRows = $derived(mandalaLayoutOverride?.rows ?? baseRows);

  // Compute aspect ratio for the entire preview (width / height)
  const previewAspectRatio = $derived.by(() => {
    const deps = getDeps();
    if (!effectiveColumns || !effectiveRows) return 1;
    const gridWidth = effectiveColumns;

    const rowHeightInCellUnits = (deps.hasMixedDurations && deps.durationColCount > 0)
      ? effectiveColumns / deps.durationColCount
      : 1;
    const gridHeight = effectiveRows * rowHeightInCellUnits;

    const cols = effectiveColumns;
    const hfScale = cols >= 3 ? 1 : cols / 3;
    const headerFraction = deps.showHeader ? (1 / HEADER_HEIGHT_DIVISOR) * hfScale : 0;
    const footerFraction = deps.showFooter ? (1 / FOOTER_HEIGHT_DIVISOR) * hfScale : 0;
    const totalHeight = gridHeight + headerFraction + footerFraction;
    const ratio = gridWidth / totalHeight;
    return ratio;
  });

  // Scaled sizes based on grid element width.
  const headerFooterRefWidth = $derived.by(() => {
    const cw = getDeps().cellWidth;
    if (!cw || !Number.isFinite(cw)) return 0;
    const cols = effectiveColumns || 1;
    if (cols >= 3) return cw;
    return cw * cols / 3;
  });

  const scaledHeaderHeight = $derived.by(() => {
    if (!headerFooterRefWidth) return 0;
    const proportional = Math.floor(headerFooterRefWidth / HEADER_HEIGHT_DIVISOR);
    return getDeps().forceContain ? proportional : Math.max(proportional, 24);
  });

  const scaledFooterHeight = $derived.by(() => {
    if (!headerFooterRefWidth) return 0;
    return Math.floor(headerFooterRefWidth / FOOTER_HEIGHT_DIVISOR);
  });

  const stepNumFontSize = $derived(
    getDeps().cellWidth ? Math.min(Math.round(getDeps().cellWidth * STEP_NUMBER_FONT_RATIO), STEP_NUMBER_FONT_MAX) : 0
  );

  const badgeSize = $derived(scaledHeaderHeight * BADGE_SIZE_SCALE);
  const badgePadding = $derived(scaledHeaderHeight * BADGE_PADDING_SCALE);
  const badgeNumberFontSize = $derived(Math.round(badgeSize * BADGE_NUMBER_FONT_SCALE));

  // Word title font size: shrinks for longer words
  const wordTitleFontSize = $derived.by(() => {
    const baseFontSize = Math.floor(scaledHeaderHeight * HEADER_WORD_FONT_SCALE);
    const word = getDeps().sequence.word;
    if (!word) return baseFontSize;

    const displayWord = simplifyAndTruncate(word, 16);
    let letterCount = 0;
    for (let i = 0; i < displayWord.length; i++) {
      const ch = displayWord[i];
      if (ch !== "-" && ch !== "." && ch !== " ") letterCount++;
    }
    if (letterCount <= 10) return baseFontSize;
    return Math.max(Math.floor(baseFontSize * (10 / letterCount)), Math.floor(scaledHeaderHeight * HEADER_WORD_FONT_MIN_SCALE));
  });

  const footerFontSize = $derived(Math.floor(scaledFooterHeight * FOOTER_FONT_SCALE));
  const footerMargin = $derived(Math.floor(scaledFooterHeight * FOOTER_MARGIN_SCALE));

  // QR code grid position
  const qrGridPosition = $derived.by(() => {
    const deps = getDeps();
    if (!deps.showQRCode || !deps.includeStartPosition) return null;
    if (mandalaLayoutOverride) {
      return {
        gridColumn: mandalaLayoutOverride.qrPos.col,
        gridRow: mandalaLayoutOverride.qrPos.row,
      };
    }
    if (startPositionLayout === "row") {
      if (effectiveColumns < 2) return null;
      return { gridColumn: effectiveColumns, gridRow: 1 };
    }
    if (effectiveRows < 2) return null;
    return { gridColumn: 1, gridRow: effectiveRows };
  });

  return {
    get isLongSequence() { return isLongSequence; },
    get needsScroll() { return needsScroll; },
    get startPositionLayout() { return startPositionLayout; },
    get baseColumns() { return baseColumns; },
    get baseRows() { return baseRows; },
    get effectiveColumns() { return effectiveColumns; },
    get effectiveRows() { return effectiveRows; },
    get mandalaLayoutOverride() { return mandalaLayoutOverride; },
    get mandalaPlacements() { return mandalaPlacements; },
    get previewAspectRatio() { return previewAspectRatio; },
    get headerFooterRefWidth() { return headerFooterRefWidth; },
    get scaledHeaderHeight() { return scaledHeaderHeight; },
    get scaledFooterHeight() { return scaledFooterHeight; },
    get stepNumFontSize() { return stepNumFontSize; },
    get badgeSize() { return badgeSize; },
    get badgePadding() { return badgePadding; },
    get badgeNumberFontSize() { return badgeNumberFontSize; },
    get wordTitleFontSize() { return wordTitleFontSize; },
    get footerFontSize() { return footerFontSize; },
    get footerMargin() { return footerMargin; },
    get qrGridPosition() { return qrGridPosition; },
    SCROLL_THRESHOLD,
  } as const;
}
