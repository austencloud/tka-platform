/**
 * Dimension Calculation
 *
 * Handles image dimension calculations with exact compatibility to the desktop
 * HeightDeterminer. Calculates additional heights needed for text areas
 * (word titles, user info) based on beat count and scaling.
 *
 * Critical: All calculations match desktop determine_additional_heights() exactly.
 */

import type { SequenceExportOptions } from "../domain/models/sequence-export-options";

// Base constants matching desktop application
const BASE_MARGIN = 50; // Match desktop BASE_MARGIN

/**
 * Determine additional heights for text areas
 * Exactly matches desktop HeightDeterminer.determine_additional_heights()
 */
export function determineAdditionalHeights(
  options: SequenceExportOptions,
  stepCount: number,
  stepScale: number
): [number, number] {
  if (!validateDimensions(stepCount, stepScale, options)) {
    throw new Error(
      `Invalid dimension parameters: stepCount=${stepCount}, stepScale=${stepScale}`
    );
  }

  let additionalHeightTop = 0;
  let additionalHeightBottom = 0;

  const showNotes = options.showNotes ?? options.addUserInfo;
  const hasFooter = Boolean(
    showNotes || options.leftLabel || options.rightLabel || options.iconPath
  );

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
    additionalHeightTop = options.addWord ? 300 : 0;
    additionalHeightBottom = hasFooter ? 150 : 0;
  }

  const scaledTop = Math.floor(additionalHeightTop * stepScale);
  const scaledBottom = Math.floor(additionalHeightBottom * stepScale);

  return [scaledTop, scaledBottom];
}

export function calculateScaledBeatSize(baseSize: number, scale: number): number {
  if (baseSize <= 0 || scale <= 0) {
    throw new Error(`Invalid size parameters: baseSize=${baseSize}, scale=${scale}`);
  }
  return Math.floor(baseSize * scale);
}

export function calculateScaledMargin(baseMargin: number, scale: number): number {
  if (baseMargin < 0 || scale <= 0) {
    throw new Error(`Invalid margin parameters: baseMargin=${baseMargin}, scale=${scale}`);
  }
  return Math.floor(baseMargin * scale);
}

export function validateDimensions(
  stepCount: number,
  stepScale: number,
  options: SequenceExportOptions
): boolean {
  if (stepCount < 0) return false;
  if (stepScale <= 0) return false;
  if (stepScale > 10) return false;
  if (!options) return false;
  if (typeof options.addWord !== "boolean") {
    return false;
  }
  return true;
}

export function getBaseMargin(): number {
  return BASE_MARGIN;
}

export function calculateTotalAdditionalHeight(
  options: SequenceExportOptions,
  stepCount: number,
  stepScale: number
): number {
  const [top, bottom] = determineAdditionalHeights(options, stepCount, stepScale);
  return top + bottom;
}

export function calculateWordAreaDimensions(
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

export function calculateUserInfoAreaDimensions(
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

export function calculateDifficultyBadgeArea(additionalHeightTop: number): {
  size: number;
  inset: number;
  available: boolean;
} {
  if (additionalHeightTop <= 0) {
    return { size: 0, inset: 0, available: false };
  }

  const size = Math.floor(additionalHeightTop * 0.75);
  const inset = Math.floor(additionalHeightTop / 8);

  return { size, inset, available: size > 0 };
}

export function getTextScalingFactors(stepCount: number): {
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

export function estimateMemoryUsage(
  width: number,
  height: number,
  bytesPerPixel: number = 4
): number {
  return width * height * bytesPerPixel;
}

export function getMaximumRecommendedDimensions(): {
  maxWidth: number;
  maxHeight: number;
  maxPixels: number;
} {
  return {
    maxWidth: 16384,
    maxHeight: 16384,
    maxPixels: 268435456,
  };
}

export function validateMemoryUsage(
  width: number,
  height: number
): { safe: boolean; estimatedMB: number } {
  const limits = getMaximumRecommendedDimensions();
  const totalPixels = width * height;
  const estimatedBytes = estimateMemoryUsage(width, height);
  const estimatedMB = estimatedBytes / (1024 * 1024);

  const safe =
    width <= limits.maxWidth &&
    height <= limits.maxHeight &&
    totalPixels <= limits.maxPixels;

  return { safe, estimatedMB };
}
