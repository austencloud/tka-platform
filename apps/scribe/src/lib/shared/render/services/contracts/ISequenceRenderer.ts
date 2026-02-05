/**
 * Main Sequence Render Service Interface
 *
 * Pure image generation service - no download/sharing logic.
 * Provides clean API for rendering TKA sequences as images.
 */

import type { SequenceData } from "../../../foundation/domain/models/SequenceData";
import type { SequenceExportOptions } from "../../domain/models/SequenceExportOptions";
import type { CompositionProgressCallback } from "./IImageComposer";

export interface ISequenceRenderer {
  /**
   * Render a complete sequence as a canvas
   * Pure rendering - returns canvas for further processing
   */
  renderSequenceToCanvas(
    sequence: SequenceData,
    options?: Partial<SequenceExportOptions>,
    onProgress?: CompositionProgressCallback
  ): Promise<HTMLCanvasElement>;

  /**
   * Render a sequence as an image blob
   * For use by sharing/export modules
   */
  renderSequenceToBlob(
    sequence: SequenceData,
    options?: Partial<SequenceExportOptions>,
    onProgress?: CompositionProgressCallback
  ): Promise<Blob>;

  /**
   * Generate a preview image (smaller scale for UI)
   * Returns data URL for immediate display in components
   */
  generatePreview(
    sequence: SequenceData,
    options?: Partial<SequenceExportOptions>
  ): Promise<string>;

  /**
   * Validate sequence and options before rendering
   * Returns validation result with specific error messages
   */
  validateRender(
    sequence: SequenceData,
    options: SequenceExportOptions
  ): { valid: boolean; errors: string[] };

  /**
   * Get default render options
   * Returns desktop-compatible default settings
   */
  getDefaultOptions(): SequenceExportOptions;

  /**
   * Batch render multiple sequences
   * Returns array of canvases for further processing
   */
  batchRender(
    sequences: SequenceData[],
    options: SequenceExportOptions
  ): Promise<HTMLCanvasElement[]>;
}
