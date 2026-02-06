/**
 * Gallery Cache Clear Utility
 *
 * Clears all gallery caching layers to force fresh metadata extraction
 * with the new difficulty calculator.
 *
 * USE THIS to fix cached difficulty levels after implementing the calculator!
 */

import { container } from "$lib/shared/di";
import type { IBrowseCache } from "../../features/browse/sequences/display/services/contracts/IBrowseCache";
import type { IOptimizedBrowser } from "../../features/browse/shared/services/contracts/IOptimizedBrowser";

export async function clearAllGalleryCaches(): Promise<void> {
  try {
    // 1. Clear BrowseCache
    const browseCacheService = container.items.browseCache as IBrowseCache;
    browseCacheService.clearCache();

    // 2. Clear OptimizedBrowser
    const optimizedService = container.items.optimizedBrowser as IOptimizedBrowser;
    optimizedService.clearCache();

    // 3. Clear IndexedDB/Dexie cache if it exists
    if ("indexedDB" in window) {
      try {
        const dbName = "tka-persistence";
        await new Promise<void>((resolve, reject) => {
          const request = indexedDB.deleteDatabase(dbName);
          request.onsuccess = () => {
            resolve();
          };
          request.onerror = () => reject(request.error);
        });
      } catch {
        // No IndexedDB to clear
      }
    }

    // 4. Clear localStorage gallery data
    const galleryKeys = Object.keys(localStorage).filter(
      (key) =>
        key.includes("gallery") ||
        key.includes("browse") ||
        key.includes("sequence")
    );
    galleryKeys.forEach((key) => localStorage.removeItem(key));

    // Return success message
    return Promise.resolve();
  } catch (error) {
    console.error("Error clearing caches:", error);
    throw error;
  }
}

/**
 * Call this from browser console to clear caches:
 *
 * ```javascript
 * import { clearAllGalleryCaches } from './src/lib/shared/utils/clear-gallery-cache';
 * await clearAllGalleryCaches();
 * location.reload();
 * ```
 */

// Make it available globally for easy console access
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__clearGalleryCache =
    clearAllGalleryCaches;
}
