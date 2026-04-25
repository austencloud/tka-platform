/**
 * Composite Video Renderer Interface
 *
 * Renders composite video frames (animation + grid side-by-side) with synchronized
 * beat highlighting. This is the core service for the "fantastic and essential"
 * composite export feature.
 *
 * Architecture:
 * 1. Pre-cache static grid once for performance (reused across all frames)
 * 2. For each frame: draw animation + cached grid + gold beat highlight
 * 3. Calculate beat grid position from beat index
 * 4. Render synchronized highlighting (matches workspace preview style)
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export interface CompositeDimensions {
  width: number;
  height: number;
}

export interface CompositeLayoutOptions {
  orientation: "horizontal" | "vertical";
  gridStepSize: number; // Size of each beat cell in pixels
  includeStartPosition: boolean;
  showStepNumbers: boolean;
}

export interface StepGridPosition {
  col: number; // Column index (0-based)
  row: number; // Row index (0-based)
  x: number; // Pixel X coordinate
  y: number; // Pixel Y coordinate
  width: number; // Beat cell width
  height: number; // Beat cell height
}

export interface ICompositeVideoRenderer {
  /**
   * Initialize the renderer with sequence and layout options.
   * Calculates dimensions and prepares for rendering.
   *
   * @param sequence The sequence data to render
   * @param options Layout and grid options
   * @returns Promise that resolves when initialization is complete
   */
  initialize(
    sequence: SequenceData,
    options: CompositeLayoutOptions
  ): Promise<void>;

  /**
   * Pre-cache the static grid rendering (called once before export loop).
   * This significantly improves performance by reusing the grid across all frames.
   *
   * @returns Promise that resolves when grid is cached
   */
  cacheStaticGrid(): Promise<void>;

  /**
   * Render a composite frame (animation + grid + beat highlight) to target canvas.
   * Should be called for each video frame during export.
   *
   * @param animationCanvas The canvas containing the current animation frame
   * @param currentStep The current beat index for highlighting (0-based)
   * @param targetCanvas The target canvas to render the composite frame to
   */
  renderCompositeFrame(
    animationCanvas: HTMLCanvasElement,
    currentStep: number,
    targetCanvas: HTMLCanvasElement
  ): void;

  /**
   * Calculate the grid position for a specific beat index.
   * Used for highlighting the current beat in the grid.
   *
   * @param stepIndex The beat index (0-based)
   * @returns Grid position with column, row, and pixel coordinates
   */
  getStepGridPosition(stepIndex: number): StepGridPosition;

  /**
   * Get the composite canvas dimensions based on orientation.
   * Used by VideoExportOrchestrator to set canvas size.
   *
   * @returns Width and height in pixels
   */
  getCompositeDimensions(): CompositeDimensions;

  /**
   * Clean up resources (offscreen canvases, etc.)
   */
  dispose(): void;
}
