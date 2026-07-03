/**
 * public-collection-loader - Read-only access to other users' public collections
 *
 * Used by the Browse module and Following Feed to display
 * another user's public collections and favorites.
 */

import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  limit,
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

/** A public collection paired with the uid of the user who owns it. */
export interface PublicCollectionWithOwner {
  collection: LibraryCollection;
  ownerId: string;
}

/**
 * Fetch every public collection across all users in ONE collection-group query,
 * newest first. Replaces the old per-creator N+1 crawl (list all users → query
 * each user's collections): that scaled with the user count; this scales with
 * the number of public collections and is capped.
 *
 * Requires the COLLECTION_GROUP index on collections (isPublic ASC, updatedAt
 * DESC) — see firestore.indexes.json.
 *
 * `collectionGroup("collections")` also matches root-level `/collections` docs
 * (a legacy path with no parent user). The owner is the parent user-doc id, so
 * root docs — which have no parent user — are skipped. The `ownerId` field on
 * the doc is not trusted for identity here; the path is authoritative.
 */
export async function getAllPublicCollections(
  max = 200
): Promise<PublicCollectionWithOwner[]> {
  const firestore = await getFirestoreInstance();
  const q = query(
    collectionGroup(firestore, "collections"),
    where("isPublic", "==", true),
    orderBy("updatedAt", "desc"),
    limit(max)
  );

  const snapshot = await getDocs(q);
  const results: PublicCollectionWithOwner[] = [];
  snapshot.forEach((docSnap) => {
    const ownerId = docSnap.ref.parent.parent?.id;
    if (!ownerId) return; // root-level /collections doc — not a user collection
    const collection = mapDocToCollection(docSnap.data(), docSnap.id);
    // System collections (e.g. a Favorites doc flipped public) are personal
    // library plumbing, not curated discovery items — keep them out of the feed.
    if (collection.systemType) return;
    results.push({ collection, ownerId });
  });

  // The feed is capped; past the cap the oldest public collections are not
  // shown. Surface it rather than silently truncating (higher-up organization
  // over the pile is a tracked follow-up).
  if (snapshot.size >= max) {
    console.warn(
      `[public-collection-loader] getAllPublicCollections hit the ${max}-doc cap; older public collections are not shown.`
    );
  }

  return results;
}

/**
 * Fetch a single public collection doc. Returns null when it doesn't exist or
 * isn't public — a followed collection whose owner deleted or unpublished it
 * resolves to null and drops out of the follower's list.
 */
export async function getPublicCollection(
  ownerId: string,
  collectionId: string
): Promise<LibraryCollection | null> {
  const firestore = await getFirestoreInstance();
  const snap = await getDoc(
    doc(firestore, getUserCollectionPath(ownerId, collectionId))
  );
  if (!snap.exists()) return null;

  const data = mapDocToCollection(snap.data(), collectionId);
  return data.isPublic ? data : null;
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
