/**
 * Gallery sync staleness decision.
 *
 * The boot prefetch warms the gallery from IndexedDB instantly, then optionally
 * pulls fresh data from Firestore. Re-pulling the whole publicSequences
 * collection on every boot is wasted bandwidth and Firestore reads when nothing
 * changed since the last sync. This pure function decides whether the cache is
 * old enough that a fresh sync is worth it, so the prefetcher can skip the
 * network when the cache is fresh.
 *
 * Kept dependency-free so it unit-tests without pulling Dexie/Firebase.
 */

/** TTL after which a cached gallery is considered stale enough to re-sync. */
export const GALLERY_SYNC_TTL_MS = 15 * 60 * 1000; // 15 min

/**
 * True when the gallery cache should be re-synced from Firestore: either it was
 * never synced (`lastSyncedAt == null`) or it was synced at least `ttlMs` ago.
 *
 * @param lastSyncedAt epoch ms of the last successful sync, or null if never.
 * @param now epoch ms of the current time.
 * @param ttlMs freshness window; defaults to {@link GALLERY_SYNC_TTL_MS}.
 */
export function isGallerySyncStale(
  lastSyncedAt: number | null,
  now: number,
  ttlMs: number = GALLERY_SYNC_TTL_MS
): boolean {
  if (lastSyncedAt == null) return true;
  return now - lastSyncedAt >= ttlMs;
}
