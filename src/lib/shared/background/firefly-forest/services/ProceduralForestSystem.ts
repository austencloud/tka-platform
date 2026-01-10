/**
 * Procedural Forest System
 *
 * Master orchestrator for the A+++ procedural forest background.
 * Coordinates all subsystems to create an immersive, layered forest scene:
 *
 * - ParallaxForestComposer: Multi-layer tree distribution with parallax
 * - AtmosphericFogSystem: Distance fog, ground mist, wispy patches
 * - GroundLayerSystem: Bushes, grass, ferns
 * - WindAnimator: Organic sway animation for vegetation
 * - EasterEggSystem: Owls, bats, moon, shooting stars
 *
 * Provides unified API for initialization, updates, and rendering data.
 */

import {
  ParallaxForestComposer,
  type ParallaxForestConfig,
  type ForestLayer,
  type ForestTreeInstance,
} from "./composition/ParallaxForestComposer";
import {
  AtmosphericFogSystem,
  type FogConfig,
  type FogLayer,
  type GroundFogData,
  type FogPatch,
  type MistLayerData,
} from "./atmosphere/AtmosphericFogSystem";
import {
  GroundLayerSystem,
  type GroundLayerConfig,
  type GroundElement,
  type GrassTuft,
} from "./ground/GroundLayerSystem";
import {
  WindAnimator,
  type WindConfig,
  type WindDisplacement,
  WIND_PRESETS,
} from "./animation/WindAnimator";
import {
  EasterEggSystem,
  type EasterEggConfig,
  type OwlSilhouette,
  type BatFlock,
  type ShootingStar,
  type GlowingEyes,
} from "./ambient/EasterEggSystem";
import {
  MoonRenderer,
  type MoonConfig,
  type MoonState,
} from "../../shared/services/MoonRenderer";

export type QualityLevel = "low" | "medium" | "high" | "ultra";

export interface ProceduralForestConfig {
  // Canvas dimensions
  width: number;
  height: number;

  // Quality level
  quality?: QualityLevel;

  // Subsystem configs
  forest?: Partial<ParallaxForestConfig>;
  fog?: Partial<FogConfig>;
  ground?: Partial<GroundLayerConfig>;
  wind?: Partial<WindConfig>;
  easterEggs?: Partial<EasterEggConfig>;
  moon?: Partial<MoonConfig>;

  // Master controls
  seed?: number;
  enabled: boolean;
  parallaxEnabled: boolean;
  windEnabled: boolean;
  fogEnabled: boolean;
  groundEnabled: boolean;
  easterEggsEnabled: boolean;
  moonEnabled: boolean;
}

export interface ProceduralForestStats {
  trees: {
    total: number;
    deciduous: number;
    conifer: number;
    bare: number;
  };
  ground: {
    bushes: number;
    grassTufts: number;
    ferns: number;
  };
  wind: {
    strength: number;
    gustActive: boolean;
  };
  easterEggs: {
    owls: number;
    batFlocks: number;
    shootingStars: number;
    glowingEyes: number;
  };
  layers: number;
}

export interface ForestRenderData {
  trees: ForestTreeInstance[];
  groundElements: GroundElement[];
  grassTufts: GrassTuft[];
  moonRenderer: MoonRenderer | null;
  shootingStars: ShootingStar[];
  batFlocks: BatFlock[];
  owls: OwlSilhouette[];
  glowingEyes: GlowingEyes[];
  fogLayers: FogLayer[];
  windStrength: number;
  gustActive: boolean;
}

const DEFAULT_CONFIG: ProceduralForestConfig = {
  width: 1920,
  height: 1080,
  seed: undefined,
  enabled: true,
  parallaxEnabled: true,
  windEnabled: true,
  fogEnabled: true,
  groundEnabled: true,
  easterEggsEnabled: true,
  moonEnabled: true,
};

export class ProceduralForestSystem {
  private config: ProceduralForestConfig;

  // Subsystems
  private forestComposer: ParallaxForestComposer;
  private fogSystem: AtmosphericFogSystem;
  private groundSystem: GroundLayerSystem;
  private windAnimator: WindAnimator;
  private easterEggSystem: EasterEggSystem;
  private moonRenderer: MoonRenderer;

  // State
  private initialized = false;
  private time = 0;
  private lastUpdateTime = 0;
  private quality: QualityLevel = "high";

