/**
 * Cloud Thumbnail Cache Implementation
 *
 * Manages thumbnail storage in Firebase Storage for crowd-sourced rendering.
 * When a user encounters a prop type for the first time, they render it locally
 * and upload to Firebase Storage so future users get instant loading.
 *
 * Storage structure: thumbnails/{propType}/{sequenceName}_{mode}.webp
 * Example: thumbnails/club/Butterfly_dark.webp
 *
 * This enables a "lazy generation" pattern where:
 * 1. First user to view a prop/sequence combo renders it locally
 * 2. Rendered image is uploaded to Firebase Storage
 * 3. All subsequent users get the pre-rendered image instantly
 */

import { getStorageInstance } from "$lib/shared/auth/firebase";
import type {
  ICloudThumbnailCache,
  CloudThumbnailKey,
  ThumbnailVariant,
  DeleteProgress,
} from "../contracts/ICloudThumbnailCache";

// In-memory cache with TTL to avoid stale URLs
// Firebase download URLs expire after ~1 hour, so we refresh after 30 minutes
const URL_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface CachedUrl {
  url: string | null;
  timestamp: number;
}

const urlCache = new Map<string, CachedUrl>();
const pendingUploads = new Map<string, Promise<string>>();

/**
 * Check if a cached entry is still valid (not expired)
 */
function isCacheValid(entry: CachedUrl): boolean {
  return Date.now() - entry.timestamp < URL_CACHE_TTL_MS;
}

// Concurrency control for cloud cache checks
// Prevents overwhelming Firebase with too many simultaneous requests
const MAX_CONCURRENT_CHECKS = 5;
let activeChecks = 0;

// Priority queue: lower number = higher priority (Y position from top of screen)
interface QueuedCheck {
  priority: number;
  resolve: () => void;
}
const checkQueue: QueuedCheck[] = [];

async function acquireCheckSlot(priority: number = Infinity): Promise<void> {
  if (activeChecks < MAX_CONCURRENT_CHECKS) {
    activeChecks++;
    return;
  }
  // Wait for a slot to become available
  return new Promise((resolve) => {
    checkQueue.push({
      priority,
      resolve: () => {
        activeChecks++;
        resolve();
      },
    });
    // Sort by priority (lower = higher priority = closer to top of screen)
    checkQueue.sort((a, b) => a.priority - b.priority);
  });
}

function releaseCheckSlot(): void {
  activeChecks--;
  // Take the highest priority item (first after sort)
  const next = checkQueue.shift();
  if (next) {
    next.resolve();
  }
}

export class CloudThumbnailCache implements ICloudThumbnailCache {
  /**
   * Get the storage path for a thumbnail
   * Includes variant in path to separate gallery (no user data) from wordcard (with user data)
   */
  getStoragePath(key: CloudThumbnailKey): string {
    const variant = key.variant ?? "gallery";
    const modeSuffix = key.lightMode ? "_light" : "_dark";
    return `thumbnails/${variant}/${key.propType}/${key.sequenceName}${modeSuffix}.webp`;
  }

  /**
   * Get cache key for in-memory cache
   * Includes variant to keep gallery and wordcard thumbnails separate
   */
  private getCacheKey(key: CloudThumbnailKey): string {
    const variant = key.variant ?? "gallery";
    const modeSuffix = key.lightMode ? "_light" : "_dark";
    return `${variant}/${key.propType}/${key.sequenceName}${modeSuffix}`;
  }

  /**
   * Prefetch opposite light mode URL in background
   * Called after a successful cloud cache hit to enable instant toggling
   * Delayed significantly to avoid competing with immediate requests
   */
  private prefetchOppositeMode(key: CloudThumbnailKey): void {
    // Delay prefetch by 3 seconds so immediate requests get priority
    setTimeout(() => {
      const oppositeKey = { ...key, lightMode: !key.lightMode };
      const oppositeCacheKey = this.getCacheKey(oppositeKey);

      // Skip if already in cache
      const cached = urlCache.get(oppositeCacheKey);
      if (cached && isCacheValid(cached)) {
        return;
      }

      // Fire and forget - fetch opposite mode in background
      this.getUrl(oppositeKey).catch(() => {
        // Ignore errors - this is just a prefetch optimization
      });
    }, 3000);
  }

