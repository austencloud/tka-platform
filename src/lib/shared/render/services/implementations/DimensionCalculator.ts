/**
 * Dimension Calculation Service
 *
 * Handles image dimension calculations with exact compatibility to the desktop
 * HeightDeterminer. This service calculates additional heights needed for text
 * areas (word titles, user info) based on beat count and scaling.
 *
 * Critical: All calculations match desktop determine_additional_heights() exactly.
 */

import type { SequenceExportOptions } from "../../domain/models/SequenceExportOptions";
import type { IDimensionCalculator } from "../contracts/IDimensionCalculator";

import { getDimensionCalculator } from "$lib/shared/render/getDimensionCalculator";

export class DimensionCalculator implements IDimensionCalculator {
  // Base constants matching desktop application
  private static readonly BASE_MARGIN = 50; // Match desktop BASE_MARGIN

  /**
   * Determine additional heights for text areas
   * Exactly matches desktop HeightDeterminer.determine_additional_heights()
   */
  determineAdditionalHeights(
    options: SequenceExportOptions,
    stepCount: number,
    stepScale: number
  ): [number, number] {
    if (!this.validateDimensions(stepCount, stepScale, options)) {
      throw new Error(
        `Invalid dimension parameters: stepCount=${stepCount}, stepScale=${stepScale}`
      );
    }

    let additionalHeightTop = 0;
    let additionalHeightBottom = 0;

    // Derive footer visibility from individual flags, falling back to addUserInfo for backwards compat
    const showCreatorName = options.showCreatorName ?? options.addUserInfo;
    const showNotes = options.showNotes ?? options.addUserInfo;
    const showBirthday = options.showBirthday ?? options.addUserInfo;
    const hasFooter = showCreatorName || showNotes || showBirthday;

    // Match desktop logic exactly based on beat count
    if (stepCount === 0) {
      additionalHeightTop = 0;
      additionalHeightBottom = hasFooter ? 55 : 0;
    } else if (stepCount === 1) {
      additionalHeightTop = options.addWord ? 150 : 0;
      additionalHeightBottom = hasFooter ? 55 : 0;
    } else if (stepCount === 2) {
      additionalHeightTop = options.addWord ? 200 : 0;
      additionalHeightBottom = hasFooter ? 75 : 0;
    } else {
      // stepCount >= 3
      additionalHeightTop = options.addWord ? 300 : 0;
      additionalHeightBottom = hasFooter ? 150 : 0;
    }

    // Apply beat scale exactly as desktop does
    const scaledTop = Math.floor(additionalHeightTop * stepScale);
    const scaledBottom = Math.floor(additionalHeightBottom * stepScale);

    return [scaledTop, scaledBottom];
  }

  /**
   * Calculate beat size with scaling
   * Matches desktop beat size calculation
   */
  calculateScaledBeatSize(baseSize: number, scale: number): number {
    if (baseSize <= 0 || scale <= 0) {
      throw new Error(
        `Invalid size parameters: baseSize=${baseSize}, scale=${scale}`
      );
    }

    return Math.floor(baseSize * scale);
  }

  /**
   * Calculate margin with scaling
   * Matches desktop margin calculation
   */
  calculateScaledMargin(baseMargin: number, scale: number): number {
    if (baseMargin < 0 || scale <= 0) {
      throw new Error(
        `Invalid margin parameters: baseMargin=${baseMargin}, scale=${scale}`
      );
    }

    return Math.floor(baseMargin * scale);
  }

  /**
   * Validate dimension parameters
   */
  validateDimensions(
    stepCount: number,
    stepScale: number,
    options: SequenceExportOptions
  ): boolean {
    // Beat count must be non-negative
    if (stepCount < 0) {
      return false;
    }

    // Beat scale must be positive
    if (stepScale <= 0) {
      return false;
    }

    // Beat scale should be reasonable to prevent memory issues
    if (stepScale > 10) {
      return false;
    }

    // Options must be provided
    if (!options) {
      return false;
    }

    // Required boolean properties must be defined
    if (
      typeof options.addWord !== "boolean" ||
      typeof options.addUserInfo !== "boolean"
    ) {
      return false;
    }

    return true;
  }

  /**
   * Get base margin constant
   */
  static getBaseMargin(): number {
    return DimensionCalculator.BASE_MARGIN;
  }

  /**
   * Calculate total additional height needed
   */
  calculateTotalAdditionalHeight(
    options: SequenceExportOptions,
    stepCount: number,
    stepScale: number
  ): number {
    const [top, bottom] = this.determineAdditionalHeights(
      options,
      stepCount,
      stepScale
    );
    return top + bottom;
  }

  /**
   * Calculate word area dimensions
   * Helper for text rendering service
   */
  calculateWordAreaDimensions(
    stepCount: number,
    stepScale: number,
    imageWidth: number
  ): { width: number; height: number; available: boolean } {
    let height = 0;

    if (stepCount === 0) {
      height = 0;
    } else if (stepCount === 1) {
      height = 150 * stepScale;
    } else if (stepCount === 2) {
      height = 200 * stepScale;
    } else {
      height = 300 * stepScale;
    }

    return {
      width: imageWidth,
      height: Math.floor(height),
      available: height > 0,
    };
  }

