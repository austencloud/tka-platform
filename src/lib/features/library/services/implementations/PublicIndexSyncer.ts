/**
 * PublicIndexSyncer - Public Sequence Index Management
 *
 * Handles syncing sequences to/from the publicSequences collection.
 * Includes content moderation - flagged content cannot be synced to public.
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
import type { IContentModerator } from "$lib/features/moderation/services/contracts/IContentModerator";
import type { IContentAppealManager } from "$lib/features/moderation/services/contracts/IContentAppealManager";
import { ContentModerationError } from "$lib/features/moderation/errors/ContentModerationError";

export class PublicIndexSyncer implements IPublicIndexSyncer {
  constructor(
    private readonly contentModerator?: IContentModerator,
    private readonly contentAppealManager?: IContentAppealManager
  ) {}

  /**
   * Sync a public sequence to the publicSequences collection.
   * Throws ContentModerationError if content is flagged and not whitelisted.
   */
  async syncToPublicIndex(
    sequence: LibrarySequence,
    userId: string
  ): Promise<void> {
    // Run content moderation check if moderator is available
    if (this.contentModerator && sequence.word) {
      const result = this.contentModerator.checkWord(sequence.word);

      if (!result.isAllowed) {
        // Check if this content has been whitelisted via appeal
        const isWhitelisted = this.contentAppealManager
          ? await this.contentAppealManager.isWhitelisted("sequence", sequence.id)
          : false;

        if (!isWhitelisted) {
          throw new ContentModerationError(
            "Content flagged by moderation",
            result.flaggedTerms,
            sequence.word,
            sequence.id
          );
        }
      }
    }

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
