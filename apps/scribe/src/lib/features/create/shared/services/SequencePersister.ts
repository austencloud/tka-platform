/**
 * Sequence Persistence Service
 *
 * Handles permanent saving of sequences to user's library.
 * This is distinct from draft autosaving - these are explicitly saved sequences.
 *
 * Domain: Create module - Sequence library persistence
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";
import { getFirestoreInstance, getAuthSync } from "$lib/shared/auth/firebase";
import { toast } from "$lib/shared/toast/state/toast-state.svelte";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

/**
 * Metadata for saving a sequence to library
 */
export interface SaveSequenceMetadata {
  name: string;
  /** User's custom display name (optional). When set, shown as primary name in UI. */
  displayName?: string;
  description?: string;
  tags?: string[];
  notes?: string;
  visibility?: "private" | "public" | "unlisted";
  thumbnailUrl?: string;
  videoUrl?: string;
}

/**
 * Saved sequence with metadata in Firestore
 */
export interface SavedSequence {
  id: string;
  userId: string;
  sequenceData: SequenceData;
  metadata: SaveSequenceMetadata;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  stepCount: number;
  thumbnailUrl?: string;
}

export class SequencePersister {
  /**
   * Save a sequence to user's library
   */
  async saveSequence(
    sequenceData: SequenceData,
    metadata: SaveSequenceMetadata
  ): Promise<string> {
    const user = getAuthSync().currentUser;
    if (!user) {
      console.error("[SequencePersister] No authenticated user");
      throw new Error("User must be authenticated to save sequence");
    }

    const sequenceId = sequenceData.id || crypto.randomUUID();

    // Flatten structure to match LibrarySequence format
    // Store thumbnail in both thumbnails array (for SequenceData compatibility)
    // and thumbnailUrl field (for backward compatibility)
    const thumbnails = metadata.thumbnailUrl
      ? [metadata.thumbnailUrl]
      : sequenceData.thumbnails || [];

    const savedSequence = {
      id: sequenceId,
      userId: user.uid,
      name: metadata.name,
      displayName: metadata.displayName, // User's custom display name
      word: sequenceData.word,
      steps: sequenceData.steps,
      visibility: metadata.visibility,
      description: metadata.description,
      tags: metadata.tags || [],
      thumbnails, // Array for SequenceData compatibility
      thumbnailUrl: metadata.thumbnailUrl, // Single URL for backward compatibility
      videoUrl: metadata.videoUrl,
      source: "created" as const, // Mark as user-created
    };

    const firestore = await getFirestoreInstance();
    const sequenceRef = doc(
      firestore,
      `users/${user.uid}/sequences/${sequenceId}`
    );

    // Filter out undefined fields
    const sequenceToSave = Object.fromEntries(
      Object.entries({
        ...savedSequence,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }).filter(([_, value]) => value !== undefined)
    );

    try {
      await setDoc(sequenceRef, sequenceToSave);
    } catch (error) {
      console.error("[SequencePersister] Failed to save sequence:", error);
      toast.error("Failed to save sequence. Please try again.");
      throw error;
    }

    return sequenceId;
  }

  /**
   * Update an existing saved sequence
   */
  async updateSequence(
    sequenceId: string,
    sequenceData: SequenceData,
    metadata: Partial<SaveSequenceMetadata>
  ): Promise<void> {
    const user = getAuthSync().currentUser;
    if (!user) {
      throw new Error("User must be authenticated");
    }

    const firestore = await getFirestoreInstance();
    const sequenceRef = doc(
      firestore,
      `users/${user.uid}/sequences/${sequenceId}`
    );

    // Flatten structure to match LibrarySequence format
    const updates: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };

    if (metadata.name !== undefined) updates.name = metadata.name;
    if (metadata.displayName !== undefined)
      updates.displayName = metadata.displayName;
    if (metadata.description !== undefined)
      updates.description = metadata.description;
    if (metadata.visibility !== undefined)
      updates.visibility = metadata.visibility;
    if (metadata.tags !== undefined) updates.tags = metadata.tags;
    if (metadata.thumbnailUrl !== undefined)
      updates.thumbnailUrl = metadata.thumbnailUrl;
    if (metadata.videoUrl !== undefined) updates.videoUrl = metadata.videoUrl;

    if (sequenceData) {
      updates.word = sequenceData.word;
      updates.steps = sequenceData.steps;
    }

    try {
      await setDoc(sequenceRef, updates, { merge: true });
    } catch (error) {
      console.error("[SequencePersister] Failed to update sequence:", error);
      toast.error("Failed to update sequence. Please try again.");
      throw error;
    }
  }

  /**
   * Load a saved sequence by ID
   */
  async loadSequence(sequenceId: string): Promise<SavedSequence | null> {
    const user = getAuthSync().currentUser;
    if (!user) return null;

    try {
      const firestore = await getFirestoreInstance();
      const sequenceRef = doc(
        firestore,
        `users/${user.uid}/sequences/${sequenceId}`
      );
      const snapshot = await getDoc(sequenceRef);

      if (!snapshot.exists()) return null;

      return snapshot.data() as SavedSequence;
    } catch (error) {
      console.error("[SequencePersister] Failed to load sequence:", error);
      toast.error("Failed to load sequence.");
      return null;
    }
  }

  /**
   * Get recent saved sequences
   */
  async getRecentSequences(limitCount = 10): Promise<SavedSequence[]> {
    const user = getAuthSync().currentUser;
    if (!user) return [];

    try {
      const firestore = await getFirestoreInstance();
      const sequencesRef = collection(firestore, `users/${user.uid}/sequences`);
      const q = query(
        sequencesRef,
        orderBy("updatedAt", "desc"),
        limit(limitCount)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => doc.data() as SavedSequence);
    } catch (error) {
      console.error(
        "[SequencePersister] Failed to get recent sequences:",
        error
      );
      toast.error("Failed to load recent sequences.");
      return [];
    }
  }

  /**
   * Get all saved sequences for current user
   */
  async getAllSequences(): Promise<SavedSequence[]> {
    const user = getAuthSync().currentUser;
    if (!user) return [];

    try {
      const firestore = await getFirestoreInstance();
      const sequencesRef = collection(firestore, `users/${user.uid}/sequences`);
      const snapshot = await getDocs(sequencesRef);

      return snapshot.docs.map((doc) => doc.data() as SavedSequence);
    } catch (error) {
      console.error("[SequencePersister] Failed to get all sequences:", error);
      toast.error("Failed to load sequences.");
      return [];
    }
  }

  /**
   * Check if a sequence is already saved
   */
  async isSequenceSaved(sequenceId: string): Promise<boolean> {
    const user = getAuthSync().currentUser;
    if (!user) return false;

    try {
      const firestore = await getFirestoreInstance();
      const sequenceRef = doc(
        firestore,
        `users/${user.uid}/sequences/${sequenceId}`
      );
      const snapshot = await getDoc(sequenceRef);

      return snapshot.exists();
    } catch (error) {
      console.error(
        "[SequencePersister] Failed to check if sequence saved:",
        error
      );
      return false;
    }
  }
}
