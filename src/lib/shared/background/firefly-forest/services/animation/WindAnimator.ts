/**
 * Wind Animator
 *
 * Animates trees, grass, and ground vegetation with realistic wind effects.
 * Uses layered sine waves and noise for organic movement:
 * - Primary sway (slow, large motion)
 * - Secondary sway (faster, smaller)
 * - Gusts (occasional stronger bursts)
 * - Height-based scaling (trunk still, tips move most)
 */

import { PerlinNoise } from "../noise/PerlinNoise";

export interface WindConfig {
  // Primary wind
  enabled: boolean;
  strength: number; // 0-1, overall wind intensity
  direction: number; // Radians, direction wind blows toward
  frequency: number; // How fast the primary sway cycles

  // Secondary wind
  secondaryStrength: number; // Relative to primary
  secondaryFrequency: number;

  // Gusts
  gustEnabled: boolean;
  gustStrength: number; // Peak strength during gust
  gustFrequency: number; // How often gusts occur
  gustDuration: number; // How long gusts last (seconds)

  // Height response
  heightExponent: number; // How much more top moves vs bottom (1 = linear, 2 = quadratic)
  trunkStiffness: number; // 0-1, how rigid the trunk is

  // Variation
  spatialVariation: number; // 0-1, how much wind varies across scene
  temporalVariation: number; // 0-1, how much wind varies over time
}

export interface WindState {
  time: number;
  currentStrength: number;
  gustActive: boolean;
  gustIntensity: number;
  gustTimeRemaining: number;
}

export interface WindDisplacement {
  x: number;
  y: number;
  rotation: number; // Radians of rotation to apply
}

const DEFAULT_CONFIG: WindConfig = {
  enabled: true,
  strength: 0.3,
  direction: Math.PI * 0.1, // Slight right lean
  frequency: 0.5,
  secondaryStrength: 0.3,
  secondaryFrequency: 1.5,
  gustEnabled: true,
  gustStrength: 2.0,
  gustFrequency: 0.05, // ~5% chance per second
  gustDuration: 2.0,
  heightExponent: 2.0,
  trunkStiffness: 0.8,
  spatialVariation: 0.3,
  temporalVariation: 0.2,
};

export class WindAnimator {
  private config: WindConfig;
  private noise: PerlinNoise;
  private state: WindState;

