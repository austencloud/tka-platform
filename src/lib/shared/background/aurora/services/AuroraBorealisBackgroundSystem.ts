// src/lib/components/backgrounds/auroraBorealis/AuroraBorealisBackgroundSystem.ts

import type { AccessibilitySettings } from "$lib/shared/background/shared/domain/models/background-models";
import type {
  Dimensions,
  PerformanceMetrics,
  QualityLevel,
} from "$lib/shared/background/shared/domain/types/background-types";
import type { IBackgroundSystem } from "$lib/shared/background/shared/services/contracts/IBackgroundSystem";

export interface AuroraLayers {
  gradient: boolean;
  waves: boolean;
  enhancedEffects: boolean;
}

export type AuroraColorPalette = "classic" | "purple" | "blue" | "rainbow";
export type AuroraIntensity = "subtle" | "normal" | "vivid" | "intense";

export class AuroraBorealisBackgroundSystem implements IBackgroundSystem {
  private quality: QualityLevel = "medium";
  private accessibility: AccessibilitySettings = {
    reducedMotion: false,
    highContrast: false,
    visibleParticleSize: 2,
  };

  // Animation state
  private lightWaves: number[] = [];
  private isInitialized = false;

  // Layer visibility
  private layers: AuroraLayers = {
    gradient: true,
    waves: true,
    enhancedEffects: true,
  };

  // Color and intensity settings
  private colorPalette: AuroraColorPalette = "classic";
  private intensity: AuroraIntensity = "normal";

  // Color palettes - alpha values set for visible aurora effect
  private readonly colorPalettes: Record<AuroraColorPalette, Array<{ r: number; g: number; b: number; a: number }>> = {
    classic: [
      { r: 0, g: 80, b: 120, a: 0.6 },
      { r: 0, g: 120, b: 100, a: 0.5 },
      { r: 50, g: 180, b: 120, a: 0.45 },
      { r: 80, g: 200, b: 150, a: 0.4 },
      { r: 120, g: 230, b: 180, a: 0.35 },
      { r: 150, g: 255, b: 200, a: 0.3 },
    ],
    purple: [
      { r: 60, g: 0, b: 120, a: 0.6 },
      { r: 100, g: 30, b: 180, a: 0.5 },
      { r: 140, g: 60, b: 200, a: 0.45 },
      { r: 180, g: 100, b: 220, a: 0.4 },
      { r: 200, g: 150, b: 255, a: 0.35 },
      { r: 230, g: 180, b: 255, a: 0.3 },
    ],
    blue: [
      { r: 0, g: 60, b: 140, a: 0.6 },
      { r: 0, g: 100, b: 180, a: 0.5 },
      { r: 30, g: 140, b: 210, a: 0.45 },
      { r: 60, g: 180, b: 230, a: 0.4 },
      { r: 100, g: 210, b: 255, a: 0.35 },
      { r: 150, g: 230, b: 255, a: 0.3 },
    ],
    rainbow: [
      { r: 255, g: 80, b: 80, a: 0.45 },
      { r: 255, g: 180, b: 80, a: 0.4 },
      { r: 80, g: 255, b: 80, a: 0.4 },
      { r: 80, g: 200, b: 255, a: 0.4 },
      { r: 150, g: 80, b: 255, a: 0.4 },
      { r: 255, g: 80, b: 200, a: 0.35 },
    ],
  };

  // Intensity multipliers
  private readonly intensityMultipliers: Record<AuroraIntensity, number> = {
    subtle: 0.5,
    normal: 1.0,
    vivid: 1.5,
    intense: 2.0,
  };

  // Aurora Borealis color palette (dynamic based on selection)
  private get auroraColors() {
    return this.colorPalettes[this.colorPalette];
  }

