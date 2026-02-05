/**
 * Prop Assets Model
 *
 * Represents the SVG assets for a prop - mirrors ArrowAssets structure
 */

export interface PropAssets {
  imageSrc: string;
  viewBox: string;
  center: { x: number; y: number };
}
