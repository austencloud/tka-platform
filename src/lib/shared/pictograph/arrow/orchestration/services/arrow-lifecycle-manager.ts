/**
 * Arrow Lifecycle Manager Implementation
 *
 * Single responsibility service for coordinating all arrow lifecycle operations.
 * Orchestrates loading, positioning, and state management for arrows.
 *
 * Manual adjustments from WASD are stored and applied in SCREEN-SPACE directly.
 * No transformation is needed because the user expects WASD to move arrows
 * in screen directions (W = up, D = right, etc.).
 */

import type { PictographData } from "../../../shared/domain/models/pictograph-data";
import {
  isVisibleMotion,
  type MotionData,
} from "../../../shared/domain/models/motion-data";
import type { ArrowSvgLoader } from "../../rendering/services/arrow-svg-loader";
import {
  calculateArrowPoint,
  shouldMirrorArrow,
} from "./arrow-positioning-orchestrator";
import type {
  ArrowAssets,
  ArrowLifecycleResult,
  ArrowPosition,
  ArrowState,
} from "../domain/arrow-models";
import {
  createArrowAssets,
  createArrowLifecycleResult,
  createArrowPosition,
  createArrowState,
} from "../domain/arrow-factories";
import type { ArrowLifecycleOptions } from "./types";

export class ArrowLifecycleManager {
  constructor(private svgLoader: ArrowSvgLoader) {}

  /**
   * Load arrow assets for a single motion
   * @param options Optional settings including themeMode for color selection
   */
  async loadArrowAssets(
    motionData: MotionData,
    options?: ArrowLifecycleOptions
  ): Promise<ArrowAssets> {
    if (!motionData.arrowPlacementData) {
      throw new Error("No arrow placement data available");
    }

    const svgData = await this.svgLoader.loadArrowSvg(
      motionData.arrowPlacementData,
      motionData,
      options?.themeMode ? { themeMode: options.themeMode } : undefined
    );

    return createArrowAssets({
      imageSrc: svgData.imageSrc,
      viewBox: {
        width: svgData.dimensions.width,
        height: svgData.dimensions.height,
        // Include full viewBox string for Canvas2D rendering (preserves origin for negative coords)
        fullViewBox: svgData.dimensions.viewBox || svgData.viewBox,
      },
      center: svgData.center ?? svgData.dimensions.center,
      shaftSrc: svgData.shaftSrc,
      tipSrc: svgData.tipSrc,
      tipBBox: svgData.tipBBox,
    });
  }

  /**
   * Calculate position for a single arrow
   * @param options Optional settings including gridMode for positioning
   */
  async calculateArrowPosition(
    motionData: MotionData,
    pictographData: PictographData,
    options?: ArrowLifecycleOptions
  ): Promise<ArrowPosition> {
    const [x, y, rotation] = await calculateArrowPoint(
        pictographData,
        motionData,
        options?.gridMode,
        options?.soloMode
      );

    // IMPORTANT: calculateArrowPoint() returns the base position + calculated
    // adjustments (from special/default placement JSON files), but does NOT
    // include manual adjustments from WASD controls.
    // Manual adjustments must be applied HERE for rendering.
    const manualAdjustX = motionData.arrowPlacementData?.manualAdjustmentX ?? 0;
    const manualAdjustY = motionData.arrowPlacementData?.manualAdjustmentY ?? 0;

    const finalX = x + manualAdjustX;
    const finalY = y + manualAdjustY;

    return createArrowPosition({
      x: finalX,
      y: finalY,
      rotation,
    });
  }

  /**
   * Determine if arrow should be mirrored
   */
  shouldMirrorArrow(
    motionData: MotionData,
    pictographData: PictographData
  ): boolean {
    if (!motionData.arrowPlacementData) {
      return false;
    }

    return shouldMirrorArrow(
      motionData.arrowPlacementData,
      pictographData,
      motionData
    );
  }

  /**
   * Get complete arrow state for a single motion
   * @param options Optional settings including themeMode for color selection and gridMode for positioning
   */
  async getArrowState(
    motionData: MotionData,
    pictographData: PictographData,
    options?: ArrowLifecycleOptions
  ): Promise<ArrowState> {
    try {
      // Load assets and calculate position in parallel
      const [assets, position] = await Promise.all([
        this.loadArrowAssets(motionData, options),
        this.calculateArrowPosition(motionData, pictographData, options),
      ]);

      const shouldMirror = this.shouldMirrorArrow(motionData, pictographData);

      return createArrowState({
        assets,
        position,
        shouldMirror,
        isVisible: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return createArrowState({
        assets: null,
        position: null,
        shouldMirror: false,
        isVisible: false,
        isLoading: false,
        error: errorMessage,
      });
    }
  }

  /**
   * Coordinate complete arrow lifecycle for all motions in pictograph
   * This is the main coordination method that ensures proper loading order
   * @param options Optional settings including themeMode for color selection
   */
  async coordinateArrowLifecycle(
    pictographData: PictographData,
    options?: ArrowLifecycleOptions
  ): Promise<ArrowLifecycleResult> {
    if (!pictographData.motions) {
      return createArrowLifecycleResult({ allReady: true });
    }

    const positions: Record<string, ArrowPosition> = {};
    const mirroring: Record<string, boolean> = {};
    const assets: Record<string, ArrowAssets> = {};
    const errors: Record<string, string> = {};

    // Process all motions in parallel for better performance
    const motionPromises = Object.entries(pictographData.motions).map(
      async ([color, motionData]) => {
        // invisible placeholder = hand not really there (both-required Step shape)
        if (!isVisibleMotion(motionData)) {
          return;
        }

        try {
          const arrowState = await this.getArrowState(
            motionData,
            pictographData,
            options
          );

          if (arrowState.error) {
            errors[color] = arrowState.error;
          } else if (arrowState.assets && arrowState.position) {
            positions[color] = arrowState.position;
            mirroring[color] = arrowState.shouldMirror;
            assets[color] = arrowState.assets;
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          errors[color] = errorMessage;
        }
      }
    );

    await Promise.all(motionPromises);

    const allReady =
      Object.keys(errors).length === 0 && Object.keys(positions).length > 0;

    return createArrowLifecycleResult({
      positions,
      mirroring,
      assets,
      allReady,
      errors,
    });
  }

  /**
   * Reset arrow state (for data changes)
   */
  resetArrowState(): void {
    // This method can be used to clear any internal caches or state
    // Currently no internal state to reset, but provides extension point
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
// Use this instead of arrowLifecycleManager to avoid DI container rebuilds.
// ============================================================================

import { arrowSvgLoader } from "../../rendering/services/arrow-svg-loader";


export const arrowLifecycleManager = new ArrowLifecycleManager(
  arrowSvgLoader
);