  constructor(config: Partial<ProceduralForestConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    const { width, height, seed } = this.config;

    // Initialize subsystems
    this.forestComposer = new ParallaxForestComposer(
      {
        width,
        height,
        ...this.config.forest,
      },
      seed
    );

    this.fogSystem = new AtmosphericFogSystem(
      width,
      height,
      this.config.fog,
      seed ? seed + 1000 : undefined
    );

    this.groundSystem = new GroundLayerSystem(
      {
        width,
        height,
        ...this.config.ground,
      },
      seed ? seed + 2000 : undefined
    );

    this.windAnimator = new WindAnimator(
      this.config.wind,
      seed ? seed + 3000 : undefined
    );

    this.easterEggSystem = new EasterEggSystem(
      width,
      height,
      this.config.easterEggs,
      seed ? seed + 4000 : undefined
    );

    // Initialize moon renderer with real lunar phase
    this.moonRenderer = new MoonRenderer(width, height, {
      useRealPhase: true,
      x: 0.15,
      y: 0.12,
      radiusFraction: 0.04,
      maxRadius: 60,
      ...this.config.moon,
    });
  }

  /**
   * Initialize the system - generates all content
   * Call this once at startup
   */
  initialize(): void {
    this.generate();
    this.lastUpdateTime = 0;
  }

  /**
   * Generate all procedural content
   * Call this once at startup or when regenerating the scene
   */
  private generate(): void {
    // Generate trees across all layers
    this.forestComposer.generate();

    // Generate ground vegetation
    this.groundSystem.generate();

    // Place owls on some trees
    this.placeOwlsOnTrees();

    this.initialized = true;
  }

  /**
   * Place owls on suitable trees
   */
  private placeOwlsOnTrees(): void {
    const layers = this.forestComposer.getLayers();

    // Only place owls on near/mid layers (depth > 0.4)
    for (const layer of layers) {
      if (layer.depth < 0.4) continue;

      for (const tree of layer.trees) {
        // ~10% chance per tree, prefer conifers and bare trees
        const chance =
          tree.treeType === "conifer" ? 0.15 : tree.treeType === "bare" ? 0.12 : 0.08;

        if (Math.random() < chance) {
          // Place owl near top of tree
          const owl = this.easterEggSystem.addOwl(
            tree.x,
            tree.baseY - 80 * tree.scale,
            tree.scale * 0.8
          );

          if (!owl) break; // Max owls reached
        }
      }
    }
  }

  /**
   * Update all animated systems
   * @param currentTime Current timestamp in milliseconds (from requestAnimationFrame)
   */
  update(currentTime: number): void {
    if (!this.config.enabled) return;

    // Calculate deltaTime in seconds
    const deltaTime = this.lastUpdateTime > 0 ? (currentTime - this.lastUpdateTime) / 1000 : 0.016;
    this.lastUpdateTime = currentTime;
    this.time += deltaTime;

    // Update wind
    if (this.config.windEnabled) {
      this.windAnimator.update(deltaTime);
    }

    // Update fog animations
    if (this.config.fogEnabled) {
      this.fogSystem.update(deltaTime * 1000); // Fog uses milliseconds
    }

    // Update easter eggs (bats, shooting stars, etc.)
    if (this.config.easterEggsEnabled) {
      this.easterEggSystem.update(deltaTime);
    }
  }

  /**
   * Update parallax based on input (mouse position, device tilt, etc.)
   * @param value -1 to 1
   */
  updateParallax(value: number): void {
    if (this.config.parallaxEnabled) {
      this.forestComposer.updateParallax(value);
    }
  }

  // ============================================
  // GETTERS FOR RENDERING
  // ============================================

  /**
   * Get all forest layers (far to near)
   */
  getLayers(): ForestLayer[] {
    return this.forestComposer.getLayers();
  }

  /**
   * Get all trees sorted for rendering
   */
  getAllTrees(): ForestTreeInstance[] {
    return this.forestComposer.getAllTreesSorted();
  }

  /**
   * Get wind displacement for a point
   */
  getWindDisplacement(
    worldX: number,
    worldY: number,
    heightRatio: number,
    scale?: number
  ): WindDisplacement {
    if (!this.config.windEnabled) {
      return { x: 0, y: 0, rotation: 0 };
    }
    return this.windAnimator.getDisplacement(worldX, worldY, heightRatio, scale);
  }

  /**
   * Get wind displacement for grass
   */
  getGrassWindDisplacement(worldX: number, heightRatio: number): WindDisplacement {
    if (!this.config.windEnabled) {
      return { x: 0, y: 0, rotation: 0 };
    }
    return this.windAnimator.getGrassDisplacement(worldX, heightRatio);
  }

  /**
   * Get distance fog opacity for a depth
   */
  getFogOpacity(depth: number): number {
    if (!this.config.fogEnabled) return 0;
    return this.fogSystem.getDistanceFogOpacity(depth);
  }

