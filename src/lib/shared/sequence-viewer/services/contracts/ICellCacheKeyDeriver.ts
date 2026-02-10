/**
 * ICellCacheKeyDeriver
 *
 * Derives deterministic cache keys for pictograph cell renders.
 * Shared between PreviewCellRenderer (cache read/write) and CellPreWarmer
 * (cache write during pre-warming) to guarantee identical keys.
 *
 * The key includes ALL rendering parameters that affect the final pixel output.
 * Any mismatch between the key used to write and the key used to read
 * results in a cache miss, defeating the purpose of pre-warming.
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { PreviewCellRenderOptions } from "./IPreviewCellRenderer";

export interface ICellCacheKeyDeriver {
  /**
   * Generate a deterministic cache key for a pictograph render.
   * Uses djb2 hash for compact keys.
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
