/**
 * PublicIndexSyncer - Public Sequence Index Management
 *
 * Handles syncing sequences to/from the publicSequences collection.
 * Includes content moderation - flagged content cannot be synced to public.
 * Auto-detects circularity and LOOP type at publish time using the
 * existing detection singletons (loopDetector, sequenceLoopabilityChecker).
 * Extracted from LibraryRepository for single responsibility.
 */

import { getErrorHandler } from "$lib/shared/application/get-error-handler";
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
import { stripUndefined } from "$lib/shared/firestore";
import { getPublicSequencePath, getPublicSequencesPath } from "$lib/shared/library/data/firestore-paths";
import type { LibrarySequence } from "$lib/shared/library/domain/models/library-sequence";
import type { FlaggedTerm } from "$lib/features/moderation/domain/models/content-moderation-models";

interface ContentModerator {
  checkWord(word: string): { isAllowed: boolean; flaggedTerms: FlaggedTerm[] };
}
interface ContentAppealManager {
  isWhitelisted(contentType: 'sequence' | 'act', contentId: string): Promise<boolean>;
}
import type { PublicSequencesLoader } from "$lib/shared/browse/services/public-sequences-loader";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { ContentModerationError } from "$lib/features/moderation/errors/content-moderation-error";
import { getPublicSequenceHashMatcher } from "$lib/shared/sequence-viewer/get-public-sequence-hash-matcher";
import type { ErrorHandler } from '$lib/shared/application/services/error-handler'
import { LOOP_LABELS_COLLECTION } from "$lib/features/loop-labeler/domain/constants/firebase-collections";
import { calculateDifficultyLevel as calculateSequenceDifficultyLevel } from "$lib/shared/browse/services/sequence-difficulty-calculator";
import { loopDetector } from "$lib/features/create/generate/circular/services/loop-detector";
import { periodToNumber } from "$lib/shared/foundation/domain/models/generation/circular-models";
import { isSeamlesslyLoopable } from "$lib/shared/foundation/services/sequence-loopability-checker";
import { resolveLoopDisplay } from "$lib/features/loop-labeler/services/loop-display-resolver";
import { isOneCountSequence } from "$lib/shared/library/domain/sequence-min-length";


export class PublicIndexSyncer {

