/**
 * Animation State Service Interface
 *
 * Interface for managing animation state.
 * Handles prop state updates and management.
 */

import type {
  PropState,
  PropStates,
} from "../../shared/domain/types/PropState";

export interface IAnimationStateManager {
  getBluePropState(): PropState;
  getRedPropState(): PropState;
  getPropStates(): PropStates;
  updatePropStates(interpolationResult: InterpolationResult): PropStates;
  updateBluePropState(updates: Partial<PropState>): void;
  updateRedPropState(updates: Partial<PropState>): void;
  setPropStates(blue: PropState, red: PropState): void;
  resetPropStates(): void;
}

export interface InterpolationResult {
  blueAngles: {
    centerPathAngle: number;
    staffRotationAngle: number;
    x?: number; // Optional Cartesian x coordinate (for dash motions)
    y?: number; // Optional Cartesian y coordinate (for dash motions)
  };
  redAngles: {
    centerPathAngle: number;
    staffRotationAngle: number;
    x?: number; // Optional Cartesian x coordinate (for dash motions)
    y?: number; // Optional Cartesian y coordinate (for dash motions)
  };
  isValid: boolean;
}
