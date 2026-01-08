/**
 * Promo Scene Manager Contract
 *
 * Manages the Three.js scene for 3D device mockup rendering.
 * Handles device model loading, environment setup, and scene lifecycle.
 */

import type * as THREE from "three";
import type {
  DeviceType,
  DeviceConfig,
  EnvironmentConfig,
  EnvironmentType,
  SceneRefs,
} from "../../domain/promo-models";

export interface IPromoSceneManager {
  /**
   * Initialize the scene with a canvas element
   * @param canvas - The HTML canvas element for rendering
   * @param width - Initial width
   * @param height - Initial height
   */
  initialize(
    canvas: HTMLCanvasElement,
    width: number,
    height: number
  ): Promise<void>;

  /**
   * Load a device model into the scene
   * @param deviceType - The type of device to load
   * @returns Promise resolving when the model is loaded
   */
  loadDevice(deviceType: DeviceType): Promise<void>;

  /**
   * Load a device model from a custom path
   * @param modelPath - Path to the GLB/GLTF model
   * @param screenMeshName - Name of the screen mesh in the model
   */
  loadDeviceFromPath(modelPath: string, screenMeshName?: string): Promise<void>;

  /**
   * Set the environment/lighting for the scene
   * @param environment - Environment configuration or preset type
   */
  setEnvironment(environment: EnvironmentType | EnvironmentConfig): void;

  /**
   * Get the current scene references
   */
  getSceneRefs(): SceneRefs;

  /**
   * Get the current device model
   */
  getDevice(): THREE.Group | null;

  /**
   * Get the screen mesh for texture mapping
   */
  getScreenMesh(): THREE.Mesh | null;

  /**
   * Get the camera
   */
  getCamera(): THREE.PerspectiveCamera | null;

  /**
   * Get the renderer
   */
  getRenderer(): THREE.WebGLRenderer | null;

  /**
   * Resize the renderer
   * @param width - New width
   * @param height - New height
   */
  resize(width: number, height: number): void;

  /**
   * Render a single frame
   */
  render(): void;

  /**
   * Get available device configurations
   */
  getAvailableDevices(): DeviceConfig[];

  /**
   * Dispose of all scene resources
   */
  dispose(): void;
}
