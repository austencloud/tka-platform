/**
 * PublicIndexSyncer - Public Sequence Index Management
 *
 * Handles syncing sequences to/from the publicSequences collection.
 * Extracted from LibraryRepository for single responsibility.
 */

import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { getPublicSequencePath } from "../../data/firestore-paths";
import type { IPublicIndexSyncer } from "../contracts/IPublicIndexSyncer";
import type { LibrarySequence } from "../../domain/models/LibrarySequence";

export class PublicIndexSyncer implements IPublicIndexSyncer {
  /**
   * Sync a public sequence to the publicSequences collection
   */
  async syncToPublicIndex(
    sequence: LibrarySequence,
    userId: string
  ): Promise<void> {
    const firestore = await getFirestoreInstance();

    try {
      // Get user display info for denormalization
      const userDoc = await getDoc(doc(firestore, `users/${userId}`));
      const userData = userDoc.data() ?? {};

      const publicData = {
        id: sequence.id,
        sourceRef: `users/${userId}/sequences/${sequence.id}`,
        ownerId: userId,
        ownerDisplayName: userData["displayName"] ?? "Unknown",
        ownerAvatarUrl: userData["photoURL"],
        name: sequence.name,
        displayName: sequence.displayName,
        word: sequence.word,
        thumbnails: sequence.thumbnails.slice(0, 3) ?? [],
        sequenceLength: sequence.steps.length ?? 0,
        difficultyLevel: sequence.difficultyLevel,
        forkCount: sequence.forkCount ?? 0,
        viewCount: sequence.viewCount ?? 0,
        starCount: sequence.starCount ?? 0,
        tags: [], // TODO: Resolve tag names from tagIds
        isForked: sequence.source === "forked",
        originalCreatorId: sequence.forkAttribution?.originalCreatorId,
        originalCreatorName: sequence.forkAttribution?.originalCreatorName,
        publishedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(
        doc(firestore, getPublicSequencePath(sequence.id)),
        publicData
      );
    } catch (error) {
      console.error(
        "[PublicIndexSyncer] Failed to sync to public index:",
        error
      );
      throw error; // Re-throw so callers know the sync failed
    }
  }

  /**
   * Remove a sequence from the public index
   */
  async removeFromPublicIndex(sequenceId: string): Promise<void> {
    const firestore = await getFirestoreInstance();

    try {
      await deleteDoc(doc(firestore, getPublicSequencePath(sequenceId)));
    } catch (error) {
      console.error(
        "[PublicIndexSyncer] Failed to remove from public index:",
        error
      );
      throw error; // Re-throw so callers know the removal failed
    }
  }
}
