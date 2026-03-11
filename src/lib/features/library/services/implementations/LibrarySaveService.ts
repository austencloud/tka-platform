/**
 * LibrarySaveService - Orchestrates saving sequences to library
 *
 * Handles the multi-step process of saving a sequence:
 * 1. Generate thumbnail image (with caching optimization)
 * 2. Upload thumbnail to Firebase Storage
 * 3. Create any new tags that don't exist
 * 4. Save sequence to Firestore
 * 5. Refresh library state
 *
 * Non-critical steps (thumbnail, tags) fail gracefully without blocking the save.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { ISharer } from "$lib/shared/share/services/contracts/ISharer";
import type { IFirebaseVideoUploader } from "$lib/shared/share/services/contracts/IFirebaseVideoUploader";
import type { ITagManager } from "../contracts/ITagManager";
import type { ILibraryRepository } from "../contracts/ILibraryRepository";
import { TAG_COLORS } from "../../domain/models/Tag";
import { DEFAULT_SHARE_OPTIONS } from "$lib/shared/share/domain/models/ShareOptions";
import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
import type {
  ILibrarySaveService,
  SaveToLibraryOptions,
  SaveProgress,
  SaveResult,
} from "../contracts/ILibrarySaveService";
import { container } from "$lib/shared/di";
import type { IErrorHandler } from "$lib/shared/application/services/contracts/IErrorHandler";

export class LibrarySaveService implements ILibrarySaveService {
  private readonly shareService: ISharer | null;
  private readonly uploadService: IFirebaseVideoUploader | null;
  private readonly tagService: ITagManager | null;
  private readonly libraryRepository: ILibraryRepository;

  constructor(
    shareService: ISharer | null,
    uploadService: IFirebaseVideoUploader | null,
    tagService: ITagManager | null,
    libraryRepository: ILibraryRepository
  ) {
    this.shareService = shareService ?? null;
    this.uploadService = uploadService ?? null;
    this.tagService = tagService ?? null;
    this.libraryRepository = libraryRepository;
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

    // Step 3: Create any new tags
    emitProgress(3);
    await this.createNewTags(tags);

    // Step 4: Save sequence to Firestore
    emitProgress(4);
    let savedSequence;
    try {
      savedSequence = await this.libraryRepository.saveSequenceWithMetadata(
        sequence,
        {
          name,
          displayName: displayName || undefined,
          visibility,
          tags,
          notes,
          thumbnailUrl,
        }
      );
    } catch (error) {
      const errorHandler = container.items.errorHandler as IErrorHandler;
      errorHandler.showUserError({
        message: "Couldn't save to your library",
        technicalDetails: error instanceof Error ? error.message : String(error),
        error: error instanceof Error ? error : new Error(String(error)),
        severity: "error",
        context: {
          module: "library",
          action: "save-to-library",
          additionalData: { sequenceName: name, visibility },
        },
      });
      throw error;
    }
    const sequenceId = savedSequence.id;

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
      2: "Uploading preview",
      3: "Creating tags",
      4: "Saving to library",
      5: "Syncing data",
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
      // Don't fail the entire save if thumbnail generation fails — show a warning instead
      console.error(
        "[LibrarySaveService] Failed to generate/upload thumbnail:",
        error
      );
      const errorHandler = container.items.errorHandler as IErrorHandler;
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
    if (tags.length === 0 || !this.tagService) {
      return;
    }

    try {
      for (const tagName of tags) {
        const normalized = tagName.toLowerCase().trim();
        const existing = await this.tagService.findTagByName(normalized);

        if (!existing) {
          // Create new tag with random color
          const randomColor =
            TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
          await this.tagService.createTag(normalized, { color: randomColor });
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
        await import("$lib/features/library/state/library-state.svelte");
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
