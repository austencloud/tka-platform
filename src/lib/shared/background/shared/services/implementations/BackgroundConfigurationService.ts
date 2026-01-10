import { NightSkyConfig } from "../../../night-sky/domain/constants/night-sky-constants";
import {
  CoreBackgroundConfig,
  QUALITY_CONFIGS,
} from "../../domain/constants/BackgroundConfigs";
import type { QualityLevel } from "../../domain/types/background-types";
import type { IBackgroundConfigurationService } from "../contracts/IBackgroundConfigurationService";

export class BackgroundConfigurationService implements IBackgroundConfigurationService {
  /**
   * Detects the appropriate quality level based on device capabilities
   * and performance characteristics.
   */
  detectAppropriateQuality(): QualityLevel {
    // Check device memory (if available) - ultra-minimal for extremely low memory
    const deviceMemory = (navigator as Navigator & { deviceMemory?: number })
      .deviceMemory;
    if (deviceMemory && deviceMemory < 2) {
      return "ultra-minimal"; // <2GB RAM = absolute lowest tier
    }

    // Check connection type (if available) - ultra-minimal for slowest connections
    const connection = (
      navigator as Navigator & {
        connection?: {
          effectiveType?: string;
        };
      }
    ).connection;
    if (connection) {
      const effectiveType = connection.effectiveType;
      if (effectiveType === "slow-2g") {
        return "ultra-minimal"; // Slowest connection
      }
      if (effectiveType === "2g") {
        return "minimal";
      }
      if (effectiveType === "3g") {
        return "low";
      }
    }

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion) {
      return "minimal";
    }

    // Check device memory (mid-range)
    if (deviceMemory && deviceMemory < 4) {
      return "low"; // 2-4GB RAM
    }

    // Check hardware concurrency (CPU cores)
    const hardwareConcurrency = navigator.hardwareConcurrency || 2;
    if (hardwareConcurrency < 4) {
      return "medium";
    }

    // Check screen size and pixel density
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    const pixelRatio = window.devicePixelRatio || 1;

    // Low resolution or small screens
    if (screenWidth < 1024 || screenHeight < 768) {
      return "medium";
    }

    // Very high pixel density might strain performance
    if (pixelRatio > 2) {
      return "medium";
    }

    // Check if we're on a mobile device
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
    if (isMobile) {
      return "medium";
    }

    // Note: Battery API check removed as it's async and would require
    // this method to be async, which would complicate the detection logic.
    // Battery level optimization can be handled separately if needed.

    // Default to high quality for desktop devices with good specs
    return "high";
  }

  /**
   * Get configuration for a specific quality level
   */
  getQualityConfig(quality: QualityLevel) {
    return QUALITY_CONFIGS[quality];
  }

  /**
   * Get optimized configuration for a specific quality level
   * This function provides both the base config and quality-specific settings
   */
  getOptimizedConfig(quality: QualityLevel) {
    const qualitySettings = this.getQualityConfig(quality);

    return {
      config: {
        core: {
          background: CoreBackgroundConfig,
        },
        nightSky: NightSkyConfig,
      },
      qualitySettings: {
        ...qualitySettings,
        enableShootingStars: quality === "high" || quality === "medium",
      },
    };
  }

  /**
   * Gets normalized configuration with quality adjustments
   */
  getQualityAdjustedConfig<T extends Record<string, unknown>>(
    baseConfig: T,
    quality: QualityLevel
  ): T & { quality: (typeof QUALITY_CONFIGS)[keyof typeof QUALITY_CONFIGS] } {
    const qualityConfig = QUALITY_CONFIGS[quality];

    const adjustedConfig = {
      ...baseConfig,
      quality: qualityConfig,
    };

    // Apply quality-based adjustments with proper typing
    if ("density" in baseConfig && typeof baseConfig["density"] === "number") {
      (adjustedConfig as unknown as { density: number }).density =
        baseConfig["density"] * qualityConfig.densityMultiplier;
    }

    if ("maxSize" in baseConfig && typeof baseConfig["maxSize"] === "number") {
      (adjustedConfig as unknown as { maxSize: number }).maxSize = Math.max(
        1,
        baseConfig["maxSize"] * (qualityConfig.particleSize / 4)
      );
    }

    return adjustedConfig;
  }

  /**
   * Creates a bounded random value within min/max range
   */
  createBoundedRandom(min: number, max: number): () => number {
    return () => Math.random() * (max - min) + min;
  }

  /**
   * Gets a random color from an array of colors
   */
  getRandomColor(colors: string[]): string {
    return (
      colors[Math.floor(Math.random() * colors.length)] ||
      colors[0] ||
      "#000000"
    );
  }
}
