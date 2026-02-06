/**
 * SVG Domain Types
 *
 * Domain models for SVG data structures used in pictograph rendering.
 * These are pure data contracts without behavior.
 */

// ============================================================================
// SVG DATA MODELS
// ============================================================================

export interface ArrowSvgData {
  id: string;
  svgContent: string;
  dimensions: SVGDimensions;
  imageSrc?: string | undefined;
  viewBox?: string | undefined;
  center?: { x: number; y: number } | undefined;
}

export interface SVGDimensions {
  width: number;
  height: number;
  viewBox?: string | undefined;
  center?: { x: number; y: number } | undefined;
}
export interface ISvgConfig {
  readonly SVG_SIZE: number;
  readonly CENTER_X: number;
  readonly CENTER_Y: number;
}
