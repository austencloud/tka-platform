/**
 * Interface for managing the Night Sky Lab canvas and animation lifecycle
 */

import type { NightSkyBackgroundSystem } from "$lib/shared/background/night-sky/services/NightSkyBackgroundSystem";
import type { QualityLevel } from "$lib/shared/background/shared/domain/types/background-types";

export interface NightSkyLayers {
  stars: boolean;
  nebula: boolean;
  aurora: boolean;
  milkyWay: boolean;
  meteors: boolean;
  comets: boolean;
  ufo: boolean;
}

export interface INightSkyLabController {
  /**
   * Initialize the animation system with a canvas
   */
  initialize(canvas: HTMLCanvasElement, quality: QualityLevel, layers: NightSkyLayers): void;

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
   * Regenerate the scene with current settings
   */
  regenerate(quality: QualityLevel, layers: NightSkyLayers): void;

  /**
   * Set layer visibility
   */
  setLayerVisibility(layers: NightSkyLayers): void;

  /**
   * Get the underlying background system for direct commands
   */
  getSystem(): NightSkyBackgroundSystem | null;

  /**
   * Check if system is initialized
   */
  isInitialized(): boolean;

  /**
   * Handle canvas click for interactions
   */
  handleCanvasClick(clickX: number, clickY: number): void;
}
