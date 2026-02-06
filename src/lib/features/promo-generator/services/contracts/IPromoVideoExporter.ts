/**
 * Promo Video Exporter Contract
 *
 * Handles rendering the 3D scene animation to video format.
 * Uses h264-mp4-encoder/mp4-muxer for high-quality MP4 output.
 */

import type * as THREE from "three";
import type {
  ExportConfig,
  ExportResolution,
  ExportFormat,
} from "../../domain/promo-models";

/**
 * Export progress callback
 */
export type ExportProgressCallback = (
  progress: number,
  stage: ExportStage
) => void;

/**
 * Export stages for progress reporting
 */
export type ExportStage =
  | "preparing"
  | "rendering"
  | "encoding"
  | "finalizing"
  | "complete";

/**
 * Export result
 */
export interface ExportResult {
  /** Whether the export succeeded */
  success: boolean;
  /** The exported video blob (if successful) */
  blob?: Blob;
  /** Download URL for the video */
  url?: string;
  /** Error message (if failed) */
  error?: string;
  /** Export duration in milliseconds */
  duration?: number;
  /** File size in bytes */
  fileSize?: number;
}

export interface IPromoVideoExporter {
  /**
   * Initialize the exporter with a renderer
   * @param renderer - The Three.js WebGL renderer
   * @param scene - The Three.js scene
   * @param camera - The Three.js camera
   */
  initialize(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera
  ): void;

  /**
   * Export the animation to video
   * @param config - Export configuration
   * @param animationDuration - Total animation duration in seconds
   * @param renderFrame - Function to call for each frame render
   * @param onProgress - Optional progress callback
   * @returns Promise resolving to the export result
   */
  export(
    config: ExportConfig,
    animationDuration: number,
    renderFrame: (normalizedTime: number) => void,
    onProgress?: ExportProgressCallback
  ): Promise<ExportResult>;

  /**
   * Cancel an in-progress export
   */
  cancel(): void;

  /**
   * Check if an export is currently in progress
   */
  isExporting(): boolean;

  /**
   * Get estimated file size for export config
   * @param config - Export configuration
   * @param duration - Animation duration in seconds
   * @returns Estimated file size in bytes
   */
  estimateFileSize(config: ExportConfig, duration: number): number;

  /**
   * Get supported export formats
   */
  getSupportedFormats(): ExportFormat[];

  /**
   * Get supported resolutions
   */
  getSupportedResolutions(): ExportResolution[];

  /**
   * Download the last exported video
   * @param filename - Optional filename override
   */
  downloadLastExport(filename?: string): void;

  /**
   * Dispose of exporter resources
   */
  dispose(): void;
}
