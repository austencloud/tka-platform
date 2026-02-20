/**
 * PublicIndexSyncer - Public Sequence Index Management
 *
 * Handles syncing sequences to/from the publicSequences collection.
 * Includes content moderation - flagged content cannot be synced to public.
 * Auto-detects circularity and LOOP type at publish time using the
 * existing detection singletons (loopDetector, sequenceLoopabilityChecker).
 * Extracted from LibraryRepository for single responsibility.
 */

import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { getPublicSequencePath } from "../../data/firestore-paths";
import type { IPublicIndexSyncer } from "../contracts/IPublicIndexSyncer";
import type { LibrarySequence } from "../../domain/models/LibrarySequence";
import type { IContentModerator } from "$lib/features/moderation/services/contracts/IContentModerator";
import type { IContentAppealManager } from "$lib/features/moderation/services/contracts/IContentAppealManager";
import { ContentModerationError } from "$lib/features/moderation/errors/ContentModerationError";
import { LOOP_LABELS_COLLECTION } from "$lib/features/loop-labeler/domain/constants/firebase-collections";
import { SequenceDifficultyCalculator } from "$lib/features/browse/sequences/display/services/implementations/SequenceDifficultyCalculator";
import { loopDetector } from "$lib/features/create/generate/circular/services/implementations/LOOPDetector";
import { sequenceLoopabilityChecker } from "$lib/features/compose/services/implementations/SequenceLoopabilityChecker";

export class PublicIndexSyncer implements IPublicIndexSyncer {
  private readonly difficultyCalculator = new SequenceDifficultyCalculator();

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

      // Detect circularity and LOOP type from step/motion data
      const { isCircular, loopType } = await this.detectLoopInfo(firestore, sequence);

      // Calculate numeric level from steps if available
      const level = sequence.steps?.length > 0
        ? this.difficultyCalculator.calculateDifficultyLevel([...sequence.steps])
        : undefined;

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
        level,
        isCircular,
        loopType,
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

  /**
   * Detect circularity and LOOP type using a layered strategy:
   * 1. Trust sequence.loopType if already set (generator-created LOOPs)
   * 2. Check loop-labels collection for human-curated override
   * 3. Run live algorithmic detection from step/motion data
   */
  private async detectLoopInfo(
    firestore: Firestore,
    sequence: LibrarySequence
  ): Promise<{ isCircular: boolean; loopType: string | null }> {
    // Layer 1: Trust existing loopType on the sequence (set by LOOP generator)
    if (sequence.loopType) {
      return { isCircular: true, loopType: sequence.loopType };
    }

    // Layer 2: Check loop-labels collection for human-curated override
    const curatedLoopType = await this.fetchLoopType(firestore, sequence.word);
    if (curatedLoopType) {
      return { isCircular: true, loopType: curatedLoopType };
    }

    // Layer 3: Run live algorithmic detection
    const isCircular = sequenceLoopabilityChecker.isSeamlesslyLoopable(sequence);
    if (!isCircular) {
      return { isCircular: false, loopType: null };
    }

    // Sequence is circular — run full LOOP type detection
    try {
      const detection = loopDetector.detectLOOPType(sequence);
      return {
        isCircular: true,
        loopType: detection.loopType,
      };
    } catch (error) {
      console.warn(
        `[PublicIndexSyncer] LOOP detection failed for "${sequence.word}", marking as circular with no type:`,
        error
      );
      return { isCircular: true, loopType: null };
    }
  }

  /**
   * Fetch LOOP type from the loop-labels collection.
   * Returns a string like "rotated", "mirrored+swapped", or null if not labeled or freeform.
   */
  private async fetchLoopType(
    firestore: Firestore,
    word: string
  ): Promise<string | null> {
    if (!word) return null;

    try {
      const labelDoc = await getDoc(doc(firestore, LOOP_LABELS_COLLECTION, word));

      if (!labelDoc.exists()) {
        return null;
      }

      const data = labelDoc.data();

      // If explicitly marked as freeform, return null (no recognized pattern)
      if (data.isFreeform) {
        return null;
      }

      // If has designations, join the components
      const designations = data.designations as Array<{
        loopType: string;
        components: string[];
      }> | undefined;

      if (designations && designations.length > 0) {
        const firstDesignation = designations[0];
        if (firstDesignation) {
          // Take the first designation's components and join them
          const components = firstDesignation.components;
          if (components && components.length > 0) {
            return components.join("+");
          }
          // Or use the loopType directly if no components (returns null for freeform)
          return firstDesignation.loopType || null;
        }
      }

      return null;
    } catch (error) {
      console.warn(
        `[PublicIndexSyncer] Failed to fetch LOOP label for "${word}":`,
        error
      );
      return null;
    }
  }
}
