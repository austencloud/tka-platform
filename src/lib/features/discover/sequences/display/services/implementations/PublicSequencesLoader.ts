/**
 * PublicSequencesLoader - Load community sequences from Firestore
 *
 * Replaces DiscoverLoader which loaded from static manifest files.
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
import type { IDiscoverLoader } from "../contracts/IDiscoverLoader";
import type { PublicSequenceIndex } from "$lib/features/library/domain/models/PublicSequenceIndex";

export class PublicSequencesLoader implements IDiscoverLoader {
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

    // Look up sourceRef from cache
    const sourceRef = this.sourceRefCache.get(sequenceName);
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
   * Invalidate cache to force reload
   */
  invalidateCache(): void {
    this.cachedSequences = null;
    this.loadPromise = null;
    this.sourceRefCache.clear();
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
      difficultyLevel: data.difficultyLevel,
      isFavorite: false,
      isCircular: false,
      tags: [...data.tags],
      metadata: {},
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
