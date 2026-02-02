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
   * Render a single pictograph to a data URL (with IndexedDB caching)
   */
  async renderCell(
    pictographData: PictographData,
    stepNumber: number | undefined,
    isDark: boolean,
    options: PreviewCellRenderOptions
  ): Promise<string> {
    // Generate cache key
    const cacheKey = this.deriveCacheKey(pictographData, stepNumber, isDark, options);

    // Check IndexedDB cache first
    try {
      const cachedBlob = await pictographBlobCache.get(cacheKey);
      if (cachedBlob) {
        // Convert blob to data URL
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(cachedBlob);
        });
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

    // Convert canvas to data URL
    const dataUrl = result.canvas.toDataURL("image/png");

    // Cache the result asynchronously (don't await)
    result.canvas.toBlob((blob) => {
      if (blob) {
        pictographBlobCache.set(cacheKey, blob).catch(() => {
          // Ignore cache write errors
        });
      }
    }, "image/png");

    return dataUrl;
  }
}

// DIRECT EXPORT - Use this instead of container.items.previewCellRenderer
// This avoids DI container rebuilds when this file changes
export const previewCellRenderer = new PreviewCellRenderer();
