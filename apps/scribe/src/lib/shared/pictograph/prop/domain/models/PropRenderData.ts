/**
 * Prop Render Data Model
 *
 * Represents the complete rendering data for a prop including
 * position, rotation, SVG content, and loading state.
 */

export interface PropRenderData {
  position: { x: number; y: number };
  rotation: number;
  svgData: {
    svgContent: string;
    viewBox: { width: number; height: number };
    center: { x: number; y: number };
  } | null;
  loaded: boolean;
  error: string | null;
}
