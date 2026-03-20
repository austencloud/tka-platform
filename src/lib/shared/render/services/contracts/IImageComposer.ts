import type { SequenceData } from "../../../foundation/domain/models/SequenceData";
import type {
  CompositionOptions,
  LayoutData,
  SequenceExportOptions,
} from "../../domain/models/SequenceExportOptions";

/**
 * Progress callback for tracking image composition
 */
export type CompositionProgressCallback = (progress: {
  current: number;
  total: number;
  stage: "preparing" | "rendering" | "finalizing";
}) => void;

/**
 * Image composition service for assembling final images
 * Equivalent to desktop ImageCreator
 */
export interface IImageComposer {
  /**
   * Compose complete sequence image from rendered steps
   * @param onProgress Optional callback for progress tracking
   */
  composeSequenceImage(
    sequence: SequenceData,
    options: Partial<SequenceExportOptions>,
    onProgress?: CompositionProgressCallback
  ): Promise<HTMLCanvasElement>;

  /**
   * Compose a sequence image sized to a playing-card aspect ratio (5:7).
   * Header pins to top, footer pins to bottom, grid centers vertically.
   * Used for physical card export only (cardMode), NOT for printMode.
   */
  composeCardImage(
    sequence: SequenceData,
    options: Partial<SequenceExportOptions>,
    onProgress?: CompositionProgressCallback
  ): Promise<HTMLCanvasElement>;

  /**
   * Compose image from pre-rendered canvases
   */
  composeFromCanvases(
    beatCanvases: HTMLCanvasElement[],
    startPositionCanvas: HTMLCanvasElement | null,
    layoutData: LayoutData,
    options: CompositionOptions
  ): Promise<HTMLCanvasElement>;

  /**
   * Apply background and borders
   */
  applyBackground(
    canvas: HTMLCanvasElement,
    backgroundColor?: string
  ): HTMLCanvasElement;

  /**
   * Optimize canvas for export
   */
  optimizeForExport(canvas: HTMLCanvasElement): HTMLCanvasElement;

  /**
   * Get cache statistics for debugging/monitoring
   * Returns stats for both Layer 1 (IndexedDB) and Layer 2 (Memory) caches
   */
  getCacheStats(): {
    // Layer 2 (Memory) stats
    memoryCacheSize: number;
    memoryCacheMaxEntries: number;
    layer2Hits: number;
    layer2Misses: number;
    layer2HitRate: string;
    // Layer 1 (IndexedDB) stats
    layer1Hits: number;
    layer1Misses: number;
    layer1HitRate: string;
    // Combined stats
    totalHits: number;
    totalMisses: number;
    overallHitRate: string;
  };

  /**
   * Get Layer 1 (IndexedDB) cache statistics
   * This is async because it queries IndexedDB
   */
  getLayer1Stats(): Promise<{ count: number; sizeBytes: number }>;

  /**
   * Clear all caches
   * @param includeIndexedDB If true, also clears the persistent IndexedDB cache
   */
  clearCache(includeIndexedDB?: boolean): Promise<void>;
}