  constructor(
    private readonly contentModerator?: ContentModerator,
    private readonly contentAppealManager?: ContentAppealManager,
    private readonly browseLoader?: PublicSequencesLoader
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

    if (isOneCountSequence(sequence)) {
      throw new Error("Too short to publish. A sequence needs at least 2 steps.");
    }

    const firestore = await getFirestoreInstance();

    try {
      // Get user display info for denormalization
      const userDoc = await getDoc(doc(firestore, `users/${userId}`));
      const userData = userDoc.data() ?? {};

      // Deduplicate by contentHash - reject if an identical sequence already exists
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
      const { isCircular, loopType, period, components } = await this.detectLoopInfo(firestore, sequence);

      // Calculate numeric level from steps if available
      const level = sequence.steps?.length > 0
        ? calculateSequenceDifficultyLevel([...sequence.steps])
        : undefined;

      // Compute encoder hash for URL-to-library matching.
      // LibrarySequence has full steps, so encoding works directly.
      let encoderHash: string | undefined;
      try {
        const matcher = getPublicSequenceHashMatcher();
        encoderHash = await matcher.computeEncoderHash(sequence);
      } catch {
        // Non-critical - sequence will still publish, just won't be URL-matchable
      }

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
        ...(period !== undefined && { period }),
        ...(components && components.length > 0 && { components }),
        forkCount: sequence.forkCount ?? 0,
        viewCount: sequence.viewCount ?? 0,
        starCount: sequence.starCount ?? 0,
        tags: [], // TODO: Resolve tag names from tagIds
        isForked: sequence.source === "forked",
        originalCreatorId: sequence.forkAttribution?.originalCreatorId,
        originalCreatorName: sequence.forkAttribution?.originalCreatorName,
        // Preserve the original creation date so the browse gallery shows the real birthday
        birthday: sequence.birthday ?? sequence.createdAt,
        publishedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        // Full motion content hash for deduplication
        contentHash: sequence.contentHash,
        encoderHash,
        // Compositional fields - everything needed to render without sourceRef
        blueSoloProp: sequence.blueSoloProp,
        redSoloProp: sequence.redSoloProp,
        stepPairings: sequence.stepPairings,
        // Hash fields for cross-tier queries
        bluePathHash: sequence.bluePathHash,
        redPathHash: sequence.redPathHash,
        blueSoloHash: sequence.blueSoloHash,
        redSoloHash: sequence.redSoloHash,
        ...(sequence.creatorIntent && { creatorIntent: sequence.creatorIntent }),
        // Start position - not derivable from compositional fields, needed for
        // correct 3D avatar orientation at beat 0.
        ...(sequence.startPosition && { startPosition: sequence.startPosition }),
      };

      // Recursively strip undefined fields - Firestore rejects them in setDoc
      const filteredPublicData = stripUndefined(publicData as Record<string, unknown>);

      await setDoc(
        doc(firestore, getPublicSequencePath(sequence.id)),
        filteredPublicData
      );

      // Fire-and-forget: write decomposed artifacts to public collections so
      // hand paths and solo props are independently discoverable in the gallery.
      this.syncArtifactsToPublic(firestore, sequence, userId).catch((err) =>
        console.warn("[PublicIndexSyncer] Public artifact sync failed (non-blocking):", err)
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
          thumbnails: sequence.thumbnails?.slice(0, 3) ?? [],
          blueSoloProp: sequence.blueSoloProp,
          redSoloProp: sequence.redSoloProp,
          stepPairings: sequence.stepPairings,
          bluePathHash: sequence.bluePathHash,
          redPathHash: sequence.redPathHash,
          blueSoloHash: sequence.blueSoloHash,
          redSoloHash: sequence.redSoloHash,
          sequenceLength: sequence.steps?.length ?? 0,
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
          birthday: sequence.birthday ?? sequence.createdAt ?? new Date(),
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
      // Don't show a generic error modal for moderation failures - those have their own UI
      if (!(error instanceof ContentModerationError)) {
        const errorHandler = getErrorHandler() as ErrorHandler;
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
      const errorHandler = getErrorHandler() as ErrorHandler;
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
   * Write decomposed hand paths and solo props to public collections.
   * Each artifact is stored by its content hash so identical shapes across
   * different sequences converge to a single document.
   */
  private async syncArtifactsToPublic(
    firestore: Firestore,
    sequence: LibrarySequence,
    userId: string
  ): Promise<void> {
    const { blueSoloProp, redSoloProp } = sequence;
    if (!blueSoloProp || !redSoloProp) return;

    const timestamp = serverTimestamp();

    const artifacts: Array<{ collectionPath: string; docId: string; data: Record<string, unknown> }> = [];

    // Hand paths
    for (const soloProp of [blueSoloProp, redSoloProp]) {
      const hp = soloProp.handPath;
      if (hp?.contentHash) {
        artifacts.push({
          collectionPath: "publicHandPaths",
          docId: hp.contentHash,
          data: {
            contentHash: hp.contentHash,
            locations: hp.locations,
            startLocation: hp.startLocation,
            endLocation: hp.endLocation,
            length: hp.length,
            bigrams: hp.bigrams,
            uniqueLocations: hp.uniqueLocations,
            impliedGridMode: hp.impliedGridMode,
            isClosed: hp.isClosed,
            ownerId: userId,
            publishedAt: timestamp,
          },
        });
      }
    }

    // Solo props
    for (const soloProp of [blueSoloProp, redSoloProp]) {
      if (soloProp?.contentHash) {
        artifacts.push({
          collectionPath: "publicSoloProps",
          docId: soloProp.contentHash,
          data: {
            contentHash: soloProp.contentHash,
            steps: soloProp.steps,
            startLocation: soloProp.startLocation,
            startOrientation: soloProp.startOrientation,
            handPath: soloProp.handPath,
            length: soloProp.length,
            bigrams: soloProp.bigrams,
            impliedGridMode: soloProp.impliedGridMode,
            ownerId: userId,
            publishedAt: timestamp,
          },
        });
      }
    }

    // Write all artifacts in parallel - merge so we don't overwrite existing documents
    await Promise.allSettled(
      artifacts.map((a) =>
        setDoc(doc(firestore, a.collectionPath, a.docId), a.data, { merge: true })
      )
    );
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
  ): Promise<{ isCircular: boolean; loopType: string | null; period?: number; components?: string[] }> {
    // Layer 1: Trust existing loopType on the sequence (set by LOOP generator)
    if (sequence.loopType) {
      // Run detection anyway to get the period and components
      try {
        const detection = loopDetector.detectLOOPType(sequence);
        const display = resolveLoopDisplay(sequence);
        return {
          isCircular: true,
          loopType: sequence.loopType,
          period: detection.period ? periodToNumber(detection.period) : undefined,
          components: display.components.size > 0 ? [...display.components] : undefined,
        };
      } catch {
        return { isCircular: true, loopType: sequence.loopType };
      }
    }

    // Layer 2: Check loop-labels collection for human-curated override
    const curatedLoopType = await this.fetchLoopType(firestore, sequence.word);
    if (curatedLoopType) {
      try {
        const detection = loopDetector.detectLOOPType(sequence);
        const display = resolveLoopDisplay(sequence);
        return {
          isCircular: true,
          loopType: curatedLoopType,
          period: detection.period ? periodToNumber(detection.period) : undefined,
          components: display.components.size > 0 ? [...display.components] : undefined,
        };
      } catch {
        return { isCircular: true, loopType: curatedLoopType };
      }
    }

    // Layer 3: Run live algorithmic detection
    const isCircular = isSeamlesslyLoopable(sequence);
    if (!isCircular) {
      return { isCircular: false, loopType: null };
    }

    // Sequence is circular - run full LOOP type detection
    try {
      const detection = loopDetector.detectLOOPType(sequence);
      const display = resolveLoopDisplay(sequence);
      return {
        isCircular: true,
        loopType: detection.loopType,
        period: detection.period ? periodToNumber(detection.period) : undefined,
        components: display.components.size > 0 ? [...display.components] : undefined,
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
