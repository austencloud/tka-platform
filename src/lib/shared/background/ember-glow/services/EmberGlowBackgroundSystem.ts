import type {
  Dimensions,
  QualityLevel,
} from "$lib/shared/background/shared/domain/types/background-types";
import type { IBackgroundSystem } from "$lib/shared/background/shared/services/contracts/IBackgroundSystem";
import type { EmberGlowLayers, EmberGlowStats } from "../domain/models/ember-models";
import {
  EMBER_BACKGROUND_GRADIENT,
  EMBER_GLOW_QUALITY_CONFIGS,
  DENSITY_MULTIPLIERS,
  HEAT_INTENSITY_CONFIGS,
  type HeatIntensity,
  type DensityPreset,
} from "../domain/constants/ember-constants";

// Import runes-based subsystems (HMR-enabled)
import * as EmberSystem from "./ember-system.svelte";
import * as SmokeSystem from "./smoke-system.svelte";
import * as SparkSystem from "./spark-system.svelte";
import * as CoalBedSystem from "./coal-bed-system.svelte";

/**
 * Ember Glow Background System
 *
 * Orchestrates three particle subsystems (now runes-based for HMR):
 * - Smoke: Dark, slow-rising particles for depth
 * - Embers: Glowing orange/amber particles with flicker
 * - Sparks: Small, bright, fast particles
 *
 * Supports heat intensity (affects all subsystems), density presets,
 * quality levels, layer visibility, and accessibility settings.
 */
export class EmberGlowBackgroundSystem implements IBackgroundSystem {
  // State
  private quality: QualityLevel = "medium";
  private heatIntensity: HeatIntensity = "warm";
  private densityPreset: DensityPreset = "normal";
  private isInitialized = false;
  private dimensions: Dimensions = { width: 0, height: 0 };
  private motionMultiplier = 1.0;

  // Breathing effect state (A+ enhancement - stronger, more visible)
  private breathingPhase = 0;
  private readonly breathingPeriod = 4; // seconds for full cycle
  private readonly breathingAmplitude = 0.5; // ±50% intensity variation (increased from 0.3)

  // Layer visibility
  private layers: EmberGlowLayers = {
    gradient: true,
    coalBed: true, // A+ - glowing heat source at bottom
    smoke: true,
    embers: true,
    sparks: true,
    // Enhancement layers
    vignette: false,
    bottomGlow: false,
    sparkTrails: false,
    breathing: false,
  };

  // Gradient colors
  private readonly gradientStops = EMBER_BACKGROUND_GRADIENT;

  // No constructor needed - subsystems are now module-level singletons

  public initialize(dimensions: Dimensions, quality: QualityLevel): void {
    this.quality = quality;
    this.dimensions = dimensions;

    const config = EMBER_GLOW_QUALITY_CONFIGS[quality];
    const densityMult = DENSITY_MULTIPLIERS[this.densityPreset];
    const heatConfig = HEAT_INTENSITY_CONFIGS[this.heatIntensity];

    // Apply density to ember system
    EmberSystem.setDensityMultiplier(densityMult);
    EmberSystem.setHeatIntensity(this.heatIntensity);
    EmberSystem.setFlicker(config.flickerEnabled, config.flickerSpeed);
    EmberSystem.initialize(dimensions, config.emberCount);

    // Initialize smoke
    SmokeSystem.initialize(dimensions, Math.floor(config.smokeCount * densityMult));

    // Sparks get heat bonus
    const sparkCount = Math.floor(
      config.sparkCount * densityMult * (1 + heatConfig.sparkBonus)
    );
    SparkSystem.initialize(dimensions, sparkCount);

    // Initialize coal bed (A+ enhancement)
    CoalBedSystem.initialize(dimensions, quality);

    this.isInitialized = true;
  }

