/**
 * Cloud Thumbnail Cache
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

import { getErrorHandler } from "$lib/shared/application/get-error-handler";
import { getStorageInstance } from "$lib/shared/auth/firebase";
import type { ErrorHandler } from '$lib/shared/application/services/error-handler'
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type { ThumbnailVariant } from "$lib/shared/browse/services/thumbnail-key-deriver";

export interface CloudThumbnailKey {
  sequenceName: string;
  /** Unique sequence ID - distinguishes variations with the same word */
  sequenceId?: string;
  propType: PropType;
  lightMode: boolean;
  /** Cache variant - defaults to 'gallery' for backwards compatibility */
  variant?: ThumbnailVariant;
}

export interface DeleteProgress {
  deleted: number;
  total: number;
  currentFile?: string;
}

// In-memory cache with TTL to avoid stale URLs
// Firebase download URLs expire after ~1 hour, so we refresh after 30 minutes
const URL_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Longer TTL for "known missing" entries - no need to re-check frequently
const _MISSING_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedUrl {
  url: string | null;
  timestamp: number;
}

const urlCache = new Map<string, CachedUrl>();
const pendingUploads = new Map<string, Promise<string>>();

// Manifest loading state
let manifestLoaded = false;
let manifestLoadPromise: Promise<number> | null = null;
const MANIFEST_PATH = "thumbnails/manifest.json";

// Firebase Storage bucket - single source of truth
const FIREBASE_STORAGE_BUCKET = "the-kinetic-alphabet.firebasestorage.app";

// Track thumbnails we've confirmed EXIST in cloud storage
// This inverts the usual pattern: we assume things DON'T exist (render locally)
// and only check cloud for things we KNOW exist (from previous uploads or checks)
// This prevents 404 spam because we never request things that don't exist
const KNOWN_EXISTS_KEY = "tka-cloud-thumbnails";
let knownExists: Set<string> | null = null;

function getKnownExists(): Set<string> {
  if (knownExists) return knownExists;
  try {
    const stored = localStorage.getItem(KNOWN_EXISTS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as { keys: string[]; timestamp: number };
      // Keep for 7 days (thumbnails don't get deleted often)
      if (Date.now() - parsed.timestamp < 7 * 24 * 60 * 60 * 1000) {
        knownExists = new Set(parsed.keys);
        return knownExists;
      }
    }
  } catch {
    // Ignore localStorage errors
  }
  knownExists = new Set();
  return knownExists;
}

function addKnownExists(cacheKey: string): void {
  const exists = getKnownExists();
  exists.add(cacheKey);
  // Persist periodically (every 10 additions) to avoid excessive writes
  if (exists.size % 10 === 0) {
    persistKnownExists();
  }
}

function persistKnownExists(): void {
  try {
    const exists = getKnownExists();
    // Limit size to prevent localStorage bloat (keep most recent 2000)
    const keys = Array.from(exists).slice(-2000);
    localStorage.setItem(
      KNOWN_EXISTS_KEY,
      JSON.stringify({ keys, timestamp: Date.now() })
    );
  } catch {
    // Ignore localStorage errors
  }
}

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

/**
 * Get the storage path for a thumbnail
 * Includes variant in path to separate gallery (no user data) from wordcard (with user data)
 */
export function getStoragePath(key: CloudThumbnailKey): string {
  const variant = key.variant ?? "gallery";
  const modeSuffix = key.lightMode ? "_light" : "_dark";
  const idSuffix = key.sequenceId ? `_${key.sequenceId}` : "";
  return `thumbnails/${variant}/${key.propType}/${key.sequenceName}${idSuffix}${modeSuffix}.webp`;
}

/**
 * Get cache key for in-memory cache
 * Includes variant to keep gallery and wordcard thumbnails separate
 * Includes sequenceId so variations of the same word cache independently
 */
function getCacheKey(key: CloudThumbnailKey): string {
  const variant = key.variant ?? "gallery";
  const modeSuffix = key.lightMode ? "_light" : "_dark";
  const idSuffix = key.sequenceId ? `_${key.sequenceId}` : "";
  return `${variant}/${key.propType}/${key.sequenceName}${idSuffix}${modeSuffix}`;
}

