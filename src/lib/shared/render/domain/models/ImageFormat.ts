/**
 * Image Format Domain Types
 *
 * Domain types for image format conversion and optimization.
 * Contains data models for image export operations.
 */

// ============================================================================
// IMAGE FORMAT DOMAIN TYPES
// ============================================================================

export interface ImageFormatOptions {
  format: "png" | "jpeg" | "webp";
  quality?: number; // 0.0 to 1.0 for lossy formats
  width?: number;
  height?: number;
  optimizeForPrint?: boolean;
}

export interface OptimizationSettings {
  enableCompression: boolean;
  maxFileSize?: number; // in bytes
  resizeStrategy?: "contain" | "cover" | "none";
}
