/**
 * LibrarySaveService - Orchestrates saving sequences to library
 *
 * Handles the multi-step process of saving a sequence:
 * 1. Generate thumbnail image (with caching optimization)
 * 2. Optimistic save to Dexie (instant, works offline)
 * 3. Create any new tags that don't exist
 * 4. Background Firestore sync (non-blocking)
 * 5. Refresh library state
 *
 * The Dexie write in step 2 makes saving work offline. Firestore syncs
 * in the background and fails gracefully if the user is offline - the
 * sequence is already safe in local storage.
 */

import { getErrorHandler } from "$lib/shared/application/get-error-handler";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { SequenceVisibility } from "$lib/shared/library/domain/models/LibrarySequence";
import { findTagByName, createUserTag } from "./tag-manager";
import type { ArtifactExtractor } from "./artifact-extractor";
import { TAG_COLORS } from "../domain/models/tag";
import { DEFAULT_SHARE_OPTIONS } from "$lib/shared/share/domain/models/share-options";
import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte.ts";
import type {
  SaveToLibraryOptions, SaveProgress, SaveResult } from "./types";
import type { ErrorHandler } from '$lib/shared/application/services/error-handler'
import { LibraryError } from "$lib/shared/library/services/LibraryRepository";
import { toast } from "$lib/shared/toast/state/toast-state.svelte.ts";
import { db } from "$lib/shared/persistence/database/TKADatabase";
import { authState } from "$lib/shared/auth/state/authState.svelte.ts";
import type { Sharer } from "../../../shared/share/services/sharer";
import type { R2VideoUploader } from "../../../shared/share/services/r2-video-uploader";
import type { LibraryRepository } from "$lib/shared/library/services/LibraryRepository";
export class LibrarySaveService {
  private readonly shareService: Sharer | null;
  private readonly uploadService: R2VideoUploader | null;
  private readonly libraryRepository: LibraryRepository;
  private readonly artifactExtractor: ArtifactExtractor | null;

  constructor(
    shareService: Sharer | null,
    uploadService: R2VideoUploader | null,
    libraryRepository: LibraryRepository,
    artifactExtractor?: ArtifactExtractor | null
  ) {
    this.shareService = shareService ?? null;
    this.uploadService = uploadService ?? null;
    this.libraryRepository = libraryRepository;
    this.artifactExtractor = artifactExtractor ?? null;
  }

  async saveSequence(
    sequence: SequenceData,
    options: SaveToLibraryOptions,
    onProgress?: (progress: SaveProgress) => void
  ): Promise<SaveResult> {
    const { name, displayName, visibility, tags, notes } = options;

    const emitProgress = (
      step: number,
      renderProgress?: { current: number; total: number }
    ) => {
      onProgress?.({
        step,
        stepLabel: this.getStepLabel(step, renderProgress),
        renderProgress,
      });
    };

    // Step 1: Generate thumbnail image
    emitProgress(1);
    const thumbnailUrl = await this.generateAndUploadThumbnail(
      sequence,
      emitProgress
    );

    // Step 2: Optimistic save to Dexie (instant, works offline)
    // The sequence is safe in local storage before we ever touch Firestore.
    emitProgress(2);
    const sequenceToSave: SequenceData = {
      ...sequence,
      id: sequence.id || crypto.randomUUID(),
      name,
      displayName: displayName || undefined,
      tags: [...tags],
      thumbnails: thumbnailUrl ? [thumbnailUrl] : [...(sequence.thumbnails ?? [])],
      isFavorite: false,
    };
    try {
      // JSON round-trip strips Firestore Timestamps and other non-cloneable objects
      const cloneable = JSON.parse(JSON.stringify(sequenceToSave));
      await db.sequences.put(cloneable);
    } catch (dexieError) {
      console.warn("[LibrarySaveService] Dexie optimistic save failed:", dexieError);
    }

    const sequenceId = sequenceToSave.id;

    // Step 3: Create any new tags
    emitProgress(3);
    await this.createNewTags(tags);

    // Step 4: Background Firestore sync (non-blocking)
    // If offline, the sequence is already in Dexie and the user sees success.
    emitProgress(4);
    this.syncToFirestore(sequence, { name, displayName, visibility, tags, notes: notes ?? "", thumbnailUrl })
      .catch(err => console.warn("[LibrarySaveService] Firestore sync pending:", err));

    // Fire-and-forget: decompose the sequence into hand paths and solo props
    // so they're independently queryable in the user's artifact repositories.
    const currentUserId = authState.effectiveUserId;
    if (this.artifactExtractor && currentUserId && sequenceToSave.blueSoloProp && sequenceToSave.redSoloProp) {
      this.artifactExtractor.extract(sequenceToSave, currentUserId).catch((err) =>
        console.error("Artifact extraction failed (non-blocking):", err)
      );
    }

    // Step 5: Refresh library state
    emitProgress(5);
    await this.refreshLibraryState();

    // Step 6: Complete
    emitProgress(6);

    // Brief pause to show success state
    await new Promise((resolve) => setTimeout(resolve, 800));

    return { sequenceId, thumbnailUrl };
  }