  // Legacy static reference for backwards compatibility
  private readonly legacyAuroraColors = [
    { r: 0, g: 25, b: 50, a: 0.4 }, // Deep blue
    { r: 0, g: 50, b: 100, a: 0.2 }, // Medium blue
    { r: 0, g: 100, b: 150, a: 0.1 }, // Light blue
    { r: 50, g: 150, b: 100, a: 0.15 }, // Blue-green
    { r: 100, g: 200, b: 150, a: 0.12 }, // Green
    { r: 150, g: 255, b: 200, a: 0.08 }, // Light green
  ];

  public initialize(_dimensions: Dimensions, quality: QualityLevel): void {
    this.quality = quality;
    this.isInitialized = true;

    // Initialize light waves with random phases for natural variation
    const numWaves = this.getNumWaves();
    this.lightWaves = [];
    for (let i = 0; i < numWaves; i++) {
      this.lightWaves.push(Math.random() * 2 * Math.PI);
    }
  }

  public update(_dimensions: Dimensions, frameMultiplier: number = 1): void {
    if (!this.isInitialized) return;

    // Respect accessibility settings
    const animationSpeed = this.accessibility.reducedMotion ? 0.1 : 1.0;

    // Normalize frame multiplier to prevent extreme values
    const normalizedMultiplier = Math.min(Math.max(frameMultiplier, 0.1), 3);

    // Update light wave positions for smooth animation
    // Advance each wave at slightly different speeds for natural variation
    for (let i = 0; i < this.lightWaves.length; i++) {
      const currentWave = this.lightWaves[i];
      if (currentWave !== undefined) {
        // Base speed scaled by frame timing for consistent animation across refresh rates
        const waveSpeed = (0.008 + i * 0.002) * animationSpeed * normalizedMultiplier;
        this.lightWaves[i] = currentWave + waveSpeed;

        // Keep waves within reasonable bounds to prevent overflow
        const currentValue = this.lightWaves[i];
        if (currentValue !== undefined && currentValue > 4 * Math.PI) {
          this.lightWaves[i] = currentValue - 4 * Math.PI;
        }
      }
    }
  }

  public draw(ctx: CanvasRenderingContext2D, dimensions: Dimensions): void {
    if (!this.isInitialized) return;

    // Draw base gradient from dark to lighter
    if (this.layers.gradient) {
      this.drawBaseGradient(ctx, dimensions);
    }

    // Draw aurora light waves
    if (this.layers.waves) {
      this.drawAuroraWaves(ctx, dimensions);
    }
  }

  public setQuality(quality: QualityLevel): void {
    this.quality = quality;
    if (this.isInitialized) {
      // Adjust number of waves based on quality
      const numWaves = this.getNumWaves();
      while (this.lightWaves.length > numWaves) this.lightWaves.pop();
      while (this.lightWaves.length < numWaves) {
        this.lightWaves.push(Math.random() * 2 * Math.PI);
      }
    }
  }

  public setAccessibility(settings: AccessibilitySettings): void {
    this.accessibility = settings;
    // Note: Accessibility settings would be used to modify animation behavior
    // For example, reducing motion if settings.reducedMotion is true
  }

  public cleanup(): void {
    this.lightWaves = [];
    this.isInitialized = false;
  }

  public getMetrics(): PerformanceMetrics {
    return {
      fps: 60, // Estimated
      warnings: [],
      particleCount: this.lightWaves.length,
    };
  }

  private getNumWaves(): number {
    switch (this.quality) {
      case "high":
        return 12;
      case "medium":
        return 10;
      case "low":
        return 6;
      case "minimal":
        return 4;
      default:
        return 10;
    }
  }

