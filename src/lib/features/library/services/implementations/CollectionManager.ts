/**
 * CollectionManager - Collection Management Implementation
 *
 * Firestore-based service for managing collections (folders) in a user's library.
 * Includes system collections like Favorites which are auto-created.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  orderBy,
  where,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  arrayUnion,
  arrayRemove,
  documentId,
  type Unsubscribe,
  type DocumentData,
  type Firestore,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { toast } from "$lib/shared/toast/state/toast-state.svelte";
import { authState } from "$lib/shared/auth/state/authState.svelte.ts";
import { container } from "$lib/shared/di";
import type { IActivityLogger } from "$lib/shared/analytics/services/contracts/IActivityLogger";
import type { ICollectionManager } from "../contracts/ICollectionManager";
import type {
  LibraryCollection,
  SystemCollectionType,
} from "../../domain/models/Collection";
import {
  createCollection,
  createSystemCollection,
  isSystemCollection,
  SYSTEM_COLLECTION_IDS,
} from "../../domain/models/Collection";
import type { LibrarySequence } from "../../domain/models/LibrarySequence";
import {
  getUserCollectionsPath,
  getUserCollectionPath,
  getUserSequencePath,
} from "../../data/firestore-paths";

/**
 * Error class for collection operations
 */
export class CollectionError extends Error {
  constructor(
    message: string,
    public code:
      | "NOT_FOUND"
      | "UNAUTHORIZED"
      | "INVALID_OPERATION"
      | "SYSTEM_COLLECTION"
      | "NETWORK",
    public collectionId?: string
  ) {
    super(message);
    this.name = "CollectionError";
  }
}

export class CollectionManager implements ICollectionManager {
  /**
   * Get the current user ID or throw if not authenticated
   */
  private getUserId(): string {
    const userId = authState.effectiveUserId;
    if (!userId) {
      throw new CollectionError("User not authenticated", "UNAUTHORIZED");
    }
    return userId;
  }

  /**
   * Convert Firestore timestamp to Date
   */
  private toDate(timestamp: unknown): Date {
    if (timestamp && typeof timestamp === "object" && "toDate" in timestamp) {
      return (timestamp as { toDate: () => Date }).toDate();
    }
    if (timestamp instanceof Date) {
      return timestamp;
    }
    return new Date();
  }

  /**
   * Map Firestore document to LibraryCollection
   */
  private mapDocToCollection(
    data: DocumentData,
    id: string
  ): LibraryCollection {
    return {
      id,
      name: data["name"] ?? "",
      description: data["description"],
      ownerId: data["ownerId"] ?? "",
      sequenceIds: data["sequenceIds"] ?? [],
      sequenceCount: data["sequenceCount"] ?? 0,
      coverImageUrl: data["coverImageUrl"],
      color: data["color"],
      icon: data["icon"] ?? "fa-folder",
      isPublic: data["isPublic"] ?? false,
      sortOrder: data["sortOrder"] ?? 0,
      systemType: data["systemType"],
      createdAt: this.toDate(data["createdAt"]),
      updatedAt: this.toDate(data["updatedAt"]),
    };
  }

  /**
   * Map Firestore document to LibrarySequence (simplified)
   */
  private mapDocToSequence(data: DocumentData, id: string): LibrarySequence {
    return {
      ...data,
      id,
      createdAt: this.toDate(data["createdAt"]),
      updatedAt: this.toDate(data["updatedAt"]),
    } as LibrarySequence;
  }

  /**
   * Batch fetch sequences by IDs to avoid N+1 query pattern
   * Firestore 'in' queries are limited to 30 items, so we chunk
   */
  private async batchFetchSequences(
    firestore: Firestore,
    userId: string,
    sequenceIds: readonly string[],
    filterPublic = false
  ): Promise<LibrarySequence[]> {
    if (sequenceIds.length === 0) {
      return [];
    }

    const sequences: LibrarySequence[] = [];
    const BATCH_SIZE = 30; // Firestore 'in' query limit

    // Process in chunks of 30
    for (let i = 0; i < sequenceIds.length; i += BATCH_SIZE) {
      const chunk = sequenceIds.slice(i, i + BATCH_SIZE);
      const sequencesRef = collection(firestore, `users/${userId}/sequences`);
      const batchQuery = query(sequencesRef, where(documentId(), "in", chunk));
      const batchSnapshot = await getDocs(batchQuery);

      for (const docSnap of batchSnapshot.docs) {
        const data = docSnap.data();
        // If filtering for public, only include public sequences
        if (filterPublic && data["visibility"] !== "public") {
          continue;
        }
        sequences.push(this.mapDocToSequence(data, docSnap.id));
      }
    }

    return sequences;
  }

