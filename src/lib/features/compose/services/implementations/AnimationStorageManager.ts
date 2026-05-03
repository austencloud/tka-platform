/**
 * Animation Storage Service Implementation
 *
 * Firestore-based implementation for persisting and retrieving Animation entities.
 * Stores animations in the user's collection: users/{userId}/animations/{animationId}
 */

import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  limit as firestoreLimit,
  getDocs,
  orderBy,
  getCountFromServer,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import type { Animation } from "../../shared/domain/Animation";
import { createAnimation } from "../../shared/domain/Animation";

/**
 * Firestore collection path constants
 */
const ANIMATIONS_COLLECTION = "animations";
const DEFAULT_LIST_LIMIT = 50;
const MAX_ANIMATIONS_PER_USER = 500;

/**
 * Firestore representation of an Animation
 * Dates are stored as Timestamps in Firestore
 */
interface AnimationFirestoreData {
  id: string;
  name: string;
  creatorId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  mode: string;
  sequences: unknown[];
  canvasSettings: unknown[];
  globalSettings: {
    bpm: number;
    loop: boolean;
  };
  thumbnail?: string;
  tags?: string[];
  isPublic: boolean;
}

export class AnimationStorageManager {
  /**
   * Get the Firestore collection reference for a user's animations
   */
  private async getUserAnimationsCollectionRef(userId: string) {
    const firestore = await getFirestoreInstance();
    return collection(firestore, `users/${userId}/${ANIMATIONS_COLLECTION}`);
  }

  /**
   * Get the Firestore document reference for a specific animation
   */
  private async getAnimationDocRef(userId: string, animationId: string) {
    const firestore = await getFirestoreInstance();
    return doc(
      firestore,
      `users/${userId}/${ANIMATIONS_COLLECTION}/${animationId}`
    );
  }

  /**
   * Convert Firestore data to Animation domain model
   */
  private firestoreToAnimation(data: AnimationFirestoreData): Animation {
    return {
      id: data.id,
      name: data.name,
      creatorId: data.creatorId,
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt.toDate(),
      mode: data.mode as Animation["mode"],
      sequences: data.sequences as Animation["sequences"],
      canvasSettings: data.canvasSettings as Animation["canvasSettings"],
      globalSettings: data.globalSettings,
      thumbnail: data.thumbnail,
      tags: data.tags,
      isPublic: data.isPublic,
    };
  }

  /**
   * Convert Animation domain model to Firestore data
   */
  private animationToFirestore(animation: Animation): Record<string, unknown> {
    return {
      id: animation.id,
      name: animation.name,
      creatorId: animation.creatorId,
      createdAt: animation.createdAt,
      updatedAt: serverTimestamp(), // Always use server timestamp for updates
      mode: animation.mode,
      sequences: animation.sequences,
      canvasSettings: animation.canvasSettings,
      globalSettings: animation.globalSettings,
      thumbnail: animation.thumbnail,
      tags: animation.tags,
      isPublic: animation.isPublic,
    };
  }

  /**
   * Save an animation to Firestore
   */
  async save(animation: Animation): Promise<void> {
    try {
      // Validate user ID
      if (!animation.creatorId) {
        throw new Error("Animation must have a creatorId to save");
      }

      const docRef = await this.getAnimationDocRef(
        animation.creatorId,
        animation.id
      );
      const firestoreData = this.animationToFirestore(animation);

      await setDoc(docRef, firestoreData, { merge: true });
    } catch (error) {
      console.error(
        `❌ [AnimationStorageManager] Failed to save animation:`,
        error
      );
      throw new Error(`Failed to save animation: ${error}`);
    }
  }

  /**
   * Load an animation by ID from Firestore
   */
  async load(userId: string, animationId: string): Promise<Animation | null> {
    try {
      const docRef = await this.getAnimationDocRef(userId, animationId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      const data = docSnap.data() as AnimationFirestoreData;
      const animation = this.firestoreToAnimation(data);

      return animation;
    } catch (error) {
      console.error(
        `❌ [AnimationStorageManager] Failed to load animation:`,
        error
      );
      throw new Error(`Failed to load animation: ${error}`);
    }
  }

  /**
   * List all animations for a user
   */
  async list(
    userId: string,
    limit: number = DEFAULT_LIST_LIMIT
  ): Promise<Animation[]> {
    try {
      const collectionRef = await this.getUserAnimationsCollectionRef(userId);
      const q = query(
        collectionRef,
        orderBy("updatedAt", "desc"),
        firestoreLimit(limit)
      );

      const querySnapshot = await getDocs(q);
      const animations: Animation[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data() as AnimationFirestoreData;
        animations.push(this.firestoreToAnimation(data));
      });

      return animations;
    } catch (error) {
      console.error(
        `❌ [AnimationStorageManager] Failed to list animations:`,
        error
      );
      throw new Error(`Failed to list animations: ${error}`);
    }
  }

  /**
   * Delete an animation from Firestore
   */
  async delete(userId: string, animationId: string): Promise<void> {
    try {
      const docRef = await this.getAnimationDocRef(userId, animationId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error(
        `❌ [AnimationStorageManager] Failed to delete animation:`,
        error
      );
      throw new Error(`Failed to delete animation: ${error}`);
    }
  }

  /**
   * Duplicate an animation
   */
  async duplicate(
    userId: string,
    animationId: string,
    newName?: string
  ): Promise<Animation> {
    try {
      // Load the original animation
      const original = await this.load(userId, animationId);

      if (!original) {
        throw new Error(`Animation not found: ${animationId}`);
      }

      // Create a duplicate with new ID and name
      const duplicate = createAnimation({
        ...original,
        id: crypto.randomUUID(),
        name: newName ?? `${original.name} (Copy)`,
        creatorId: userId,
      });

      // Save the duplicate
      await this.save(duplicate);

      return duplicate;
    } catch (error) {
      console.error(
        `❌ [AnimationStorageManager] Failed to duplicate animation:`,
        error
      );
      throw new Error(`Failed to duplicate animation: ${error}`);
    }
  }

  /**
   * Check if an animation exists
   */
  async exists(userId: string, animationId: string): Promise<boolean> {
    try {
      const docRef = await this.getAnimationDocRef(userId, animationId);
      const docSnap = await getDoc(docRef);
      return docSnap.exists();
    } catch (error) {
      console.error(
        `❌ [AnimationStorageManager] Failed to check if animation exists:`,
        error
      );
      return false;
    }
  }

  /**
   * Get the total count of animations for a user
   */
  async count(userId: string): Promise<number> {
    try {
      const collectionRef = await this.getUserAnimationsCollectionRef(userId);
      const snapshot = await getCountFromServer(collectionRef);
      const count = snapshot.data().count;

      return count;
    } catch (error) {
      console.error(
        `❌ [AnimationStorageManager] Failed to count animations:`,
        error
      );
      throw new Error(`Failed to count animations: ${error}`);
    }
  }

  /**
   * Check if user has reached the maximum number of animations
   */
  async hasReachedLimit(userId: string): Promise<boolean> {
    const currentCount = await this.count(userId);
    return currentCount >= MAX_ANIMATIONS_PER_USER;
  }
}
