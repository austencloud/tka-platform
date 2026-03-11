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
  setDoc,
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
  getCountFromServer,
  arrayUnion,
  documentId,
  type Unsubscribe,
  type DocumentData,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { authState } from "$lib/shared/auth/state/authState.svelte.ts";
import { toast } from "$lib/shared/toast/state/toast-state.svelte";
import { trackWrite } from "$lib/shared/offline/state/sync-status-state.svelte";
import { container } from "$lib/shared/di";
import type { IErrorHandler } from "$lib/shared/application/services/contracts/IErrorHandler";
import type { IAchievementManager } from "$lib/shared/gamification/services/contracts/IAchievementManager";
import type { ITagManager } from "../contracts/ITagManager";
import type { IOrientationCycleDetector } from "../../../create/generate/circular/services/contracts/IOrientationCycleDetector";
import type { IPublicIndexSyncer } from "../contracts/IPublicIndexSyncer";
import type { IConflictResolver } from "$lib/shared/offline/services/contracts/IConflictResolver";
import type { ISequenceContentHasher } from "../contracts/ISequenceContentHasher";
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
  /**
   * Cache of the last-known local sequences from subscription callbacks.
   * Used by conflict detection to provide the user's local version when
   * a server snapshot arrives with a higher _version than expected.
   */
  private localSequenceCache = new Map<string, LibrarySequence>();

  constructor(
    private achievementService: IAchievementManager,
    private tagService: ITagManager,
    private orientationCycleDetector: IOrientationCycleDetector,
    private publicIndexSyncer: IPublicIndexSyncer,
    private conflictResolver?: IConflictResolver,
    private contentHasher?: ISequenceContentHasher
  ) {}

  /**
   * Surface an error to the user via the ErrorHandler modal (which includes
   * "Report Bug"). Falls back to a plain toast if the ErrorHandler itself
   * isn't available or throws.
   */
  private reportError(
    message: string,
    error: unknown,
    action: string,
    additionalData?: Record<string, unknown>,
    severity: "error" | "warning" = "error"
  ): void {
    try {
      const errorHandler = container.items.errorHandler as IErrorHandler;
      errorHandler.showUserError({
        message,
        technicalDetails: error instanceof Error ? error.message : String(error),
        error: error instanceof Error ? error : new Error(String(error)),
        severity,
        context: {
          module: "library",
          action,
          additionalData,
        },
      });
    } catch {
      // ErrorHandler itself failed — fall back to toast
      toast.error(message);
    }
  }

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
    // Support both flat structure and nested sequenceData structure
    const seqData = data["sequenceData"] || {};

    // Ensure sequenceTags exists (for backward compatibility)
    const sequenceTags = data["sequenceTags"] || [];

    // Derive word from steps (single source of truth)
    // Fall back to stored word/name only if steps aren't available
    // Check both top-level steps and nested sequenceData.steps
    const steps = (data["steps"] || seqData["steps"]) as Array<{ letter?: string }> | undefined;
    let word: string | null = null;
    if (steps && steps.length > 0) {
      // Derive word by concatenating beat letters
      word = steps
        .map((beat) => beat.letter ?? "")
        .filter((letter) => letter !== "")
        .join("");
    }

    // Fallback to stored values if derivation failed
    // Check both top-level and nested sequenceData for word/name
    if (!word) {
      word = data["word"] || seqData["word"] || data["name"] || seqData["name"] || id;
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

  async saveSequence(
    sequence: SequenceData,
    overrides?: { visibility?: SequenceVisibility; notes?: string }
  ): Promise<LibrarySequence> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();
    let actualSequenceId = sequence.id || crypto.randomUUID();

    let sequenceDocRef = doc(
      firestore,
      getUserSequencePath(userId, actualSequenceId)
    );
    const userDocRef = doc(firestore, `users/${userId}`);

    // Check if this is a new or existing sequence using local cache
    // getDoc reads from cache first when offline persistence is enabled
    const existingDoc = await getDoc(sequenceDocRef);
    let isNewSequence = !existingDoc.exists();

    // Compute content hash for the incoming sequence
    const incomingHash = this.contentHasher
      ? await this.contentHasher.computeHash(sequence)
      : undefined;

    let libSeq: LibrarySequence;

    if (existingDoc.exists()) {
      // FORK DETECTION: If motion content changed, this is a new variation.
      // Create a new document — the original stays untouched in the user's library.
      const existingData = existingDoc.data();
      const existingHash = existingData?.contentHash as string | undefined;

      if (incomingHash && existingHash && existingHash !== incomingHash) {
        // Content changed — fork into a new variation
        const parentId = actualSequenceId;
        actualSequenceId = crypto.randomUUID();
        sequenceDocRef = doc(
          firestore,
          getUserSequencePath(userId, actualSequenceId)
        );
        isNewSequence = true;

        libSeq = createLibrarySequence(
          { ...sequence, id: actualSequenceId },
          userId,
          {
            visibility: overrides?.visibility ?? "private",
            notes: overrides?.notes,
            source: "created",
            forkAttribution: {
              originalSequenceId: parentId,
              originalCreatorId: existingData?.ownerId ?? userId,
              originalCreatorName: existingData?.ownerDisplayName ?? "",
              forkedAt: new Date(),
            },
          }
        );
      } else {
        // Same hash or no stored hash — normal metadata update
        const existing = this.mapDocToLibrarySequence(
          existingData!,
          actualSequenceId
        );
        libSeq = {
          ...existing,
          ...sequence,
          id: actualSequenceId,
          updatedAt: new Date(),
        };
        if (overrides?.visibility) {
          libSeq = { ...libSeq, visibility: overrides.visibility };
        }
        if (overrides?.notes !== undefined) {
          libSeq = { ...libSeq, notes: overrides.notes };
        }
      }
    } else {
      libSeq = createLibrarySequence(
        { ...sequence, id: actualSequenceId },
        userId,
        {
          visibility: overrides?.visibility ?? "public",
          notes: overrides?.notes,
        }
      );
    }

    // Migrate tags to sequenceTags if needed
    if (!libSeq.sequenceTags || libSeq.sequenceTags.length === 0) {
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

    // Write sequence document using setDoc — works offline, queues in Firestore cache
    // IMPORTANT: birthday is set once on creation and NEVER changes
    const rawWriteData = {
      ...libSeq,
      contentHash: incomingHash,
      birthday: isNewSequence
        ? libSeq.birthday || serverTimestamp()
        : libSeq.birthday,
      createdAt: isNewSequence ? serverTimestamp() : libSeq.createdAt,
      updatedAt: serverTimestamp(),
      _version: isNewSequence
        ? 1
        : ((existingDoc.data()?._version as number) || 0) + 1,
    };

    // Strip undefined values — Firestore rejects them in setDoc
    const writeData = Object.fromEntries(
      Object.entries(rawWriteData).filter(([, v]) => v !== undefined)
    );

    // Fire-and-forget: setDoc queues locally, syncs when online
    // trackWrite monitors the sync status but we don't block on it
    trackWrite(() => setDoc(sequenceDocRef, writeData), "library").catch((error) => {
      this.reportError(
        "Failed to save sequence. Your changes may not sync to other devices.",
        error,
        "save-sequence",
        { sequenceId: actualSequenceId }
      );
    });

    // Track the local write version for conflict detection
    const newVersion = writeData._version as number;
    this.conflictResolver?.trackLocalWrite(actualSequenceId, newVersion);

    // Update user stats — separate non-blocking write
    if (isNewSequence) {
      trackWrite(
        () =>
          updateDoc(userDocRef, {
            sequenceCount: increment(1),
            lastActivityDate: serverTimestamp(),
          }),
        "library"
      ).catch((error) => {
        console.error("[LibraryRepository] Failed to update user stats:", error);
      });
    } else {
      updateDoc(userDocRef, {
        lastActivityDate: serverTimestamp(),
      }).catch((error) => {
        console.error("[LibraryRepository] Failed to update activity:", error);
      });
    }

    // Post-write: Tag migration (async, non-blocking)
    let finalSequence = libSeq;
    if (!libSeq.sequenceTags || libSeq.sequenceTags.length === 0) {
      migrateSequenceTags(libSeq, this.tagService)
        .then((migrationResult) => {
          finalSequence = {
            ...libSeq,
            sequenceTags: migrationResult.sequenceTags,
            tagIds: migrationResult.tagIds,
          };
          updateDoc(sequenceDocRef, {
            sequenceTags: migrationResult.sequenceTags,
            tagIds: migrationResult.tagIds,
          }).catch((err) =>
            console.error("[LibraryRepository] Tag update failed:", err)
          );
        })
        .catch((error) => {
          console.error("[LibraryRepository] Tag migration failed:", error);
        });
    }

    // Post-write: Track XP (async, non-blocking)
    if (isNewSequence) {
      this.achievementService
        .trackAction("sequence_created", {
          stepCount: sequence.steps.length ?? 0,
        })
        .catch((_e) => console.warn("Failed to track achievement:", _e));
    }

    // Post-write: Sync to public index (async, non-blocking)
    if (finalSequence.visibility === "public" && this.publicIndexSyncer) {
      this.publicIndexSyncer
        .syncToPublicIndex(finalSequence, userId)
        .catch((error) => {
          this.reportError(
            "Sequence saved, but it may not appear in the community gallery yet.",
            error,
            "public-index-sync",
            { sequenceId: finalSequence.id },
            "warning"
          );
        });
    } else if (finalSequence.visibility === "public" && !this.publicIndexSyncer) {
      console.warn("[LibraryRepository] Sequence is public but publicIndexSyncer is null — it will NOT appear in the public gallery.", { sequenceId: finalSequence.id });
    }

    return finalSequence;
  }

  async saveSequenceWithMetadata(
    sequence: SequenceData,
    metadata: {
      name: string;
      displayName?: string;
      visibility: SequenceVisibility;
      tags: string[];
      notes: string;
      thumbnailUrl?: string;
    }
  ): Promise<LibrarySequence> {
    // Put the new thumbnail first, filter out duplicates so re-saves
    // don't grow the array with the same URL repeated.
    const existingThumbnails = (sequence.thumbnails || []).filter(
      (t) => t !== metadata.thumbnailUrl
    );
    const thumbnails = metadata.thumbnailUrl
      ? [metadata.thumbnailUrl, ...existingThumbnails]
      : existingThumbnails;

    const enrichedSequence: SequenceData = {
      ...sequence,
      name: metadata.name,
      displayName: metadata.displayName,
      word: sequence.word || metadata.name,
      thumbnails,
      tags: metadata.tags,
    };

    return this.saveSequence(enrichedSequence, {
      visibility: metadata.visibility,
      notes: metadata.notes,
    });
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

    // Read existing from local cache (fast — Firestore serves from cache first)
    const existing = await this.getSequence(sequenceId);
    if (!existing) {
      throw new LibraryError("Sequence not found", "NOT_FOUND", sequenceId);
    }

    // Apply updates locally for immediate return
    const updated = {
      ...existing,
      ...updates,
      id: sequenceId,
      ownerId: userId,
      updatedAt: new Date(),
    };

    // Fire-and-forget: queue write locally, sync when online
    trackWrite(
      () =>
        updateDoc(docRef, {
          ...updates,
          updatedAt: serverTimestamp(),
        }),
      "library"
    ).catch((error) => {
      this.reportError(
        "Failed to update sequence. Your changes may not sync to other devices.",
        error,
        "update-sequence",
        { sequenceId }
      );
    });

    // Handle visibility changes (async, non-blocking)
    if (updates.visibility && updates.visibility !== existing.visibility) {
      if (!this.publicIndexSyncer) {
        console.warn("[LibraryRepository] Visibility changed but publicIndexSyncer is null — public gallery will not reflect this change.", { sequenceId, newVisibility: updates.visibility });
      } else if (updates.visibility === "public") {
        this.publicIndexSyncer
          .syncToPublicIndex(updated, userId)
          .catch((error) => {
            this.reportError(
              "Sequence updated, but it may not appear in the community gallery yet.",
              error,
              "public-index-sync",
              { sequenceId },
              "warning"
            );
          });
      } else if (existing.visibility === "public") {
        this.publicIndexSyncer
          .removeFromPublicIndex(sequenceId)
          .catch((error) => {
            this.reportError(
              "Sequence updated, but it may still appear in the community gallery.",
              error,
              "public-index-remove",
              { sequenceId },
              "warning"
            );
          });
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

    // Fire-and-forget — deletes the public index doc so the card disappears
    // from the community gallery on next load. Not awaited because the gallery
    // only refreshes on an explicit reload anyway; awaiting it just slows down
    // the delete. Errors are logged but not rethrown.
    if (existing.visibility === "public" && this.publicIndexSyncer) {
      this.publicIndexSyncer.removeFromPublicIndex(sequenceId).catch((error) => {
        this.reportError(
          "Sequence deleted, but it may still appear in the community gallery.",
          error,
          "public-index-remove",
          { sequenceId },
          "warning"
        );
      });
    } else if (existing.visibility === "public" && !this.publicIndexSyncer) {
      console.warn("[LibraryRepository] Sequence is public but publicIndexSyncer is null — it will NOT be removed from the public gallery.", { sequenceId });
    }

    // Await the local write so callers can safely reload data immediately after.
    // trackWrite queues to Firestore's local cache first (offline-persistence), so
    // this resolves quickly — it does NOT block on server acknowledgment.
    await trackWrite(
      () => deleteDoc(doc(firestore, getUserSequencePath(userId, sequenceId))),
      "library"
    ).catch((error) => {
      this.reportError(
        "Failed to delete sequence. It may reappear on refresh.",
        error,
        "delete-sequence",
        { sequenceId }
      );
    });

    // Decrement user's sequenceCount (async, non-blocking, clamped to 0)
    const userDocRef = doc(firestore, `users/${userId}`);
    updateDoc(userDocRef, {
      sequenceCount: increment(-1),
    })
      .then(async () => {
        const userSnap = await getDoc(userDocRef);
        const count = (userSnap.data()?.["sequenceCount"] as number) ?? 0;
        if (count < 0) {
          await updateDoc(userDocRef, { sequenceCount: 0 });
        }
      })
      .catch((error) => {
        console.error(
          `[LibraryRepository] Failed to decrement sequenceCount for user ${userId}:`,
          error
        );
      });
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
          stepCount: existing.steps.length ?? 0,
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
            snapshot.forEach((docSnap) => {
              const serverSeq = { ...this.mapDocToLibrarySequence(docSnap.data(), docSnap.id), ownerId: userId };
              sequences.push(serverSeq);

              // Check for conflicts on server-originated changes
              // hasPendingWrites means this is our own local write echoing back
              if (this.conflictResolver && !docSnap.metadata.hasPendingWrites) {
                const localSeq = this.localSequenceCache.get(docSnap.id);
                if (localSeq) {
                  const conflict = this.conflictResolver.detectConflict(localSeq, serverSeq);
                  if (conflict) {
                    this.conflictResolver.promptForResolution(conflict).then((resolution) => {
                      this.conflictResolver!.resolveConflict(conflict, resolution);
                      if (resolution === "keep-local") {
                        this.resaveSequenceForConflict(localSeq);
                      }
                    });
                  }
                }
              }
            });

            // Update local cache with latest snapshot data
            for (const seq of sequences) {
              this.localSequenceCache.set(seq.id, seq);
            }

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

  /**
   * Re-save a sequence after user chose "keep-local" in conflict resolution.
   * Writes the local version with an incremented _version to overwrite the server.
   */
  private async resaveSequenceForConflict(sequence: LibrarySequence): Promise<void> {
    try {
      const firestore = await getFirestoreInstance();
      const userId = this.getUserId();
      const sequenceDocRef = doc(firestore, getUserSequencePath(userId, sequence.id));

      const newVersion = ((sequence._version ?? 0) + 1);
      trackWrite(
        () => setDoc(sequenceDocRef, {
          ...sequence,
          _version: newVersion,
          updatedAt: serverTimestamp(),
        }),
        "library"
      ).catch((error) => {
        console.error("[LibraryRepository] Failed to re-save after conflict resolution:", error);
        toast.error("Failed to save your version. Will retry when online.");
      });

      this.conflictResolver?.trackLocalWrite(sequence.id, newVersion);
    } catch (error) {
      console.error("[LibraryRepository] Conflict re-save failed:", error);
    }
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
      // Note: totalSteps requires fetching docs or a denormalized counter
      // For now, return 0 - consider denormalizing if this stat is needed frequently
      totalSteps: 0,
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

    // Decrement user's sequenceCount by the number of deleted sequences (clamped to 0)
    const userDocRef = deletedCount > 0 ? doc(firestore, `users/${userId}`) : null;
    if (deletedCount > 0 && userDocRef) {
      batch.update(userDocRef, {
        sequenceCount: increment(-deletedCount),
      });
    }

    try {
      await trackWrite(() => batch.commit(), "library");
      // Clamp sequenceCount to 0 if it went negative
      if (userDocRef) {
        const userSnap = await getDoc(userDocRef);
        const count = (userSnap.data()?.["sequenceCount"] as number) ?? 0;
        if (count < 0) {
          await updateDoc(userDocRef, { sequenceCount: 0 });
        }
      }
    } catch (error) {
      this.reportError(
        "Failed to delete sequences. Please try again.",
        error,
        "delete-sequences-batch"
      );
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
      await trackWrite(() => batch.commit(), "library");
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
      await trackWrite(() => batch.commit(), "library");
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
      await trackWrite(() => batch.commit(), "library");
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
