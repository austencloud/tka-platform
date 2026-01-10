/**
 * LibraryRepository - Core Library Implementation
 *
 * Firestore-based service for managing sequences in a user's library.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  limit as firestoreLimit,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  increment,
  runTransaction,
  getCountFromServer,
  arrayUnion,
  documentId,
  type Unsubscribe,
  type DocumentData,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { authState } from "$lib/shared/auth/state/authState.svelte.ts";
import { toast } from "$lib/shared/toast/state/toast-state.svelte";
import type { IAchievementManager } from "$lib/shared/gamification/services/contracts/IAchievementManager";
import type { ITagManager } from "../contracts/ITagManager";
import type { IOrientationCycleDetector } from "../../../create/generate/circular/services/contracts/IOrientationCycleDetector";
import type { IPublicIndexSyncer } from "../contracts/IPublicIndexSyncer";
import { migrateSequenceTags } from "../migrations/tag-migration";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type {
  ILibraryRepository,
  LibraryStats,
  LibraryQueryOptions,
} from "../contracts/ILibraryRepository";
import type {
  LibrarySequence,
  SequenceVisibility,
} from "../../domain/models/LibrarySequence";
import { createLibrarySequence } from "../../domain/models/LibrarySequence";
import {
  getUserSequencesPath,
  getUserSequencePath,
  getPublicSequencePath,
} from "../../data/firestore-paths";

/**
 * Error class for library operations
 */
export class LibraryError extends Error {
  constructor(
    message: string,
    public code:
      | "NOT_FOUND"
      | "UNAUTHORIZED"
      | "INVALID_DATA"
      | "NETWORK"
      | "QUOTA_EXCEEDED"
      | "ALREADY_EXISTS",
    public sequenceId?: string
  ) {
    super(message);
    this.name = "LibraryError";
  }
}

export class LibraryRepository implements ILibraryRepository {
  constructor(
    private achievementService: IAchievementManager,
    private tagService: ITagManager,
    private orientationCycleDetector: IOrientationCycleDetector,
    private publicIndexSyncer: IPublicIndexSyncer
  ) {}

  /**
   * Get the current user ID or throw if not authenticated
   */
  private getUserId(): string {
    const userId = authState.effectiveUserId;
    if (!userId) {
      throw new LibraryError("User not authenticated", "UNAUTHORIZED");
    }
    return userId;
  }

  /**
   * Convert Firestore timestamp to Date, returning undefined if missing
   */
  private toDateOrUndefined(timestamp: unknown): Date | undefined {
    if (timestamp && typeof timestamp === "object" && "toDate" in timestamp) {
      return (timestamp as { toDate: () => Date }).toDate();
    }
    if (timestamp instanceof Date) {
      return timestamp;
    }
    return undefined;
  }

  /**
   * Get a date from multiple possible fields, with fallback chain
   */
  private getDateWithFallback(...timestamps: unknown[]): Date {
    for (const ts of timestamps) {
      const date = this.toDateOrUndefined(ts);
      if (date) return date;
    }
    return new Date();
  }

  /**
   * Map Firestore document to LibrarySequence
   */
  private mapDocToLibrarySequence(
    doc: DocumentData,
    id: string
  ): LibrarySequence {
    const data = doc;
    const forkAttr = data["forkAttribution"];

    // Ensure sequenceTags exists (for backward compatibility)
    const sequenceTags = data["sequenceTags"] || [];

    // Derive word from beats (single source of truth)
    // Fall back to stored word/name only if beats aren't available
    const beats = data["beats"] as Array<{ letter?: string }> | undefined;
    let word: string | null = null;
    if (beats && beats.length > 0) {
      // Derive word by concatenating beat letters
      word = beats
        .map((beat) => beat.letter ?? "")
        .filter((letter) => letter !== "")
        .join("");
    }

    // Fallback to stored values if derivation failed
    if (!word) {
      word = data["word"] || data["name"] || id;
    }

    // Smart date fallbacks for backwards compatibility with older sequences
    // Priority: createdAt → birthday → dateAdded (some sequences only have birthday or dateAdded)
    const createdAt = this.getDateWithFallback(
      data["createdAt"],
      data["birthday"],
      data["dateAdded"]
    );
    const updatedAt = this.getDateWithFallback(
      data["updatedAt"],
      data["createdAt"],
      data["birthday"]
    );

    return {
      ...data,
      id,
      word, // Ensure word is always present
      sequenceTags,
      // Birthday field - original creation date (never changes after being set)
      birthday: this.toDateOrUndefined(data["birthday"]),
      createdAt,
      updatedAt,
      // Convert dateAdded if present (legacy field from SequenceData)
      dateAdded: this.toDateOrUndefined(data["dateAdded"]),
      visibilityChangedAt: this.toDateOrUndefined(data["visibilityChangedAt"]),
      lastAccessedAt: this.toDateOrUndefined(data["lastAccessedAt"]),
      forkAttribution: forkAttr
        ? {
            ...forkAttr,
            forkedAt:
              this.toDateOrUndefined(forkAttr.forkedAt) ?? new Date(),
          }
        : undefined,
    } as LibrarySequence;
  }

