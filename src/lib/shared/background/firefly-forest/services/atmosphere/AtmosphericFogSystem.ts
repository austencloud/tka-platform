/**
 * Atmospheric Fog System
 *
 * Creates layered fog effects for depth perception in the forest.
 * Combines multiple fog techniques:
 * - Distance-based color attenuation
 * - Ground fog with density gradient
 * - Wispy fog patches
 * - Mist layers between trees
 */

import { PerlinNoise } from "../noise/PerlinNoise";

export interface FogConfig {
  // Overall atmosphere
  enabled: boolean;
  density: number; // 0-1, overall fog thickness

  // Distance fog (atmospheric perspective)
  distanceFog: {
    enabled: boolean;
    nearColor: string;
    farColor: string;
    startDistance: number; // 0-1 depth where fog begins
    endDistance: number; // 0-1 depth where fog is full
  };

  // Ground fog (low-lying mist)
  groundFog: {
    enabled: boolean;
    color: string;
    maxHeight: number; // 0-1 of canvas height
    density: number; // 0-1
    waviness: number; // 0-1, how wavy the fog top edge is
    animationSpeed: number; // How fast fog moves
  };

  // Wispy fog patches
  wispyFog: {
    enabled: boolean;
    color: string;
    patchCount: number;
    opacity: number; // 0-1
    scale: number; // Size multiplier
    drift: number; // How much patches drift
  };

  // Mist layers (horizontal bands)
  mistLayers: {
    enabled: boolean;
    layerCount: number;
    color: string;
    minOpacity: number;
    maxOpacity: number;
  };
}

export interface FogLayer {
  type: "distance" | "ground" | "wispy" | "mist";
  depth: number; // 0-1 for rendering order
  opacity: number;
  data: FogPatch | GroundFogData | MistLayerData | null;
}

export interface FogPatch {
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  phase: number; // Animation phase
}

export interface GroundFogData {
  points: Array<{ x: number; y: number }>;
  color: string;
  opacity: number;
}

export interface MistLayerData {
  y: number;
  height: number;
  opacity: number;
  color: string;
}

const DEFAULT_CONFIG: FogConfig = {
  enabled: true,
  density: 0.5,

  distanceFog: {
    enabled: true,
    nearColor: "rgba(20, 30, 40, 0)",
    farColor: "rgba(15, 25, 35, 0.8)",
    startDistance: 0,
    endDistance: 1,
  },

  groundFog: {
    enabled: true,
    color: "rgba(180, 200, 210, 0.3)",
    maxHeight: 0.15,
    density: 0.6,
    waviness: 0.5,
    animationSpeed: 0.001,
  },

  wispyFog: {
    enabled: true,
    color: "rgba(150, 180, 200, 0.15)",
    patchCount: 8,
    opacity: 0.4,
    scale: 1,
    drift: 0.5,
  },

  mistLayers: {
    enabled: true,
    layerCount: 3,
    color: "rgba(100, 130, 160, 0.1)",
    minOpacity: 0.05,
    maxOpacity: 0.15,
  },
};

export class AtmosphericFogSystem {
  private config: FogConfig;
  private noise: PerlinNoise;
  private time: number = 0;
  private wispyPatches: FogPatch[] = [];
  private mistLayers: MistLayerData[] = [];
  private width: number;
  private height: number;

  constructor(
    width: number,
    height: number,
    config: Partial<FogConfig> = {},
    seed?: number
  ) {
    this.width = width;
    this.height = height;
    this.config = this.mergeConfig(DEFAULT_CONFIG, config);
    this.noise = new PerlinNoise(seed);

    this.initializeWispyPatches();
    this.initializeMistLayers();
  }

  private mergeConfig(defaults: FogConfig, overrides: Partial<FogConfig>): FogConfig {
    return {
      ...defaults,
      ...overrides,
      distanceFog: { ...defaults.distanceFog, ...overrides.distanceFog },
      groundFog: { ...defaults.groundFog, ...overrides.groundFog },
      wispyFog: { ...defaults.wispyFog, ...overrides.wispyFog },
      mistLayers: { ...defaults.mistLayers, ...overrides.mistLayers },
    };
  }

