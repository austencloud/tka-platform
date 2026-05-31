/**
 * PublicSequencesLoader - Load community sequences from Firestore
 *
 * Replaces BrowseLoader which loaded from static manifest files.
 * Now loads from the publicSequences Firestore collection.
 *
 * Features:
 * - Loads display metadata efficiently (no steps until needed)
 * - Caches results to avoid repeated queries
 * - Fetches full sequence data on demand via sourceRef
 */

import { getErrorHandler } from "$lib/shared/application/get-error-handler";
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  getDoc,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { getPublicSequencesPath } from "$lib/shared/library/data/firestore-paths";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { PublicSequenceIndex } from "$lib/shared/foundation/domain/models/PublicSequenceIndex";
import { hydrate } from "$lib/shared/foundation/services/sequence-hydrator";
import type { ErrorHandler } from '$lib/shared/application/services/error-handler'
import type { GalleryOfflineCache } from "$lib/shared/offline/services/gallery-offline-cache";
import { networkStatusState } from "$lib/shared/offline/state/network-status-state.svelte";

export class PublicSequencesLoader {
  private cachedSequences: SequenceData[] | null = null;
  private loadPromise: Promise<SequenceData[]> | null = null;
  // Map from word/name OR sequence ID to sourceRef for efficient full data lookup.
  // Both keys point to the same sourceRef so we can look up by either.
  // ID-based lookup is preferred when available (disambiguates same-word variations).
  private sourceRefCache: Map<string, string> = new Map();
  private galleryOfflineCache: GalleryOfflineCache | null;
  private lastFetchedDocs: PublicSequenceIndex[] = [];

  constructor(galleryOfflineCache?: GalleryOfflineCache) {
    this.galleryOfflineCache = galleryOfflineCache ?? null;
    if (this.galleryOfflineCache) {
      this.galleryOfflineCache.setConverter(
        (data, id) => this.mapPublicIndexToSequenceData(data, id)
      );
    }
  }

  /**
   * Load all public sequences from Firestore, falling back to offline cache
   * when the network is unavailable or the Firestore fetch fails.
   * Returns display metadata (no steps) for gallery grid.
   */
  async loadSequenceMetadata(): Promise<SequenceData[]> {
    if (this.cachedSequences) return this.cachedSequences;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this.fetchWithOfflineFallback();
    try {
      this.cachedSequences = await this.loadPromise;
      return this.cachedSequences;
    } catch (error) {
      const errorHandler = getErrorHandler() as ErrorHandler;
      errorHandler.showUserError({
        message: "Couldn't load the gallery",
        technicalDetails: error instanceof Error ? error.message : String(error),
        error: error instanceof Error ? error : new Error(String(error)),
        severity: "error",
        context: { module: "browse", action: "load-gallery" },
      });
      throw error;
    } finally {
      this.loadPromise = null;
    }
  }

  /**
   * Try Firestore first (when online), fall back to IndexedDB cache when
   * offline or when the network request fails.
   */
  private async fetchWithOfflineFallback(): Promise<SequenceData[]> {
    if (networkStatusState.isOnline) {
      try {
        const sequences = await this.fetchPublicSequences();
        if (this.galleryOfflineCache) {
          this.persistToOfflineCache().catch((err) =>
            console.warn("[PublicSequencesLoader] Offline cache persist failed:", err)
          );
        }
        return sequences;
      } catch (error) {
        console.warn(
          "[PublicSequencesLoader] Firestore fetch failed, trying offline cache:",
          error
        );
      }
    }

    if (this.galleryOfflineCache) {
      const hasCache = await this.galleryOfflineCache.hasCachedData();
      if (hasCache) {
        const cached = await this.galleryOfflineCache.loadCached();
        for (const [key, value] of cached.sourceRefs) {
          this.sourceRefCache.set(key, value);
        }
        return cached.sequences;
      }
    }

    throw new Error("No network connection and no cached gallery data available");
  }

  private async persistToOfflineCache(): Promise<void> {
    if (!this.galleryOfflineCache || this.lastFetchedDocs.length === 0) return;
    await this.galleryOfflineCache.persist(this.lastFetchedDocs);
  }

