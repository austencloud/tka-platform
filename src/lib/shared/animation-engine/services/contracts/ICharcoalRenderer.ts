/**
 * ICharcoalRenderer
 *
 * Interface for the WebGL2 charcoal spark particle system overlay.
 * Discrete spark particles with gravity physics, burst emission on
 * direction reversals, and temperature-based color gradients.
 *
 * Architecturally independent from IFireOverlayRenderer - different
 * physics (gravity+drag vs Navier-Stokes), different shaders
 * (point sprites vs fluid sim), different visual output.
 */

import type { FireFrameInput, FireOverlayConfig } from "../../domain/types/FireTypes";
import type { CharcoalSparkParams } from "../../domain/types/CharcoalSparkTypes";

export interface ICharcoalRenderer {
  /**
   * Create the WebGL canvas and compile shaders.
   */
  initialize(container: HTMLElement, width: number, height: number): boolean;

  /**
   * Resize the overlay canvas.
   */
  resize(width: number, height: number): void;

  /**
   * Render one frame of charcoal sparks.
   */
  renderCharcoal(input: FireFrameInput, config: FireOverlayConfig): void;

  /**
   * Update charcoal spark parameters (gravity, burst threshold, etc.).
   */
  setParams(params: CharcoalSparkParams): void;

  /**
   * Clear all active particles.
   */
  clearSimulation(): void;

  /**
   * Clean up WebGL resources and remove canvas from DOM.
   */
  dispose(): void;

  /**
   * Whether the renderer has been successfully initialized.
   */
  isInitialized(): boolean;

  /**
   * Get the overlay canvas element.
   */
  getCanvas(): HTMLCanvasElement | null;

  /**
   * Set the CSS z-index on the overlay canvas.
   */
  setCanvasZIndex(z: number): void;

  /**
   * Get the WebGL2 rendering context.
   */
  getGl(): WebGL2RenderingContext | null;
}
