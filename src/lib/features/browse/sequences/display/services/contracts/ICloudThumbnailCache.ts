/**
 * Cloud Thumbnail Cache Contract
 *
 * Manages thumbnail storage in Firebase Storage for crowd-sourced rendering.
 * When a user encounters a prop type for the first time, they render it locally
 * and upload to Firebase Storage so future users get instant loading.
 *
 * Storage structure: /thumbnails/{variant}/{propType}/{sequenceName}_{mode}.webp
 * Examples:
 *   - Gallery (no user data): /thumbnails/gallery/club/Butterfly_dark.webp
 *   - Choreo card (with user data): /thumbnails/wordcard/club/Butterfly_dark.webp
 */

import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

/**
 * Thumbnail variant determines what metadata is baked into the image:
 * - 'gallery': No user data footer (for Browse browsing)
 * - 'wordcard': With user data footer (for print cards)
 */
export type ThumbnailVariant = "gallery" | "wordcard";

/**
 * Progress callback for deletion operations
 */
export interface DeleteProgress {
  deleted: number;
  total: number;
  currentFile?: string;
}

export interface CloudThumbnailKey {
  sequenceName: string;
  /** Unique sequence ID - distinguishes variations with the same word */
  sequenceId?: string;
  propType: PropType;
  lightMode: boolean;
  /** Cache variant - defaults to 'gallery' for backwards compatibility */
  variant?: ThumbnailVariant;
}

export interface CloudThumbnailResult {
  url: string;
  blob: Blob;
  fromCache: boolean;
}

export interface ICloudThumbnailCache {
  /**
   * Get thumbnail URL from in-memory cache only (synchronous)
   * Returns undefined if not in cache, null if checked and known not to exist
   * Use this for instant cache hits without async overhead
   */
  getCachedUrl(key: CloudThumbnailKey): string | null | undefined;

  /**
   * Get thumbnail URL from Firebase Storage
   * Returns null if thumbnail doesn't exist in cloud
   */
  getUrl(key: CloudThumbnailKey, priority?: number): Promise<string | null>;

  /**
   * Download thumbnail blob from Firebase Storage
   * Returns null if thumbnail doesn't exist
   */
  download(key: CloudThumbnailKey): Promise<Blob | null>;

  /**
   * Check if thumbnail exists in Firebase Storage
   */
  exists(key: CloudThumbnailKey): Promise<boolean>;

  /**
   * Upload rendered thumbnail to Firebase Storage
   * Returns the public URL of the uploaded image
   * Handles race conditions gracefully (first upload wins)
   */
  upload(key: CloudThumbnailKey, blob: Blob): Promise<string>;

  /**
   * Get the storage path for a thumbnail
   */
  getStoragePath(key: CloudThumbnailKey): string;

  /**
   * Delete all thumbnails for a variant (admin only)
   * Returns the number of files deleted
   * Optional progress callback for real-time feedback
   */
  deleteVariant(
    variant: ThumbnailVariant,
    onProgress?: (progress: DeleteProgress) => void
  ): Promise<number>;

  /**
   * Clear the in-memory URL cache
   * @param includeKnownExists - Also clear the persistent "known exists" list
   */
  clearMemoryCache(includeKnownExists?: boolean): void;

  /**
   * Invalidate a specific cache entry
   * Call this when an image fails to load (e.g., 404) to allow retry
   */
  invalidateUrl(key: CloudThumbnailKey): void;

  /**
   * Load the thumbnail manifest from cloud storage
   * Pre-populates the "known exists" list for instant cache hits across all devices
   * Should be called once on app startup
   * Returns the number of thumbnails registered
   */
  loadManifest(): Promise<number>;

  /**
   * Check if manifest has been loaded
   */
  isManifestLoaded(): boolean;
}
