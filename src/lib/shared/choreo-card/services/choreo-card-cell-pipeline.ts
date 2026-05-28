/**
 * choreo-card-cell-pipeline.ts
 *
 * Pure functions extracted from ChoreoCard.svelte for cell rendering,
 * grid position calculation, duration detection, and preview caching.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { PreviewCellRenderOptions } from "$lib/shared/sequence-viewer/services/preview-cell-renderer";
import type { TimelineRow } from "$lib/shared/create/utils/grid-calculations";
import type { MandalaLayoutOverride } from "$lib/shared/sequence-viewer/services/getMandalaPlacements";
import { getSettings } from "$lib/shared/application/state/app-state.svelte";
import type { PropType } from '$lib/shared/pictograph/prop/domain/enums/PropType';
import type { BrowseViewMode } from '$lib/shared/browse/domain/BrowseViewMode';

// ============================================================================
// GLOBAL CELL URL CACHE
// Survives component remounts so drag-to-move doesn't re-render all cells.
// Keyed by sequence content + render options hash. Capped at 30 entries (LRU).
// ============================================================================

export interface CachedPreview {
  cells: { index: number; label: string; imageUrl: string; gridColumn: number; gridRow: number; duration: number }[];
  columns: number;
  rows: number;
  durationRows?: TimelineRow[];
  hasMixedDurations?: boolean;
  durationColCount?: number;
}

const MAX_PREVIEW_CACHE = 30;
export const globalPreviewCache = new Map<string, CachedPreview>();

/**
 * Derive a stable cache key from the sequence content and render options.
 * Captures all values that affect the rendered output so two sequences with
 * identical letters but different orientations never collide.
 */
export function getPreviewCacheKey(
  seq: SequenceData,
  opts: PreviewCellRenderOptions,
  colCount: number | null,
  isDark: boolean,
  spl: "row" | "column" = "column",
): string {
  const stepLetters = seq.steps?.map(s => s.letter ?? "?").join("") ?? "";
  const durationFingerprint = seq.steps?.map(s => s.duration ?? 1).join(",") ?? "";
  // Motion fingerprint captures orientation + rotation data that affects rendering.
  // Without this, two sequences with identical letters but different orientations
  // would collide in the cache.
  const motionFingerprint = seq.steps?.map(s => {
    const b = s.motions?.blue;
    const r = s.motions?.red;
    return `${b?.startOrientation ?? ""}${b?.endOrientation ?? ""}${b?.rotationDirection ?? ""}${r?.startOrientation ?? ""}${r?.endOrientation ?? ""}${r?.rotationDirection ?? ""}`;
  }).join("") ?? "";
  const vm = opts.browseViewMode;
  const vmKey = vm ? `${vm.subject}-${vm.granularity}-${vm.color}` : "default";
  // Resolve prop types to actual values (fall back to global settings) so the
  // in-memory cache differentiates between e.g. staff and fan when the caller
  // doesn't explicitly pass a prop type override.
  const settings = getSettings();
  const resolvedBlue = opts.bluePropType ?? settings.bluePropType ?? "staff";
  const resolvedRed = opts.redPropType ?? settings.redPropType ?? "staff";
  const mv = `${opts.showBlueMotion === false ? "B0" : "B1"}${opts.showRedMotion === false ? "R0" : "R1"}`;
  const gv = `${opts.showTnD ? "V1" : "V0"}${opts.showElemental ? "E1" : "E0"}${opts.showPositions ? "P1" : "P0"}`;
  return `${seq.id ?? seq.word ?? "?"}-${stepLetters}-${seq.steps?.length ?? 0}-${opts.size}-${opts.showStepNumbers}-${opts.showNonRadialPoints}-${opts.showTKA}-${opts.showReversals}-${opts.handPathMode ?? false}-${resolvedBlue}-${resolvedRed}-${colCount ?? "auto"}-${isDark ? "dark" : "light"}-spl:${spl}-d:${durationFingerprint}-m:${motionFingerprint}-vm:${vmKey}-mv:${mv}-gv:${gv}`;
}

/**
 * Store a preview in the global cache with LRU eviction.
 * When evicting, revokes blob URLs that are not currently displayed.
 */
export function storePreviewInCache(
  key: string,
  data: CachedPreview,
  activeCells: { imageUrl: string; fadeOutUrl?: string }[],
): void {
  if (globalPreviewCache.size >= MAX_PREVIEW_CACHE && !globalPreviewCache.has(key)) {
    const oldest = globalPreviewCache.keys().next().value;
    if (oldest !== undefined) {
      const evicted = globalPreviewCache.get(oldest);
      if (evicted) {
        const activeUrls = new Set<string>();
        for (const c of activeCells) {
          if (c.imageUrl.startsWith("blob:")) activeUrls.add(c.imageUrl);
          if (c.fadeOutUrl?.startsWith("blob:")) activeUrls.add(c.fadeOutUrl);
        }
        for (const cell of evicted.cells) {
          if (cell.imageUrl.startsWith("blob:") && !activeUrls.has(cell.imageUrl)) {
            URL.revokeObjectURL(cell.imageUrl);
          }
        }
      }
      globalPreviewCache.delete(oldest);
    }
  }
  globalPreviewCache.set(key, data);
}

