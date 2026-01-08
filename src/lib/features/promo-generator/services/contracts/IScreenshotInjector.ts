/**
 * Screenshot Injector Contract
 *
 * Handles mapping screenshot images to the device screen mesh texture.
 * Supports dynamic texture updates for multi-screen animations.
 */

import type * as THREE from "three";
import type { ScreenshotContent } from "../../domain/promo-models";

export interface IScreenshotInjector {
  /**
   * Initialize the injector with a target mesh
   * @param screenMesh - The mesh to map textures onto
   */
  initialize(screenMesh: THREE.Mesh): void;

  /**
   * Load and apply a screenshot to the screen mesh
   * @param source - Image source (URL, path, or base64 data URL)
   * @returns Promise resolving when the texture is applied
   */
  loadScreenshot(source: string): Promise<void>;

  /**
   * Load multiple screenshots for animation sequences
   * @param screenshots - Array of screenshot content with timing
   * @returns Promise resolving when all textures are preloaded
   */
  preloadScreenshots(screenshots: ScreenshotContent[]): Promise<void>;

  /**
   * Get the screenshot that should be active at a given time
   * @param normalizedTime - Time position (0-1)
   * @returns The active screenshot source, or null if none
   */
  getActiveScreenshot(normalizedTime: number): string | null;

  /**
   * Update the screen texture to show the appropriate screenshot for a time
   * @param normalizedTime - Time position (0-1)
   */
  updateForTime(normalizedTime: number): void;

  /**
   * Apply a texture directly to the screen mesh
   * @param texture - The Three.js texture to apply
   */
  applyTexture(texture: THREE.Texture): void;

  /**
   * Get the current texture
   */
  getCurrentTexture(): THREE.Texture | null;

  /**
   * Clear all loaded textures and release memory
   */
  dispose(): void;
}
