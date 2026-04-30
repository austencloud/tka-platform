/**
 * IFireOverlayRenderer
 *
 * Interface for the WebGL fire shader overlay that composites
 * procedural flames on top of the Canvas2D animation.
 */

import type { FireFrameInput, FireOverlayConfig } from "../../domain/types/FireTypes";

export interface IFireOverlayRenderer {
  /**
   * Create the WebGL canvas and compile shaders.
   * @param container - Parent element to append the overlay canvas into
   * @param width - Initial canvas width in CSS pixels
   * @param height - Initial canvas height in CSS pixels
   */
  initialize(container: HTMLElement, width: number, height: number): boolean;

  /**
   * Resize the overlay canvas (e.g., when container resizes).
   */
  resize(width: number, height: number): void;

  /**
   * Render one frame of fire.
   * Called after Canvas2D renderScene() in the same RAF tick.
   */
  renderFire(input: FireFrameInput, config: FireOverlayConfig): void;

  /**
   * Update quality level (FBM octave count) for frame budget adaptation.
   * @param octaves - Number of FBM octaves (2 = low, 4 = high)
   */
  setQuality(octaves: number): void;

  /**
   * Clear all simulation buffers (velocity, temperature, fuel, soot, pressure, color).
   * Used on loop boundaries to prevent residual fire state from bleeding across loops.
   */
  clearSimulation(): void;

  /**
   * Invalidate the frame cache without clearing simulation FBOs.
   * Keeps the warm Navier-Stokes state while forcing fresh frame recording.
   */
  invalidateFrameCache(): void;

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
   * Returns null if not yet initialized.
   */
  getCanvas(): HTMLCanvasElement | null;

  /**
   * Set the CSS z-index on the overlay canvas.
   */
  setCanvasZIndex(z: number): void;

  /**
   * Get the WebGL2 rendering context.
   * Returns null if not yet initialized.
   */
  getGl(): WebGL2RenderingContext | null;

  // --- EXPORT DIAGNOSTIC (remove after debugging) ---
  enableDiagnostics(): void;
  disableDiagnostics(): void;
}
