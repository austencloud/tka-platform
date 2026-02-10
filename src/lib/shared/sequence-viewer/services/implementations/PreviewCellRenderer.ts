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
import type { LayerRenderOptions, LayerVisibility } from "$lib/shared/render/services/contracts/ILayerCompositor";
import { pictographPreparer } from "$lib/shared/pictograph/shared/services/implementations/PictographPreparer";
import { pictographBlobCache } from "$lib/shared/render/services/implementations/PictographBlobCache";
import { getWorkerRenderPool } from "$lib/shared/render/services/implementations/WorkerRenderPool";
import { cellCacheKeyDeriver } from "./CellCacheKeyDeriver";

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
        console.log(`[PreviewCell] ✅ CACHE HIT: ${cacheKey} | step=${stepNumber} | dark=${isDark} | size=${options.size}`);
        return URL.createObjectURL(cachedBlob);
      } else {
        console.log(`[PreviewCell] ❌ CACHE MISS: ${cacheKey} | step=${stepNumber} | dark=${isDark} | size=${options.size} | letter=${pictographData.letter}`);
      }
    } catch {
      console.log(`[PreviewCell] ⚠️ CACHE ERROR: ${cacheKey}`);
      // Cache miss or error, proceed to render
    }

    // Prepare the pictograph data (DOM-free, runs on main thread)
    const prepared = await pictographPreparer.prepareSingle(pictographData, {
      themeMode: isDark ? "dark" : "light",
      bluePropType: options.bluePropType,
      redPropType: options.catDogModeEnabled
        ? options.redPropType
        : options.bluePropType,
    });

    // Render options for layer compositor
    const renderOptions: LayerRenderOptions = {
      size: options.size,
      darkMode: isDark,
      showNonRadialPoints: options.showNonRadialPoints ?? true,
      handPointVisibility: options.handPointVisibility ?? "all",
      bluePropType: options.bluePropType,
      redPropType: options.catDogModeEnabled
        ? options.redPropType
        : options.bluePropType,
    };

    // Visibility settings
    const visibility: LayerVisibility = {
      showTKA: options.showTKA ?? true,
      showReversals: options.showReversals ?? true,
    };

    // Render via WorkerRenderPool (off-thread when available, main-thread fallback)
    const pool = getWorkerRenderPool();
    const blob = await pool.render(
      prepared,
      renderOptions,
      visibility,
      options.showStepNumbers ? stepNumber : undefined
    );

    // Cache the blob to IndexedDB asynchronously (don't await)
    pictographBlobCache.set(cacheKey, blob).catch(() => {
      // Ignore cache write errors
    });

    // Return blob URL — caller must revoke when done
    return URL.createObjectURL(blob);
  }
}

// DIRECT EXPORT - Use this instead of container.items.previewCellRenderer
// This avoids DI container rebuilds when this file changes
export const previewCellRenderer = new PreviewCellRenderer();
