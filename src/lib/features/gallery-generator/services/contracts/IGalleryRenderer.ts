/**
 * Gallery Renderer Contract
 *
 * Renders sequences to image blobs for gallery export.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { BatchRenderResult } from "../../domain/gallery-models";

export interface IGalleryRenderer {
  /**
   * Render a single sequence to a blob
   */
  renderSequence(sequence: SequenceData, lightMode: boolean): Promise<Blob>;

  /**
   * Render a batch of sequences in parallel
   */
  renderBatch(
    sequences: SequenceData[],
    lightMode: boolean
  ): Promise<BatchRenderResult[]>;

  /**
   * Check if a sequence requires non-radial points to be shown
   */
  requiresNonRadialPoints(sequence: SequenceData): boolean;
}