  /**
   * Alias for getFogOpacity - used by renderer
   */
  getDistanceFogOpacity(depth: number): number {
    return this.getFogOpacity(depth);
  }

  /**
   * Get ground fog data
   */
  getGroundFog(): GroundFogData | null {
    if (!this.config.fogEnabled) return null;
    return this.fogSystem.generateGroundFog();
  }

  /**
   * Get wispy fog patches
   */
  getWispyPatches(): FogPatch[] {
    if (!this.config.fogEnabled) return [];
    return this.fogSystem.getWispyPatches();
  }

  /**
   * Get mist layers
   */
  getMistLayers(): MistLayerData[] {
    if (!this.config.fogEnabled) return [];
    return this.fogSystem.getMistLayers();
  }

  /**
   * Get all fog layers for rendering
   */
  getAllFogLayers(): FogLayer[] {
    if (!this.config.fogEnabled) return [];
    return this.fogSystem.getAllFogLayers();
  }

  /**
   * Get ground elements (bushes, ferns)
   */
  getGroundElements(): GroundElement[] {
    if (!this.config.groundEnabled) return [];
    return this.groundSystem.getElements();
  }

  /**
   * Get grass tufts
   */
  getGrassTufts(): GrassTuft[] {
    if (!this.config.groundEnabled) return [];
    return this.groundSystem.getGrassTufts();
  }

  /**
   * Get owl silhouettes
   */
  getOwls(): OwlSilhouette[] {
    if (!this.config.easterEggsEnabled) return [];
    return this.easterEggSystem.getOwls();
  }

  /**
   * Get active bat flocks
   */
  getBatFlocks(): BatFlock[] {
    if (!this.config.easterEggsEnabled) return [];
    return this.easterEggSystem.getBatFlocks();
  }

  /**
   * Get moon renderer for direct rendering
   */
  getMoonRenderer(): MoonRenderer | null {
    if (!this.config.moonEnabled) return null;
    return this.moonRenderer;
  }

  /**
   * Get moon state data
   */
  getMoonState(): MoonState | null {
    if (!this.config.moonEnabled) return null;
    return this.moonRenderer.getState();
  }

  /**
   * Get active shooting stars
   */
  getShootingStars(): ShootingStar[] {
    if (!this.config.easterEggsEnabled) return [];
    return this.easterEggSystem.getShootingStars();
  }

  /**
   * Get glowing eyes
   */
  getGlowingEyes(): GlowingEyes[] {
    if (!this.config.easterEggsEnabled) return [];
    return this.easterEggSystem.getGlowingEyes();
  }

  /**
   * Get bat wing geometry for rendering
   */
  getBatWingPoints(
    bat: import("./ambient/EasterEggSystem").Bat
  ): ReturnType<EasterEggSystem["getBatWingPoints"]> {
    return this.easterEggSystem.getBatWingPoints(bat);
  }

  /**
   * Get access to the easter egg system for rendering
   */
  getEasterEggSystem(): EasterEggSystem {
    return this.easterEggSystem;
  }

  /**
   * Get all render data in one call - used by ForestCanvasRenderer
   */
  getRenderData(): ForestRenderData {
    return {
      trees: this.getAllTrees(),
      groundElements: this.getGroundElements(),
      grassTufts: this.getGrassTufts(),
      moonRenderer: this.getMoonRenderer(),
      shootingStars: this.getShootingStars(),
      batFlocks: this.getBatFlocks(),
      owls: this.getOwls(),
      glowingEyes: this.getGlowingEyes(),
      fogLayers: this.getAllFogLayers(),
      windStrength: this.getWindStrength(),
      gustActive: this.isGustActive(),
    };
  }

  // ============================================
  // CONTROLS
  // ============================================

  /**
   * Trigger a wind gust
   */
  triggerGust(): void {
    this.windAnimator.triggerGust();
  }

  /**
   * Check if a gust is currently active
   */
  isGustActive(): boolean {
    return this.windAnimator.isGustActive();
  }

  /**
   * Get current wind strength
   */
  getWindStrength(): number {
    return this.windAnimator.getCurrentStrength();
  }

  /**
   * Set wind preset
   */
  setWindPreset(preset: keyof typeof WIND_PRESETS): void {
    const presetConfig = WIND_PRESETS[preset];
    if (presetConfig) {
      this.windAnimator.setConfig(presetConfig);
    }
  }