  /**
   * Load full sequence data for a specific sequence
   * Fetches from the source user's library via sourceRef
   * Uses cached sourceRef mapping for efficiency
   *
   * When sequenceId is provided, it's used for disambiguation so that
   * two sequences sharing the same word (e.g. two "FJ" variations by
   * different authors) resolve to the correct source document.
   */
  async loadFullSequenceData(sequenceName: string, sequenceId?: string): Promise<SequenceData | null> {
    // Ensure metadata is loaded first (populates sourceRef cache)
    if (!this.cachedSequences) {
      await this.loadSequenceMetadata();
    }

    // Prefer ID-based lookup when available - this is the only way to
    // disambiguate multiple sequences that share the same word.
    let sourceRef = sequenceId ? this.sourceRefCache.get(`id:${sequenceId}`) : undefined;

    // Fall back to word-based lookup (works when words are unique)
    if (!sourceRef) {
      sourceRef = this.sourceRefCache.get(sequenceName);
    }

    // Last resort: scan cached sequences for a match by name/word,
    // preferring the one matching sequenceId if provided.
    if (!sourceRef) {
      const candidates = this.cachedSequences?.filter(
        (s) => s.name === sequenceName || s.word === sequenceName
      ) ?? [];
      const match = (sequenceId && candidates.find((s) => s.id === sequenceId))
        || candidates[0];
      if (match?.ownerId && match.id) {
        sourceRef = `users/${match.ownerId}/sequences/${match.id}`;
      }
    }
    if (!sourceRef) {
      console.warn(`[PublicSequencesLoader] No sequence found for "${sequenceName}"${sequenceId ? ` (id: ${sequenceId})` : ""}`);
      return null;
    }

    // Fetch full data from the source reference
    const firestore = await getFirestoreInstance();
    try {
      const fullDoc = await getDoc(doc(firestore, sourceRef));
      if (!fullDoc.exists()) {
        console.warn(`[PublicSequencesLoader] Source sequence not found: ${sourceRef}`);
        return null;
      }

      const data = fullDoc.data();
      return this.mapFirestoreToSequenceData(data, fullDoc.id);
    } catch (error) {
      console.error(`[PublicSequencesLoader] Failed to load full sequence:`, error);
      return null;
    }
  }

  /**
   * Remove a single sequence from the cache by ID.
   * Avoids a Firestore round-trip after a delete.
   */
  removeFromCache(sequenceId: string): void {
    if (this.cachedSequences) {
      this.cachedSequences = this.cachedSequences.filter((s) => s.id !== sequenceId);
    }
  }

  /**
   * Add a sequence directly to the in-memory cache.
   * Called after publishing so the sequence appears in the gallery immediately.
   * If the cache isn't loaded yet, this is a no-op - the sequence will be fetched
   * from Firestore naturally on the next gallery load.
   */
  addToCache(sequence: SequenceData): void {
    if (!this.cachedSequences) return;
    const existingIndex = this.cachedSequences.findIndex((s) => s.id === sequence.id);
    if (existingIndex >= 0) {
      // Replace the existing entry so re-saves with a new word show correctly.
      this.cachedSequences = [
        ...this.cachedSequences.slice(0, existingIndex),
        sequence,
        ...this.cachedSequences.slice(existingIndex + 1),
      ];
    } else {
      this.cachedSequences = [...this.cachedSequences, sequence];
    }
  }

  warmFromCache(sequences: SequenceData[], sourceRefs: Map<string, string>): void {
    if (this.cachedSequences) return; // Already warmed or loaded - don't overwrite
    this.cachedSequences = sequences;
    for (const [key, value] of sourceRefs) {
      this.sourceRefCache.set(key, value);
    }
  }

  /**
   * Force a fresh Firestore fetch regardless of cache state.
   * Used by the prefetcher to sync in the background after warming from IndexedDB.
   * Updates the in-memory cache and persists to IndexedDB offline cache.
   */
  async refreshFromFirestore(): Promise<SequenceData[]> {
    const sequences = await this.fetchPublicSequences();
    this.cachedSequences = sequences;

    // Persist to offline cache for next session
    if (this.galleryOfflineCache) {
      this.persistToOfflineCache().catch((err) =>
        console.warn("[PublicSequencesLoader] Offline cache persist failed:", err)
      );
    }

    return sequences;
  }