  /**
   * Get thumbnail URL from in-memory cache only (synchronous)
   * Returns undefined if not in cache, null if checked and known not to exist
   * Use this for instant cache hits without async overhead
   */
  getCachedUrl(key: CloudThumbnailKey): string | null | undefined {
    const cacheKey = this.getCacheKey(key);
    const cached = urlCache.get(cacheKey);
    if (cached && isCacheValid(cached)) {
      return cached.url;
    }
    // Expired or not in cache
    if (cached) {
      urlCache.delete(cacheKey); // Clean up expired entry
    }
    return undefined; // Not in cache yet
  }

  /**
   * Get thumbnail URL from Firebase Storage
   * Returns null if thumbnail doesn't exist in cloud
   * Uses getMetadata first to avoid 404 errors in console (getDownloadURL logs network errors)
   * @param priority - Lower = higher priority (Y position). Visible thumbnails get served first.
   */
  async getUrl(key: CloudThumbnailKey, priority: number = Infinity): Promise<string | null> {
    const cacheKey = this.getCacheKey(key);

    // Check in-memory cache first (no concurrency limit needed)
    const cached = urlCache.get(cacheKey);
    if (cached && isCacheValid(cached)) {
      return cached.url;
    }
    // Clean up expired entry
    if (cached) {
      urlCache.delete(cacheKey);
    }

    // Acquire a slot before making Firebase request (respects priority queue)
    await acquireCheckSlot(priority);

    try {
      // Double-check cache after acquiring slot (might have been populated while waiting)
      const cachedAgain = urlCache.get(cacheKey);
      if (cachedAgain && isCacheValid(cachedAgain)) {
        return cachedAgain.url;
      }

      const { ref, getMetadata, getDownloadURL } = await import("firebase/storage");
      const storage = await getStorageInstance();
      const storagePath = this.getStoragePath(key);
      const storageRef = ref(storage, storagePath);

      // Add timeout to prevent hanging when Firebase is overloaded
      const TIMEOUT_MS = 5000;

      // First check if file exists using getMetadata (doesn't log 404 to console)
      // This avoids the red 404 errors that getDownloadURL causes
      try {
        await Promise.race([
          getMetadata(storageRef),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Cloud cache timeout")), TIMEOUT_MS)
          ),
        ]);
      } catch (metadataError: unknown) {
        // File doesn't exist - cache null and return silently (no console error)
        if (
          metadataError instanceof Error &&
          (metadataError.message.includes("object-not-found") ||
            metadataError.message.includes("storage/object-not-found"))
        ) {
          urlCache.set(cacheKey, { url: null, timestamp: Date.now() });
          return null;
        }
        // Timeout - don't cache, render locally
        if (metadataError instanceof Error && metadataError.message.includes("timeout")) {
          return null;
        }
        // Other error - don't cache, might be transient
        return null;
      }

      // File exists - now get the download URL (won't 404)
      const url = await getDownloadURL(storageRef);

      if (url) {
        urlCache.set(cacheKey, { url, timestamp: Date.now() });

        // Prefetch opposite light mode in background for instant toggling
        this.prefetchOppositeMode(key);
      }
      return url;
    } catch (error: unknown) {
      // Shouldn't happen since we checked metadata first, but handle gracefully
      if (
        error instanceof Error &&
        (error.message.includes("object-not-found") ||
          error.message.includes("storage/object-not-found"))
      ) {
        urlCache.set(cacheKey, { url: null, timestamp: Date.now() });
        return null;
      }
      return null;
    } finally {
      // Always release the slot
      releaseCheckSlot();
    }
  }

  /**
   * Download thumbnail blob from Firebase Storage
   * Returns null if thumbnail doesn't exist
   */
  async download(key: CloudThumbnailKey): Promise<Blob | null> {
    try {
      const url = await this.getUrl(key);
      if (!url) return null;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.blob();
    } catch (error) {
      console.warn(
        `CloudThumbnailCache: Error downloading ${this.getCacheKey(key)}:`,
        error
      );
      return null;
    }
  }

  /**
   * Check if thumbnail exists in Firebase Storage
   */
  async exists(key: CloudThumbnailKey): Promise<boolean> {
    const url = await this.getUrl(key);
    return url !== null;
  }

  /**
   * Upload rendered thumbnail to Firebase Storage
   * Returns the public URL of the uploaded image
   * Handles race conditions gracefully (first upload wins)
   */
  async upload(key: CloudThumbnailKey, blob: Blob): Promise<string> {
    const cacheKey = this.getCacheKey(key);

    // Check if there's already a pending upload for this key
    const pendingUpload = pendingUploads.get(cacheKey);
    if (pendingUpload) {
      return pendingUpload;
    }

    // Check if it already exists (race condition check)
    const existingUrl = await this.getUrl(key);
    if (existingUrl) {
      return existingUrl;
    }

    // Create upload promise
    const uploadPromise = this.performUpload(key, blob);
    pendingUploads.set(cacheKey, uploadPromise);

    try {
      const url = await uploadPromise;
      urlCache.set(cacheKey, { url, timestamp: Date.now() });
      return url;
    } finally {
      pendingUploads.delete(cacheKey);
    }
  }

  /**
   * Perform the actual upload to Firebase Storage
   */
  private async performUpload(
    key: CloudThumbnailKey,
    blob: Blob
  ): Promise<string> {
    const { ref, uploadBytes, getDownloadURL } =
      await import("firebase/storage");
    const storage = await getStorageInstance();
    const storagePath = this.getStoragePath(key);
    const storageRef = ref(storage, storagePath);

    // Upload with metadata
    await uploadBytes(storageRef, blob, {
      contentType: "image/webp",
      customMetadata: {
        sequenceName: key.sequenceName,
        propType: key.propType,
        lightMode: String(key.lightMode),
        variant: key.variant ?? "gallery",
        uploadedAt: new Date().toISOString(),
        source: "crowd-sourced",
      },
    });

    const url = await getDownloadURL(storageRef);
    return url;
  }

  /**
   * Clear the in-memory URL cache
   * (Firebase Storage content is persistent)
   */
  clearMemoryCache(): void {
    urlCache.clear();
  }

  /**
   * Invalidate a specific cache entry
   * Call this when an image fails to load (e.g., 404) to allow retry
   */
  invalidateUrl(key: CloudThumbnailKey): void {
    const cacheKey = this.getCacheKey(key);
    urlCache.delete(cacheKey);
  }

  /**
   * Delete all thumbnails for a variant (admin only)
   * Lists all files in thumbnails/{variant}/ and deletes them
   * Returns the number of files deleted
   */
  async deleteVariant(
    variant: ThumbnailVariant,
    onProgress?: (progress: DeleteProgress) => void
  ): Promise<number> {
    const { ref, listAll, deleteObject } = await import("firebase/storage");
    const storage = await getStorageInstance();

    // Get reference to the variant folder
    const variantRef = ref(storage, `thumbnails/${variant}`);

    let deletedCount = 0;

    try {
      // List all items recursively (Firebase listAll returns prefixes for folders)
      const result = await listAll(variantRef);

      // Collect all files to delete
      const allItems: { fullPath: string; ref: typeof result.items[0] }[] = [];

      // Add root items
      for (const item of result.items) {
        allItems.push({ fullPath: item.fullPath, ref: item });
      }

      // Add subfolder items
      for (const prefix of result.prefixes) {
        const subResult = await listAll(prefix);
        for (const item of subResult.items) {
          allItems.push({ fullPath: item.fullPath, ref: item });
        }
      }

      const total = allItems.length;

      // Report initial count
      onProgress?.({ deleted: 0, total });

      // Delete files in parallel batches for speed
      const BATCH_SIZE = 50;
      for (let i = 0; i < allItems.length; i += BATCH_SIZE) {
        const batch = allItems.slice(i, i + BATCH_SIZE);

        // Delete batch in parallel
        const results = await Promise.allSettled(
          batch.map((item) => deleteObject(item.ref))
        );

        // Count successes and log failures
        results.forEach((result, j) => {
          if (result.status === "fulfilled") {
            deletedCount++;
          } else {
            const item = batch[j];
            if (item) {
              console.warn(`Failed to delete ${item.fullPath}:`, result.reason);
            }
          }
        });

        // Report progress after each batch
        onProgress?.({
          deleted: deletedCount,
          total,
        });
      }

      // Clear in-memory cache for this variant
      for (const key of urlCache.keys()) {
        if (key.startsWith(`${variant}/`)) {
          urlCache.delete(key);
        }
      }

      return deletedCount;
    } catch (error) {
      console.error(`CloudThumbnailCache: Error deleting ${variant}:`, error);
      throw error;
    }
  }
}
