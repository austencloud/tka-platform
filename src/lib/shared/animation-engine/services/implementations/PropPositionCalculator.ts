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
  PropEndpointConfig,
  PropEndpointResult,
  PropEndpointPair,
} from "../contracts/IPropPositionCalculator";
import { getTrailPointConfig, type TrailPointSource } from "../../domain/types/TrailPointTypes";
import { getTipPoints } from "../../domain/types/PropTipPoints";

/** Viewbox size for coordinate calculations */
const VIEWBOX_SIZE = 950;

/** Default grid halfway point offset (matches strict grid points) */
const DEFAULT_GRID_HALFWAY_OFFSET = 150;

/** Default inward factor (no adjustment for animation mode) */
const DEFAULT_INWARD_FACTOR = 1.0;

export class PropPositionCalculator {
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

    // Check for trail point assignment override
    const trailConfig = getTrailPointConfig(propType);
    if (trailConfig) {
      const source = endType === 0 ? trailConfig.left : trailConfig.right;
      return this.resolveTrailEndpoint(source, propType, config, center);
    }

    // Geometric fallback: offset from center along rotation axis
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

    // Check for trail point assignment override
    const trailConfig = getTrailPointConfig(propType);
    if (trailConfig) {
      return {
        left: this.resolveTrailEndpoint(trailConfig.left, propType, config, center),
        right: this.resolveTrailEndpoint(trailConfig.right, propType, config, center),
      };
    }

    // Geometric fallback
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

  /**
   * Resolve a trail point source to an offset from center.
   * Returns null for "none" sources (trail disabled for this end).
   */
  private resolveTrailSource(
    source: TrailPointSource,
    propType: string | null | undefined,
    config: PropEndpointConfig
  ): { offsetX: number; offsetY: number } | null {
    if (source.type === "none") return null;

    const gridScaleFactor = config.canvasSize / VIEWBOX_SIZE;

    if (source.type === "tip") {
      const tipConfig = getTipPoints(propType);
      const tipPoint = tipConfig.points[source.index];
      if (!tipPoint) return null;
      return {
        offsetX: tipPoint.dx * gridScaleFactor,
        offsetY: tipPoint.dy * gridScaleFactor,
      };
    }

    if (source.type === "custom") {
      return {
        offsetX: source.dx * gridScaleFactor,
        offsetY: source.dy * gridScaleFactor,
      };
    }

    return null;
  }

  /**
   * Resolve a trail endpoint to a pixel position.
   * For "none" sources, returns center (trail renderer should skip).
   */
  private resolveTrailEndpoint(
    source: TrailPointSource,
    propType: string | null | undefined,
    config: PropEndpointConfig,
    center: PropEndpointResult
  ): PropEndpointResult {
    const resolved = this.resolveTrailSource(source, propType, config);
    if (!resolved) return { ...center };
    return {
      x: center.x + resolved.offsetX,
      y: center.y + resolved.offsetY,
    };
  }
}
