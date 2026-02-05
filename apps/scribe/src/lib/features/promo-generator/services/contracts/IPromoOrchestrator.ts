/**
 * Promo Orchestrator Contract
 *
 * Main entry point for the promo generator feature.
 * Coordinates scene management, animations, and video export.
 */

import type {
  DeviceType,
  EnvironmentType,
  EnvironmentConfig,
  AnimationPreset,
  ExportConfig,
  PromoGeneratorState,
  ScreenshotContent,
} from "../../domain/promo-models";
import type { ExportResult, ExportProgressCallback } from "./IPromoVideoExporter";
import type { AnimationProgressCallback } from "./IPromoAnimationController";

export interface IPromoOrchestrator {
  /**
   * Initialize the promo generator with a canvas
   * @param canvas - The HTML canvas element
   * @param width - Initial width
   * @param height - Initial height
   */
  initialize(
    canvas: HTMLCanvasElement,
    width: number,
    height: number
  ): Promise<void>;

  /**
   * Load a device model
   * @param device - Device type or path to custom model
   */
  loadDevice(device: DeviceType | string): Promise<void>;

  /**
   * Load a screenshot onto the device screen
   * @param source - Image source (URL, path, or base64)
   */
  loadScreenshot(source: string): Promise<void>;

  /**
   * Load multiple screenshots for animated sequences
   * @param screenshots - Array of screenshot content with timing
   */
  loadScreenshots(screenshots: ScreenshotContent[]): Promise<void>;

  /**
   * Set the environment/lighting
   * @param environment - Environment type or custom config
   */
  setEnvironment(environment: EnvironmentType | EnvironmentConfig): void;

  /**
   * Load an animation preset
   * @param presetId - The preset identifier
   */
  usePreset(presetId: string): void;

  /**
   * Load a custom animation preset
   * @param preset - The custom preset definition
   */
  useCustomPreset(preset: AnimationPreset): void;

  /**
   * Preview the animation (plays in the canvas)
   * @param onProgress - Optional progress callback
   */
  preview(onProgress?: AnimationProgressCallback): void;

  /**
   * Pause the preview
   */
  pausePreview(): void;

  /**
   * Resume a paused preview
   */
  resumePreview(): void;

  /**
   * Stop the preview
   */
  stopPreview(): void;

  /**
   * Seek preview to a specific time
   * @param normalizedTime - Time position (0-1)
   */
  seekPreview(normalizedTime: number): void;

  /**
   * Export the animation to video
   * @param config - Export configuration
   * @param onProgress - Optional progress callback
   */
  export(
    config: ExportConfig,
    onProgress?: ExportProgressCallback
  ): Promise<ExportResult>;

  /**
   * Cancel an in-progress export
   */
  cancelExport(): void;

  /**
   * Get the current state
   */
  getState(): PromoGeneratorState;

  /**
   * Subscribe to state changes
   * @param callback - Callback for state updates
   * @returns Unsubscribe function
   */
  subscribe(callback: (state: PromoGeneratorState) => void): () => void;

  /**
   * Get available animation presets
   */
  getAvailablePresets(): AnimationPreset[];

  /**
   * Get available device types
   */
  getAvailableDevices(): DeviceType[];

  /**
   * Resize the renderer
   * @param width - New width
   * @param height - New height
   */
  resize(width: number, height: number): void;

  /**
   * Render a single frame (for manual control)
   */
  render(): void;

  /**
   * Dispose of all resources
   */
  dispose(): void;
}
