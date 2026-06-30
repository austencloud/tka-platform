/**
 * Pictograph Cloud Cache
 *
 * Per-cell sibling of cloud-thumbnail-cache. Stores one pre-rendered WebP per
 * unique pictograph (keyed by the canonical cloud-cell hash) in Firebase
 * Storage, so a cold scanner DOWNLOADS the image instead of rasterizing it.
 *
 * READ PATH IS DIRECT-PROBE (not manifest-gated). A scan card has only a handful
 * of cells, so we just attempt the deterministic public URL: a hit downloads, a
 * miss (404) renders locally + uploads (crowd-source). This gives cross-device
 * benefit immediately — the moment render-at-publish or any prior scanner has
 * uploaded a cell, every later device's probe finds it — with no out-of-band
 * manifest-generation step. Misses are negative-cached for the session so the
 * same absent hash is probed at most once per page load. Never throws.
 *
 * Storage: pictograph-cells/{hash}.webp
 * (Reads require the Storage bucket's CORS to allow the app origin — same bucket
 * + CORS as cloud-thumbnail-cache; run `npm run storage:cors:apply` if a read is
 * CORS-blocked on localhost.)
 */

const FIREBASE_STORAGE_BUCKET = "the-kinetic-alphabet.firebasestorage.app";

/** Successful public URLs, keyed by hash (pure fn of hash; session-lived). */
const urlCache = new Map<string, string>();
/** Hashes confirmed ABSENT this session — skip re-probing. */
const missing = new Set<string>();
/** In-flight uploads, deduped by hash. */
const pendingUploads = new Map<string, Promise<string | null>>();

/** The deterministic public URL where this hash's image would live. */
export function cellPublicUrl(hash: string): string {
  const encoded = encodeURIComponent(`pictograph-cells/${hash}.webp`);
  return `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_STORAGE_BUCKET}/o/${encoded}?alt=media`;
}

/**
 * Download the pre-rendered WebP for this hash, or null if it doesn't exist yet
 * (or the network failed). Direct-probe; negative-cached per session. Never throws.
 */
export async function download(hash: string): Promise<Blob | null> {
  if (missing.has(hash)) return null;
  try {
    const res = await fetch(cellPublicUrl(hash));
    if (!res.ok) {
      missing.add(hash);
      return null;
    }
    urlCache.set(hash, cellPublicUrl(hash));
    return await res.blob();
  } catch {
    return null;
  }
}

/**
 * Upload a freshly-rendered WebP for this hash so later scanners download it.
 * First-write-wins, deduped per session. Never throws — returns the URL on
 * success, null on failure.
 */
export async function upload(hash: string, blob: Blob): Promise<string | null> {
  const pending = pendingUploads.get(hash);
  if (pending) return pending;

  const p = (async (): Promise<string | null> => {
    try {
      const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
      const { getStorageInstance } = await import("$lib/shared/auth/firebase");
      const storage = await getStorageInstance();
      const storageRef = ref(storage, `pictograph-cells/${hash}.webp`);
      await uploadBytes(storageRef, blob, {
        contentType: "image/webp",
        customMetadata: { uploadedAt: new Date().toISOString(), source: "crowd-sourced" },
      });
      const url = await getDownloadURL(storageRef);
      urlCache.set(hash, url);
      missing.delete(hash);
      return url;
    } catch {
      return null;
    }
  })();

  pendingUploads.set(hash, p);
  try {
    return await p;
  } finally {
    pendingUploads.delete(hash);
  }
}

/** Test-only reset of module state. */
export function _resetForTest(): void {
  urlCache.clear();
  missing.clear();
  pendingUploads.clear();
}