  public update(dimensions: Dimensions, frameMultiplier: number = 1.0): void {
    // Auto-initialize if dimensions changed
    if (dimensions.width > 0 && dimensions.height > 0) {
      if (!this.isInitialized) {
        this.initialize(dimensions, this.quality);
      }
    }

    if (!this.isInitialized) return;

    this.dimensions = dimensions;

    // Advance breathing phase (assuming 60fps base)
    // Breathing respects motion multiplier for accessibility
    if (this.layers.breathing) {
      const secondsPerFrame = (frameMultiplier * this.motionMultiplier) / 60;
      this.breathingPhase += (secondsPerFrame / this.breathingPeriod) * Math.PI * 2;
      if (this.breathingPhase > Math.PI * 2) {
        this.breathingPhase -= Math.PI * 2;
      }
    }

    // Calculate breathing multiplier for subsystems that sync with it
    const breathingMult = this.layers.breathing
      ? 1 + Math.sin(this.breathingPhase) * this.breathingAmplitude
      : 1;

    // Update all subsystems
    if (this.layers.coalBed) {
      CoalBedSystem.setBreathingMultiplier(breathingMult);
      CoalBedSystem.update(dimensions, frameMultiplier);
    }

    if (this.layers.smoke) {
      SmokeSystem.update(dimensions, frameMultiplier);
    }

    if (this.layers.embers) {
      EmberSystem.update(dimensions, frameMultiplier);
    }

    if (this.layers.sparks) {
      SparkSystem.update(dimensions, frameMultiplier);
    }
  }

  public draw(ctx: CanvasRenderingContext2D, dimensions: Dimensions): void {
    // Calculate breathing intensity multiplier
    const breathingMult = this.layers.breathing
      ? 1 + Math.sin(this.breathingPhase) * this.breathingAmplitude
      : 1;

    // Layer 1: Background gradient
    if (this.layers.gradient) {
      const gradient = ctx.createLinearGradient(0, 0, dimensions.width, dimensions.height);
      this.gradientStops.forEach(({ position, color }) => {
        gradient.addColorStop(position, color);
      });
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);
    }

    // Layer 2: Coal bed (A+ - glowing heat source at bottom)
    if (this.layers.coalBed && this.isInitialized) {
      CoalBedSystem.draw(ctx, dimensions);
    }

    // Layer 3: Bottom glow (warm radial glow from below)
    if (this.layers.bottomGlow) {
      this.drawBottomGlow(ctx, dimensions, breathingMult);
    }

    // Layer 3: Smoke (behind embers)
    if (this.layers.smoke && this.isInitialized) {
      SmokeSystem.draw(ctx, dimensions);
    }

    // Layer 4: Embers
    if (this.layers.embers && this.isInitialized) {
      EmberSystem.draw(ctx, dimensions);
    }

    // Layer 5: Sparks (on top)
    if (this.layers.sparks && this.isInitialized) {
      SparkSystem.draw(ctx, dimensions);
    }

    // Layer 6: Vignette (darkens edges, focuses center - pulses with breathing)
    if (this.layers.vignette) {
      this.drawVignette(ctx, dimensions, breathingMult);
    }

