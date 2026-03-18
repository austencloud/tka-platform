/**
 * IImageStager
 *
 * Uploads feedback images to a staging area immediately on attach,
 * so submit is instant. Supports cancellation and cleanup.
 */

import type { StagedImageState } from "../../domain/models/feedback-models";

/**
 * Callback invoked as a staged image upload progresses.
 */
export type StagedProgressCallback = (state: StagedImageState) => void;

/**
 * Handle returned from stageImage() for cancellation.
 */
export interface StagedUploadHandle {
  /** Resolves with the download URL on success, rejects on failure */
  promise: Promise<string>;
  /** Cancel the in-flight upload */
  cancel: () => void;
  /** The storage path (for deletion after upload completes) */
  storagePath: string;
}

export interface IImageStager {
  /**
   * Start uploading an image to the staging area immediately.
   * Returns a handle with a promise, cancel function, and storage path.
   */
  stageImage(
    file: File,
    userId: string,
    onProgress: StagedProgressCallback
  ): StagedUploadHandle;

  /**
   * Delete a staged image from storage (used on image removal or cleanup).
   */
  deleteStaged(storagePath: string): Promise<void>;
}