  private async fetchPublicSequences(): Promise<SequenceData[]> {
    this.lastFetchedDocs = [];

    const firestore = await getFirestoreInstance();
    const publicSeqRef = collection(firestore, getPublicSequencesPath());

    // Query all public sequences, ordered by word for consistent display
    const q = query(publicSeqRef, orderBy("word", "asc"));
    const snapshot = await getDocs(q);

    const sequences: SequenceData[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as PublicSequenceIndex;
      sequences.push(this.mapPublicIndexToSequenceData(data, docSnap.id));

      // Capture raw doc for offline cache persistence after this fetch
      this.lastFetchedDocs.push({ ...data, id: docSnap.id } as PublicSequenceIndex);

      // Cache sourceRef for efficient full data lookup later.
      // Store under both word AND ID so we can look up by either.
      // The ID key is prefixed with "id:" to avoid collisions with words.
      if (data.sourceRef) {
        this.sourceRefCache.set(data.word, data.sourceRef);
        if (data.name && data.name !== data.word) {
          this.sourceRefCache.set(data.name, data.sourceRef);
        }
        // ID-based key enables disambiguation for same-word variations
        this.sourceRefCache.set(`id:${docSnap.id}`, data.sourceRef);
      }
    });

    return sequences;
  }

  /**
   * Map PublicSequenceIndex to SequenceData for display.
   * If compositional fields are present, hydrates full steps from them
   * so the sequence is self-contained (no sourceRef fetch needed).
   */
  private mapPublicIndexToSequenceData(
    data: PublicSequenceIndex,
    id: string
  ): SequenceData {
    const seq: SequenceData = {
      id,
      name: data.name,
      displayName: (data as unknown as { displayName?: string }).displayName,
      word: data.word,
      steps: [], // Will be hydrated below if compositional fields are present
      thumbnails: [...data.thumbnails],
      sequenceLength: data.sequenceLength,
      level: data.level ?? this.difficultyStringToLevel(data.difficultyLevel),
      difficultyLevel: data.difficultyLevel,
      loopType: data.loopType as SequenceData["loopType"],
      period: (data as unknown as { period?: number }).period,
      components: (data as unknown as { components?: string[] }).components as SequenceData["components"],
      componentDomains: (data as unknown as { componentDomains?: SequenceData["componentDomains"] }).componentDomains,
      isFavorite: false,
      isCircular: (data as unknown as { isCircular?: boolean }).isCircular ?? false,
      tags: [...data.tags],
      metadata: {},
      // Date info - prefer birthday (real creation date) over publishedAt (bulk publish date)
      // Firestore returns Timestamp objects, convert to Date
      dateAdded: this.toDate(data.birthday ?? data.publishedAt),
      birthday: this.toDate(data.birthday),
      createdAt: this.toDate(data.updatedAt),
      // Owner info
      ownerId: data.ownerId,
      ownerDisplayName: data.ownerDisplayName,
      ownerAvatarUrl: data.ownerAvatarUrl,
      // Compositional fields (if present in the public index)
      blueSoloProp: data.blueSoloProp,
      redSoloProp: data.redSoloProp,
      stepPairings: data.stepPairings,
      bluePathHash: data.bluePathHash,
      redPathHash: data.redPathHash,
      blueSoloHash: data.blueSoloHash,
      redSoloHash: data.redSoloHash,
      // Fork info
      ...(data.isForked && {
        source: "forked" as const,
        forkAttribution: {
          originalCreatorId: data.originalCreatorId!,
          originalCreatorName: data.originalCreatorName!,
        },
      }),
    };

    // If compositional fields are present, hydrate steps from them
    // so the sequence is fully renderable without a sourceRef fetch
    if (data.blueSoloProp && data.redSoloProp && data.stepPairings) {
      try {
        const hydrated = hydrate(seq);
        // Trust the actual step count over the stored sequenceLength,
        // which may be stale (e.g. base word length before LOOP expansion)
        if (hydrated.steps && hydrated.steps.length > 0) {
          return { ...hydrated, sequenceLength: hydrated.steps.length };
        }
        return hydrated;
      } catch {
        // Hydration services not available - return with empty steps
        // (will fall back to sourceRef fetch on demand)
      }
    }

    return seq;
  }

  /** Convert legacy difficultyLevel string to numeric level */
  private difficultyStringToLevel(difficultyLevel?: string): number | undefined {
    if (!difficultyLevel) return undefined;
    const map: Record<string, number> = {
      beginner: 1,
      intermediate: 2,
      advanced: 3,
    };
    return map[difficultyLevel.toLowerCase()];
  }

  /** Convert Firestore Timestamp or any date-like value to a JS Date */
  private toDate(value: unknown): Date | undefined {
    if (!value) return undefined;
    if (value instanceof Date) return value;
    // Firestore Timestamp has a toDate() method
    if (typeof value === "object" && "toDate" in (value as Record<string, unknown>)) {
      return (value as { toDate(): Date }).toDate();
    }
    // Fallback: try parsing as string/number
    const parsed = new Date(value as string | number);
    return isNaN(parsed.getTime()) ? undefined : parsed;
  }

  /**
   * Map full Firestore document to SequenceData
   */
  private mapFirestoreToSequenceData(
    data: Record<string, unknown>,
    id: string
  ): SequenceData {
    const seq: SequenceData = {
      id,
      name: (data.name as string) ?? "",
      displayName: data.displayName as string | undefined,
      word: (data.word as string) ?? "",
      // Backwards compatibility: support old 'beats' property name
      steps: (data.steps as SequenceData["steps"]) ?? (data.beats as SequenceData["steps"]) ?? [],
      startPosition: data.startPosition as SequenceData["startPosition"],
      startingPosition: data.startingPosition as SequenceData["startingPosition"],
      startingPositionGroup: data.startingPositionGroup as SequenceData["startingPositionGroup"],
      thumbnails: (data.thumbnails as readonly string[]) ?? [],
      sequenceLength: data.sequenceLength as number | undefined,
      author: data.author as string | undefined,
      level: data.level as number | undefined,
      dateAdded: data.dateAdded ? new Date(data.dateAdded as string) : undefined,
      gridMode: data.gridMode as SequenceData["gridMode"],
      // propType removed - prop type is a viewer preference, not sequence data
      isFavorite: (data.isFavorite as boolean) ?? false,
      isCircular: (data.isCircular as boolean) ?? false,
      loopType: data.loopType as SequenceData["loopType"],
      orientationCycleCount: data.orientationCycleCount as SequenceData["orientationCycleCount"],
      difficultyLevel: data.difficultyLevel as string | undefined,
      tags: (data.tags as readonly string[]) ?? [],
      metadata: (data.metadata as Record<string, unknown>) ?? {},
      ownerId: data.ownerId as string | undefined,
      ownerDisplayName: data.ownerDisplayName as string | undefined,
      ownerAvatarUrl: data.ownerAvatarUrl as string | undefined,
      // Pass through compositional fields so the hydrator can derive steps
      blueSoloProp: data.blueSoloProp as SequenceData["blueSoloProp"],
      redSoloProp: data.redSoloProp as SequenceData["redSoloProp"],
      stepPairings: data.stepPairings as SequenceData["stepPairings"],
      bluePathHash: data.bluePathHash as string | undefined,
      redPathHash: data.redPathHash as string | undefined,
      blueSoloHash: data.blueSoloHash as string | undefined,
      redSoloHash: data.redSoloHash as string | undefined,
    };

    // If compositional fields are present, derive steps from them so
    // the compositional model is the single source of truth.
    try {
      const hydrated = hydrate(seq);

      // Normalize: ensure step 0 (start position) is separated from the steps
      // array. Gallery sequences from Firebase may store it inline, which causes
      // the animation orchestrator to count an extra beat and shift all indices.
      return this.normalizeStartPosition(hydrated);
    } catch {
      return this.normalizeStartPosition(seq);
    }
  }

  /**
   * Ensure step 0 (start position) is not mixed into the steps array.
   * Firestore data may use the legacy format where beat 0 sits alongside
   * motion beats, which throws off the animation orchestrator's indexing.
   */
  private normalizeStartPosition(seq: SequenceData): SequenceData {
    if (!seq.steps?.length) return seq;

    const hasStep0 = seq.steps.some((s) => s.stepNumber === 0);
    if (!hasStep0) return seq;

    const steps = seq.steps.filter((s) => s.stepNumber !== 0);

    // If no startPosition is set, derive it from the step 0 entry
    if (!seq.startPosition && !seq.startingPosition) {
      const step0 = seq.steps.find((s) => s.stepNumber === 0)!;
      return {
        ...seq,
        steps,
        startPosition: {
          isStartPosition: true,
          id: step0.id || `start-${seq.id}`,
          letter: step0.letter ?? null,
          endPosition: step0.endPosition ?? step0.startPosition ?? null,
          motions: step0.motions,
        },
      };
    }

    return { ...seq, steps };
  }
}
