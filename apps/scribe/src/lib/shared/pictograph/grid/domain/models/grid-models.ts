import type { GridMode } from "../enums/grid-enums";

export interface GridCoordinateData {
  hand_points: {
    normal: Record<string, string>;
    strict: Record<string, string>;
  };
  layer2_points: {
    normal: Record<string, string>;
    strict: Record<string, string>;
  };
  outer_points: Record<string, string>;
  center_point: string;
}
export interface GridData {
  readonly gridMode: GridMode;
  readonly centerX: number;
  readonly centerY: number;
  readonly radius: number;
  readonly gridPointData: GridPointData; //
}

export interface GridDrawOptions {
  size?: number; // Grid size for canvas drawing
  opacity?: number; // Grid opacity (0-1)
  lineWidth?: number; // Line width for grid lines
  strokeStyle?: string; // Line color/style
  padding?: number; // Padding around grid
}

// Combined grid options for overlay rendering
export interface CombinedGridOptions {
  primaryGridMode: GridMode; // Primary grid type
  overlayGridMode?: GridMode; // Optional overlay grid type
  primaryOpacity?: number; // Primary grid opacity
  overlayOpacity?: number; // Overlay grid opacity
}

// Legacy generic grid display options (kept for backward compatibility)
export interface GenericGridDisplayOptions {
  showGrid: boolean;
  gridColor: string;
  gridOpacity: number;
  showLabels: boolean;
  labelColor: string;
  labelSize: number;
}

export interface GridValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
/**
 * Grid data interface matching the legacy system
 */
export interface GridPointData {
  allHandPointsStrict: Record<
    string,
    { coordinates: { x: number; y: number } | null }
  >;
  allHandPointsNormal: Record<
    string,
    { coordinates: { x: number; y: number } | null }
  >;
  allLayer2PointsStrict: Record<
    string,
    { coordinates: { x: number; y: number } | null }
  >;
  allLayer2PointsNormal: Record<
    string,
    { coordinates: { x: number; y: number } | null }
  >;
  allOuterPoints: Record<
    string,
    { coordinates: { x: number; y: number } | null }
  >;
  centerPoint: { coordinates: { x: number; y: number } | null };
}