  constructor(config: Partial<WindConfig> = {}, seed?: number) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.noise = new PerlinNoise(seed);
    this.state = {
      time: 0,
      currentStrength: this.config.strength,
      gustActive: false,
      gustIntensity: 0,
      gustTimeRemaining: 0,
    };
  }

  /**
   * Update wind state
   * @param deltaTime Time since last update in seconds
   */
  update(deltaTime: number): void {
    if (!this.config.enabled) return;

    this.state.time += deltaTime;

    // Update gust state
    this.updateGusts(deltaTime);

    // Calculate current effective strength
    const baseStrength = this.config.strength;
    const temporalNoise =
      this.noise.noise2D(this.state.time * 0.1, 0) * this.config.temporalVariation;
    this.state.currentStrength =
      baseStrength * (1 + temporalNoise) * (1 + this.state.gustIntensity);
  }

  private updateGusts(deltaTime: number): void {
    if (!this.config.gustEnabled) {
      this.state.gustActive = false;
      this.state.gustIntensity = 0;
      return;
    }

    if (this.state.gustActive) {
      // Gust in progress
      this.state.gustTimeRemaining -= deltaTime;

      if (this.state.gustTimeRemaining <= 0) {
        // Gust ending
        this.state.gustActive = false;
        this.state.gustIntensity = 0;
      } else {
        // Gust envelope (attack-sustain-release)
        const progress = 1 - this.state.gustTimeRemaining / this.config.gustDuration;
        if (progress < 0.2) {
          // Attack
          this.state.gustIntensity = (progress / 0.2) * this.config.gustStrength;
        } else if (progress < 0.7) {
          // Sustain
          this.state.gustIntensity =
            this.config.gustStrength * (0.8 + Math.random() * 0.2);
        } else {
          // Release
          this.state.gustIntensity =
            this.config.gustStrength * ((1 - progress) / 0.3);
        }
      }
    } else {
      // Check for new gust
      if (Math.random() < this.config.gustFrequency * deltaTime) {
        this.state.gustActive = true;
        this.state.gustTimeRemaining = this.config.gustDuration;
      }
    }
  }

  /**
   * Calculate displacement for a point at given position and height
   * @param worldX World X position
   * @param worldY World Y position
   * @param heightRatio 0-1, 0 = ground, 1 = top of element
   * @param scale Size multiplier for the element
   */
  getDisplacement(
    worldX: number,
    worldY: number,
    heightRatio: number,
    scale: number = 1
  ): WindDisplacement {
    if (!this.config.enabled) {
      return { x: 0, y: 0, rotation: 0 };
    }

    const {
      direction,
      frequency,
      secondaryStrength,
      secondaryFrequency,
      heightExponent,
      trunkStiffness,
      spatialVariation,
    } = this.config;

    // Height response - bottom moves less than top
    const adjustedHeight = Math.max(0, heightRatio - trunkStiffness * (1 - heightRatio));
    const heightFactor = Math.pow(adjustedHeight, heightExponent);

    // Spatial variation noise
    const spatialNoise =
      this.noise.noise2D(worldX * 0.003, worldY * 0.003) * spatialVariation;
    const localStrength = this.state.currentStrength * (1 + spatialNoise);

    // Primary sway
    const primaryPhase =
      this.state.time * frequency +
      worldX * 0.001 +
      this.noise.noise2D(worldX * 0.01, 0) * 2;
    const primarySway = Math.sin(primaryPhase) * localStrength;

    // Secondary sway (faster, smaller)
    const secondaryPhase =
      this.state.time * secondaryFrequency +
      worldX * 0.002 +
      this.noise.noise2D(worldX * 0.02, worldY * 0.01) * 3;
    const secondarySway =
      Math.sin(secondaryPhase) * localStrength * secondaryStrength;

    // Combine sways
    const totalSway = (primarySway + secondarySway) * heightFactor * scale * 20;

    // Calculate displacement in wind direction
    const dx = Math.cos(direction) * totalSway;
    const dy = Math.sin(direction) * totalSway * 0.3; // Less vertical motion

    // Rotation based on sway
    const rotation = totalSway * 0.01 * heightFactor;

    return { x: dx, y: dy, rotation };
  }

  /**
   * Calculate displacement for grass blade
   * Grass is more responsive to wind
   */
  getGrassDisplacement(
    worldX: number,
    heightRatio: number
  ): WindDisplacement {
    if (!this.config.enabled) {
      return { x: 0, y: 0, rotation: 0 };
    }

    const { direction, frequency, secondaryFrequency, spatialVariation } = this.config;

    // Grass is very responsive
    const heightFactor = Math.pow(heightRatio, 1.5);
    const grassMultiplier = 2.0;

    // Spatial variation
    const spatialNoise =
      this.noise.noise2D(worldX * 0.01, 0) * spatialVariation;
    const localStrength = this.state.currentStrength * (1 + spatialNoise) * grassMultiplier;

    // Fast, responsive sway
    const primaryPhase =
      this.state.time * frequency * 1.5 +
      worldX * 0.005 +
      this.noise.noise2D(worldX * 0.05, this.state.time * 0.5) * 2;
    const primarySway = Math.sin(primaryPhase);

    // Faster secondary
    const secondaryPhase =
      this.state.time * secondaryFrequency * 2 +
      worldX * 0.008;
    const secondarySway = Math.sin(secondaryPhase) * 0.4;

    // Tertiary flutter
    const flutterPhase = this.state.time * 5 + worldX * 0.02;
    const flutter = Math.sin(flutterPhase) * 0.15;

    const totalSway = (primarySway + secondarySway + flutter) * localStrength * heightFactor;

    const dx = Math.cos(direction) * totalSway * 15;
    const dy = Math.sin(direction) * totalSway * 5;
    const rotation = totalSway * 0.3;

    return { x: dx, y: dy, rotation };
  }

  /**
   * Get current wind state for UI display
   */
  getState(): WindState {
    return { ...this.state };
  }

  /**
   * Get effective wind strength at current moment
   */
  getCurrentStrength(): number {
    return this.state.currentStrength;
  }

  /**
   * Check if a gust is currently active
   */
  isGustActive(): boolean {
    return this.state.gustActive;
  }

  /**
   * Manually trigger a gust
   */
  triggerGust(): void {
    if (!this.config.gustEnabled) return;
    this.state.gustActive = true;
    this.state.gustTimeRemaining = this.config.gustDuration;
  }

  /**
   * Set wind configuration
   */
  setConfig(config: Partial<WindConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): WindConfig {
    return { ...this.config };
  }

  /**
   * Reset animation state
   */
  reset(): void {
    this.state = {
      time: 0,
      currentStrength: this.config.strength,
      gustActive: false,
      gustIntensity: 0,
      gustTimeRemaining: 0,
    };
  }
}

/**
 * Wind presets for different moods
 */
export const WIND_PRESETS: Record<string, Partial<WindConfig>> = {
  calm: {
    strength: 0.1,
    frequency: 0.3,
    secondaryStrength: 0.2,
    gustEnabled: false,
  },
  gentle: {
    strength: 0.25,
    frequency: 0.5,
    secondaryStrength: 0.3,
    gustEnabled: true,
    gustFrequency: 0.02,
    gustStrength: 1.5,
  },
  moderate: {
    strength: 0.4,
    frequency: 0.6,
    secondaryStrength: 0.35,
    gustEnabled: true,
    gustFrequency: 0.05,
    gustStrength: 2.0,
  },
  strong: {
    strength: 0.6,
    frequency: 0.8,
    secondaryStrength: 0.4,
    gustEnabled: true,
    gustFrequency: 0.1,
    gustStrength: 2.5,
  },
  stormy: {
    strength: 0.8,
    frequency: 1.0,
    secondaryStrength: 0.5,
    gustEnabled: true,
    gustFrequency: 0.15,
    gustStrength: 3.0,
    gustDuration: 3.0,
  },
};
