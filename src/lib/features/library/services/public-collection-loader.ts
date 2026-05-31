/**
 * public-collection-loader - Read-only access to other users' public collections
 *
 * Used by the Browse module and Following Feed to display
 * another user's public collections and favorites.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import type { LibraryCollection } from "$lib/shared/library/domain/models/collection";
import { SYSTEM_COLLECTION_IDS } from "$lib/shared/library/domain/models/collection";
import type { LibrarySequence } from "$lib/shared/library/domain/models/library-sequence";
import {
  getUserCollectionsPath,
  getUserCollectionPath,
} from "$lib/shared/library/data/firestore-paths";
import {
  mapDocToCollection,
  batchFetchSequences,
} from "$lib/shared/library/services/collection-firestore-mapper";

export async function getUserPublicCollections(
  userId: string
): Promise<LibraryCollection[]> {
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

  snapshot.forEach((docSnap) => {
    collections.push(mapDocToCollection(docSnap.data(), docSnap.id));
  });

  return collections;
}

export async function getUserCollectionSequences(
  userId: string,
  collectionId: string
): Promise<LibrarySequence[]> {
  const firestore = await getFirestoreInstance();
  const collectionRef = doc(
    firestore,
    getUserCollectionPath(userId, collectionId)
  );
  const collectionSnap = await getDoc(collectionRef);

  if (!collectionSnap.exists()) {
    return [];
  }

  const collectionData = mapDocToCollection(
    collectionSnap.data(),
    collectionId
  );

  if (!collectionData.isPublic) {
    console.warn(
      `[PublicCollectionLoader] Attempted to access non-public collection: ${collectionId}`
    );
    return [];
  }

  return batchFetchSequences(
    firestore,
    userId,
    collectionData.sequenceIds,
    true
  );
}

export async function getUserPublicFavoriteIds(userId: string): Promise<string[]> {
  const firestore = await getFirestoreInstance();

  // Check if user has public favorites enabled
  const settingsRef = doc(firestore, `users/${userId}/settings/preferences`);
  const settingsSnap = await getDoc(settingsRef);

  const settings = settingsSnap.exists() ? settingsSnap.data() : {};
  const favoritesPublic = settings["favoritesPublic"] ?? true;

  if (!favoritesPublic) {
    return [];
  }

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
