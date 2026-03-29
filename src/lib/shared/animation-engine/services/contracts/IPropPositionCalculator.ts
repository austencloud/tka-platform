/**
 * IPropPositionCalculator
 *
 * Single source of truth for calculating prop endpoint positions.
 * Used by TrailCapturer, AnimationPathCache, and TrailPathGenerator.
 *
 * This is different from EndpointCalculator (which calculates motion angles
 * for pictographs). This calculates pixel positions of prop tips for trail rendering.
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

/**
 * Service for calculating prop endpoint positions for trail rendering
 */
export interface IPropPositionCalculator {
  /**
   * Calculate a single endpoint position
   *
   * @param prop - Prop state (angles, positions)
   * @param config - Configuration (canvas size, prop dimensions)
   * @param endType - Which end (0 = left, 1 = right/tip)
   * @param propType - Optional prop type (hand props return center as endpoint)
   * @returns Pixel position of the endpoint
   */
  calculateEndpoint(
    prop: PropState,
    config: PropEndpointConfig,
    endType: 0 | 1,
    propType?: string | null
  ): PropEndpointResult;

  /**
   * Calculate both endpoints at once (for video generation)
   *
   * @param prop - Prop state (angles, positions)
   * @param config - Configuration (canvas size, prop dimensions)
   * @param propType - Optional prop type (hand props return center for both)
   * @returns Both endpoint positions
   */
  calculateEndpoints(
    prop: PropState,
    config: PropEndpointConfig,
    propType?: string | null
  ): PropEndpointPair;

  /**
   * Calculate just the prop center position
   *
   * @param prop - Prop state (angles, positions)
   * @param config - Configuration (canvas size, prop dimensions)
   * @returns Pixel position of the prop center
   */
  calculateCenter(
    prop: PropState,
    config: PropEndpointConfig
  ): PropEndpointResult;
}
