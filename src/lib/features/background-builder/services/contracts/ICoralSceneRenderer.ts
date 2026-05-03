/**
 * Contract for placing and rendering coral silhouettes along the ocean floor.
 *
 * The renderer loads assets via CoralAssetLoader, distributes coral across
 * the canvas bottom with depth layering, and animates a gentle sway.
 */

import type { CoralDepthLayer } from "../../domain/coral-types";

export interface CoralSceneConfig {
  /** Total number of coral pieces to place (default 20) */
  totalCount?: number;
  /** Distribution per layer: [back, mid, front] (default [6, 8, 6]) */
  layerCounts?: [number, number, number];
}

export interface ICoralSceneRenderer {
  /**
   * Load assets and place coral across the scene.
   * Safe to call multiple times - skips if already initialized.
   */
  initialize(
    width: number,
    height: number,
    config?: CoralSceneConfig
  ): Promise<void>;

  /**
   * Advance sway animation by one frame.
   * @param frameMultiplier - delta time normalized to 60fps (1.0 = 16.67ms)
   */
  update(frameMultiplier: number): void;

  /**
   * Draw one depth layer to the provided canvas context.
   * Call once per layer in back -> mid -> front order.
   */
  drawLayer(
    ctx: CanvasRenderingContext2D,
    layer: CoralDepthLayer,
    width: number,
    height: number
  ): void;

  /**
   * Reposition coral proportionally after a canvas resize.
   */
  handleResize(
    oldWidth: number,
    oldHeight: number,
    newWidth: number,
    newHeight: number
  ): void;

  /**
   * Discard current placement and generate a new random arrangement.
   */
  regenerate(width: number, height: number): Promise<void>;

  /** Whether the renderer has loaded assets and placed coral */
  isReady(): boolean;

  /** Total number of placed coral pieces */
  getCoralCount(): number;

  /** Release all resources */
  cleanup(): void;
}
