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

import { injectable } from "inversify";
import { getStorageInstance } from "$lib/shared/auth/firebase";
import type {
  ICloudThumbnailCache,
  CloudThumbnailKey,
  ThumbnailVariant,
} from "../contracts/ICloudThumbnailCache";

// In-memory cache to avoid repeated Firebase Storage checks
const urlCache = new Map<string, string | null>();
const pendingUploads = new Map<string, Promise<string>>();

@injectable()
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
   * Get thumbnail URL from Firebase Storage
   * Returns null if thumbnail doesn't exist in cloud
   */
  async getUrl(key: CloudThumbnailKey): Promise<string | null> {
    const cacheKey = this.getCacheKey(key);

    // Check in-memory cache first
    if (urlCache.has(cacheKey)) {
      return urlCache.get(cacheKey) ?? null;
    }

    try {
      const { ref, getDownloadURL } = await import("firebase/storage");
      const storage = await getStorageInstance();
      const storagePath = this.getStoragePath(key);
      const storageRef = ref(storage, storagePath);

      const url = await getDownloadURL(storageRef);
      urlCache.set(cacheKey, url);
      return url;
    } catch (error: unknown) {
      // If file doesn't exist, cache the null result
      if (
        error instanceof Error &&
        (error.message.includes("object-not-found") ||
          error.message.includes("storage/object-not-found"))
      ) {
        urlCache.set(cacheKey, null);
        return null;
      }
      // For other errors, don't cache - might be transient
      console.warn(
        `CloudThumbnailCache: Error getting URL for ${cacheKey}:`,
        error
      );
      return null;
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
      urlCache.set(cacheKey, url);
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
   * Delete all thumbnails for a variant (admin only)
   * Lists all files in thumbnails/{variant}/ and deletes them
   * Returns the number of files deleted
   */
  async deleteVariant(variant: ThumbnailVariant): Promise<number> {
    const { ref, listAll, deleteObject } = await import("firebase/storage");
    const storage = await getStorageInstance();

    // Get reference to the variant folder
    const variantRef = ref(storage, `thumbnails/${variant}`);

    let deletedCount = 0;

    try {
      // List all items recursively (Firebase listAll returns prefixes for folders)
      const result = await listAll(variantRef);

      // Delete all files in root of variant folder
      for (const item of result.items) {
        try {
          await deleteObject(item);
          deletedCount++;
        } catch (error) {
          console.warn(`Failed to delete ${item.fullPath}:`, error);
        }
      }

      // Recursively delete files in subfolders (prop type folders)
      for (const prefix of result.prefixes) {
        const subResult = await listAll(prefix);
        for (const item of subResult.items) {
          try {
            await deleteObject(item);
            deletedCount++;
          } catch (error) {
            console.warn(`Failed to delete ${item.fullPath}:`, error);
          }
        }
      }

      // Clear in-memory cache for this variant
      for (const key of urlCache.keys()) {
        if (key.startsWith(`${variant}/`)) {
          urlCache.delete(key);
        }
      }

      console.log(
        `CloudThumbnailCache: Deleted ${deletedCount} files from ${variant} variant`
      );
      return deletedCount;
    } catch (error) {
      console.error(`CloudThumbnailCache: Error deleting ${variant}:`, error);
      throw error;
    }
  }
}
