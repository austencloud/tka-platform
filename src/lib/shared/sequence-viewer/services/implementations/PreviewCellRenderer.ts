/**
 * PreviewCellRenderer
 *
 * Renders individual pictograph cells with two-layer caching:
 * 1. IndexedDB (PictographBlobCache) - persists across sessions
 * 2. LayerCompositor's memory cache - fast in-session reuse
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
import { layerCompositor } from "$lib/shared/render/services/implementations/LayerCompositor";
import { pictographPreparer } from "$lib/shared/pictograph/shared/services/implementations/PictographPreparer";
import { pictographBlobCache } from "$lib/shared/render/services/implementations/PictographBlobCache";

export class PreviewCellRenderer implements IPreviewCellRenderer {
  /**
   * Generate a cache key for a pictograph based on its data and render options.
   * Uses djb2 hash for compact keys.
   */
  private deriveCacheKey(
    pictographData: PictographData,
    stepNumber: number | undefined,
    isDark: boolean,
    options: PreviewCellRenderOptions
  ): string {
    // Build a deterministic key from ALL rendering parameters
    // Every setting that affects the final pixel output MUST be in this key,
    // otherwise the IndexedDB blob cache returns stale images.
    const keyParts = [
      pictographData.letter || "start",
      pictographData.motions?.blue?.motionType || "none",
      pictographData.motions?.blue?.startLocation || "",
      pictographData.motions?.blue?.endLocation || "",
      pictographData.motions?.blue?.turns ?? 0,
      pictographData.motions?.red?.motionType || "none",
      pictographData.motions?.red?.startLocation || "",
      pictographData.motions?.red?.endLocation || "",
      pictographData.motions?.red?.turns ?? 0,
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
    ];

    // djb2 hash
    const str = keyParts.join("|");
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
    }
    return `lsp-${Math.abs(hash).toString(36)}`;
  }

  /**
   * Convert an HTMLCanvasElement to a Blob asynchronously.
   * Unlike toDataURL() which blocks the main thread for PNG encoding,
   * toBlob() delegates encoding to a background thread.
   */
  private canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("toBlob returned null"))),
        "image/png"
      );
    });
  }

  /**
   * Render a single pictograph and return a blob URL.
   * Uses blob URLs (URL.createObjectURL) instead of data URLs for two reasons:
   * 1. Cache hits: createObjectURL is instant vs FileReader.readAsDataURL (~5ms)
   * 2. Cache misses: toBlob is async (background thread) vs toDataURL (blocks main thread ~20-50ms)
   *
   * IMPORTANT: Callers must call URL.revokeObjectURL() on returned URLs when done.
   */
  async renderCell(
    pictographData: PictographData,
    stepNumber: number | undefined,
    isDark: boolean,
    options: PreviewCellRenderOptions
  ): Promise<string> {
    // Generate cache key
    const cacheKey = this.deriveCacheKey(pictographData, stepNumber, isDark, options);

    // Check IndexedDB cache first — blob URL creation is instant
    try {
      const cachedBlob = await pictographBlobCache.get(cacheKey);
      if (cachedBlob) {
        return URL.createObjectURL(cachedBlob);
      }
    } catch {
      // Cache miss or error, proceed to render
    }

    // Prepare the pictograph data
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

    // Compose the pictograph
    const result = await layerCompositor.compose(
      prepared,
      renderOptions,
      visibility,
      options.showStepNumbers ? stepNumber : undefined
    );

    // Convert canvas to blob asynchronously (doesn't block main thread)
    const blob = await this.canvasToBlob(result.canvas);

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