    // Layer 7: Breathing overlay (warm pulse across entire scene)
    if (this.layers.breathing) {
      this.drawBreathingOverlay(ctx, dimensions, breathingMult);
    }
  }

  /**
   * Draw breathing overlay - a warm color wash that pulses visibly
   * A+ Enhancement: Stronger, more noticeable breathing effect
   */
  private drawBreathingOverlay(
    ctx: CanvasRenderingContext2D,
    dimensions: Dimensions,
    breathingMult: number
  ): void {
    // Calculate intensity based on breathing phase
    // Now with ±50% amplitude, breathingMult ranges from 0.5 to 1.5
    const breathIntensity = Math.max(0, (breathingMult - 1) * 2); // 0 to 1.0

    // Warm amber overlay from bottom (always visible when breathing enabled)
    const baseOverlay = 0.03; // Constant subtle warmth
    const pulseOverlay = breathIntensity * 0.12; // Pulsing component

    // Full-screen warm gradient from bottom
    const gradient = ctx.createLinearGradient(0, dimensions.height, 0, 0);
    gradient.addColorStop(0, `rgba(255, 140, 50, ${baseOverlay + pulseOverlay})`);
    gradient.addColorStop(0.3, `rgba(255, 100, 30, ${(baseOverlay + pulseOverlay) * 0.7})`);
    gradient.addColorStop(0.6, `rgba(255, 80, 20, ${(baseOverlay + pulseOverlay) * 0.3})`);
    gradient.addColorStop(1, `rgba(0, 0, 0, 0)`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    // Additional center glow that pulses (like the fire is breathing)
    if (breathIntensity > 0.1) {
      const centerX = dimensions.width / 2;
      const centerY = dimensions.height * 0.85;
      const glowRadius = dimensions.width * 0.4 * (1 + breathIntensity * 0.2);

      const centerGlow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, glowRadius);
      centerGlow.addColorStop(0, `rgba(255, 160, 60, ${breathIntensity * 0.08})`);
      centerGlow.addColorStop(0.5, `rgba(255, 100, 30, ${breathIntensity * 0.04})`);
      centerGlow.addColorStop(1, `rgba(0, 0, 0, 0)`);

      ctx.fillStyle = centerGlow;
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);
    }
  }

  /**
   * Draw a warm radial glow emanating from bottom center
   */
  private drawBottomGlow(
    ctx: CanvasRenderingContext2D,
    dimensions: Dimensions,
    breathingMult: number
  ): void {
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height + dimensions.height * 0.1; // Below screen
    const radius = Math.max(dimensions.width, dimensions.height) * 0.8;

    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);

    // Warm amber glow with breathing intensity
    const baseOpacity = 0.25 * breathingMult;
    gradient.addColorStop(0, `rgba(255, 140, 50, ${baseOpacity})`);
    gradient.addColorStop(0.3, `rgba(255, 100, 30, ${baseOpacity * 0.6})`);
    gradient.addColorStop(0.6, `rgba(200, 60, 20, ${baseOpacity * 0.3})`);
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);
  }

  /**
   * Draw a vignette effect (darkens edges, pulses with breathing)
   * A+ Enhancement: Vignette pulses subtly with the breathing effect
   */
  private drawVignette(ctx: CanvasRenderingContext2D, dimensions: Dimensions, breathingMult: number): void {
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const radius = Math.max(dimensions.width, dimensions.height) * 0.7;

    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);

    // Vignette opacity pulses with breathing (edges darken during "exhale")
    // When breathing enabled, breathingMult ranges from 0.5 to 1.5
    // Invert: darker edges when breathingMult is low (exhale)
    const vignetteStrength = this.layers.breathing
      ? 1 + (1 - breathingMult) * 0.3 // 0.85 to 1.15 multiplier
      : 1;

    // Transparent center, dark edges
    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(0.5, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(0.8, `rgba(0, 0, 0, ${0.3 * vignetteStrength})`);
    gradient.addColorStop(1, `rgba(0, 0, 0, ${0.6 * vignetteStrength})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);
  }

  public setQuality(quality: QualityLevel): void {
    this.quality = quality;

    const config = EMBER_GLOW_QUALITY_CONFIGS[quality];
    const densityMult = DENSITY_MULTIPLIERS[this.densityPreset];
    const heatConfig = HEAT_INTENSITY_CONFIGS[this.heatIntensity];

    // Update flicker settings
    EmberSystem.setFlicker(config.flickerEnabled, config.flickerSpeed);

    // Update particle counts
    if (this.isInitialized) {
      EmberSystem.setCount(this.dimensions, config.emberCount);
      SmokeSystem.setCount(
        this.dimensions,
        Math.floor(config.smokeCount * densityMult)
      );
      SparkSystem.setCount(
        this.dimensions,
        Math.floor(config.sparkCount * densityMult),
        heatConfig.sparkBonus
      );
    }
  }

  public setAccessibility(settings: {
    reducedMotion: boolean;
    highContrast: boolean;
  }): void {
    if (settings.reducedMotion) {
      // Slow all animations significantly
      this.motionMultiplier = 0.2;

      // Reduce spark trail length for reduced motion
      SparkSystem.setTrailConfig(4, 0.7);
    } else {
      this.motionMultiplier = 1.0;

      // Full trail length when motion is allowed
      SparkSystem.setTrailConfig(10, 0.85);
    }

    // Pass to all subsystems
    EmberSystem.setMotionMultiplier(this.motionMultiplier);
    SmokeSystem.setMotionMultiplier(this.motionMultiplier);
    SparkSystem.setMotionMultiplier(this.motionMultiplier);
    CoalBedSystem.setMotionMultiplier(this.motionMultiplier);
  }

  public handleResize(oldDimensions: Dimensions, newDimensions: Dimensions): void {
    if (!this.isInitialized) return;

    this.dimensions = newDimensions;

    EmberSystem.handleResize(oldDimensions, newDimensions);
    // Smoke and sparks don't need resize handling - they respawn naturally
  }

  public cleanup(): void {
    EmberSystem.cleanup();
    SmokeSystem.cleanup();
    SparkSystem.cleanup();
    CoalBedSystem.cleanup();
    this.isInitialized = false;
  }

  /**
   * Set layer visibility
   */
  public setLayerVisibility(layers: Partial<EmberGlowLayers>): void {
    this.layers = { ...this.layers, ...layers };

    // Wire up sparkTrails to SparkSystem
    if (layers.sparkTrails !== undefined) {
      SparkSystem.setTrailsEnabled(layers.sparkTrails);
    }
  }

  /**
   * Get current scene statistics
   */
  public getStats(): EmberGlowStats {
    return {
      embers: EmberSystem.getCount(),
      smoke: SmokeSystem.getCount(),
      sparks: SparkSystem.getCount(),
      coals: CoalBedSystem.getCount(),
      heatIntensity: this.heatIntensity,
      densityPreset: this.densityPreset,
    };
  }

  /**
   * Set heat intensity level
   * Affects ember colors, speed, glow, and spark bonus
   */
  public setHeatIntensity(intensity: HeatIntensity): void {
    this.heatIntensity = intensity;

    // Update ember system
    EmberSystem.setHeatIntensity(intensity);

    // Update spark count with heat bonus
    if (this.isInitialized) {
      const config = EMBER_GLOW_QUALITY_CONFIGS[this.quality];
      const densityMult = DENSITY_MULTIPLIERS[this.densityPreset];
      const heatConfig = HEAT_INTENSITY_CONFIGS[intensity];

      SparkSystem.setCount(
        this.dimensions,
        Math.floor(config.sparkCount * densityMult),
        heatConfig.sparkBonus
      );

      // Reinitialize embers to apply new heat colors
      EmberSystem.initialize(
        this.dimensions,
        Math.floor(config.emberCount * densityMult)
      );
    }
  }

  /**
   * Set density preset
   * Multiplies all particle counts
   */
  public setDensityPreset(preset: DensityPreset): void {
    this.densityPreset = preset;
    const densityMult = DENSITY_MULTIPLIERS[preset];

    // Update density multiplier in ember system
    EmberSystem.setDensityMultiplier(densityMult);

    if (this.isInitialized) {
      const config = EMBER_GLOW_QUALITY_CONFIGS[this.quality];
      const heatConfig = HEAT_INTENSITY_CONFIGS[this.heatIntensity];

      // Reinitialize all systems with new density
      EmberSystem.initialize(this.dimensions, config.emberCount);
      SmokeSystem.setCount(
        this.dimensions,
        Math.floor(config.smokeCount * densityMult)
      );
      SparkSystem.setCount(
        this.dimensions,
        Math.floor(config.sparkCount * densityMult),
        heatConfig.sparkBonus
      );
    }
  }
}