/**
 * Get thumbnail URL from in-memory cache only (synchronous)
 * Returns undefined if not in cache, null if checked and known not to exist
 * Use this for instant cache hits without async overhead
 */
export function getCachedUrl(key: CloudThumbnailKey): string | null | undefined {
  const cacheKey = getCacheKey(key);
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
 * Returns null if thumbnail doesn't exist in cloud (or we don't know if it exists)
 *
 * IMPORTANT: This method only fetches thumbnails we KNOW exist (from previous uploads).
 * If we don't know it exists, we return null immediately to avoid 404 errors.
 * The caller should render locally, then upload() will register it as "known to exist".
 *
 * @param priority - Lower = higher priority (Y position). Visible thumbnails get served first.
 */
export async function getUrl(key: CloudThumbnailKey, priority: number = Infinity): Promise<string | null> {
  const cacheKey = getCacheKey(key);

  // Check in-memory cache first (no concurrency limit needed)
  const cached = urlCache.get(cacheKey);
  if (cached && isCacheValid(cached)) {
    return cached.url;
  }
  // Clean up expired entry
  if (cached) {
    urlCache.delete(cacheKey);
  }

  // KEY CHANGE: Only fetch if we KNOW this thumbnail exists
  // This prevents 404 errors entirely - we never request things we haven't confirmed
  if (!getKnownExists().has(cacheKey)) {
    // We don't know if it exists - return null, caller will render locally
    // After upload(), this will be added to knownExists for next time
    return null;
  }

  // We know this exists - safe to fetch without 404
  // Acquire a slot before making request (respects priority queue)
  await acquireCheckSlot(priority);

  try {
    // Double-check cache after acquiring slot (might have been populated while waiting)
    const cachedAgain = urlCache.get(cacheKey);
    if (cachedAgain && isCacheValid(cachedAgain)) {
      return cachedAgain.url;
    }

    // Build the public URL directly
    const storagePath = getStoragePath(key);
    const encodedPath = encodeURIComponent(storagePath);
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_STORAGE_BUCKET}/o/${encodedPath}?alt=media`;

    // Cache and return - we know it exists, no need to verify
    urlCache.set(cacheKey, { url: publicUrl, timestamp: Date.now() });
    return publicUrl;
  } finally {
    // Always release the slot
    releaseCheckSlot();
  }
}

/**
 * Download thumbnail blob from Firebase Storage
 * Returns null if thumbnail doesn't exist
 */
export async function download(key: CloudThumbnailKey): Promise<Blob | null> {
  try {
    const url = await getUrl(key);
    if (!url) return null;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.blob();
  } catch (error) {
    try {
      const errorHandler = getErrorHandler() as ErrorHandler;
      errorHandler.showUserError({
        message: "Thumbnail didn't load",
        technicalDetails: error instanceof Error ? error.message : String(error),
        error: error instanceof Error ? error : new Error(String(error)),
        severity: "warning",
        context: {
          module: "browse",
          action: "load-thumbnail",
        },
      });
    } catch {
      console.warn(
        `CloudThumbnailCache: Error downloading ${getCacheKey(key)}:`,
        error
      );
    }
    return null;
  }
}

/**
 * Check if thumbnail exists in Firebase Storage
 */
export async function exists(key: CloudThumbnailKey): Promise<boolean> {
  const url = await getUrl(key);
  return url !== null;
}

/**
 * Upload rendered thumbnail to Firebase Storage
 * Returns the public URL of the uploaded image
 * Handles race conditions gracefully (first upload wins)
 */
export async function upload(key: CloudThumbnailKey, blob: Blob): Promise<string> {
  const cacheKey = getCacheKey(key);

  // Check if there's already a pending upload for this key
  const pendingUpload = pendingUploads.get(cacheKey);
  if (pendingUpload) {
    return pendingUpload;
  }

  // Check if it already exists (race condition check)
  const existingUrl = await getUrl(key);
  if (existingUrl) {
    return existingUrl;
  }

  // Create upload promise
  const uploadPromise = performUpload(key, blob);
  pendingUploads.set(cacheKey, uploadPromise);

  try {
    const url = await uploadPromise;
    urlCache.set(cacheKey, { url, timestamp: Date.now() });
    addKnownExists(cacheKey); // Register as existing - future getUrl() calls will fetch it
    return url;
  } finally {
    pendingUploads.delete(cacheKey);
  }
}

/**
 * Perform the actual upload to Firebase Storage
 */
async function performUpload(
  key: CloudThumbnailKey,
  blob: Blob
): Promise<string> {
  const { ref, uploadBytes, getDownloadURL } =
    await import("firebase/storage");
  const storage = await getStorageInstance();
  const storagePath = getStoragePath(key);
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
 * @param includeKnownExists - Also clear the persistent "known exists" list
 *        (use this after bulk-deleting thumbnails from storage)
 */
export function clearMemoryCache(includeKnownExists: boolean = false): void {
  urlCache.clear();
  if (includeKnownExists) {
    knownExists = new Set();
    try {
      localStorage.removeItem(KNOWN_EXISTS_KEY);
    } catch {
      // Ignore localStorage errors
    }
  }
}

/**
 * Invalidate a specific cache entry
 * Call this when an image fails to load (e.g., 404) to allow retry
 */
export function invalidateUrl(key: CloudThumbnailKey): void {
  const cacheKey = getCacheKey(key);
  urlCache.delete(cacheKey);
}

/**
 * Load the thumbnail manifest from cloud storage
 * Pre-populates the "known exists" list for instant cache hits across all devices
 * Should be called once on app startup
 * Returns the number of thumbnails registered
 */
export async function loadManifest(): Promise<number> {
  // Already loaded
  if (manifestLoaded) {
    return getKnownExists().size;
  }

  // Already loading - wait for it
  if (manifestLoadPromise) {
    return manifestLoadPromise;
  }

  // Start loading
  manifestLoadPromise = doLoadManifest();
  return manifestLoadPromise;
}

async function doLoadManifest(): Promise<number> {
  try {
    // Build direct URL to manifest (public read)
    const encodedPath = encodeURIComponent(MANIFEST_PATH);
    const manifestUrl = `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_STORAGE_BUCKET}/o/${encodedPath}?alt=media`;

    const response = await fetch(manifestUrl);
    if (!response.ok) {
      // Manifest doesn't exist yet - that's OK, will be created on first upload
      manifestLoaded = true;
      return 0;
    }

    const manifest = await response.json() as { keys: string[]; generated: string };
    const exists = getKnownExists();
    let added = 0;

    for (const key of manifest.keys) {
      if (!exists.has(key)) {
        exists.add(key);
        added++; // eslint-disable-line @typescript-eslint/no-unused-vars
      }
    }

    // Persist the merged set
    persistKnownExists();
    manifestLoaded = true;

    return exists.size;
  } catch (error) {
    console.warn("[CloudThumbnailCache] Failed to load manifest:", error);
    manifestLoaded = true; // Don't retry continuously
    return getKnownExists().size;
  } finally {
    manifestLoadPromise = null;
  }
}

/**
 * Check if manifest has been loaded
 */
export function isManifestLoaded(): boolean {
  return manifestLoaded;
}

/**
 * Delete all thumbnails for a variant (admin only)
 * Lists all files in thumbnails/{variant}/ and deletes them
 * Returns the number of files deleted
 */
export async function deleteVariant(
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

      // Count successes - treat "object-not-found" as success (already deleted)
      results.forEach((result, j) => {
        if (result.status === "fulfilled") {
          deletedCount++;
        } else {
          // Check if this is a "not found" error - that's OK, file is already gone
          const reason = result.reason as { code?: string };
          if (reason?.code === "storage/object-not-found") {
            // Already deleted or never existed - count as success
            deletedCount++;
          } else {
            // Only log actual failures (permission errors, network issues, etc.)
            const item = batch[j];
            if (item) {
              console.warn(`Failed to delete ${item.fullPath}:`, result.reason);
            }
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

    // Also clear "known exists" entries for deleted thumbnails
    const existsSet = getKnownExists();
    for (const key of existsSet) {
      if (key.startsWith(`${variant}/`)) {
        existsSet.delete(key);
      }
    }
    persistKnownExists();

    return deletedCount;
  } catch (error) {
    console.error(`CloudThumbnailCache: Error deleting ${variant}:`, error);
    throw error;
  }
}
