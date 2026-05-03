/**
 * PublicCollectionLoader - Read-only access to other users' public collections
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
import type { LibraryCollection } from "../../domain/models/Collection";
import { SYSTEM_COLLECTION_IDS } from "../../domain/models/Collection";
import type { LibrarySequence } from "../../domain/models/LibrarySequence";
import {
  getUserCollectionsPath,
  getUserCollectionPath,
} from "../../data/firestore-paths";
import {
  mapDocToCollection,
  batchFetchSequences,
} from "./collection-firestore-mapper";

export class PublicCollectionLoader {
  async getUserPublicCollections(
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

  async getUserCollectionSequences(
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

  async getUserPublicFavoriteIds(userId: string): Promise<string[]> {
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
}
