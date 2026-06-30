/**
 * Pictograph Cloud Cache
 *
 * Per-cell sibling of cloud-thumbnail-cache. Stores one pre-rendered WebP per
 * unique pictograph (keyed by the canonical cloud-cell hash) in Firebase
 * Storage, so a cold scanner DOWNLOADS the image instead of rasterizing it.
 *
 * Same "known-exists" discipline as the thumbnail cache: we never request a
 * file we have not confirmed exists (via manifest or a prior upload), so reads
 * never 404-spam.
 *
 * Storage: pictograph-cells/{hash}.webp
 * Manifest: pictograph-cells/manifest.json  ->  { keys: string[], generated }
 */

const FIREBASE_STORAGE_BUCKET = "the-kinetic-alphabet.firebasestorage.app";
const MANIFEST_PATH = "pictograph-cells/manifest.json";
const KNOWN_EXISTS_KEY = "tka-cloud-cells";

let knownExists: Set<string> | null = null;
let manifestLoaded = false;
let manifestLoadPromise: Promise<number> | null = null;
const urlCache = new Map<string, string>();
const pendingUploads = new Map<string, Promise<string>>();

function storagePath(hash: string): string {
  return `pictograph-cells/${hash}.webp`;
}

function getKnownExists(): Set<string> {
  if (knownExists) return knownExists;
  try {
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem(KNOWN_EXISTS_KEY) : null;
    if (stored) {
      const parsed = JSON.parse(stored) as { keys: string[]; timestamp: number };
      if (Date.now() - parsed.timestamp < 7 * 24 * 60 * 60 * 1000) {
        knownExists = new Set(parsed.keys);
        return knownExists;
      }
    }
  } catch {
    /* ignore */
  }
  knownExists = new Set();
  return knownExists;
}

function persistKnownExists(): void {
  try {
    if (typeof localStorage === "undefined") return;
    const keys = Array.from(getKnownExists()).slice(-5000);
    localStorage.setItem(KNOWN_EXISTS_KEY, JSON.stringify({ keys, timestamp: Date.now() }));
  } catch {
    /* ignore */
  }
}

/** Synchronous "do we know this exists" check (used before download attempts). */
export function knows(hash: string): boolean {
  return getKnownExists().has(hash);
}

/** Register a hash as existing (after upload or manifest load). */
export function registerExists(hash: string): void {
  const set = getKnownExists();
  set.add(hash);
  if (set.size % 10 === 0) persistKnownExists();
}

/** Public download URL for a KNOWN hash; null if not known. */
export async function getUrl(hash: string): Promise<string | null> {
  const cached = urlCache.get(hash);
  if (cached) return cached;
  if (!knows(hash)) return null;
  const encoded = encodeURIComponent(storagePath(hash));
  const url = `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_STORAGE_BUCKET}/o/${encoded}?alt=media`;
  urlCache.set(hash, url);
  return url;
}

/** Download the WebP blob for a known hash; null on miss/error. */
export async function download(hash: string): Promise<Blob | null> {
  try {
    const url = await getUrl(hash);
    if (!url) return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

/** Upload a rendered WebP under its hash; first-write-wins. */
export async function upload(hash: string, blob: Blob): Promise<string> {
  const pending = pendingUploads.get(hash);
  if (pending) return pending;
  const existing = await getUrl(hash);
  if (existing) return existing;

  const p = (async () => {
    const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
    const { getStorageInstance } = await import("$lib/shared/auth/firebase");
    const storage = await getStorageInstance();
    const storageRef = ref(storage, storagePath(hash));
    await uploadBytes(storageRef, blob, {
      contentType: "image/webp",
      customMetadata: { uploadedAt: new Date().toISOString(), source: "crowd-sourced" },
    });
    const url = await getDownloadURL(storageRef);
    return url;
  })();
  pendingUploads.set(hash, p);
  try {
    const url = await p;
    urlCache.set(hash, url);
    registerExists(hash);
    return url;
  } finally {
    pendingUploads.delete(hash);
  }
}

/** Pre-populate knownExists from the cloud manifest (call once on scan boot). */
export async function loadManifest(): Promise<number> {
  if (manifestLoaded) return getKnownExists().size;
  if (manifestLoadPromise) return manifestLoadPromise;
  manifestLoadPromise = (async () => {
    try {
      const encoded = encodeURIComponent(MANIFEST_PATH);
      const url = `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_STORAGE_BUCKET}/o/${encoded}?alt=media`;
      const res = await fetch(url);
      if (!res.ok) { manifestLoaded = true; return 0; }
      const manifest = (await res.json()) as { keys: string[] };
      const set = getKnownExists();
      for (const k of manifest.keys) set.add(k);
      persistKnownExists();
      manifestLoaded = true;
      return set.size;
    } catch {
      manifestLoaded = true;
      return getKnownExists().size;
    } finally {
      manifestLoadPromise = null;
    }
  })();
  return manifestLoadPromise;
}

/** Test-only reset. */
export function _resetForTest(): void {
  knownExists = null;
  manifestLoaded = false;
  manifestLoadPromise = null;
  urlCache.clear();
  pendingUploads.clear();
}
