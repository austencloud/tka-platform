/**
 * LibraryRepository - Core Library Implementation
 *
 * Firestore-based service for managing sequences in a user's library.
 */

import { getErrorHandler } from "$lib/shared/application/get-error-handler";
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
  increment,
  getCountFromServer,
  type Unsubscribe,
  type DocumentData,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { authState } from "$lib/shared/auth/state/auth-state.svelte";
import { toast } from "$lib/shared/toast/state/toast-state.svelte";
import { trackWrite } from "$lib/shared/offline/state/sync-status-state.svelte";
import { hydrate, ensureComposition } from "$lib/shared/foundation/services/sequence-hydrator";
import {
  firestoreGet,
  firestoreList,
  stripUndefined,
} from "$lib/shared/firestore";
import {
  LibrarySequenceDocSchema,
  UserProfileDocSchema,
} from "$lib/shared/library/domain/library-schemas";
import type { ErrorHandler } from '$lib/shared/application/services/error-handler'
import { detectOrientationCycle } from "$lib/shared/create/services/orientation-cycle-detector";
import type { IPublicIndexSyncer as PublicIndexSyncer } from "$lib/shared/library/services/IPublicIndexSyncer";
import type { ConflictResolver } from "$lib/shared/offline/services/conflict-resolver";
import { computeHash } from "$lib/shared/library/services/sequence-content-hasher";
import { getTagMigrator } from "$lib/shared/library/get-tag-migrator";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type {
  LibraryStats, LibraryQueryOptions } from "$lib/shared/library/domain/library-contract-types";
import type {
  LibrarySequence,
  SequenceVisibility,
} from "$lib/shared/library/domain/models/library-sequence";
import { createLibrarySequence } from "$lib/shared/library/domain/models/library-sequence";
import {
  getUserSequencesPath,
  getUserSequencePath,
} from "$lib/shared/library/data/firestore-paths";
import {
  notifyLibraryMutated,
  notifyLibrarySequenceAdded,
  notifyLibrarySequenceUpdated,
} from "$lib/shared/library/library-events";
import { LibraryRecycleBin } from "$lib/shared/library/services/library-recycle-bin";
import { LibraryBatchOperations } from "$lib/shared/library/services/library-batch-operations";
import { LibraryError } from "$lib/shared/library/domain/library-error";
import { isOneCountSequence } from "$lib/shared/library/domain/sequence-min-length";

export class LibraryRepository {
  /**
   * Cache of the last-known local sequences from subscription callbacks.
   * Used by conflict detection to provide the user's local version when
   * a server snapshot arrives with a higher _version than expected.
   */
  private localSequenceCache = new Map<string, LibrarySequence>();
  private recycleBin: LibraryRecycleBin;
  private batchOps: LibraryBatchOperations;

  constructor(
    private publicIndexSyncer: PublicIndexSyncer,
    private conflictResolver?: ConflictResolver
  ) {
    this.recycleBin = new LibraryRecycleBin(
      () => getFirestoreInstance(),
      () => this.getUserId(),
      (id) => this.getSequence(id),
      this.publicIndexSyncer,
      (msg, err, action, data, severity) => this.reportError(msg, err, action, data, severity)
    );
    this.batchOps = new LibraryBatchOperations(
      () => getFirestoreInstance(),
      () => this.getUserId(),
      (d, id) => this.mapDocToLibrarySequence(d, id),
      this.publicIndexSyncer,
      (msg, err, action, data, severity) => this.reportError(msg, err, action, data, severity)
    );
  }

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
      const errorHandler = getErrorHandler() as ErrorHandler;
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
      // ErrorHandler itself failed - fall back to toast
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
    // Some older documents only have stepPairings (no steps array), so check both.
    // Pre-compositional legacy docs (2025-era) store their motion steps under
    // `sequenceData.beats` — neither flat nor nested `steps` exist — so include
    // that slot too, mirroring the `steps ?? beats` fallback already used in
    // public-sequences-loader.ts. Without it these docs hydrate to an empty
    // steps array and read as "0 steps" everywhere in the gallery.
    // Fall back to stored word/name only if none is available.
    const steps = (data["steps"] || seqData["steps"] || data["beats"] || seqData["beats"]) as
      | Array<{ letter?: string }>
      | undefined;
    const stepPairings = (data["stepPairings"] || seqData["stepPairings"]) as Array<{ letter?: string }> | undefined;
    let word: string | null = null;

