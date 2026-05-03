/**
 * IThumbnailRenderer
 *
 * Pure render logic: sequence + input → blob.
 * Extracts the rendering responsibility from PropAwareThumbnail.
 *
 * Handles:
 * - Loading full sequence data if needed (via PublicSequencesLoader)
 * - Deriving start position if missing (via StartPositionDeriver)
 * - Applying prop type overrides
 * - Rendering via SequenceRenderer pipeline
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { ThumbnailRenderInput } from "./IThumbnailKeyDeriver";

export interface RenderOptions {
  /** Beat size in pixels (default: 240) */
  stepSize?: number;

  /** Output format (default: WebP) */
  format?: "WebP" | "PNG" | "JPEG";

  /** Quality for lossy formats 0-1 (default: 0.9) */
  quality?: number;
}

/**
 * Progress callback for tracking render progress.
 */
export type RenderProgressCallback = (progress: {
  current: number;
  total: number;
  stage: "preparing" | "rendering" | "finalizing";
}) => void;

export interface IThumbnailRenderer {
  /**
   * Render a sequence to a blob image.
   * Pure function - same inputs always produce same output.
   *
   * The sequence may have partial data (e.g., no steps).
   * This method handles loading full data if needed.
   *
   * @param sequence The sequence to render (may be partial)
   * @param input Render configuration (props, light mode, composition settings)
   * @param options Optional format/quality settings
   * @param onProgress Optional callback for progress updates during rendering
   * @returns Blob containing the rendered image
   */
  render(
    sequence: SequenceData,
    input: ThumbnailRenderInput,
    options?: RenderOptions,
    onProgress?: RenderProgressCallback,
    signal?: AbortSignal
  ): Promise<Blob>;
}