/**
 * Calculate grid position for a step index.
 * With start position (column layout): first column reserved for start.
 * With start position (row layout): first row reserved for start.
 * Without start position: all columns available for steps.
 */
export function calculateGridPosition(
  stepIndex: number,
  cols: number,
  includeStartPosition: boolean,
  startPositionLayout: "row" | "column",
  mandalaLayoutOverride: MandalaLayoutOverride | null,
): { gridColumn: number; gridRow: number } {
  // 4-count horizontal mandala override: start/step positions come from the override spec.
  if (mandalaLayoutOverride) {
    if (stepIndex === -1) {
      return { gridColumn: mandalaLayoutOverride.startPos.col, gridRow: mandalaLayoutOverride.startPos.row };
    }
    const pos = mandalaLayoutOverride.stepPositions[stepIndex];
    if (pos) return { gridColumn: pos.col, gridRow: pos.row };
  }

  // Start position is always at column 1, row 1
  if (stepIndex === -1) {
    return { gridColumn: 1, gridRow: 1 };
  }

  if (includeStartPosition && startPositionLayout === "row") {
    // Row layout: start position occupies row 1 alone; steps fill full-width
    // rows starting at row 2, using all `cols` columns.
    const col = (stepIndex % cols) + 1;
    const row = Math.floor(stepIndex / cols) + 2;
    return { gridColumn: col, gridRow: row };
  }

  if (includeStartPosition) {
    // Column layout: col 1 is reserved for start, steps start at col 2.
    const stepsPerRow = cols - 1;
    const firstRowSteps = cols - 1;

    if (stepIndex < firstRowSteps) {
      return { gridColumn: stepIndex + 2, gridRow: 1 };
    }

    const remainingIndex = stepIndex - firstRowSteps;
    const row = Math.floor(remainingIndex / stepsPerRow) + 2;
    const col = (remainingIndex % stepsPerRow) + 2;
    return { gridColumn: col, gridRow: row };
  } else {
    // Without start position: all columns available for steps
    const col = (stepIndex % cols) + 1;
    const row = Math.floor(stepIndex / cols) + 1;
    return { gridColumn: col, gridRow: row };
  }
}

/**
 * Detect whether the sequence has mixed (non-uniform) durations.
 * Returns false if all durations are 1.0 or undefined.
 */
export function detectMixedDurations(steps: readonly { duration?: number }[]): boolean {
  for (const step of steps) {
    const d = step.duration ?? 1;
    if (Math.abs(d - 1.0) > 0.001) return true;
  }
  return false;
}

/**
 * Build render options from component visibility/prop state.
 * Pure function — takes all required state as parameters.
 */
export function buildRenderOptions(params: {
  cellSize: number;
  bluePropType: PropType | undefined;
  redPropType: PropType | undefined;
  catDogModeEnabled: boolean;
  showNonRadial: boolean;
  handPointVis: "all" | "active";
  showTKA: boolean;
  showReversals: boolean;
  showTnD: boolean;
  showElemental: boolean;
  showPositions: boolean;
  isSoloMode: boolean;
  handPathMode: boolean;
  browseViewMode: BrowseViewMode | undefined;
  showBlueMotion: boolean;
  showRedMotion: boolean;
}): PreviewCellRenderOptions {
  return {
    size: params.cellSize,
    bluePropType: params.bluePropType,
    redPropType: params.redPropType,
    catDogModeEnabled: params.catDogModeEnabled,
    // Never bake step numbers into the rendered blob - identical pictographs
    // at different beats must share the same cached image. Step numbers are
    // rendered as HTML overlays on top of the <img> instead.
    showStepNumbers: false,
    showNonRadialPoints: params.showNonRadial,
    handPointVisibility: params.handPointVis,
    showTKA: params.isSoloMode ? false : params.showTKA,
    showReversals: params.isSoloMode ? false : params.showReversals,
    showTnD: params.isSoloMode ? false : params.showTnD,
    showElemental: params.isSoloMode ? false : params.showElemental,
    showPositions: params.isSoloMode ? false : params.showPositions,
    handPathMode: params.handPathMode,
    browseViewMode: params.browseViewMode,
    showBlueMotion: params.showBlueMotion,
    showRedMotion: params.showRedMotion,
  };
}