  // ============================================================
  // CRUD OPERATIONS
  // ============================================================

  async saveSequence(sequence: SequenceData): Promise<LibrarySequence> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();
    const sequenceId = sequence.id || crypto.randomUUID();

    const sequenceDocRef = doc(
      firestore,
      getUserSequencePath(userId, sequenceId)
    );
    const userDocRef = doc(firestore, `users/${userId}`);

    // Use transaction to safely handle read-modify-write
    const { librarySequence, isNewSequence } = await runTransaction(
      firestore,
      async (transaction) => {
        // Read existing document within transaction
        const existingDoc = await transaction.get(sequenceDocRef);
        const wasNew = !existingDoc.exists();

        let libSeq: LibrarySequence;

        if (existingDoc.exists()) {
          // Update existing
          const existing = this.mapDocToLibrarySequence(
            existingDoc.data(),
            sequenceId
          );
          libSeq = {
            ...existing,
            ...sequence,
            id: sequenceId,
            updatedAt: new Date(),
          };
        } else {
          // Create new
          libSeq = createLibrarySequence(
            { ...sequence, id: sequenceId },
            userId,
            { visibility: "public" } // Default to public
          );
        }

        // Migrate tags to sequenceTags if needed (sync operation)
        if (!libSeq.sequenceTags || libSeq.sequenceTags.length === 0) {
          // Note: Tag migration needs to happen outside transaction
          // because it may involve async Firestore operations
          libSeq = {
            ...libSeq,
            sequenceTags: [],
            tagIds: [],
          };
        }

        // Detect orientation cycle count for circular sequences (sync CPU operation)
        if (libSeq.isCircular) {
          try {
            const cycleResult =
              this.orientationCycleDetector.detectOrientationCycle(libSeq);
            libSeq = {
              ...libSeq,
              orientationCycleCount: cycleResult.cycleCount,
            };
          } catch (error) {
            console.error(
              "[LibraryRepository] Orientation cycle detection failed:",
              error
            );
          }
        }

        // Write sequence document
        // IMPORTANT: birthday is set once on creation and NEVER changes
        transaction.set(sequenceDocRef, {
          ...libSeq,
          birthday: existingDoc.exists()
            ? libSeq.birthday // Preserve existing birthday
            : libSeq.birthday || serverTimestamp(), // Use provided birthday or default to now
          createdAt: existingDoc.exists()
            ? libSeq.createdAt
            : serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Increment user's sequenceCount if this is a new sequence
        if (wasNew) {
          transaction.update(userDocRef, {
            sequenceCount: increment(1),
          });
        }

        return { librarySequence: libSeq, isNewSequence: wasNew };
      }
    );

    // Post-transaction: Tag migration (involves async Firestore operations)
    let finalSequence = librarySequence;
    if (
      !librarySequence.sequenceTags ||
      librarySequence.sequenceTags.length === 0
    ) {
      try {
        const migrationResult = await migrateSequenceTags(
          librarySequence,
          this.tagService
        );
        finalSequence = {
          ...librarySequence,
          sequenceTags: migrationResult.sequenceTags,
          tagIds: migrationResult.tagIds,
        };
        // Update with migrated tags (outside transaction is fine for this)
        await updateDoc(sequenceDocRef, {
          sequenceTags: migrationResult.sequenceTags,
          tagIds: migrationResult.tagIds,
        });
      } catch (error) {
        console.error("[LibraryRepository] Tag migration failed:", error);
      }
    }

    // Post-transaction: Track XP for creating sequence
    if (isNewSequence) {
      try {
        await this.achievementService.trackAction("sequence_created", {
          beatCount: sequence.beats.length ?? 0,
        });
      } catch (_e) {
        console.warn("Failed to track achievement:", _e);
      }
    }

    // Post-transaction: Sync to public index
    if (finalSequence.visibility === "public") {
      await this.publicIndexSyncer.syncToPublicIndex(finalSequence, userId);
    }

    return finalSequence;
  }

  async getSequence(sequenceId: string): Promise<LibrarySequence | null> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();
    const docRef = doc(firestore, getUserSequencePath(userId, sequenceId));
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return this.mapDocToLibrarySequence(docSnap.data(), sequenceId);
  }

