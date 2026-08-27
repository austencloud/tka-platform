/**
 * Atmosphere & Sky System
 *
 * Procedural sky with gradient colors and fog.
 * Uses MeshBasicMaterial for WebGPU compatibility.
 */

import {
  BackSide,
  SphereGeometry,
  Mesh,
  Color,
  Vector3,
  Fog,
  FogExp2,
  MeshBasicMaterial,
  type Scene,
  type PerspectiveCamera,
} from "three";


export interface SkyConfig {
  skyColor: string;
  horizonColor: string;
  sunDirection: Vector3;
}

export interface FogConfig {
  color: string;
  near: number;
  far: number;
  density: number;
  useExp2: boolean;
}


const DEFAULT_SKY_CONFIG: SkyConfig = {
  skyColor: "#4a90c2",
  horizonColor: "#87ceeb",
  sunDirection: new Vector3(0.5, 0.3, 0.5).normalize(),
};

const BIOME_FOG_CONFIGS: Record<string, FogConfig> = {
  forest: {
    color: "#4a6741",
    near: 50,
    far: 300,
    density: 0.008,
    useExp2: true,
  },
  plains: {
    color: "#a8c4b8",
    near: 100,
    far: 500,
    density: 0.004,
    useExp2: true,
  },
  mountains: {
    color: "#b8c8d8",
    near: 80,
    far: 400,
    density: 0.005,
    useExp2: true,
  },
  desert: {
    color: "#d4c4a8",
    near: 60,
    far: 350,
    density: 0.006,
    useExp2: true,
  },
  ocean: {
    color: "#4a7c8c",
    near: 30,
    far: 200,
    density: 0.012,
    useExp2: true,
  },
  default: {
    color: "#8090a0",
    near: 100,
    far: 400,
    density: 0.005,
    useExp2: true,
  },
};


export class AtmosphereManager {
  private scene: Scene;
  private skyMesh: Mesh | null = null;
  private skyMaterial: MeshBasicMaterial | null = null;
  private currentBiome: string = "default";
  private targetFogColor = new Color();
  private currentFogColor = new Color();
  private _fogEnabled: boolean = true;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  /**
   * Create the sky dome using basic material (WebGPU compatible)
   */
  createSky(config: Partial<SkyConfig> = {}): void {
    const cfg = { ...DEFAULT_SKY_CONFIG, ...config };

    // Create sky material - simple solid color (gradient would need shader)
    this.skyMaterial = new MeshBasicMaterial({
      color: new Color(cfg.skyColor),
      side: BackSide,
      depthWrite: false,
    });

    // Create sky sphere - 500 meter radius for expansive sky
    const skyGeometry = new SphereGeometry(500, 32, 32);
    this.skyMesh = new Mesh(skyGeometry, this.skyMaterial);
    this.skyMesh.renderOrder = -1000;

    this.scene.add(this.skyMesh);
  }

  /**
   * Set up fog based on biome
   */
  setFog(biome: string): void {
    const config = BIOME_FOG_CONFIGS[biome] || BIOME_FOG_CONFIGS.default!;

    this.targetFogColor.set(config.color);

    if (config.useExp2) {
      this.scene.fog = new FogExp2(config.color, config.density);
    } else {
      this.scene.fog = new Fog(config.color, config.near, config.far);
    }

    this.currentBiome = biome;
    this._fogEnabled = true;
  }

  /**
   * Toggle fog on/off while preserving current biome
   */
  setFogEnabled(enabled: boolean): void {
    this._fogEnabled = enabled;
    if (enabled) {
      this.setFog(this.currentBiome);
    } else {
      this.scene.fog = null;
    }
  }

  /**
   * Update fog to blend between biomes
   */
  updateFog(biome: string, deltaTime: number): void {
    if (biome !== this.currentBiome) {
      this.setFog(biome);
    }

    // Smooth color transition
    if (this.scene.fog) {
      this.currentFogColor.lerp(this.targetFogColor, deltaTime * 2);
      this.scene.fog.color.copy(this.currentFogColor);
    }
  }

  /**
   * Update sun direction (no-op for basic material)
   */
  setSunDirection(_direction: Vector3): void {
    // Basic material doesn't use sun direction
  }

  /**
   * Update sky to follow camera
   */
  update(camera: PerspectiveCamera): void {
    if (this.skyMesh) {
      this.skyMesh.position.copy(camera.position);
    }
  }

  getFogConfig(biome: string): FogConfig {
    return BIOME_FOG_CONFIGS[biome] || BIOME_FOG_CONFIGS.default!;
  }

  /**
   * Get current atmosphere state for debug display
   */
  getState(): {
    fogEnabled: boolean;
    currentBiome: string;
    fogDensity: number;
    fogColor: string;
  } {
    const config = BIOME_FOG_CONFIGS[this.currentBiome] || BIOME_FOG_CONFIGS.default!;
    return {
      fogEnabled: this._fogEnabled,
      currentBiome: this.currentBiome,
      fogDensity: config.density,
      fogColor: config.color,
    };
  }

  /**
   * Set visibility of atmosphere (sky and fog)
   */
  setVisible(visible: boolean): void {
    if (this.skyMesh) {
      this.skyMesh.visible = visible;
    }
    if (!visible) {
      this.scene.fog = null;
    } else if (this.skyMesh) {
      // Re-enable fog with default settings
      this.setFog("plains");
    }
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    if (this.skyMesh) {
      this.scene.remove(this.skyMesh);
      this.skyMesh.geometry.dispose();
    }
    if (this.skyMaterial) {
      this.skyMaterial.dispose();
    }
    this.scene.fog = null;
  }
}