  /**
   * Fetch sequences from the public index by ID.
   * Used as the fallback pass when a sequence ID doesn't resolve in the
   * user's own library — e.g. when they've favorited someone else's sequence.
   */
  private async batchFetchPublicSequences(
    firestore: Firestore,
    sequenceIds: string[]
  ): Promise<LibrarySequence[]> {
    const results: LibrarySequence[] = [];
    const BATCH_SIZE = 30; // Firestore 'in' query limit

    for (let i = 0; i < sequenceIds.length; i += BATCH_SIZE) {
      const chunk = sequenceIds.slice(i, i + BATCH_SIZE);
      const publicRef = collection(firestore, "publicSequences");
      const q = query(publicRef, where(documentId(), "in", chunk));
      const snapshot = await getDocs(q);

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        // Map public index doc to LibrarySequence shape for display.
        // Public sequences don't carry library-specific fields, so we
        // supply safe defaults so the rest of the UI can treat them uniformly.
        results.push({
          id: docSnap.id,
          ...data,
          source: "imported" as const,
          visibility: "public" as const,
          collectionIds: [],
          sequenceTags: [],
          tagIds: [],
          forkCount: data["forkCount"] ?? 0,
          viewCount: data["viewCount"] ?? 0,
          starCount: data["starCount"] ?? 0,
          createdAt: data["createdAt"]?.toDate?.() ?? new Date(),
          updatedAt: data["updatedAt"]?.toDate?.() ?? new Date(),
        } as unknown as LibrarySequence);
      }
    }

