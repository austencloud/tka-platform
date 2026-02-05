/**
 * Share Service Contract
 *
 * Simple, focused interface for sharing/downloading sequences.
 * Replaces the over-engineered export module.
 */

import type { SequenceData } from "../../../foundation/domain/models/SequenceData";
import type { ShareOptions } from "../../domain/models/ShareOptions";

/**
 * Progress callback for image generation
 */
export type ImageGenerationProgressCallback = (progress: {
  current: number;
  total: number;
  stage: "preparing" | "rendering" | "finalizing";
}) => void;

export interface ISharer {
  /**
   * Generate a preview image for the share interface
   * Returns data URL for immediate display
   * @param forceRegenerate - Skip cache and regenerate preview
   */
  generatePreview(
    sequence: SequenceData,
    options: ShareOptions,
    forceRegenerate?: boolean
  ): Promise<string>;

  /**
   * Download sequence as image file
   * Simple download functionality - the core feature users need
   */
  downloadImage(
    sequence: SequenceData,
    options: ShareOptions,
    filename?: string
  ): Promise<void>;

  /**
   * Get image as blob for future sharing features
   * Prepares for social media integration
   * @param onProgress - Optional callback for progress tracking during rendering
   */
  getImageBlob(
    sequence: SequenceData,
    options: ShareOptions,
    onProgress?: ImageGenerationProgressCallback
  ): Promise<Blob>;

  /**
   * Generate appropriate filename for the sequence
   */
  generateFilename(sequence: SequenceData, options: ShareOptions): string;

  /**
   * Validate share options
   */
  validateOptions(options: ShareOptions): { valid: boolean; errors: string[] };

  /**
   * Share sequence via device's native share functionality
   * Handles Web Share API with file sharing and fallbacks
   */
  shareViaDevice(sequence: SequenceData, options: ShareOptions): Promise<void>;

  /**
   * Try to get a cached image blob if available for the given sequence and options
   * Returns null if no cached version exists or options don't match
   * This allows reusing already-generated previews without re-composing
   */
  getCachedBlobIfAvailable(
    sequence: SequenceData,
    options: ShareOptions
  ): Promise<Blob | null>;
}