  async updateSequence(
    sequenceId: string,
    updates: Partial<LibrarySequence>
  ): Promise<LibrarySequence> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();
    const docRef = doc(firestore, getUserSequencePath(userId, sequenceId));

    // Get existing
    const existing = await this.getSequence(sequenceId);
    if (!existing) {
      throw new LibraryError("Sequence not found", "NOT_FOUND", sequenceId);
    }

    // Apply updates
    const updated = {
      ...existing,
      ...updates,
      id: sequenceId,
      ownerId: userId, // Can't change owner
      updatedAt: new Date(),
    };

    try {
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("[LibraryRepository] Failed to update sequence:", error);
      toast.error("Failed to update sequence. Please try again.");
      throw new LibraryError(
        "Failed to update sequence",
        "NETWORK",
        sequenceId
      );
    }

    // Handle visibility changes
    if (updates.visibility && updates.visibility !== existing.visibility) {
      if (updates.visibility === "public") {
        await this.publicIndexSyncer.syncToPublicIndex(updated, userId);
      } else if (existing.visibility === "public") {
        await this.publicIndexSyncer.removeFromPublicIndex(sequenceId);
      }
    }

    return updated;
  }

  async deleteSequence(sequenceId: string): Promise<void> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();
    const existing = await this.getSequence(sequenceId);

    if (!existing) {
      return; // Already deleted
    }

    // Remove from public index if public
    if (existing.visibility === "public") {
      try {
        await this.publicIndexSyncer.removeFromPublicIndex(sequenceId);
      } catch (error) {
        console.warn(
          "[LibraryRepository] Failed to remove from public index:",
          error
        );
        // Continue with deletion - public index sync can be fixed later
      }
    }

    // Delete the sequence
    try {
      await deleteDoc(doc(firestore, getUserSequencePath(userId, sequenceId)));
    } catch (error) {
      console.error("[LibraryRepository] Failed to delete sequence:", error);
      toast.error("Failed to delete sequence. Please try again.");
      throw new LibraryError(
        "Failed to delete sequence",
        "NETWORK",
        sequenceId
      );
    }

    // Decrement user's sequenceCount
    try {
      const userDocRef = doc(firestore, `users/${userId}`);
      await updateDoc(userDocRef, {
        sequenceCount: increment(-1),
      });
    } catch (error) {
      console.error(
        `[LibraryRepository] Failed to decrement sequenceCount for user ${userId}:`,
        error
      );
      // Don't throw - sequence is already deleted, count will be inconsistent but not critical
    }
  }

  async getSequences(
    options?: LibraryQueryOptions
  ): Promise<LibrarySequence[]> {
    const userId = this.getUserId();
    return this.getUserSequences(userId, options);
  }

  async getUserSequences(
    userId: string,
    options?: LibraryQueryOptions
  ): Promise<LibrarySequence[]> {
    const firestore = await getFirestoreInstance();
    const sequencesRef = collection(firestore, getUserSequencesPath(userId));

    // Build query
    let q = query(sequencesRef);

    // Apply filters
    if (options?.source && options.source !== "all") {
      q = query(q, where("source", "==", options.source));
    }

    if (options?.visibility && options.visibility !== "all") {
      q = query(q, where("visibility", "==", options.visibility));
    }

    if (options?.collectionId) {
      q = query(
        q,
        where("collectionIds", "array-contains", options.collectionId)
      );
    }

    if (options?.isFavorite !== undefined) {
      q = query(q, where("isFavorite", "==", options.isFavorite));
    }

    // Apply sorting
    const sortField = options?.sortBy ?? "updatedAt";
    const sortDir = options?.sortDirection ?? "desc";
    q = query(q, orderBy(sortField, sortDir));

    // Apply limit
    if (options?.limit) {
      q = query(q, firestoreLimit(options.limit));
    }

    const snapshot = await getDocs(q);
    const sequences: LibrarySequence[] = [];

    snapshot.forEach((docSnap) => {
      sequences.push(this.mapDocToLibrarySequence(docSnap.data(), docSnap.id));
    });

    // Fetch owner profile to enrich sequences with display metadata
    // This is needed when viewing another user's library (e.g., admin impersonation)
    let ownerDisplayName: string | undefined;
    let ownerAvatarUrl: string | undefined;

    try {
      const userDoc = await getDoc(doc(firestore, `users/${userId}`));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        ownerDisplayName = userData?.displayName;
        ownerAvatarUrl = userData?.photoURL;
      }
    } catch (err) {
      console.warn(
        `[LibraryRepository] Failed to fetch owner profile for ${userId}:`,
        err
      );
    }

    // Enrich sequences with owner metadata
    const enrichedSequences = sequences.map((seq) => ({
      ...seq,
      ownerId: userId,
      ownerDisplayName: ownerDisplayName ?? seq.ownerDisplayName,
      ownerAvatarUrl: ownerAvatarUrl ?? seq.ownerAvatarUrl,
    }));

    // Client-side search filter (Firestore doesn't support full-text search)
    if (options?.searchQuery) {
      const searchLower = options.searchQuery.toLowerCase();
      return enrichedSequences.filter(
        (seq) =>
          seq.name.toLowerCase().includes(searchLower) ||
          seq.word.toLowerCase().includes(searchLower) ||
          seq.displayName?.toLowerCase().includes(searchLower)
      );
    }

    return enrichedSequences;
  }

  // ============================================================
  // VISIBILITY MANAGEMENT
  // ============================================================

  async setVisibility(
    sequenceId: string,
    visibility: SequenceVisibility
  ): Promise<void> {
    await this.updateSequence(sequenceId, {
      visibility,
      visibilityChangedAt: new Date(),
    });
  }

  async publishSequence(sequenceId: string): Promise<void> {
    const existing = await this.getSequence(sequenceId);
    if (!existing) {
      throw new LibraryError("Sequence not found", "NOT_FOUND", sequenceId);
    }

    // Only award XP if this is the first time publishing
    const wasPrivate = existing.visibility !== "public";

    await this.setVisibility(sequenceId, "public");

    if (wasPrivate) {
      try {
        await this.achievementService.trackAction("sequence_published", {
          sequenceId,
          beatCount: existing.beats.length ?? 0,
        });
      } catch (_e) {
        console.warn("Failed to track achievement:", _e);
      }
    }
  }

  async unpublishSequence(sequenceId: string): Promise<void> {
    await this.setVisibility(sequenceId, "private");
  }

  // ============================================================
  // REAL-TIME SUBSCRIPTIONS
  // ============================================================

  subscribeToLibrary(
    callback: (sequences: LibrarySequence[]) => void,
    options?: LibraryQueryOptions
  ): () => void {
    const userId = this.getUserId();
    let unsubscribe: Unsubscribe | null = null;

    // Default limit to prevent unbounded listeners
    const DEFAULT_LIBRARY_LIMIT = 100;

    // Initialize subscription asynchronously
    getFirestoreInstance()
      .then((firestore) => {
        const sequencesRef = collection(
          firestore,
          getUserSequencesPath(userId)
        );

        let q = query(sequencesRef, orderBy("updatedAt", "desc"));

        // Always apply a limit to prevent cost explosion
        const limitCount = options?.limit ?? DEFAULT_LIBRARY_LIMIT;
        q = query(q, firestoreLimit(limitCount));

        unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            const sequences: LibrarySequence[] = [];
            snapshot.forEach((doc) => {
              sequences.push(this.mapDocToLibrarySequence(doc.data(), doc.id));
            });
            callback(sequences);
          },
          (error) => {
            console.error("[LibraryRepository] Subscription error:", error);
            toast.error("Failed to sync library. Please refresh.");
          }
        );
      })
      .catch((error) => {
        console.error(
          "[LibraryRepository] Failed to initialize library subscription:",
          error
        );
        toast.error("Failed to connect to library.");
      });

    // Return cleanup function
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }

  subscribeToSequence(
    sequenceId: string,
    callback: (sequence: LibrarySequence | null) => void
  ): () => void {
    const userId = this.getUserId();
    let unsubscribe: Unsubscribe | null = null;

    // Initialize subscription asynchronously
    getFirestoreInstance()
      .then((firestore) => {
        const docRef = doc(firestore, getUserSequencePath(userId, sequenceId));

        unsubscribe = onSnapshot(
          docRef,
          (docSnap) => {
            if (docSnap.exists()) {
              callback(
                this.mapDocToLibrarySequence(docSnap.data(), sequenceId)
              );
            } else {
              callback(null);
            }
          },
          (error) => {
            console.error(
              "[LibraryRepository] Sequence subscription error:",
              error
            );
            toast.error("Failed to sync sequence updates.");
          }
        );
      })
      .catch((error) => {
        console.error(
          "[LibraryRepository] Failed to initialize sequence subscription:",
          error
        );
      });

    // Return cleanup function
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }

  // ============================================================
  // STATISTICS
  // ============================================================

  async getLibraryStats(): Promise<LibraryStats> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();
    const sequencesRef = collection(firestore, getUserSequencesPath(userId));

    // Run all count queries in parallel for efficiency
    const [
      totalSnapshot,
      createdSnapshot,
      forkedSnapshot,
      publicSnapshot,
      privateSnapshot,
    ] = await Promise.all([
      getCountFromServer(query(sequencesRef)),
      getCountFromServer(query(sequencesRef, where("source", "==", "created"))),
      getCountFromServer(query(sequencesRef, where("source", "==", "forked"))),
      getCountFromServer(
        query(sequencesRef, where("visibility", "==", "public"))
      ),
      getCountFromServer(
        query(sequencesRef, where("visibility", "==", "private"))
      ),
    ]);

    return {
      totalSequences: totalSnapshot.data().count,
      createdSequences: createdSnapshot.data().count,
      forkedSequences: forkedSnapshot.data().count,
      publicSequences: publicSnapshot.data().count,
      privateSequences: privateSnapshot.data().count,
      totalCollections: 0, // TODO: Get from collection service
      totalActs: 0, // TODO: Get from act service
      // Note: totalBeats requires fetching docs or a denormalized counter
      // For now, return 0 - consider denormalizing if this stat is needed frequently
      totalBeats: 0,
    };
  }

  // ============================================================
  // BATCH OPERATIONS
  // ============================================================

  async deleteSequences(sequenceIds: string[]): Promise<void> {
    if (sequenceIds.length === 0) return;

    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();
    const batch = writeBatch(firestore);

    // Batch fetch all sequences to check visibility (avoid N+1 reads)
    const sequencesRef = collection(firestore, getUserSequencesPath(userId));
    const BATCH_SIZE = 30; // Firestore 'in' query limit
    const existingSequences = new Map<string, LibrarySequence>();

    // Process in chunks of 30
    for (let i = 0; i < sequenceIds.length; i += BATCH_SIZE) {
      const chunk = sequenceIds.slice(i, i + BATCH_SIZE);
      const batchQuery = query(sequencesRef, where(documentId(), "in", chunk));
      const batchSnapshot = await getDocs(batchQuery);

      for (const docSnap of batchSnapshot.docs) {
        existingSequences.set(
          docSnap.id,
          this.mapDocToLibrarySequence(docSnap.data(), docSnap.id)
        );
      }
    }

    let deletedCount = 0;
    for (const sequenceId of sequenceIds) {
      const existing = existingSequences.get(sequenceId);
      if (existing) {
        if (existing.visibility === "public") {
          batch.delete(doc(firestore, getPublicSequencePath(sequenceId)));
        }
        batch.delete(doc(firestore, getUserSequencePath(userId, sequenceId)));
        deletedCount++;
      }
    }

    // Decrement user's sequenceCount by the number of deleted sequences
    if (deletedCount > 0) {
      const userDocRef = doc(firestore, `users/${userId}`);
      batch.update(userDocRef, {
        sequenceCount: increment(-deletedCount),
      });
    }

    try {
      await batch.commit();
    } catch (error) {
      console.error("[LibraryRepository] Failed to delete sequences:", error);
      toast.error("Failed to delete sequences. Please try again.");
      throw new LibraryError("Failed to delete sequences", "NETWORK");
    }
  }

  async moveToCollection(
    sequenceIds: string[],
    collectionId: string
  ): Promise<void> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();
    const batch = writeBatch(firestore);

    for (const sequenceId of sequenceIds) {
      const docRef = doc(firestore, getUserSequencePath(userId, sequenceId));
      // Use arrayUnion to append to existing collections without data loss
      batch.update(docRef, {
        collectionIds: arrayUnion(collectionId),
        updatedAt: serverTimestamp(),
      });
    }

    try {
      await batch.commit();
    } catch (error) {
      console.error("[LibraryRepository] Failed to move to collection:", error);
      toast.error("Failed to move sequences. Please try again.");
      throw new LibraryError(
        "Failed to move sequences to collection",
        "NETWORK"
      );
    }
  }

  async addTagsToSequences(
    sequenceIds: string[],
    tagIds: string[]
  ): Promise<void> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();
    const batch = writeBatch(firestore);

    for (const sequenceId of sequenceIds) {
      const docRef = doc(firestore, getUserSequencePath(userId, sequenceId));
      // Use arrayUnion to append tags without overwriting existing ones
      batch.update(docRef, {
        tagIds: arrayUnion(...tagIds),
        updatedAt: serverTimestamp(),
      });
    }

    try {
      await batch.commit();
    } catch (error) {
      console.error("[LibraryRepository] Failed to add tags:", error);
      toast.error("Failed to add tags. Please try again.");
      throw new LibraryError("Failed to add tags to sequences", "NETWORK");
    }
  }

  async setVisibilityBatch(
    sequenceIds: string[],
    visibility: SequenceVisibility
  ): Promise<void> {
    if (sequenceIds.length === 0) return;

    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();
    const batch = writeBatch(firestore);
    const now = serverTimestamp();

    // Track which sequences need public index updates
    const toPublish: LibrarySequence[] = [];
    const toUnpublish: string[] = [];

    // Batch fetch all sequences to check current visibility (avoid N+1)
    const sequencesRef = collection(firestore, getUserSequencesPath(userId));
    const BATCH_SIZE = 30;

    for (let i = 0; i < sequenceIds.length; i += BATCH_SIZE) {
      const chunk = sequenceIds.slice(i, i + BATCH_SIZE);
      const batchQuery = query(sequencesRef, where(documentId(), "in", chunk));
      const batchSnapshot = await getDocs(batchQuery);

      for (const docSnap of batchSnapshot.docs) {
        const existing = this.mapDocToLibrarySequence(
          docSnap.data(),
          docSnap.id
        );
        const docRef = doc(firestore, getUserSequencePath(userId, docSnap.id));

        // Update visibility in batch
        batch.update(docRef, {
          visibility,
          visibilityChangedAt: now,
          updatedAt: now,
        });

        // Track public index changes
        if (visibility === "public" && existing.visibility !== "public") {
          toPublish.push({ ...existing, visibility });
        } else if (
          visibility !== "public" &&
          existing.visibility === "public"
        ) {
          toUnpublish.push(docSnap.id);
        }
      }
    }

    // Commit all visibility updates in one batch
    try {
      await batch.commit();
    } catch (error) {
      console.error("[LibraryRepository] Failed to update visibility:", error);
      toast.error("Failed to update visibility. Please try again.");
      throw new LibraryError("Failed to update sequence visibility", "NETWORK");
    }

    // Handle public index updates (these can run in parallel)
    // Wrap in try/catch but don't throw - visibility was already updated
    try {
      await Promise.all([
        ...toPublish.map((seq) =>
          this.publicIndexSyncer.syncToPublicIndex(seq, userId)
        ),
        ...toUnpublish.map((id) =>
          this.publicIndexSyncer.removeFromPublicIndex(id)
        ),
      ]);
    } catch (error) {
      console.error("[LibraryRepository] Failed to sync public index:", error);
      toast.warning("Visibility updated, but public index sync failed.");
      // Don't throw - visibility was already successfully updated
    }
  }

  // ============================================================
  // FAVORITES
  // ============================================================

  async toggleFavorite(sequenceId: string): Promise<boolean> {
    const existing = await this.getSequence(sequenceId);
    if (!existing) {
      throw new LibraryError("Sequence not found", "NOT_FOUND", sequenceId);
    }

    const newFavoriteStatus = !existing.isFavorite;
    await this.updateSequence(sequenceId, { isFavorite: newFavoriteStatus });
    return newFavoriteStatus;
  }

  async getFavorites(): Promise<LibrarySequence[]> {
    return this.getSequences({
      isFavorite: true,
      sortBy: "updatedAt",
      sortDirection: "desc",
    });
  }
}