  /**
   * Regenerate everything with a new seed
   */
  regenerate(seed?: number): void {
    // Create new instances with new seed
    const { width, height } = this.config;

    this.forestComposer = new ParallaxForestComposer(
      { width, height, ...this.config.forest },
      seed
    );

    this.groundSystem = new GroundLayerSystem(
      { width, height, ...this.config.ground },
      seed ? seed + 2000 : undefined
    );

    this.easterEggSystem = new EasterEggSystem(
      width,
      height,
      this.config.easterEggs,
      seed ? seed + 4000 : undefined
    );

    // Moon renderer doesn't need regeneration, just refresh phase
    this.moonRenderer.refreshPhase();

    this.generate();
  }

  /**
   * Resize all systems
   */
  resize(width: number, height: number): void {
    this.config.width = width;
    this.config.height = height;

    this.forestComposer.resize(width, height);
    this.fogSystem.resize(width, height);
    this.groundSystem.resize(width, height);
    this.easterEggSystem.resize(width, height);
    this.moonRenderer.resize(width, height);

    // Regenerate content for new size
    this.generate();
  }

  // ============================================
  // CONFIGURATION
  // ============================================

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  setParallaxEnabled(enabled: boolean): void {
    this.config.parallaxEnabled = enabled;
  }

  setWindEnabled(enabled: boolean): void {
    this.config.windEnabled = enabled;
  }

  setFogEnabled(enabled: boolean): void {
    this.config.fogEnabled = enabled;
  }

  setGroundEnabled(enabled: boolean): void {
    this.config.groundEnabled = enabled;
  }

  setEasterEggsEnabled(enabled: boolean): void {
    this.config.easterEggsEnabled = enabled;
  }

  setMoonEnabled(enabled: boolean): void {
    this.config.moonEnabled = enabled;
    this.moonRenderer.setVisible(enabled);
  }

  setMoonConfig(config: Partial<MoonConfig>): void {
    this.moonRenderer.setConfig(config);
  }

  setWindConfig(config: Partial<WindConfig>): void {
    this.windAnimator.setConfig(config);
  }

  setFogConfig(config: Partial<FogConfig>): void {
    this.fogSystem.setConfig(config);
  }

  setEasterEggConfig(config: Partial<EasterEggConfig>): void {
    this.easterEggSystem.setConfig(config);
  }

  /**
   * Set quality level - adjusts detail and particle counts
   */
  setQuality(quality: QualityLevel): void {
    this.quality = quality;

    // Quality multipliers for different detail levels
    const qualityMultipliers: Record<QualityLevel, number> = {
      low: 0.5,
      medium: 0.75,
      high: 1.0,
      ultra: 1.5,
    };

    const multiplier = qualityMultipliers[quality];

    // Adjust ground layer counts
    this.groundSystem = new GroundLayerSystem(
      {
        width: this.config.width,
        height: this.config.height,
        bushCount: Math.floor(15 * multiplier),
        grassTuftCount: Math.floor(40 * multiplier),
        fernCount: Math.floor(10 * multiplier),
        ...this.config.ground,
      },
      this.config.seed ? this.config.seed + 2000 : undefined
    );

    this.groundSystem.generate();
  }

  getConfig(): ProceduralForestConfig {
    return { ...this.config };
  }

  /**
   * Get comprehensive stats for debug display
   */
  getStats(): ProceduralForestStats {
    const forestStats = this.forestComposer.getStats();
    const groundStats = this.groundSystem.getStats();
    const easterEggStats = this.easterEggSystem.getStats();

    return {
      trees: {
        total: forestStats.totalTrees,
        deciduous: forestStats.treesByType.deciduous,
        conifer: forestStats.treesByType.conifer,
        bare: forestStats.treesByType.bare,
      },
      ground: {
        bushes: groundStats.bushes,
        grassTufts: groundStats.grassTufts,
        ferns: groundStats.ferns,
      },
      wind: {
        strength: this.windAnimator.getCurrentStrength(),
        gustActive: this.windAnimator.isGustActive(),
      },
      easterEggs: {
        owls: easterEggStats.owls,
        batFlocks: easterEggStats.activeBatFlocks,
        shootingStars: easterEggStats.activeShootingStars,
        glowingEyes: easterEggStats.glowingEyes,
      },
      layers: forestStats.layerCount,
    };
  }

  /**
   * Check if system has been initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Re-export wind presets for convenience
export { WIND_PRESETS };

// Re-export types for consumers
export type {
  ForestLayer,
  ForestTreeInstance,
  FogLayer,
  GroundFogData,
  FogPatch,
  MistLayerData,
  GroundElement,
  GrassTuft,
  WindDisplacement,
  OwlSilhouette,
  BatFlock,
  ShootingStar,
  GlowingEyes,
  MoonConfig,
  MoonState,
};

// Re-export MoonRenderer for direct usage
export { MoonRenderer };
