import type { PointRef, Vec2 } from "../../domain/models/GridTopology";
import type { GridMode } from "$lib/shared/render/core/types";
import type { Plane } from "@austencloud/scene-3d";

// --- From TopologyBetaSeparator ---

/** Pixel offsets to apply to each prop to separate them */
export interface BetaOffset {
  readonly blue: Vec2;
  readonly red: Vec2;
}

// --- From TopologyBuilder ---

export interface GridOptions {
  /** Grid rendering mode (default: "diamond") */
  mode?: GridMode;
  /** Explicit center position - overrides conjoin placement */
  center?: Vec2;
  /** Hand point radius in abstract units (default: 1.0) */
  radius?: number;
  /** Plane for 3D (default: "wall", L8+) */
  plane?: Plane;
}

// --- From TopologyPositionEnumerator ---

export interface PositionPair {
  readonly blue: PointRef;
  readonly red: PointRef;
}

// --- From TopologyPropLoader ---

/** Render-ready prop data for direct SVG rendering */
export interface TopologyPropRenderData {
  /** SVG content string (colored, ready to render) */
  readonly svgContent: string;
  /** SVG viewBox dimensions */
  readonly viewBox: { width: number; height: number };
  /** SVG center point for transform origin */
  readonly center: { x: number; y: number };
  /** Position in 950x950 grid space (strict coordinates) */
  readonly position: { x: number; y: number };
  /** Rotation angle in degrees */
  readonly rotation: number;
}

// --- From TopologyRenderer ---

export interface ViewBoxData {
  /** SVG viewBox string: "minX minY width height" */
  readonly viewBox: string;
  /** Width in SVG units */
  readonly width: number;
  /** Height in SVG units */
  readonly height: number;
  /** Origin offset: minX, minY */
  readonly origin: Vec2;
}
