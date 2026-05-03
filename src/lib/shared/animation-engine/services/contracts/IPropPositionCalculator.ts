/**
 * Prop Position Calculator Types
 *
 * Co-exported types for prop endpoint position calculations.
 */

import type { PropState } from "../../domain/PropState";

/**
 * Configuration for endpoint calculations
 */
export interface PropEndpointConfig {
  /** Canvas size in pixels */
  canvasSize: number;
  /** Prop dimensions in viewbox coordinates */
  propDimensions: { width: number; height: number };
  /** Grid halfway point offset (default: 150) */
  gridHalfwayOffset?: number;
  /** Inward factor for radius (default: 1.0) */
  inwardFactor?: number;
}

/**
 * Result of a single endpoint calculation
 */
export interface PropEndpointResult {
  x: number;
  y: number;
}

/**
 * Result of calculating both endpoints
 */
export interface PropEndpointPair {
  /** Left end (tipIndex 0) */
  left: PropEndpointResult;
  /** Right end (tipIndex 1, tip) */
  right: PropEndpointResult;
}

