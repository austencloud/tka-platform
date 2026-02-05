import type { GridMode } from "@tka/types";

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
  readonly gridPointData: GridPointData;
}

export interface GridDrawOptions {
  size?: number;
  opacity?: number;
  lineWidth?: number;
  strokeStyle?: string;
  padding?: number;
}

export interface CombinedGridOptions {
  primaryGridMode: GridMode;
  overlayGridMode?: GridMode;
  primaryOpacity?: number;
  overlayOpacity?: number;
}

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