    return results;
  }

  // ============================================================
  // SYSTEM COLLECTIONS
  // ============================================================

  async ensureSystemCollections(): Promise<void> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();

    // Check and create each system collection type
    const systemTypes: SystemCollectionType[] = ["favorites"];

    for (const type of systemTypes) {
      const collectionId = SYSTEM_COLLECTION_IDS[type];
      const docRef = doc(
        firestore,
        getUserCollectionPath(userId, collectionId)
      );
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        const systemCollection = createSystemCollection(type, userId);
        await setDoc(docRef, {
          ...systemCollection,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }
  }

  async getSystemCollection(
    type: SystemCollectionType
  ): Promise<LibraryCollection> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();
    const collectionId = SYSTEM_COLLECTION_IDS[type];

    // Try to get existing
    const docRef = doc(firestore, getUserCollectionPath(userId, collectionId));
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return this.mapDocToCollection(docSnap.data(), collectionId);
    }

    // Create if doesn't exist
    const systemCollection = createSystemCollection(type, userId);
    await setDoc(docRef, {
      ...systemCollection,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return systemCollection;
  }

  async getFavoritesCollection(): Promise<LibraryCollection> {
    return this.getSystemCollection("favorites");
  }

  // ============================================================
  // CRUD OPERATIONS
  // ============================================================

  async createCollection(
    name: string,
    description?: string
  ): Promise<LibraryCollection> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();
    const collectionId = crypto.randomUUID();

    const newCollection = createCollection(name, userId, {
      description,
      sortOrder: Date.now(), // Use timestamp for initial sort order
    });

    const docRef = doc(firestore, getUserCollectionPath(userId, collectionId));
    await setDoc(docRef, {
      ...newCollection,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Update user activity
    const userDocRef = doc(firestore, `users/${userId}`);
    await updateDoc(userDocRef, { lastActivityDate: serverTimestamp() });

    return {
      ...newCollection,
      id: collectionId,
    };
  }

  async getCollection(collectionId: string): Promise<LibraryCollection | null> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();
    const docRef = doc(firestore, getUserCollectionPath(userId, collectionId));
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return this.mapDocToCollection(docSnap.data(), collectionId);
  }

  async updateCollection(
    collectionId: string,
    updates: Partial<
      Pick<
        LibraryCollection,
        "name" | "description" | "coverImageUrl" | "color" | "icon" | "isPublic"
      >
    >
  ): Promise<LibraryCollection> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();
    const existing = await this.getCollection(collectionId);

    if (!existing) {
      throw new CollectionError(
        "Collection not found",
        "NOT_FOUND",
        collectionId
      );
    }

    // Prevent renaming system collections
    if (isSystemCollection(existing) && updates.name !== undefined) {
      throw new CollectionError(
        "Cannot rename system collection",
        "SYSTEM_COLLECTION",
        collectionId
      );
    }

    const docRef = doc(firestore, getUserCollectionPath(userId, collectionId));
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });

    return {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
  }

  async deleteCollection(collectionId: string): Promise<void> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();
    const existing = await this.getCollection(collectionId);

    if (!existing) {
      return; // Already deleted
    }

    // Prevent deleting system collections
    if (isSystemCollection(existing)) {
      throw new CollectionError(
        "Cannot delete system collection",
        "SYSTEM_COLLECTION",
        collectionId
      );
    }

    // Remove collection reference from all sequences in this collection
    const batch = writeBatch(firestore);
    for (const sequenceId of existing.sequenceIds) {
      const seqRef = doc(firestore, getUserSequencePath(userId, sequenceId));
      batch.update(seqRef, {
        collectionIds: arrayRemove(collectionId),
      });
    }

    // Delete the collection
    batch.delete(doc(firestore, getUserCollectionPath(userId, collectionId)));

    try {
      await batch.commit();
    } catch (error) {
      console.error("[CollectionManager] Failed to delete collection:", error);
      toast.error("Failed to delete collection. Please try again.");
      throw new CollectionError(
        "Failed to delete collection",
        "NETWORK",
        collectionId
      );
    }
  }

  async getCollections(): Promise<LibraryCollection[]> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();
    const collectionsRef = collection(
      firestore,
      getUserCollectionsPath(userId)
    );
    const q = query(collectionsRef, orderBy("sortOrder", "asc"));

    const snapshot = await getDocs(q);
    const collections: LibraryCollection[] = [];

    snapshot.forEach((doc) => {
      collections.push(this.mapDocToCollection(doc.data(), doc.id));
    });

    return collections;
  }

  // ============================================================
  // SEQUENCE MANAGEMENT
  // ============================================================

  async addSequenceToCollection(
    collectionId: string,
    sequenceId: string
  ): Promise<void> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();

    // Update collection
    const collectionRef = doc(
      firestore,
      getUserCollectionPath(userId, collectionId)
    );
    await updateDoc(collectionRef, {
      sequenceIds: arrayUnion(sequenceId),
      sequenceCount:
        (await this.getCollection(collectionId))!.sequenceCount + 1,
      updatedAt: serverTimestamp(),
    });

    // Update sequence's collectionIds if the sequence exists in the user's library.
    // The sequence might not exist locally when favoriting someone else's public
    // sequence or a sequence from the generate module that hasn't been saved yet.
    // In those cases the collection document (above) is the source of truth, and
    // the sequence-side cross-reference is a nice-to-have we skip gracefully.
    try {
      const sequenceRef = doc(
        firestore,
        getUserSequencePath(userId, sequenceId)
      );
      await updateDoc(sequenceRef, {
        collectionIds: arrayUnion(collectionId),
        updatedAt: serverTimestamp(),
      });
    } catch (err: unknown) {
      // Firestore throws "not-found" (code) or "No document to update" (message)
      // when updateDoc targets a non-existent document.
      const isNotFound =
        (err instanceof Error && err.message.includes("No document to update")) ||
        (typeof err === "object" && err !== null && "code" in err &&
          (err as { code: string }).code === "not-found");
      if (!isNotFound) {
        throw err;
      }
      // Sequence not in user's library — collection doc already updated, so
      // the favorite is persisted. The sequence-side backlink is just skipped.
    }
  }

  async removeSequenceFromCollection(
    collectionId: string,
    sequenceId: string
  ): Promise<void> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();
    const existing = await this.getCollection(collectionId);

    if (!existing) {
      return;
    }

    // Update collection
    const collectionRef = doc(
      firestore,
      getUserCollectionPath(userId, collectionId)
    );
    await updateDoc(collectionRef, {
      sequenceIds: arrayRemove(sequenceId),
      sequenceCount: Math.max(0, existing.sequenceCount - 1),
      updatedAt: serverTimestamp(),
    });

    // Remove collection reference from the sequence if it exists in the user's
    // library. Same as addSequenceToCollection: the sequence may not exist
    // locally (public sequence from another user, unsaved generate output).
    try {
      const sequenceRef = doc(
        firestore,
        getUserSequencePath(userId, sequenceId)
      );
      await updateDoc(sequenceRef, {
        collectionIds: arrayRemove(collectionId),
        updatedAt: serverTimestamp(),
      });
    } catch (err: unknown) {
      const isNotFound =
        (err instanceof Error && err.message.includes("No document to update")) ||
        (typeof err === "object" && err !== null && "code" in err &&
          (err as { code: string }).code === "not-found");
      if (!isNotFound) {
        throw err;
      }
    }
  }

  async getCollectionSequences(
    collectionId: string
  ): Promise<LibrarySequence[]> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();
    const collectionData = await this.getCollection(collectionId);

    if (!collectionData || collectionData.sequenceIds.length === 0) {
      return [];
    }

    // Pass 1: fetch from user's own library
    const ownSequences = await this.batchFetchSequences(
      firestore,
      userId,
      collectionData.sequenceIds
    );

    // If all IDs resolved, we're done
    if (ownSequences.length === collectionData.sequenceIds.length) {
      return ownSequences;
    }

    // Pass 2: find which IDs didn't resolve and try the public index.
    // This handles the case where a user favorited someone else's public
    // sequence — that ID lives in publicSequences/, not the user's own library.
    const foundIds = new Set(ownSequences.map((s) => s.id));
    const missingIds = collectionData.sequenceIds.filter(
      (id) => !foundIds.has(id)
    );

    if (missingIds.length === 0) return ownSequences;

    const publicSequences = await this.batchFetchPublicSequences(
      firestore,
      missingIds
    );

    return [...ownSequences, ...publicSequences];
  }

  async reorderSequences(
    collectionId: string,
    sequenceIds: string[]
  ): Promise<void> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();
    const docRef = doc(firestore, getUserCollectionPath(userId, collectionId));

    await updateDoc(docRef, {
      sequenceIds,
      updatedAt: serverTimestamp(),
    });
  }

  async addSequencesToCollection(
    collectionId: string,
    sequenceIds: string[]
  ): Promise<void> {
    for (const sequenceId of sequenceIds) {
      await this.addSequenceToCollection(collectionId, sequenceId);
    }
  }

  // ============================================================
  // REAL-TIME SUBSCRIPTIONS
  // ============================================================

  subscribeToCollections(
    callback: (collections: LibraryCollection[]) => void
  ): () => void {
    const userId = this.getUserId();
    let unsubscribe: Unsubscribe | null = null;

    // Initialize subscription asynchronously
    getFirestoreInstance()
      .then((firestore) => {
        const collectionsRef = collection(
          firestore,
          getUserCollectionsPath(userId)
        );
        const q = query(collectionsRef, orderBy("sortOrder", "asc"));

        unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            const collections: LibraryCollection[] = [];
            snapshot.forEach((doc) => {
              collections.push(this.mapDocToCollection(doc.data(), doc.id));
            });
            callback(collections);
          },
          (error) => {
            console.error("[CollectionManager] Subscription error:", error);
            toast.error("Failed to connect to collections.");
          }
        );
      })
      .catch((error) => {
        console.error(
          "[CollectionManager] Failed to initialize collections subscription:",
          error
        );
        toast.error("Failed to connect to collections.");
      });

    // Return cleanup function
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }

  subscribeToCollection(
    collectionId: string,
    callback: (collection: LibraryCollection | null) => void
  ): () => void {
    const userId = this.getUserId();
    let unsubscribe: Unsubscribe | null = null;

    // Initialize subscription asynchronously
    getFirestoreInstance()
      .then((firestore) => {
        const docRef = doc(
          firestore,
          getUserCollectionPath(userId, collectionId)
        );

        unsubscribe = onSnapshot(
          docRef,
          (docSnap) => {
            if (docSnap.exists()) {
              callback(this.mapDocToCollection(docSnap.data(), collectionId));
            } else {
              callback(null);
            }
          },
          (error) => {
            console.error(
              "[CollectionManager] Collection subscription error:",
              error
            );
            toast.error("Failed to connect to collection.");
          }
        );
      })
      .catch((error) => {
        console.error(
          "[CollectionManager] Failed to initialize collection subscription:",
          error
        );
        toast.error("Failed to connect to collection.");
      });

    // Return cleanup function
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }

  // ============================================================
  // REORDERING
  // ============================================================

  async reorderCollections(collectionIds: string[]): Promise<void> {
    const firestore = await getFirestoreInstance();
    const userId = this.getUserId();
    const batch = writeBatch(firestore);

    collectionIds.forEach((collectionId, index) => {
      const docRef = doc(
        firestore,
        getUserCollectionPath(userId, collectionId)
      );
      batch.update(docRef, {
        sortOrder: index,
        updatedAt: serverTimestamp(),
      });
    });

    try {
      await batch.commit();
    } catch (error) {
      console.error(
        "[CollectionManager] Failed to reorder collections:",
        error
      );
      toast.error("Failed to reorder collections. Please try again.");
      throw new CollectionError("Failed to reorder collections", "NETWORK");
    }
  }

  // ============================================================
  // FAVORITES OPERATIONS
  // ============================================================

  async toggleFavorite(sequenceId: string): Promise<boolean> {
    const favoritesCollection = await this.getFavoritesCollection();
    const isFavorited = favoritesCollection.sequenceIds.includes(sequenceId);

    if (isFavorited) {
      await this.removeSequenceFromCollection(
        favoritesCollection.id,
        sequenceId
      );
      // Log unfavorite event
      this.logFavoriteAction(sequenceId, false);
      return false;
    } else {
      await this.addSequenceToCollection(favoritesCollection.id, sequenceId);
      // Log favorite event
      this.logFavoriteAction(sequenceId, true);
      return true;
    }
  }

  /**
   * Log a favorite/unfavorite action to the activity log
   */
  private logFavoriteAction(sequenceId: string, isFavorite: boolean): void {
    const activityService = container.items.activityLogger;
    if (activityService) {
      activityService.log(
        isFavorite ? "sequence_favorite" : "sequence_unfavorite",
        "social",
        { sequenceId }
      );
    }
  }

  async isFavorite(sequenceId: string): Promise<boolean> {
    const favoritesCollection = await this.getFavoritesCollection();
    return favoritesCollection.sequenceIds.includes(sequenceId);
  }

  async getFavorites(): Promise<LibrarySequence[]> {
    const favoritesCollection = await this.getFavoritesCollection();
    return this.getCollectionSequences(favoritesCollection.id);
  }

  async getFavoriteIds(): Promise<Set<string>> {
    const favoritesCollection = await this.getFavoritesCollection();
    return new Set(favoritesCollection.sequenceIds);
  }

  // ============================================================
  // PUBLIC COLLECTIONS (for viewing other users' collections)
  // ============================================================

  async getUserPublicCollections(userId: string): Promise<LibraryCollection[]> {
    const firestore = await getFirestoreInstance();
    const collectionsRef = collection(
      firestore,
      getUserCollectionsPath(userId)
    );
    const q = query(
      collectionsRef,
      where("isPublic", "==", true),
      orderBy("sortOrder", "asc")
    );

    const snapshot = await getDocs(q);
    const collections: LibraryCollection[] = [];

    snapshot.forEach((doc) => {
      collections.push(this.mapDocToCollection(doc.data(), doc.id));
    });

    return collections;
  }

  async getUserCollectionSequences(
    userId: string,
    collectionId: string
  ): Promise<LibrarySequence[]> {
    const firestore = await getFirestoreInstance();
    // First verify the collection is public
    const collectionRef = doc(
      firestore,
      getUserCollectionPath(userId, collectionId)
    );
    const collectionSnap = await getDoc(collectionRef);

    if (!collectionSnap.exists()) {
      return [];
    }

    const collectionData = this.mapDocToCollection(
      collectionSnap.data(),
      collectionId
    );

    // Only return sequences if collection is public
    if (!collectionData.isPublic) {
      console.warn(
        `[CollectionManager] Attempted to access non-public collection: ${collectionId}`
      );
      return [];
    }

    // Batch fetch sequences, filtering for public visibility
    return this.batchFetchSequences(
      firestore,
      userId,
      collectionData.sequenceIds,
      true // filterPublic = true
    );
  }

  // ============================================================
  // PUBLIC FAVORITES (for Following Feed)
  // ============================================================

  /**
   * Get another user's favorite sequence IDs if their favorites are public
   * Used by the Following Feed to show what people you follow have favorited
   * @param userId - The user whose favorites to fetch
   * @returns Array of sequence IDs, or empty array if favorites are private
   */
  async getUserPublicFavoriteIds(userId: string): Promise<string[]> {
    const firestore = await getFirestoreInstance();

    // Check if user has public favorites enabled
    const settingsRef = doc(firestore, `users/${userId}/settings/preferences`);
    const settingsSnap = await getDoc(settingsRef);

    // Default to true if setting doesn't exist (opt-out privacy model)
    const settings = settingsSnap.exists() ? settingsSnap.data() : {};
    const favoritesPublic = settings["favoritesPublic"] ?? true;

    if (!favoritesPublic) {
      return [];
    }

    // Get the favorites collection
    const favoritesId = SYSTEM_COLLECTION_IDS["favorites"];
    const favoritesRef = doc(
      firestore,
      getUserCollectionPath(userId, favoritesId)
    );
    const favoritesSnap = await getDoc(favoritesRef);

    if (!favoritesSnap.exists()) {
      return [];
    }

    return favoritesSnap.data()["sequenceIds"] ?? [];
  }
}
