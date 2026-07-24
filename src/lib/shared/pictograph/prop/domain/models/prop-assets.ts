/**
 * Prop Assets Model
 *
 * Represents the SVG assets for a prop - mirrors ArrowAssets structure
 */

import type { PropType } from "../enums/prop-type";

export interface PropAssets {
  imageSrc: string; // SVG content ready for rendering
  viewBox: string; // SVG viewBox for scaling
  center: { x: number; y: number }; // Center point for positioning
  /** The prop type that produced this asset after render-time overrides. */
  propType?: PropType | string;
}
