/**
 * PreviewCellRenderer
 *
 * Renders individual pictograph cells with two-layer caching:
 * 1. IndexedDB (PictographBlobCache) - persists across sessions
 * 2. WorkerRenderPool / LayerCompositor - off-thread rendering
 *
 * Rendering pipeline:
 * 1. Check IndexedDB cache → instant blob URL on hit
 * 2. On miss: prepareSingle() on main thread (DOM-free data prep)
 * 3. Send prepared data to WorkerRenderPool → renders on Web Worker
 * 4. Cache resulting blob in IndexedDB (fire-and-forget)
 * 5. Return blob URL to component
 *
 * Cache key includes ALL render parameters to ensure stale images
 * aren't served when visibility settings change.
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type {
  IPreviewCellRenderer,
  PreviewCellRenderOptions,
} from "../contracts/IPreviewCellRenderer";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { LayerRenderOptions, LayerVisibility } from "$lib/shared/render/services/contracts/ILayerCompositor";
import { pictographPreparer } from "$lib/shared/pictograph/shared/services/implementations/PictographPreparer";
import { pictographBlobCache } from "$lib/shared/render/services/implementations/PictographBlobCache";
import { getWorkerRenderPool } from "$lib/shared/render/services/implementations/WorkerRenderPool";
import { cellCacheKeyDeriver } from "./CellCacheKeyDeriver";
import type { BrowseViewMode } from "$lib/features/browse/shared/domain/BrowseViewMode";

export class PreviewCellRenderer implements IPreviewCellRenderer {

  /**
   * Render a single pictograph and return a blob URL.
   * Uses blob URLs (URL.createObjectURL) instead of data URLs for two reasons:
   * 1. Cache hits: createObjectURL is instant vs FileReader.readAsDataURL (~5ms)
   * 2. Cache misses: rendering happens off-thread via WorkerRenderPool
   *
   * IMPORTANT: Callers must call URL.revokeObjectURL() on returned URLs when done.
   */
  async renderCell(
    pictographData: PictographData,
    stepNumber: number | undefined,
    isDark: boolean,
    options: PreviewCellRenderOptions
  ): Promise<string> {
    // Generate cache key via shared deriver (same keys as CellPreWarmer)
    const cacheKey = cellCacheKeyDeriver.deriveCacheKey(pictographData, stepNumber, isDark, options);

    // Check IndexedDB cache first — blob URL creation is instant
    try {
      const cachedBlob = await pictographBlobCache.get(cacheKey);
      if (cachedBlob) {
        return URL.createObjectURL(cachedBlob);
      }
    } catch {
      // Cache miss or error, proceed to render
    }

    // Determine if a browse view mode changes rendering behavior.
    // "props + solo" strips the non-selected hand's motion data.
    // "hands + *" delegates to hand path rendering mode.
    const viewMode = options.browseViewMode;
    const isHandsView = viewMode?.subject === "hands";
    const isSoloView = viewMode?.granularity === "solo";

    // In hand path mode OR hands view mode, override props to HAND.
    // PictographPreparer will handle the motion transform (pro/anti → float).
    const isHandPath = (options.handPathMode ?? false) || isHandsView;
    const effectiveBlueProp = isHandPath ? PropType.HAND : options.bluePropType;
    const effectiveRedProp = isHandPath
      ? PropType.HAND
      : (options.catDogModeEnabled ? options.redPropType : options.bluePropType);

    // For solo views (props+solo or hands+solo), strip the non-selected hand's
    // motion data so the renderer only draws one performer.
    const dataForRender = isSoloView
      ? this.filterSoloMotions(pictographData, viewMode!)
      : pictographData;

    // Prepare the pictograph data (DOM-free, runs on main thread)
    const prepared = await pictographPreparer.prepareSingle(dataForRender, {
      themeMode: isDark ? "dark" : "light",
      bluePropType: effectiveBlueProp,
      redPropType: effectiveRedProp,
      handPathMode: isHandPath,
    });

    // Render options for layer compositor
    const renderOptions: LayerRenderOptions = {
      size: options.size,
      widthMultiplier: options.widthMultiplier,
      darkMode: isDark,
      showNonRadialPoints: options.showNonRadialPoints ?? true,
      handPointVisibility: options.handPointVisibility ?? "all",
      bluePropType: effectiveBlueProp,
      redPropType: effectiveRedProp,
    };

    // Visibility settings
    const visibility: LayerVisibility = {
      showTKA: isHandPath ? false : (options.showTKA ?? true),
      showReversals: isHandPath ? false : (options.showReversals ?? true),
    };

    // Render via WorkerRenderPool (off-thread when available, main-thread fallback)
    const pool = getWorkerRenderPool();
    const resolvedStepNumber = options.showStepNumbers ? stepNumber : undefined;
    const blob = await pool.render(
      prepared,
      renderOptions,
      visibility,
      resolvedStepNumber
    );

    // Cache the blob to IndexedDB asynchronously (don't await)
    pictographBlobCache.set(cacheKey, blob).catch(() => {
      // Ignore cache write errors
    });

    // Return blob URL — caller must revoke when done
    return URL.createObjectURL(blob);
  }

  /**
   * For solo view modes, remove the non-selected hand's motion data so the
   * renderer only draws one performer. The selected hand is determined by
   * the BrowseViewMode.color field ("blue" or "red").
   */
  private filterSoloMotions(
    data: PictographData,
    viewMode: BrowseViewMode
  ): PictographData {
    const keepColor = viewMode.color;
    const motions = { ...data.motions };
    if (keepColor === "blue") {
      delete motions.red;
    } else {
      delete motions.blue;
    }
    return { ...data, motions };
  }

  /**
   * Delete a specific cell's cached blob from IndexedDB.
   * Used by context menu "Re-render" to clear stale entries before re-rendering.
   */
  async deleteCellCache(
    pictographData: PictographData,
    stepNumber: number | undefined,
    isDark: boolean,
    options: PreviewCellRenderOptions
  ): Promise<boolean> {
    const cacheKey = cellCacheKeyDeriver.deriveCacheKey(pictographData, stepNumber, isDark, options);
    return pictographBlobCache.delete(cacheKey);
  }
}

// DIRECT EXPORT - Use this instead of container.items.previewCellRenderer
// This avoids DI container rebuilds when this file changes
export const previewCellRenderer = new PreviewCellRenderer();
