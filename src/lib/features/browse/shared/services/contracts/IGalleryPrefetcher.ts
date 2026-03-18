export interface IGalleryPrefetcher {
  /** Warm from IndexedDB, then sync from Firestore in background. */
  prefetch(): Promise<void>;

  /** True once IndexedDB cache has been loaded into memory. */
  readonly isWarmed: boolean;

  /** True while Firestore background sync is in progress. */
  readonly isSyncing: boolean;

  /** The in-flight prefetch promise, if any. */
  readonly prefetchPromise: Promise<void> | null;
}
