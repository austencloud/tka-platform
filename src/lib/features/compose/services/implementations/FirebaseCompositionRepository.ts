/**
 * FirebaseCompositionRepository
 *
 * Persists compositions to Firestore for cross-device sync.
 * Structure: users/{userId}/compositions/{compositionId}
 *
 * Follows the fire-and-forget pattern: local save succeeds first,
 * Firebase sync happens in the background. Failures are logged
 * but don't block the user.
 */

import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  type Timestamp,
} from "firebase/firestore";
import { auth, getFirestoreInstance } from "$lib/shared/auth/firebase";
import { trackWrite } from "$lib/shared/offline/state/sync-status-state.svelte";
import {
  getUserCompositionsPath,
  getUserCompositionPath,
} from "../../data/firestore-paths";
import type { Composition } from "../../compose/domain/types";

/**
 * Convert a Composition to a Firestore-safe document.
 * Strips Date objects and replaces with ISO strings for nested data,
 * uses serverTimestamp() for top-level timestamps.
 */
function compositionToFirestoreDoc(composition: Composition): Record<string, unknown> {
  const { createdAt, updatedAt, ...rest } = composition;
  return {
    ...rest,
    createdAt: createdAt instanceof Date ? createdAt.toISOString() : createdAt,
    updatedAt: serverTimestamp(),
  };
}

/**
 * Convert a Firestore document back to a Composition.
 * Handles Timestamp → Date conversion.
 */
function firestoreDocToComposition(
  id: string,
  data: Record<string, unknown>
): Composition {
  const createdAt =
    data.createdAt instanceof Object && "toDate" in data.createdAt
      ? (data.createdAt as Timestamp).toDate()
      : typeof data.createdAt === "string"
        ? new Date(data.createdAt)
        : new Date();

  const updatedAt =
    data.updatedAt instanceof Object && "toDate" in data.updatedAt
      ? (data.updatedAt as Timestamp).toDate()
      : typeof data.updatedAt === "string"
        ? new Date(data.updatedAt)
        : new Date();

  return {
    ...data,
    id,
    createdAt,
    updatedAt,
  } as Composition;
}

export class FirebaseCompositionRepository {
  /**
   * Get the current authenticated user ID.
   * Returns null if not authenticated.
   */
  private getUserId(): string | null {
    return auth.currentUser?.uid ?? null;
  }

  /**
   * Save a composition to Firestore.
   * Uses merge to avoid overwriting fields not present in the update.
   */
  async saveComposition(composition: Composition): Promise<void> {
    const userId = this.getUserId();
    if (!userId) return;

    const firestore = await getFirestoreInstance();
    const docRef = doc(
      firestore,
      getUserCompositionPath(userId, composition.id)
    );
    const firestoreData = compositionToFirestoreDoc(composition);

    await trackWrite(() => setDoc(docRef, firestoreData, { merge: true }));
  }

  /**
   * Load a single composition from Firestore.
   */
  async getComposition(compositionId: string): Promise<Composition | null> {
    const userId = this.getUserId();
    if (!userId) return null;

    try {
      const firestore = await getFirestoreInstance();
      const docRef = doc(
        firestore,
        getUserCompositionPath(userId, compositionId)
      );
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) return null;
      return firestoreDocToComposition(docSnap.id, docSnap.data());
    } catch (error) {
      console.error(`Failed to load composition ${compositionId} from Firebase:`, error);
      return null;
    }
  }

  /**
   * Load all compositions from Firestore for the current user.
   */
  async getCompositions(): Promise<Composition[]> {
    const userId = this.getUserId();
    if (!userId) return [];

    try {
      const firestore = await getFirestoreInstance();
      const collRef = collection(
        firestore,
        getUserCompositionsPath(userId)
      );
      const q = query(collRef, orderBy("updatedAt", "desc"));
      const snapshot = await getDocs(q);

      return snapshot.docs.map((docSnap) =>
        firestoreDocToComposition(docSnap.id, docSnap.data())
      );
    } catch (error) {
      console.error("Failed to load compositions from Firebase:", error);
      return [];
    }
  }

  /**
   * Delete a composition from Firestore.
   */
  async deleteComposition(compositionId: string): Promise<void> {
    const userId = this.getUserId();
    if (!userId) return;

    try {
      const firestore = await getFirestoreInstance();
      const docRef = doc(
        firestore,
        getUserCompositionPath(userId, compositionId)
      );
      await trackWrite(() => deleteDoc(docRef));
    } catch (error) {
      console.error(`Failed to delete composition ${compositionId} from Firebase:`, error);
    }
  }

  /**
   * Update favorite status in Firestore.
   */
  async updateFavorite(
    compositionId: string,
    isFavorite: boolean
  ): Promise<void> {
    const userId = this.getUserId();
    if (!userId) return;

    try {
      const firestore = await getFirestoreInstance();
      const docRef = doc(
        firestore,
        getUserCompositionPath(userId, compositionId)
      );
      await trackWrite(() =>
        setDoc(
          docRef,
          { isFavorite, updatedAt: serverTimestamp() },
          { merge: true }
        )
      );
    } catch (error) {
      console.error(`Failed to update favorite for ${compositionId}:`, error);
    }
  }

  /**
   * Check if the user is authenticated (can sync).
   */
  isAuthenticated(): boolean {
    return this.getUserId() !== null;
  }
}

export const firebaseCompositionRepository =
  new FirebaseCompositionRepository();
