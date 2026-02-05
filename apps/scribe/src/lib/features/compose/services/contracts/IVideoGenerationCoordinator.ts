import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type {
  VideoRenderProgress,
  VideoRenderResult,
} from "./IVideoPreRenderer";

/**
 * Video generation options
 */
export interface VideoGenerationOptions {
  fps?: number;
  quality?: number;
  width?: number;
  height?: number;
}

/**
 * IVideoGenerationCoordinator
 *
 * Orchestrates video generation workflow including:
 * - Cache checking
 * - Progress tracking
 * - Error handling
 * - Generation lifecycle management
 */
export interface IVideoGenerationCoordinator {
  /**
   * Check if a cached video exists for the sequence
   * @param sequenceData The sequence to check
   * @returns The cached video result if it exists, null otherwise
   */
  checkCachedVideo(
    sequenceData: SequenceData
  ): Promise<VideoRenderResult | null>;

  /**
   * Start generating a video for the sequence
   * @param sequenceData The sequence to render
   * @param options Video generation options
   * @param onProgress Callback for progress updates
   * @returns The generated video result
   */
  generateVideo(
    sequenceData: SequenceData,
    options?: VideoGenerationOptions,
    onProgress?: (progress: VideoRenderProgress) => void
  ): Promise<VideoRenderResult>;

  /**
   * Cancel the current video generation
   */
  cancelGeneration(): void;

  /**
   * Check if video generation is currently in progress
   */
  isGenerating(): boolean;
}
