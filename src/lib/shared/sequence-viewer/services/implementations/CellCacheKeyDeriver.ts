/**
 * CellCacheKeyDeriver
 *
 * Derives deterministic cache keys for pictograph cell renders.
 * Extracted from PreviewCellRenderer so both PreviewCellRenderer and
 * CellPreWarmer generate identical keys, guaranteeing cache hits when
 * the pre-warmer has already rendered a cell.
 *
 * Key format: "lsp4-{pipe-delimited rendering parameters}"
 * Uses the full key string as the IndexedDB key instead of a hash.
 * IndexedDB handles string keys natively and this eliminates the
 * collision risk that existed with the 32-bit djb2 hash (lsp3).
 *
 * Version history:
 * - lsp-: Original format. Contaminated by ImageComposer write-through
 *   that stored blobs WITH step numbers under "nonum" keys.
 * - lsp2-: Attempted fix. Still contaminated because Canvas2DDirectRenderer
 *   unconditionally baked step numbers from StepData into rendered blobs.
 * - lsp3-: Fixed step number baking. Used djb2 hash, but 32-bit hash space
 *   caused collisions after ~46K entries, returning wrong prop type blobs.
 * - lsp4-: Full string key. No hash, no collisions.
 * - lsp5-: Invalidate after LayerKeyDeriver fix (was missing rotationDirection
 *   and orientations from base layer cache key, causing CW/CCW collisions).
 * - lsp6-: Added browseViewMode (subject/granularity/color) so the same
 *   sequence caches separate blobs for props vs hands vs solo views.
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { PreviewCellRenderOptions } from "../contracts/IPreviewCellRenderer";
import type { ICellCacheKeyDeriver } from "../contracts/ICellCacheKeyDeriver";
// BrowseViewMode type is referenced via PreviewCellRenderOptions.browseViewMode

export class CellCacheKeyDeriver implements ICellCacheKeyDeriver {
  deriveCacheKey(
    pictographData: PictographData,
    stepNumber: number | undefined,
    isDark: boolean,
    options: PreviewCellRenderOptions
  ): string {
    // Build a deterministic key from ALL rendering parameters.
    // Every setting that affects the final pixel output MUST be in this key,
    // otherwise the IndexedDB blob cache returns stale images.
    const blue = pictographData.motions?.blue;
    const red = pictographData.motions?.red;
    const keyParts = [
      pictographData.letter || "start",
      blue?.motionType || "none",
      blue?.startLocation || "",
      blue?.endLocation || "",
      blue?.turns ?? 0,
      blue?.startOrientation ?? "",
      blue?.endOrientation ?? "",
      blue?.rotationDirection ?? "",
      red?.motionType || "none",
      red?.startLocation || "",
      red?.endLocation || "",
      red?.turns ?? 0,
      red?.startOrientation ?? "",
      red?.endOrientation ?? "",
      red?.rotationDirection ?? "",
      options.bluePropType || "staff",
      options.catDogModeEnabled
        ? (options.redPropType || "staff")
        : (options.bluePropType || "staff"),
      isDark ? "dark" : "light",
      options.showStepNumbers ? (stepNumber ?? "none") : "nonum",
      options.size,
      // Visibility settings that change the rendered output
      options.showNonRadialPoints ? "nr1" : "nr0",
      options.handPointVisibility ?? "all",
      options.showTKA ? "tka1" : "tka0",
      options.showReversals ? "rev1" : "rev0",
      // Hand path mode renders completely different pictographs (float arrows, HAND props)
      options.handPathMode ? "hp1" : "",
      // Width multiplier for duration-expanded cells
      options.widthMultiplier && options.widthMultiplier !== 1 ? `wm${options.widthMultiplier}` : "",
      // Browse view mode: different subject/granularity/color renders different pictographs
      options.browseViewMode ? `vm-${options.browseViewMode.subject}-${options.browseViewMode.granularity}-${options.browseViewMode.color}` : "",
    ];

    return `lsp6-${keyParts.join("|")}`;
  }
}

// Singleton — no state, pure function, safe to share
export const cellCacheKeyDeriver = new CellCacheKeyDeriver();
