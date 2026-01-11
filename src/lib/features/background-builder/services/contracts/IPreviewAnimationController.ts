/**
 * Interface for managing the Firefly Forest preview animation
 */

import type { FireflyForestLayers } from "$lib/shared/background/firefly-forest/services/FireflyForestBackgroundSystem";
import type { TreeTypeVisibility } from "$lib/shared/background/firefly-forest/services/TreeSilhouetteSystem";
import type { QualityLevel } from "$lib/shared/background/shared/domain/types/background-types";

export interface PreviewStats {
  fireflies: number;
  stars: number;
  ambientParticles: number;
  hasShootingStar: boolean;
}

export interface PlacementConfig {
  density: number;
  style: number;
}

export interface IPreviewAnimationController {
  /**
   * Initialize the animation system with a canvas
   */
  initialize(canvas: HTMLCanvasElement, quality: QualityLevel, layers: FireflyForestLayers): void;

  /**
   * Start the animation loop
   */
  start(): void;

  /**
   * Stop the animation loop
   */
  stop(): void;

  /**
   * Handle canvas resize
   */
  handleResize(): void;

  /**
   * Clean up resources
   */
  cleanup(): void;

  /**
   * Regenerate the scene
   */
  regenerate(): void;

  /**
   * Set quality level
   */
  setQuality(quality: QualityLevel): void;

  /**
   * Set layer visibility
   */
  setLayerVisibility(layers: FireflyForestLayers): void;

  /**
   * Set tree type visibility
   */
  setTreeVisibility(treeTypes: TreeTypeVisibility): void;

  /**
   * Apply placement configuration
   */
  applyPlacement(config: PlacementConfig): void;

  /**
   * Reset placement to defaults
   */
  resetPlacement(): void;

  /**
   * Update mouse position for interactive effects
   */
  updateMousePosition(clientX: number, clientY: number): void;

  /**
   * Reset mouse position (on mouse leave)
   */
  resetMousePosition(): void;

  /**
   * Get current stats
   */
  getStats(): PreviewStats;

  /**
   * Check if system is initialized
   */
  isInitialized(): boolean;
}
