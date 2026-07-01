/**
 * collection-manager - Core Collection CRUD & Membership
 *
 * Firestore-based module for managing collections (folders) in a user's library.
 * Favorites operations are in FavoritesManager. Public collection access is in
 * PublicCollectionLoader.
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
  onSnapshot,
  serverTimestamp,
  writeBatch,
  arrayUnion,
  arrayRemove,
  increment,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { toast } from "$lib/shared/toast/state/toast-state.svelte";
import type {
  LibraryCollection,
  SystemCollectionType,
} from "$lib/shared/library/domain/models/collection";
import {
  createCollection,
  createSystemCollection,
  isSystemCollection,
  SYSTEM_COLLECTION_IDS,
} from "$lib/shared/library/domain/models/collection";
import type { LibrarySequence } from "$lib/shared/library/domain/models/library-sequence";
import {
  getUserCollectionsPath,
  getUserCollectionPath,
  getUserSequencePath,
} from "$lib/shared/library/data/firestore-paths";
import {
  getAuthenticatedUserId,
  mapDocToCollection,
  batchFetchSequences,
  batchFetchPublicSequences,
  CollectionError,
} from "$lib/shared/library/services/collection-firestore-mapper";

// Re-export so existing imports of CollectionError from this module still work
export { CollectionError };

// ============================================================
// SYSTEM COLLECTIONS
// ============================================================

export async function ensureSystemCollections(): Promise<void> {
  const firestore = await getFirestoreInstance();
  const userId = getAuthenticatedUserId();

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

export async function getSystemCollection(
  type: SystemCollectionType
): Promise<LibraryCollection> {
  const firestore = await getFirestoreInstance();
  const userId = getAuthenticatedUserId();
  const collectionId = SYSTEM_COLLECTION_IDS[type];

  const docRef = doc(firestore, getUserCollectionPath(userId, collectionId));
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return mapDocToCollection(docSnap.data(), collectionId);
  }

  const systemCollection = createSystemCollection(type, userId);
  await setDoc(docRef, {
    ...systemCollection,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return systemCollection;
}

export async function getFavoritesCollection(): Promise<LibraryCollection> {
  return getSystemCollection("favorites");
}

// ============================================================
// CRUD OPERATIONS
// ============================================================

export async function createUserCollection(
  name: string,
  description?: string
): Promise<LibraryCollection> {
  const firestore = await getFirestoreInstance();
  const userId = getAuthenticatedUserId();
  const collectionId = crypto.randomUUID();

  const newCollection = createCollection(name, userId, {
    description,
    sortOrder: Date.now(),
  });

  const docRef = doc(firestore, getUserCollectionPath(userId, collectionId));
  // Firestore rejects undefined field values. createCollection leaves optional
  // fields (description, color, coverImageUrl) undefined when not supplied, so
  // strip them before the write — otherwise setDoc throws "Unsupported field
  // value: undefined".
  const docData = Object.fromEntries(
    Object.entries({
      ...newCollection,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }).filter(([, value]) => value !== undefined),
  );
  try {
    await setDoc(docRef, docData);

    const userDocRef = doc(firestore, `users/${userId}`);
    await updateDoc(userDocRef, { lastActivityDate: serverTimestamp() });
  } catch (error) {
    console.error("[CollectionManager] Failed to create collection:", error);
    toast.error("Failed to create collection. Please try again.");
    throw new CollectionError(
      "Failed to create collection",
      "NETWORK",
      collectionId
    );
  }

  return {
    ...newCollection,
    id: collectionId,
  };
}

export async function getCollection(collectionId: string): Promise<LibraryCollection | null> {
  const firestore = await getFirestoreInstance();
  const userId = getAuthenticatedUserId();
  const docRef = doc(firestore, getUserCollectionPath(userId, collectionId));
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  return mapDocToCollection(docSnap.data(), collectionId);
}

export async function updateCollection(
  collectionId: string,
  updates: Partial<
    Pick<
      LibraryCollection,
      "name" | "description" | "coverImageUrl" | "color" | "icon" | "isPublic"
    >
  >
): Promise<LibraryCollection> {
  const firestore = await getFirestoreInstance();
  const userId = getAuthenticatedUserId();
  const existing = await getCollection(collectionId);

  if (!existing) {
    throw new CollectionError(
      "Collection not found",
      "NOT_FOUND",
      collectionId
    );
  }

  if (isSystemCollection(existing) && updates.name !== undefined) {
    throw new CollectionError(
      "Cannot rename system collection",
      "SYSTEM_COLLECTION",
      collectionId
    );
  }

  const docRef = doc(firestore, getUserCollectionPath(userId, collectionId));
  try {
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("[CollectionManager] Failed to update collection:", error);
    toast.error("Failed to update collection. Please try again.");
    throw new CollectionError(
      "Failed to update collection",
      "NETWORK",
      collectionId
    );
  }

  return {
    ...existing,
    ...updates,
    updatedAt: new Date(),
  };
}

export async function deleteCollection(collectionId: string): Promise<void> {
  const firestore = await getFirestoreInstance();
  const userId = getAuthenticatedUserId();
  const existing = await getCollection(collectionId);

  if (!existing) {
    return;
  }

  if (isSystemCollection(existing)) {
    throw new CollectionError(
      "Cannot delete system collection",
      "SYSTEM_COLLECTION",
      collectionId
    );
  }

  const batch = writeBatch(firestore);
  for (const sequenceId of existing.sequenceIds) {
    const seqRef = doc(firestore, getUserSequencePath(userId, sequenceId));
    batch.update(seqRef, {
      collectionIds: arrayRemove(collectionId),
    });
  }

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

export async function getCollections(): Promise<LibraryCollection[]> {
  const firestore = await getFirestoreInstance();
  const userId = getAuthenticatedUserId();
  const collectionsRef = collection(
    firestore,
    getUserCollectionsPath(userId)
  );
  const q = query(collectionsRef, orderBy("sortOrder", "asc"));

  const snapshot = await getDocs(q);
  const collections: LibraryCollection[] = [];

  snapshot.forEach((docSnap) => {
    collections.push(mapDocToCollection(docSnap.data(), docSnap.id));
  });

  return collections;
}

// ============================================================
// SEQUENCE MANAGEMENT
// ============================================================

export async function addSequenceToCollection(
  collectionId: string,
  sequenceId: string
): Promise<void> {
  const firestore = await getFirestoreInstance();
  const userId = getAuthenticatedUserId();

  const collectionRef = doc(
    firestore,
    getUserCollectionPath(userId, collectionId)
  );
  try {
    await updateDoc(collectionRef, {
      sequenceIds: arrayUnion(sequenceId),
      sequenceCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error(
      "[CollectionManager] Failed to add sequence to collection:",
      error
    );
    toast.error("Failed to add to collection. Please try again.");
    throw new CollectionError(
      "Failed to add sequence to collection",
      "NETWORK",
      collectionId
    );
  }

  // Update sequence's collectionIds if it exists in the user's library.
  // The sequence might not exist locally when favoriting someone else's public
  // sequence or a sequence from the generate module that hasn't been saved yet.
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
    const isNotFound =
      (err instanceof Error && err.message.includes("No document to update")) ||
      (typeof err === "object" && err !== null && "code" in err &&
        (err as { code: string }).code === "not-found");
    if (!isNotFound) {
      throw err;
    }
  }
}

export async function removeSequenceFromCollection(
  collectionId: string,
  sequenceId: string
): Promise<void> {
  const firestore = await getFirestoreInstance();
  const userId = getAuthenticatedUserId();
  const existing = await getCollection(collectionId);

  if (!existing) {
    return;
  }

  const collectionRef = doc(
    firestore,
    getUserCollectionPath(userId, collectionId)
  );
  try {
    await updateDoc(collectionRef, {
      sequenceIds: arrayRemove(sequenceId),
      sequenceCount: Math.max(0, existing.sequenceCount - 1),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error(
      "[CollectionManager] Failed to remove sequence from collection:",
      error
    );
    toast.error("Failed to remove from collection. Please try again.");
    throw new CollectionError(
      "Failed to remove sequence from collection",
      "NETWORK",
      collectionId
    );
  }

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

export async function getCollectionSequences(
  collectionId: string
): Promise<LibrarySequence[]> {
  const firestore = await getFirestoreInstance();
  const userId = getAuthenticatedUserId();
  const collectionData = await getCollection(collectionId);

  if (!collectionData || collectionData.sequenceIds.length === 0) {
    return [];
  }

  // Pass 1: fetch from user's own library
  const ownSequences = await batchFetchSequences(
    firestore,
    userId,
    collectionData.sequenceIds
  );

  if (ownSequences.length === collectionData.sequenceIds.length) {
    return ownSequences;
  }

  // Pass 2: try the public index for sequences not in user's library
  // (e.g. favorited someone else's public sequence)
  const foundIds = new Set(ownSequences.map((s) => s.id));
  const missingIds = collectionData.sequenceIds.filter(
    (id) => !foundIds.has(id)
  );

  if (missingIds.length === 0) return ownSequences;

  const publicSequences = await batchFetchPublicSequences(
    firestore,
    missingIds
  );

  return [...ownSequences, ...publicSequences];
}

export async function reorderSequences(
  collectionId: string,
  sequenceIds: string[]
): Promise<void> {
  const firestore = await getFirestoreInstance();
  const userId = getAuthenticatedUserId();
  const docRef = doc(firestore, getUserCollectionPath(userId, collectionId));

  try {
    await updateDoc(docRef, {
      sequenceIds,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("[CollectionManager] Failed to reorder sequences:", error);
    toast.error("Failed to reorder sequences. Please try again.");
    throw new CollectionError(
      "Failed to reorder sequences",
      "NETWORK",
      collectionId
    );
  }
}

export async function addSequencesToCollection(
  collectionId: string,
  sequenceIds: string[]
): Promise<void> {
  for (const sequenceId of sequenceIds) {
    await addSequenceToCollection(collectionId, sequenceId);
  }
}

// ============================================================
// REAL-TIME SUBSCRIPTIONS
// ============================================================

export function subscribeToCollections(
  callback: (collections: LibraryCollection[]) => void
): () => void {
  const userId = getAuthenticatedUserId();
  let unsubscribe: Unsubscribe | null = null;

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
          snapshot.forEach((docSnap) => {
            collections.push(mapDocToCollection(docSnap.data(), docSnap.id));
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

  return () => {
    if (unsubscribe) {
      unsubscribe();
    }
  };
}

export function subscribeToCollection(
  collectionId: string,
  callback: (collection: LibraryCollection | null) => void
): () => void {
  const userId = getAuthenticatedUserId();
  let unsubscribe: Unsubscribe | null = null;

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
            callback(mapDocToCollection(docSnap.data(), collectionId));
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

  return () => {
    if (unsubscribe) {
      unsubscribe();
    }
  };
}

// ============================================================
// REORDERING
// ============================================================

export async function reorderCollections(collectionIds: string[]): Promise<void> {
  const firestore = await getFirestoreInstance();
  const userId = getAuthenticatedUserId();
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
// FAVORITES
// ============================================================

export async function toggleFavorite(sequenceId: string): Promise<boolean> {
  const favoritesCollection = await getFavoritesCollection();
  const isFavorited = favoritesCollection.sequenceIds.includes(sequenceId);

  if (isFavorited) {
    await removeSequenceFromCollection(favoritesCollection.id, sequenceId);
    return false;
  } else {
    await addSequenceToCollection(favoritesCollection.id, sequenceId);
    return true;
  }
}

export async function isFavorite(sequenceId: string): Promise<boolean> {
  const favoritesCollection = await getFavoritesCollection();
  return favoritesCollection.sequenceIds.includes(sequenceId);
}

export async function getFavorites(): Promise<LibrarySequence[]> {
  const favoritesCollection = await getFavoritesCollection();
  return getCollectionSequences(favoritesCollection.id);
}

export async function getFavoriteIds(): Promise<Set<string>> {
  const favoritesCollection = await getFavoritesCollection();
  return new Set(favoritesCollection.sequenceIds);
}

// ============================================================
// PUBLIC COLLECTIONS - delegated to public-collection-loader
// New code should use public-collection-loader directly.
// ============================================================

export async function getUserPublicCollections(userId: string): Promise<LibraryCollection[]> {
  const { getUserPublicCollections: load } = await import("$lib/features/library/services/public-collection-loader");
  return load(userId);
}

export async function getUserCollectionSequences(
  userId: string,
  collectionId: string
): Promise<LibrarySequence[]> {
  const { getUserCollectionSequences: load } = await import("$lib/features/library/services/public-collection-loader");
  return load(userId, collectionId);
}

export async function getUserPublicFavoriteIds(userId: string): Promise<string[]> {
  const { getUserPublicFavoriteIds: load } = await import("$lib/features/library/services/public-collection-loader");
  return load(userId);
}