    const letterSource = (steps && steps.length > 0) ? steps : stepPairings;
    if (letterSource && letterSource.length > 0) {
      word = letterSource
        .map((step) => step.letter ?? "")
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
      // Funnel whichever slot held the motion array (flat steps, nested
      // sequenceData.steps, or legacy *.beats) into `steps`. For legacy
      // beats docs the spread above leaves `steps` absent, so set it here.
      // hydrate() overrides this with freshly derived steps when the doc
      // carries compositional fields.
      ...(steps && steps.length > 0 && {
        steps: steps as unknown as LibrarySequence["steps"],
      }),
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

    if (isOneCountSequence(sequence)) {
      throw new LibraryError(
        "Too short to save. A sequence needs at least 2 steps.",
        "INVALID_DATA",
        sequence.id
      );
    }

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
    const incomingHash = await computeHash(sequence).catch(() => undefined);

    let libSeq: LibrarySequence;

    if (existingDoc.exists()) {
      // FORK DETECTION: If motion content changed, this is a new variation.
      // Create a new document - the original stays untouched in the user's library.
      const existingData = existingDoc.data();
      const existingHash = existingData?.contentHash as string | undefined;

      if (incomingHash && existingHash && existingHash !== incomingHash) {
        // Content changed - fork into a new variation
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
            // Forks default to public - TKA notation is meant to be shared
            visibility: overrides?.visibility ?? "public",
            notes: overrides?.notes,
            source: "forked",
            forkAttribution: {
              originalSequenceId: parentId,
              originalCreatorId: existingData?.ownerId ?? userId,
              originalCreatorName: existingData?.ownerDisplayName ?? "",
              forkedAt: new Date(),
            },
          }
        );
      } else {
        // Same hash or no stored hash - normal metadata update
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

    // Duplicate detection: prevent saving a sequence with identical motion content.
    // This catches the case where a user saves the same sequence twice - the word
    // matches AND the motion data is byte-for-byte identical. Without this check,
    // you'd end up with two entries in the Variations pane that look identical.
    if (isNewSequence && incomingHash) {
      const sequencesRef = collection(
        firestore,
        getUserSequencesPath(userId)
      );
      const duplicateQuery = query(
        sequencesRef,
        where("contentHash", "==", incomingHash),
        firestoreLimit(1)
      );
      const duplicateSnapshot = await getDocs(duplicateQuery);
      if (!duplicateSnapshot.empty) {
        throw new LibraryError(
          "This exact sequence is already in your library",
          "ALREADY_EXISTS",
          duplicateSnapshot.docs[0]!.id
        );
      }
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
        const cycleResult = detectOrientationCycle(libSeq);
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

    // Recompute compositional fields (blueSoloProp, redSoloProp, stepPairings,
    // content hashes) from the current steps so Firestore always has fresh
    // compositional data - even if the sequence was modified via the old
    // steps-based mutation API.
    try {
      libSeq = ensureComposition(libSeq) as LibrarySequence;
    } catch {
      // Composition services not available (e.g. during SSR or early boot).
      // Save without compositional fields - the migration script can backfill.
    }

    // Write sequence document using setDoc - works offline, queues in Firestore cache
    // IMPORTANT: birthday is set once on creation and NEVER changes
    const rawWriteData = {
      ...libSeq,
      // Steps are derived from compositional fields on read - don't persist.
      // startPosition IS persisted because it's NOT derivable from compositional
      // fields - without it the 3D viewer has no start pose to show.
      steps: undefined,
      startPosition: libSeq.startPosition ?? undefined,
      startingPosition: undefined,
      startingPositionGroup: undefined,
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

    // Recursively strip undefined values - Firestore rejects them in setDoc
    const writeData = stripUndefined(rawWriteData as Record<string, unknown>);

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

    // Update user stats - separate non-blocking write
    // Uses setDoc with merge instead of updateDoc so it works even if the
    // user document hasn't been created yet (race with auth state init).
    if (isNewSequence) {
      trackWrite(
        () =>
          setDoc(
            userDocRef,
            {
              sequenceCount: increment(1),
              lastActivityDate: serverTimestamp(),
            },
            { merge: true }
          ),
        "library"
      ).catch((error) => {
        console.error("[LibraryRepository] Failed to update user stats:", error);
      });
    } else {
      setDoc(
        userDocRef,
        { lastActivityDate: serverTimestamp() },
        { merge: true }
      ).catch((error) => {
        console.error("[LibraryRepository] Failed to update activity:", error);
      });
    }

    // Post-write: Tag migration (async, non-blocking)
    let finalSequence = libSeq;
    if (!libSeq.sequenceTags || libSeq.sequenceTags.length === 0) {
      getTagMigrator()(libSeq)
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

    // Notify listeners (browse gallery, etc.) so they can insert immediately
    notifyLibrarySequenceAdded(finalSequence);

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
      console.warn("[LibraryRepository] Sequence is public but publicIndexSyncer is null - it will NOT appear in the public gallery.", { sequenceId: finalSequence.id });
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
    const userId = this.getUserId();
    const validated = await firestoreGet(
      getUserSequencesPath(userId),
      sequenceId,
      LibrarySequenceDocSchema,
    );

    if (!validated) {
      return null;
    }

    const seq = this.mapDocToLibrarySequence(validated as DocumentData, sequenceId);

    // Hydrate: derive steps from compositional fields if present
    try {
      return hydrate(seq) as LibrarySequence;
    } catch {
      return seq;
    }
  }

  async hasMatchingContent(contentHash: string): Promise<boolean> {
    if (!contentHash) return false;

    const userId = this.getUserId();
    const results = await firestoreList(
      getUserSequencesPath(userId),
      LibrarySequenceDocSchema,
      {
        where: [{ field: "contentHash", op: "==", value: contentHash }],
        limit: 1,
      },
    );
    return results.length > 0;
  }

  async updateSequence(
    sequenceId: string,
    updates: Partial<LibrarySequence>
  ): Promise<LibrarySequence> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();
    const docRef = doc(firestore, getUserSequencePath(userId, sequenceId));

    // Read existing from local cache (fast - Firestore serves from cache first)
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

    // Notify listeners so caches can patch without a Firestore round-trip
    notifyLibrarySequenceUpdated(sequenceId, updates as Record<string, unknown>);

    // Handle visibility changes (async, non-blocking)
    if (updates.visibility && updates.visibility !== existing.visibility) {
      if (!this.publicIndexSyncer) {
        console.warn("[LibraryRepository] Visibility changed but publicIndexSyncer is null - public gallery will not reflect this change.", { sequenceId, newVisibility: updates.visibility });
      } else if (updates.visibility === "public") {
        // Ensure compositional fields are fresh before publishing
        const compositionReady = { ...updated, ...ensureComposition(updated) };
        this.publicIndexSyncer
          .syncToPublicIndex(compositionReady, userId)
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

    // Fire-and-forget - deletes the public index doc so the card disappears
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
      console.warn("[LibraryRepository] Sequence is public but publicIndexSyncer is null - it will NOT be removed from the public gallery.", { sequenceId });
    }

    // Await the local write so callers can safely reload data immediately after.
    // trackWrite queues to Firestore's local cache first (offline-persistence), so
    // this resolves quickly - it does NOT block on server acknowledgment.
    try {
      await trackWrite(
        () => deleteDoc(doc(firestore, getUserSequencePath(userId, sequenceId))),
        "library"
      );
    } catch (error) {
      // Surface the failure instead of swallowing it. Callers optimistically
      // remove the card and show a success toast; if the delete never landed,
      // that fakes success and the doc reappears on the next reload. Rethrow so
      // the caller can show an error and keep the card.
      this.reportError(
        "Failed to delete sequence. It may reappear on refresh.",
        error,
        "delete-sequence",
        { sequenceId }
      );
      throw error;
    }

    // Notify listeners so caches can remove the entry immediately (success only)
    notifyLibraryMutated(sequenceId);

    // Decrement user's sequenceCount (async, non-blocking, clamped to 0)
    const userDocRef = doc(firestore, `users/${userId}`);
    setDoc(
      userDocRef,
      { sequenceCount: increment(-1) },
      { merge: true }
    )
      .then(async () => {
        const userSnap = await getDoc(userDocRef);
        const count = (userSnap.data()?.["sequenceCount"] as number) ?? 0;
        if (count < 0) {
          await setDoc(
            userDocRef,
            { sequenceCount: 0 },
            { merge: true }
          );
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

    // Hydrate sequences: derive steps from compositional fields.
    // Without this, sequences saved after f0f9928ae (which stopped persisting
    // steps to Firestore) would have empty steps arrays, causing the browse
    // gallery to miscalculate aspect ratios and show black bars.
    snapshot.forEach((docSnap) => {
      let seq = this.mapDocToLibrarySequence(docSnap.data(), docSnap.id);
      try {
        seq = hydrate(seq) as LibrarySequence;
      } catch {
        // Hydration failed for this sequence - use raw data
      }
      sequences.push(seq);
    });

    // Fetch owner profile to enrich sequences with display metadata
    // This is needed when viewing another user's library (e.g., admin impersonation)
    let ownerDisplayName: string | undefined;
    let ownerAvatarUrl: string | undefined;

    try {
      const userProfile = await firestoreGet("users", userId, UserProfileDocSchema);
      if (userProfile) {
        ownerDisplayName = userProfile.displayName ?? undefined;
        ownerAvatarUrl = userProfile.photoURL ?? undefined;
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

    // Filter out soft-deleted sequences (recycle bin).
    // Done client-side because a Firestore "!=" query would exclude all
    // existing documents that lack the isDeleted field entirely.
    const activeSequences = enrichedSequences.filter((seq) => !seq.isDeleted);

    // Client-side search filter (Firestore doesn't support full-text search)
    if (options?.searchQuery) {
      const searchLower = options.searchQuery.toLowerCase();
      return activeSequences.filter(
        (seq) =>
          seq.name.toLowerCase().includes(searchLower) ||
          seq.word.toLowerCase().includes(searchLower) ||
          seq.displayName?.toLowerCase().includes(searchLower)
      );
    }

    return activeSequences;
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

    await this.setVisibility(sequenceId, "public");
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
              let serverSeq = { ...this.mapDocToLibrarySequence(docSnap.data(), docSnap.id), ownerId: userId } as LibrarySequence;
              {
                try {
                  serverSeq = hydrate(serverSeq) as LibrarySequence;
                } catch {
                  // Hydration failed - use raw data
                }
              }
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
        () => setDoc(sequenceDocRef, stripUndefined({
          ...sequence,
          _version: newVersion,
          updatedAt: serverTimestamp(),
        } as Record<string, unknown>)),
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
        toast.error("Failed to connect to sequence updates.");
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
    };
  }

  // ============================================================
  // BATCH OPERATIONS (delegated to LibraryBatchOperations)
  // ============================================================

  async deleteSequences(sequenceIds: string[]): Promise<void> {
    return this.batchOps.deleteSequences(sequenceIds);
  }

  async moveToCollection(
    sequenceIds: string[],
    collectionId: string
  ): Promise<void> {
    return this.batchOps.moveToCollection(sequenceIds, collectionId);
  }

  async addTagsToSequences(
    sequenceIds: string[],
    tagIds: string[]
  ): Promise<void> {
    return this.batchOps.addTagsToSequences(sequenceIds, tagIds);
  }

  async setVisibilityBatch(
    sequenceIds: string[],
    visibility: SequenceVisibility
  ): Promise<void> {
    return this.batchOps.setVisibilityBatch(sequenceIds, visibility);
  }

  // ============================================================
  // SOFT DELETE / RECYCLE BIN (delegated to LibraryRecycleBin)
  // ============================================================

  async softDeleteSequence(sequenceId: string): Promise<void> {
    return this.recycleBin.softDeleteSequence(sequenceId);
  }

  async restoreSequence(sequenceId: string): Promise<void> {
    return this.recycleBin.restoreSequence(sequenceId);
  }

  async purgeSequence(sequenceId: string): Promise<void> {
    return this.recycleBin.purgeSequence(sequenceId);
  }

  async getDeletedSequences(): Promise<LibrarySequence[]> {
    return this.recycleBin.getDeletedSequences();
  }

  async emptyRecycleBin(): Promise<void> {
    return this.recycleBin.emptyRecycleBin();
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