  private drawBaseGradient(
    ctx: CanvasRenderingContext2D,
    dimensions: Dimensions
  ): void {
    // Create base gradient from dark to lighter
    const baseGradient = ctx.createLinearGradient(
      0,
      0,
      dimensions.width,
      dimensions.height
    );
    baseGradient.addColorStop(0, "rgb(5, 10, 25)"); // Very dark blue
    baseGradient.addColorStop(0.5, "rgb(10, 20, 40)"); // Dark blue
    baseGradient.addColorStop(1, "rgb(15, 30, 60)"); // Medium dark blue

    ctx.fillStyle = baseGradient;
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);
  }

  private drawAuroraWaves(
    ctx: CanvasRenderingContext2D,
    dimensions: Dimensions
  ): void {
    // Calculate wave positions for gradient
    const wavePositions: Array<[number, number]> = [];

    for (let i = 0; i < this.lightWaves.length; i++) {
      const wave = this.lightWaves[i];
      if (wave !== undefined) {
        const position = (Math.sin(wave) + 1) / 2; // Normalize to 0-1
        wavePositions.push([position, i]);
      }
    }

    // Sort positions to ensure proper gradient ordering
    wavePositions.sort((a, b) => a[0] - b[0]);

    // Create gradient with aurora colors
    const gradient = ctx.createLinearGradient(
      0,
      0,
      dimensions.width,
      dimensions.height
    );

    for (const [pos, waveIndex] of wavePositions) {
      const colorIndex = waveIndex % this.auroraColors.length;
      const color = this.auroraColors[colorIndex];

      if (color && this.lightWaves[waveIndex] !== undefined) {
        // Add some dynamic intensity variation with minimum visibility
        const waveValue = this.lightWaves[waveIndex];
        if (waveValue !== undefined) {
          // Ensure minimum 40% intensity, oscillates between 0.4 and 1.0
          const intensityFactor = 0.4 + 0.6 * ((Math.sin(waveValue * 1.5) + 1) / 2);
          const intensityMult = this.intensityMultipliers[this.intensity];
          const alpha = Math.min(1, color.a * intensityFactor * intensityMult);

          gradient.addColorStop(
            pos,
            `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`
          );
        }
      }
    }

    // Fill with the aurora gradient
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    // Add additional wave effects for more realism
    if (this.quality === "high" && this.layers.enhancedEffects) {
      this.drawAdditionalWaveEffects(ctx, dimensions);
    }
  }

  private drawAdditionalWaveEffects(
    ctx: CanvasRenderingContext2D,
    dimensions: Dimensions
  ): void {
    // Add subtle vertical wave patterns for enhanced aurora effect
    ctx.save();

    for (let i = 0; i < this.lightWaves.length; i += 2) {
      const wave = this.lightWaves[i];
      if (wave !== undefined) {
        const x = ((Math.sin(wave * 0.5) + 1) / 2) * dimensions.width;
        const width = 20 + Math.sin(wave) * 10;

        const waveGradient = ctx.createLinearGradient(
          x - width / 2,
          0,
          x + width / 2,
          0
        );
        const color = this.auroraColors[i % this.auroraColors.length];
        if (color) {
          const intensity = ((Math.sin(wave * 2) + 1) / 2) * 0.1;

          waveGradient.addColorStop(
            0,
            `rgba(${color.r}, ${color.g}, ${color.b}, 0)`
          );
          waveGradient.addColorStop(
            0.5,
            `rgba(${color.r}, ${color.g}, ${color.b}, ${intensity})`
          );
          waveGradient.addColorStop(
            1,
            `rgba(${color.r}, ${color.g}, ${color.b}, 0)`
          );

          ctx.fillStyle = waveGradient;
          ctx.fillRect(x - width / 2, 0, width, dimensions.height);
        }
      }
    }

    ctx.restore();
  }

  /**
   * Set layer visibility
   */
  public setLayerVisibility(layers: Partial<AuroraLayers>): void {
    this.layers = { ...this.layers, ...layers };
  }

  /**
   * Get current scene statistics
   */
  public getStats(): { waves: number } {
    return {
      waves: this.lightWaves.length,
    };
  }

  /**
   * Set color palette
   */
  public setColorPalette(palette: AuroraColorPalette): void {
    this.colorPalette = palette;
  }

  /**
   * Set intensity level
   */
  public setIntensity(intensity: AuroraIntensity): void {
    this.intensity = intensity;
  }
}
