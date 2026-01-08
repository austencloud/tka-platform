import type { Dimensions } from "$lib/shared/background/shared/domain/types/background-types";
import type { LightRay, CausticsState } from "../../domain/models/DeepOceanModels";

/**
 * Contract for light ray and caustics calculations
 */
export interface ILightRayCalculator {
  /**
   * Initialize light rays for the given dimensions
   */
  initializeLightRays(dimensions: Dimensions, count: number): LightRay[];

  /**
   * Update light ray animations
   */
  updateLightRays(lightRays: LightRay[], frameMultiplier: number): LightRay[];

  /**
   * Initialize caustic patterns
   */
  initializeCaustics(dimensions: Dimensions): CausticsState;

  /**
   * Update caustic animations
   */
  updateCaustics(
    caustics: CausticsState,
    dimensions: Dimensions,
    frameMultiplier: number
  ): CausticsState;

  /**
   * Get optimal light ray count for quality level
   */
  getLightRayCount(quality: string): number;

  /**
   * Check if caustics should be enabled for quality level
   */
  getCausticsEnabled(quality: string): boolean;
}
