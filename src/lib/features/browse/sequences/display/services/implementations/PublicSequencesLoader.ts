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

import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  getDoc,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { getPublicSequencesPath } from "$lib/features/library/data/firestore-paths";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { IBrowseLoader } from "../contracts/IBrowseLoader";
import type { PublicSequenceIndex } from "$lib/features/library/domain/models/PublicSequenceIndex";
import { container } from "$lib/shared/di";
import type { IErrorHandler } from "$lib/shared/application/services/contracts/IErrorHandler";

export class PublicSequencesLoader implements IBrowseLoader {
  private cachedSequences: SequenceData[] | null = null;
  private loadPromise: Promise<SequenceData[]> | null = null;
  // Map from word/name to sourceRef for efficient full data lookup
  private sourceRefCache: Map<string, string> = new Map();

  /**
   * Load all public sequences from Firestore
   * Returns display metadata (no steps) for gallery grid
   */
  async loadSequenceMetadata(): Promise<SequenceData[]> {
    // Return cached data if available
    if (this.cachedSequences) {
      return this.cachedSequences;
    }

    // Prevent duplicate loads
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = this.fetchPublicSequences();

    try {
      this.cachedSequences = await this.loadPromise;
      return this.cachedSequences;
    } catch (error) {
      const errorHandler = container.items.errorHandler as IErrorHandler;
      errorHandler.showUserError({
        message: "Couldn't load the gallery",
        technicalDetails: error instanceof Error ? error.message : String(error),
        error: error instanceof Error ? error : new Error(String(error)),
        severity: "error",
        context: {
          module: "browse",
          action: "load-gallery",
        },
      });
      throw error;
    } finally {
      this.loadPromise = null;
    }
  }

  /**
   * Load full sequence data for a specific sequence
   * Fetches from the source user's library via sourceRef
   * Uses cached sourceRef mapping for efficiency
   */
  async loadFullSequenceData(sequenceName: string): Promise<SequenceData | null> {
    // Ensure metadata is loaded first (populates sourceRef cache)
    if (!this.cachedSequences) {
      await this.loadSequenceMetadata();
    }

    // We normally find a sequence by its word (e.g. "ABBD"). But if the user
    // edited and re-saved it with a different word (e.g. "ABBDJ"), our lookup
    // table still has the old word and won't find the new one. In that case,
    // we fall back to locating it by its unique ID instead, which never changes
    // no matter how many times the sequence is edited.
    let sourceRef = this.sourceRefCache.get(sequenceName);
    if (!sourceRef) {
      const cached = this.cachedSequences?.find(
        (s) => s.name === sequenceName || s.word === sequenceName
      );
      if (cached?.ownerId && cached.id) {
        sourceRef = `users/${cached.ownerId}/sequences/${cached.id}`;
      }
    }
    if (!sourceRef) {
      console.warn(`[PublicSequencesLoader] No sequence found for "${sequenceName}"`);
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
   * If the cache isn't loaded yet, this is a no-op — the sequence will be fetched
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

  private async fetchPublicSequences(): Promise<SequenceData[]> {
    const firestore = await getFirestoreInstance();
    const publicSeqRef = collection(firestore, getPublicSequencesPath());

    // Query all public sequences, ordered by word for consistent display
    const q = query(publicSeqRef, orderBy("word", "asc"));
    const snapshot = await getDocs(q);

    const sequences: SequenceData[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as PublicSequenceIndex;
      sequences.push(this.mapPublicIndexToSequenceData(data, docSnap.id));

      // Cache sourceRef for efficient full data lookup later
      if (data.sourceRef) {
        this.sourceRefCache.set(data.word, data.sourceRef);
        if (data.name && data.name !== data.word) {
          this.sourceRefCache.set(data.name, data.sourceRef);
        }
      }
    });

    return sequences;
  }

  /**
   * Map PublicSequenceIndex to SequenceData for display
   * Note: steps are empty - will be fetched on demand if needed
   */
  private mapPublicIndexToSequenceData(
    data: PublicSequenceIndex,
    id: string
  ): SequenceData {
    return {
      id,
      name: data.name,
      displayName: (data as unknown as { displayName?: string }).displayName,
      word: data.word,
      steps: [], // Empty - will be fetched on demand for rendering
      thumbnails: [...data.thumbnails],
      sequenceLength: data.sequenceLength,
      level: data.level ?? this.difficultyStringToLevel(data.difficultyLevel),
      difficultyLevel: data.difficultyLevel,
      loopType: data.loopType as SequenceData["loopType"],
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
      // Fork info
      ...(data.isForked && {
        source: "forked" as const,
        forkAttribution: {
          originalCreatorId: data.originalCreatorId!,
          originalCreatorName: data.originalCreatorName!,
        },
      }),
    };
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
    return {
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
    };
  }
}