  getStepLabel(
    step: number,
    renderProgress?: { current: number; total: number }
  ): string {
    const labels: Record<number, string> = {
      1: "Creating thumbnail",
      2: "Saving locally",
      3: "Creating tags",
      4: "Syncing to cloud",
      5: "Refreshing library",
      6: "Complete",
    };

    // Dynamic label for step 1 with render progress
    // Uses "frame" instead of "beat" since total includes start position
    if (step === 1 && renderProgress && renderProgress.total > 0) {
      return `Rendering frame ${renderProgress.current} of ${renderProgress.total}`;
    }

    return labels[step] || "Processing...";
  }

  /**
   * Fire-and-forget Firestore sync. Runs after the local Dexie save succeeds,
   * so if this fails (e.g. offline) the sequence is already safe locally.
   */
  private async syncToFirestore(
    sequence: SequenceData,
    metadata: {
      name: string;
      displayName?: string;
      visibility: SequenceVisibility;
      tags: string[];
      notes: string;
      thumbnailUrl?: string;
    }
  ): Promise<void> {
    try {
      await this.libraryRepository.saveSequenceWithMetadata(sequence, metadata);
    } catch (error) {
      if (error instanceof LibraryError && error.code === "ALREADY_EXISTS") {
        toast.info("This exact sequence is already in your library.");
      } else {
        console.warn("[LibrarySaveService] Firestore sync failed (data safe in Dexie):", error);
      }
    }
  }

  /**
   * Generate thumbnail and upload to storage
   * Returns thumbnail URL or undefined if generation/upload fails
   */
  private async generateAndUploadThumbnail(
    sequence: SequenceData,
    emitProgress: (
      step: number,
      renderProgress?: { current: number; total: number }
    ) => void
  ): Promise<string | undefined> {
    if (!this.shareService || !this.uploadService) {
      console.warn(
        "[LibrarySaveService] Share or upload service not available, skipping thumbnail"
      );
      return undefined;
    }

    try {
      // Get image composition settings from visibility settings
      const imageCompositionManager = getImageCompositionManager();
      const compositionSettings = imageCompositionManager.getSettings();

      const thumbnailOptions = {
        ...DEFAULT_SHARE_OPTIONS,
        addWord: compositionSettings.addWord,
        addStepNumbers: compositionSettings.addStepNumbers,
        addDifficultyLevel: compositionSettings.addDifficultyLevel,
        addUserInfo: compositionSettings.addUserInfo,
        includeStartPosition: compositionSettings.includeStartPosition,
        format: "PNG" as const,
      };

      // Try to reuse cached preview if available
      let imageBlob = await this.shareService.getCachedBlobIfAvailable(
        sequence,
        thumbnailOptions
      );

      if (!imageBlob) {
        // Cache miss - generate thumbnail with progress tracking
        imageBlob = await this.shareService.getImageBlob(
          sequence,
          thumbnailOptions,
          (progress: { current: number; total: number; stage: string }) => {
            emitProgress(1, {
              current: progress.current,
              total: progress.total,
            });
          }
        );
      }

      // Step 2: Upload thumbnail
      emitProgress(2);
      const uploadResult = await this.uploadService.uploadSequenceThumbnail(
        sequence.id,
        imageBlob,
        "png"
      );

      return uploadResult.url;
    } catch (error) {
      // Don't fail the entire save if thumbnail generation fails - show a warning instead
      console.error(
        "[LibrarySaveService] Failed to generate/upload thumbnail:",
        error
      );
      const errorHandler = getErrorHandler() as ErrorHandler;
      errorHandler.showUserError({
        message: "Sequence saved, but the thumbnail didn't generate",
        technicalDetails: error instanceof Error ? error.message : String(error),
        error: error instanceof Error ? error : new Error(String(error)),
        severity: "warning",
        context: {
          module: "library",
          action: "save-to-library",
        },
      });
      return undefined;
    }
  }

  /**
   * Create any new tags that don't exist in the system
   */
  private async createNewTags(tags: string[]): Promise<void> {
    if (tags.length === 0) {
      return;
    }

    try {
      for (const tagName of tags) {
        const normalized = tagName.toLowerCase().trim();
        const existing = await findTagByName(normalized);

        if (!existing) {
          // Create new tag with random color
          const randomColor =
            TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
          await createUserTag(normalized, { color: randomColor });
        }
      }
    } catch (error) {
      // Don't fail the save if tag creation fails
      console.error("[LibrarySaveService] Failed to create tags:", error);
    }
  }

  /**
   * Refresh library state after saving
   */
  private async refreshLibraryState(): Promise<void> {
    try {
      const { libraryState } =
        await import("$lib/features/library/state/library-state.svelte.ts");
      if (libraryState) {
        await libraryState.loadSequences();
      }
    } catch (error) {
      console.warn(
        "[LibrarySaveService] Could not refresh library state:",
        error
      );
    }
  }
}
