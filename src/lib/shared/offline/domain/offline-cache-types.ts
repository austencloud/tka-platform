/**
 * Offline Cache Types
 *
 * Types for the proactive offline caching system.
 */

import type { PublicSequenceIndex } from "$lib/shared/foundation/domain/models/public-sequence-index";

/** A cached gallery sequence entry in Dexie */
export interface GalleryCacheEntry {
  /** Same ID as Firestore doc */
  id: string;
  /** The Firestore doc stored as-is */
  data: PublicSequenceIndex;
  /** When this entry was cached */
  cachedAt: number;
}

/** Metadata about the gallery cache for staleness tracking */
export interface GalleryCacheMeta {
  id: "gallery-cache-meta";
  lastSyncedAt: number;
  sequenceCount: number;
}

export type OfflineCachePhase = "idle" | "caching" | "ready" | "error";

export interface OfflineCacheProgress {
  cached: number;
  total: number;
  currentTask: string;
}

export interface OfflineCacheStats {
  gallerySequenceCount: number;
  galleryLastSyncedAt: number | null;
  thumbnailsCached: number;
  thumbnailsSizeBytes: number;
  propSvgsCached: boolean;
  isOfflineReady: boolean;
}

/** Why a download attempt produced no durable caching. */
export type DownloadForOfflineReason =
  /** No service worker here (dev / localhost / preview) — nothing to cache into. */
  | "unsupported-env"
  /** Environment is fine but the gallery cache is empty (visit Browse online first). */
  | "empty-gallery";

/** Outcome of a "Download for offline" run, so the UI can report honestly. */
export interface DownloadForOfflineResult {
  /** True when this environment has an active SW cache to warm into. */
  supported: boolean;
  /** Set when nothing meaningful happened; drives the user-facing notice. */
  reason?: DownloadForOfflineReason;
  /** Cloud thumbnails successfully warmed into the SW cache. */
  warmed: number;
  /** Gallery sequences considered. */
  total: number;
}