  private initializeWispyPatches(): void {
    const { patchCount, scale } = this.config.wispyFog;
    this.wispyPatches = [];

    for (let i = 0; i < patchCount; i++) {
      const baseWidth = (100 + Math.random() * 200) * scale;
      const baseHeight = (60 + Math.random() * 100) * scale;

      this.wispyPatches.push({
        x: Math.random() * this.width,
        y: this.height * (0.3 + Math.random() * 0.5), // Middle-lower portion
        width: baseWidth,
        height: baseHeight,
        opacity: 0.2 + Math.random() * 0.3,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  private initializeMistLayers(): void {
    const { layerCount, minOpacity, maxOpacity } = this.config.mistLayers;
    this.mistLayers = [];

    for (let i = 0; i < layerCount; i++) {
      const t = i / (layerCount - 1 || 1);
      this.mistLayers.push({
        y: this.height * (0.4 + t * 0.4), // Distribute in lower half
        height: 20 + Math.random() * 40,
        opacity: minOpacity + (maxOpacity - minOpacity) * Math.random(),
        color: this.config.mistLayers.color,
      });
    }
  }

  /**
   * Update fog animation state
   * @param deltaTime Time since last update in milliseconds
   */
  update(deltaTime: number): void {
    this.time += deltaTime;

    // Update wispy patches
    if (this.config.wispyFog.enabled) {
      this.updateWispyPatches(deltaTime);
    }
  }

  private updateWispyPatches(deltaTime: number): void {
    const { drift } = this.config.wispyFog;

    for (const patch of this.wispyPatches) {
      // Drift slowly
      patch.x += Math.sin(this.time * 0.0001 + patch.phase) * drift * 0.1;

      // Subtle vertical bob
      patch.y +=
        Math.cos(this.time * 0.00015 + patch.phase * 2) * drift * 0.05;

      // Wrap around
      if (patch.x > this.width + patch.width) {
        patch.x = -patch.width;
      } else if (patch.x < -patch.width) {
        patch.x = this.width + patch.width;
      }
    }
  }

  /**
   * Get distance fog opacity for a given depth value
   * @param depth 0-1, 0 = near, 1 = far
   */
  getDistanceFogOpacity(depth: number): number {
    if (!this.config.distanceFog.enabled) return 0;

    const { startDistance, endDistance } = this.config.distanceFog;
    const { density } = this.config;

    if (depth <= startDistance) return 0;
    if (depth >= endDistance) return density;

    const t = (depth - startDistance) / (endDistance - startDistance);
    return t * density;
  }

  /**
   * Get fog color at a specific depth (for blending with tree colors)
   * @param depth 0-1
   */
  getDistanceFogColor(depth: number): string {
    const { nearColor, farColor } = this.config.distanceFog;
    return this.lerpColorString(nearColor, farColor, depth);
  }

  /**
   * Generate ground fog edge points for current time
   */
  generateGroundFog(): GroundFogData | null {
    if (!this.config.groundFog.enabled) return null;

    const { maxHeight, waviness, animationSpeed, color, density } =
      this.config.groundFog;

    const fogTop = this.height - this.height * maxHeight;
    const points: Array<{ x: number; y: number }> = [];

    // Generate wavy top edge
    const pointCount = Math.ceil(this.width / 30);

    for (let i = 0; i <= pointCount; i++) {
      const x = (i / pointCount) * this.width;

      // Multi-octave noise for organic edge
      const noiseVal =
        this.noise.fbm(x * 0.005 + this.time * animationSpeed, this.time * animationSpeed * 0.5, 4) *
        waviness *
        50;

      // Secondary faster wave
      const fastWave =
        Math.sin(x * 0.02 + this.time * animationSpeed * 3) * waviness * 15;

      points.push({
        x,
        y: fogTop + noiseVal + fastWave,
      });
    }

    // Close the polygon
    points.push({ x: this.width, y: this.height });
    points.push({ x: 0, y: this.height });

    return {
      points,
      color,
      opacity: density * this.config.density,
    };
  }

  /**
   * Get current wispy fog patches
   */
  getWispyPatches(): FogPatch[] {
    if (!this.config.wispyFog.enabled) return [];

    return this.wispyPatches.map((patch) => ({
      ...patch,
      opacity: patch.opacity * this.config.wispyFog.opacity * this.config.density,
    }));
  }

  /**
   * Get mist layer data for rendering
   */
  getMistLayers(): MistLayerData[] {
    if (!this.config.mistLayers.enabled) return [];

    return this.mistLayers.map((layer) => ({
      ...layer,
      opacity: layer.opacity * this.config.density,
    }));
  }

  /**
   * Get all fog layers sorted by depth for proper rendering
   */
  getAllFogLayers(): FogLayer[] {
    const layers: FogLayer[] = [];

    // Ground fog (rendered near the bottom)
    const groundFog = this.generateGroundFog();
    if (groundFog) {
      layers.push({
        type: "ground",
        depth: 0.9,
        opacity: groundFog.opacity,
        data: groundFog,
      });
    }

    // Mist layers
    for (const mist of this.getMistLayers()) {
      layers.push({
        type: "mist",
        depth: 0.5 + (mist.y / this.height) * 0.3,
        opacity: mist.opacity,
        data: mist,
      });
    }

    // Wispy patches
    for (const patch of this.getWispyPatches()) {
      layers.push({
        type: "wispy",
        depth: 0.4 + Math.random() * 0.3,
        opacity: patch.opacity,
        data: patch,
      });
    }

    return layers.sort((a, b) => a.depth - b.depth);
  }

  /**
   * Apply fog color/opacity to a tree color based on its depth
   */
  applyDistanceFog(
    treeColor: string,
    depth: number
  ): { color: string; opacity: number } {
    const fogOpacity = this.getDistanceFogOpacity(depth);
    const fogColor = this.getDistanceFogColor(depth);

    // For silhouettes, we typically just adjust opacity
    // The fog color can be blended in the rendering pass
    return {
      color: treeColor,
      opacity: 1 - fogOpacity * 0.7, // Reduce tree opacity in fog
    };
  }

  /**
   * Resize fog system to new dimensions
   */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.initializeWispyPatches();
    this.initializeMistLayers();
  }

  /**
   * Set fog configuration at runtime
   */
  setConfig(config: Partial<FogConfig>): void {
    this.config = this.mergeConfig(this.config, config);

    if (config.wispyFog?.patchCount !== undefined) {
      this.initializeWispyPatches();
    }
    if (config.mistLayers?.layerCount !== undefined) {
      this.initializeMistLayers();
    }
  }

  getConfig(): FogConfig {
    return { ...this.config };
  }

  private lerpColorString(color1: string, color2: string, t: number): string {
    // This is a simplified version - proper implementation would parse and blend
    // For now, just return the appropriate color based on threshold
    return t < 0.5 ? color1 : color2;
  }
}
