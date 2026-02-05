/**
 * SVG Conversion Service Interfaces
 *
 * Service contracts for converting SVG elements and strings to Canvas.
 * Consolidates the SVG-to-Canvas conversion logic that was duplicated
 * across 4+ different services in the image export system.
 */

// ============================================================================
// DATA CONTRACTS (Domain Models)
// ============================================================================

export interface RenderQualitySettings {
  antialiasing: boolean;
  smoothScaling?: boolean;
  imageSmoothingQuality?: "low" | "medium" | "high";
  scale?: number;
  dpi?: number;
  quality?: number;
}

export interface SVGConversionOptions {
  format?: string;
  quality?: RenderQualitySettings | number;
  width?: number;
  height?: number;
  backgroundColor?: string;
  preserveAspectRatio?: boolean;
}

export interface ConversionResult {
  success: boolean;
  canvas?: HTMLCanvasElement;
  error?: string;
  metadata: {
    originalWidth: number;
    originalHeight: number;
    finalWidth: number;
    finalHeight: number;
    conversionTime: number;
  };
}
