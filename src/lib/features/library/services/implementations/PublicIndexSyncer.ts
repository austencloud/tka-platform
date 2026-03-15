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
  collection,
  query,
  where,
  getDocs,
  limit as firestoreLimit,
  type Firestore,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { getPublicSequencePath, getPublicSequencesPath } from "../../data/firestore-paths";
import type { IPublicIndexSyncer } from "../contracts/IPublicIndexSyncer";
import type { LibrarySequence } from "../../domain/models/LibrarySequence";
import type { IContentModerator } from "$lib/features/moderation/services/contracts/IContentModerator";
import type { IContentAppealManager } from "$lib/features/moderation/services/contracts/IContentAppealManager";
import type { IBrowseLoader } from "$lib/features/browse/sequences/display/services/contracts/IBrowseLoader";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { ContentModerationError } from "$lib/features/moderation/errors/ContentModerationError";
import { container } from "$lib/shared/di";
import type { IErrorHandler } from "$lib/shared/application/services/contracts/IErrorHandler";
import { LOOP_LABELS_COLLECTION } from "$lib/features/loop-labeler/domain/constants/firebase-collections";
import { SequenceDifficultyCalculator } from "$lib/features/browse/sequences/display/services/implementations/SequenceDifficultyCalculator";
import { loopDetector } from "$lib/features/create/generate/circular/services/implementations/LOOPDetector";
import { sequenceLoopabilityChecker } from "$lib/features/compose/services/implementations/SequenceLoopabilityChecker";

export class PublicIndexSyncer implements IPublicIndexSyncer {
  private readonly difficultyCalculator = new SequenceDifficultyCalculator();

  constructor(
    private readonly contentModerator?: IContentModerator,
    private readonly contentAppealManager?: IContentAppealManager,
    private readonly browseLoader?: IBrowseLoader
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

      // Deduplicate by contentHash — reject if an identical sequence already exists
      // in the public index from a different document (re-publishing the same doc is OK)
      if (sequence.contentHash) {
        const dupQuery = query(
          collection(firestore, getPublicSequencesPath()),
          where("contentHash", "==", sequence.contentHash),
          firestoreLimit(1)
        );
        const dupSnapshot = await getDocs(dupQuery);
        if (!dupSnapshot.empty) {
          const existingDoc = dupSnapshot.docs[0]!;
          if (existingDoc.id !== sequence.id) {
            throw new Error(
              `This exact sequence already exists in the gallery (published as "${existingDoc.data().word ?? existingDoc.id}")`
            );
          }
        }
      }

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
        thumbnails: sequence.thumbnails?.slice(0, 3) ?? [],
        sequenceLength: sequence.steps?.length ?? 0,
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
        // Full motion content hash for deduplication
        contentHash: sequence.contentHash,
        // Compositional fields — everything needed to render without sourceRef
        blueSoloProp: sequence.blueSoloProp,
        redSoloProp: sequence.redSoloProp,
        stepPairings: sequence.stepPairings,
        // Hash fields for cross-tier queries
        bluePathHash: sequence.bluePathHash,
        redPathHash: sequence.redPathHash,
        blueSoloHash: sequence.blueSoloHash,
        redSoloHash: sequence.redSoloHash,
        ...(sequence.creatorIntent && { creatorIntent: sequence.creatorIntent }),
      };

      // Strip undefined fields — Firestore rejects them in setDoc
      const filteredPublicData = Object.fromEntries(
        Object.entries(publicData).filter(([, v]) => v !== undefined)
      );

      await setDoc(
        doc(firestore, getPublicSequencePath(sequence.id)),
        filteredPublicData
      );

      // Inject the newly published sequence into the browse gallery cache so it
      // shows up immediately without a Firestore round-trip.
      if (this.browseLoader) {
        const cachedEntry: SequenceData = {
          id: sequence.id,
          name: sequence.name,
          displayName: sequence.displayName,
          word: sequence.word,
          steps: sequence.steps ?? [],
          thumbnails: sequence.thumbnails.slice(0, 3),
          blueSoloProp: sequence.blueSoloProp,
          redSoloProp: sequence.redSoloProp,
          stepPairings: sequence.stepPairings,
          bluePathHash: sequence.bluePathHash,
          redPathHash: sequence.redPathHash,
          blueSoloHash: sequence.blueSoloHash,
          redSoloHash: sequence.redSoloHash,
          sequenceLength: sequence.steps.length,
          difficultyLevel: sequence.difficultyLevel,
          level,
          isCircular,
          loopType: loopType as SequenceData["loopType"],
          isFavorite: false,
          tags: [],
          metadata: {},
          ownerId: userId,
          ownerDisplayName: (userData["displayName"] as string | undefined) ?? "Unknown",
          ownerAvatarUrl: userData["photoURL"] as string | undefined,
          dateAdded: new Date(),
          ...(sequence.source === "forked" && sequence.forkAttribution && {
            source: "forked" as const,
            forkAttribution: sequence.forkAttribution,
          }),
        };
        this.browseLoader.addToCache(cachedEntry);
      }
    } catch (error) {
      console.error(
        "[PublicIndexSyncer] Failed to sync to public index:",
        error
      );
      // Don't show a generic error modal for moderation failures — those have their own UI
      if (!(error instanceof ContentModerationError)) {
        const errorHandler = container.items.errorHandler as IErrorHandler;
        errorHandler.showUserError({
          message: "Couldn't publish your sequence",
          technicalDetails: error instanceof Error ? error.message : String(error),
          error: error instanceof Error ? error : new Error(String(error)),
          severity: "error",
          context: {
            module: "library",
            action: "publish-sequence",
            additionalData: { sequenceId: sequence.id, userId },
          },
        });
      }
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

      // Remove from cache immediately so the gallery reflects the change.
      this.browseLoader?.removeFromCache(sequenceId);
    } catch (error) {
      console.error(
        "[PublicIndexSyncer] Failed to remove from public index:",
        error
      );
      const errorHandler = container.items.errorHandler as IErrorHandler;
      errorHandler.showUserError({
        message: "Couldn't unpublish your sequence",
        technicalDetails: error instanceof Error ? error.message : String(error),
        error: error instanceof Error ? error : new Error(String(error)),
        severity: "error",
        context: {
          module: "library",
          action: "unpublish-sequence",
          additionalData: { sequenceId },
        },
      });
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
