/**
 * PropPositionCalculator
 *
 * Single source of truth for calculating prop endpoint positions for trail rendering.
 * Consolidates logic previously duplicated in:
 * - TrailCapturer.ts (real-time capture)
 * - AnimationPathCache.ts (pre-computation)
 * - TrailPathGenerator.ts (video generation)
 *
 * Uses the same coordinate system as PixiPropRenderer for accurate trails.
 */

import type { PropState } from "$lib/features/compose/shared/domain/types/PropState";
import type {
  IPropPositionCalculator,
  PropEndpointConfig,
  PropEndpointResult,
  PropEndpointPair,
} from "../contracts/IPropPositionCalculator";

/** Viewbox size for coordinate calculations */
const VIEWBOX_SIZE = 950;

/** Default grid halfway point offset (matches strict grid points) */
const DEFAULT_GRID_HALFWAY_OFFSET = 150;

/** Default inward factor (no adjustment for animation mode) */
const DEFAULT_INWARD_FACTOR = 1.0;

export class PropPositionCalculator implements IPropPositionCalculator {
  calculateEndpoint(
    prop: PropState,
    config: PropEndpointConfig,
    endType: 0 | 1,
    propType?: string | null
  ): PropEndpointResult {
    const center = this.calculateCenter(prop, config);

    // Hand props return center as the endpoint (no staff to track)
    if (propType?.toLowerCase() === "hand") {
      return center;
    }

    const gridScaleFactor = config.canvasSize / VIEWBOX_SIZE;
    const staffHalfWidth = (config.propDimensions.width / 2) * gridScaleFactor;
    const staffEndOffset = endType === 1 ? staffHalfWidth : -staffHalfWidth;

    return {
      x: center.x + Math.cos(prop.staffRotationAngle) * staffEndOffset,
      y: center.y + Math.sin(prop.staffRotationAngle) * staffEndOffset,
    };
  }

  calculateEndpoints(
    prop: PropState,
    config: PropEndpointConfig,
    propType?: string | null
  ): PropEndpointPair {
    const center = this.calculateCenter(prop, config);

    // Hand props return center for both endpoints
    if (propType?.toLowerCase() === "hand") {
      return {
        left: { ...center },
        right: { ...center },
      };
    }

    const gridScaleFactor = config.canvasSize / VIEWBOX_SIZE;
    const staffHalfWidth = (config.propDimensions.width / 2) * gridScaleFactor;

    const offsetX = Math.cos(prop.staffRotationAngle) * staffHalfWidth;
    const offsetY = Math.sin(prop.staffRotationAngle) * staffHalfWidth;

    return {
      left: {
        x: center.x - offsetX,
        y: center.y - offsetY,
      },
      right: {
        x: center.x + offsetX,
        y: center.y + offsetY,
      },
    };
  }

  calculateCenter(
    prop: PropState,
    config: PropEndpointConfig
  ): PropEndpointResult {
    const { canvasSize } = config;
    const gridHalfwayOffset = config.gridHalfwayOffset ?? DEFAULT_GRID_HALFWAY_OFFSET;
    const inwardFactor = config.inwardFactor ?? DEFAULT_INWARD_FACTOR;

    const centerX = canvasSize / 2;
    const centerY = canvasSize / 2;
    const gridScaleFactor = canvasSize / VIEWBOX_SIZE;
    const scaledHalfwayRadius = gridHalfwayOffset * gridScaleFactor;

    // Cartesian coordinates (for DASH motions)
    if (prop.x !== undefined && prop.y !== undefined) {
      return {
        x: centerX + prop.x * scaledHalfwayRadius * inwardFactor,
        y: centerY + prop.y * scaledHalfwayRadius * inwardFactor,
      };
    }

    // Polar coordinates (for circular motions)
    return {
      x: centerX + Math.cos(prop.centerPathAngle) * scaledHalfwayRadius * inwardFactor,
      y: centerY + Math.sin(prop.centerPathAngle) * scaledHalfwayRadius * inwardFactor,
    };
  }
}
