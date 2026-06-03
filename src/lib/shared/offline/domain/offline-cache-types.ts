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