  /**
   * Calculate user info area dimensions
   * Helper for text rendering service
   */
  calculateUserInfoAreaDimensions(
    stepCount: number,
    stepScale: number,
    imageWidth: number
  ): { width: number; height: number; available: boolean } {
    let height = 0;

    if (stepCount === 0) {
      height = 55 * stepScale;
    } else if (stepCount === 1) {
      height = 55 * stepScale;
    } else if (stepCount === 2) {
      height = 75 * stepScale;
    } else {
      height = 150 * stepScale;
    }

    return {
      width: imageWidth,
      height: Math.floor(height),
      available: height > 0,
    };
  }

  /**
   * Calculate difficulty badge area
   * Based on desktop implementation
   */
  calculateDifficultyBadgeArea(additionalHeightTop: number): {
    size: number;
    inset: number;
    available: boolean;
  } {
    if (additionalHeightTop <= 0) {
      return { size: 0, inset: 0, available: false };
    }

    // Match desktop calculation exactly
    const size = Math.floor(additionalHeightTop * 0.75);
    const inset = Math.floor(additionalHeightTop / 8);

    return {
      size,
      inset,
      available: size > 0,
    };
  }

  /**
   * Get text scaling factors based on beat count
   * Matches desktop FontMarginHelper patterns
   */
  getTextScalingFactors(stepCount: number): {
    fontScale: number;
    marginScale: number;
    description: string;
  } {
    if (stepCount <= 1) {
      return {
        fontScale: 1 / 1.3,
        marginScale: 1 / 3,
        description: "Small scaling for 0-1 steps",
      };
    } else if (stepCount === 2) {
      return {
        fontScale: 1 / 1.4,
        marginScale: 1 / 2,
        description: "Medium scaling for 2 steps",
      };
    } else if (stepCount === 3) {
      return {
        fontScale: 1 / 1.5,
        marginScale: 1 / 2,
        description: "Medium scaling for 2 steps",
      };
    } else {
      return {
        fontScale: 1.0,
        marginScale: 1.0,
        description: "Full scaling for 3+ steps",
      };
    }
  }

  /**
   * Calculate memory usage estimate for dimensions
   */
  estimateMemoryUsage(
    width: number,
    height: number,
    bytesPerPixel: number = 4
  ): number {
    return width * height * bytesPerPixel;
  }

  /**
   * Get recommended maximum dimensions to prevent memory issues
   */
  getMaximumRecommendedDimensions(): {
    maxWidth: number;
    maxHeight: number;
    maxPixels: number;
  } {
    // Conservative limits for web browsers
    return {
      maxWidth: 16384, // 16K width
      maxHeight: 16384, // 16K height
      maxPixels: 268435456, // 256 megapixels
    };
  }

  /**
   * Validate that dimensions won't cause memory issues
   */
  validateMemoryUsage(
    width: number,
    height: number
  ): { safe: boolean; estimatedMB: number } {
    const limits = this.getMaximumRecommendedDimensions();
    const totalPixels = width * height;
    const estimatedBytes = this.estimateMemoryUsage(width, height);
    const estimatedMB = estimatedBytes / (1024 * 1024);

    const safe =
      width <= limits.maxWidth &&
      height <= limits.maxHeight &&
      totalPixels <= limits.maxPixels;

    return { safe, estimatedMB };
  }

  /**
   * Debug method to test height calculations across beat count range
   */
  debugHeightCalculations(
    maxBeats: number = 10,
    stepScale: number = 1
  ): Array<{
    stepCount: number;
    topHeight: number;
    bottomHeight: number;
    totalHeight: number;
    wordArea: boolean;
    userInfoArea: boolean;
  }> {
    const results = [];

    const testOptions: SequenceExportOptions = {
      addWord: true,
      addUserInfo: true,
      // Other required properties with defaults
      includeStartPosition: true,
      addStepNumbers: true,
      addReversalSymbols: true,
      combinedGrids: false,
      stepScale: stepScale,
      stepSize: 144,
      margin: 50,
      redVisible: true,
      blueVisible: true,
      userName: "Test User",
      exportDate: "1-1-2024",
      notes: "Test",
      format: "PNG",
      quality: 1.0,
      scale: 1.0,
      addDifficultyLevel: false,
    };

    for (let stepCount = 0; stepCount <= maxBeats; stepCount++) {
      const [topHeight, bottomHeight] = this.determineAdditionalHeights(
        testOptions,
        stepCount,
        stepScale
      );

      results.push({
        stepCount,
        topHeight,
        bottomHeight,
        totalHeight: topHeight + bottomHeight,
        wordArea: topHeight > 0,
        userInfoArea: bottomHeight > 0,
      });
    }

    return results;
  }
}

// DIRECT EXPORT - Use this instead of getDimensionCalculator()
// This avoids DI container rebuilds when this file changes
export const dimensionCalculator = new DimensionCalculator();
