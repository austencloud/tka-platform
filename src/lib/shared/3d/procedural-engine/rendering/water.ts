/**
 * Water Renderer
 *
 * Simple stylized water for ocean biomes.
 * Uses MeshPhysicalMaterial for WebGPU compatibility.
 */

import type {
  Vector3} from "three";
import {
  PlaneGeometry,
  Mesh,
  Color,
  DoubleSide,
  MeshPhysicalMaterial,
  type Scene,
} from "three";


export interface WaterConfig {
  size: number;
  segments: number;
  color: string;
  opacity: number;
  waterLevel: number;
  roughness: number;
  metalness: number;
}


const DEFAULT_WATER_CONFIG: WaterConfig = {
  size: 500, // 500 meters - large ocean surface
  segments: 64,
  color: "#2a8faa",
  opacity: 0.8,
  waterLevel: 3,
  roughness: 0.1,
  metalness: 0.1,
};


export class WaterManager {
  private scene: Scene;
  private waterMesh: Mesh | null = null;
  private waterMaterial: MeshPhysicalMaterial | null = null;
  private config: WaterConfig;

  constructor(scene: Scene, config: Partial<WaterConfig> = {}) {
    this.scene = scene;
    this.config = { ...DEFAULT_WATER_CONFIG, ...config };
  }

  /**
   * Create the water plane
   */
  create(): void {
    const { size, segments, waterLevel } = this.config;

    // Create water material using MeshPhysicalMaterial (WebGPU compatible)
    this.waterMaterial = new MeshPhysicalMaterial({
      color: new Color(this.config.color),
      transparent: true,
      opacity: this.config.opacity,
      side: DoubleSide,
      roughness: this.config.roughness,
      metalness: this.config.metalness,
      envMapIntensity: 0.5,
      clearcoat: 0.3,
      clearcoatRoughness: 0.2,
    });

    const waterGeometry = new PlaneGeometry(size, size, segments, segments);
    waterGeometry.rotateX(-Math.PI / 2);

    this.waterMesh = new Mesh(waterGeometry, this.waterMaterial);
    this.waterMesh.position.y = waterLevel;
    this.waterMesh.renderOrder = 100;

    this.scene.add(this.waterMesh);
  }

  /**
   * Update water position to follow camera
   */
  update(time: number, cameraX: number, cameraZ: number): void {
    // Keep water centered on camera for infinite water effect
    if (this.waterMesh) {
      this.waterMesh.position.x = cameraX;
      this.waterMesh.position.z = cameraZ;
    }
  }

  /**
   * Set sun direction (unused with physical material but kept for API compatibility)
   */
  setSunDirection(_direction: Vector3): void {
    // Physical material uses scene lights automatically
  }

  setWaterLevel(level: number): void {
    this.config.waterLevel = level;
    if (this.waterMesh) {
      this.waterMesh.position.y = level;
    }
  }

  /**
   * Toggle water visibility
   */
  setVisible(visible: boolean): void {
    if (this.waterMesh) {
      this.waterMesh.visible = visible;
    }
  }

  /**
   * Get current water state for debug display
   */
  getState(): {
    visible: boolean;
    waterLevel: number;
    color: string;
    opacity: number;
  } {
    return {
      visible: this.waterMesh?.visible ?? false,
      waterLevel: this.config.waterLevel,
      color: this.config.color,
      opacity: this.config.opacity,
    };
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    if (this.waterMesh) {
      this.scene.remove(this.waterMesh);
      this.waterMesh.geometry.dispose();
    }
    if (this.waterMaterial) {
      this.waterMaterial.dispose();
    }
  }
}
