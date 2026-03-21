/**
 * ICellCacheKeyDeriver
 *
 * Derives deterministic cache keys for pictograph cell renders.
 * Shared between PreviewCellRenderer (cache read/write) and CellPreWarmer
 * (cache write during pre-warming) to guarantee identical keys.
 *
 * The key composes PictographKeyHasher (single source of truth for all
 * motion and visibility properties) with cell-specific dimensions (size,
 * step number, browseViewMode). Any new field added to PictographKeyHasher
 * automatically flows through — no second place to update.
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { PreviewCellRenderOptions } from "./IPreviewCellRenderer";

export interface ICellCacheKeyDeriver {
  /**
   * Generate a deterministic cache key for a pictograph render.
   * Composes PictographKeyHasher's pictograph identity hash with cell-specific dimensions.
   *
   * @param pictographData - The pictograph to derive a key for
   * @param stepNumber - Step number (1-indexed), or undefined for start position
   * @param isDark - Whether this is a dark mode render
   * @param options - All render options that affect the output
   * @returns A string key suitable for IndexedDB lookup
   */
  deriveCacheKey(
    pictographData: PictographData,
    stepNumber: number | undefined,
    isDark: boolean,
    options: PreviewCellRenderOptions
  ): string;
}
