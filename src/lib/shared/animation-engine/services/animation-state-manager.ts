/**
 * Animation State Service
 *
 * Focused service for managing prop states and coordinate calculations.
 * Single responsibility: Prop state management and coordinate transformations.
 */

import type {
  PropState,
  PropStates,
} from "$lib/shared/foundation/domain/types/PropState";

export interface InterpolationResult {
  blueAngles: {
    centerPathAngle: number;
    staffRotationAngle: number;
    x?: number; // Optional Cartesian x coordinate (for dash motions)
    y?: number; // Optional Cartesian y coordinate (for dash motions)
  } | null; // null = hand not present in sequence
  redAngles: {
    centerPathAngle: number;
    staffRotationAngle: number;
    x?: number; // Optional Cartesian x coordinate (for dash motions)
    y?: number; // Optional Cartesian y coordinate (for dash motions)
  } | null; // null = hand not present in sequence
  isValid: boolean;
}
export class AnimationStateManager {

  private bluePropState: PropState = {
    centerPathAngle: 0,
    staffRotationAngle: 0,
  };

  private redPropState: PropState = {
    centerPathAngle: 0,
    staffRotationAngle: 0,
  };

  /**
   * Get current blue prop state
   */
  getBluePropState(): PropState {
    return { ...this.bluePropState };
  }

  /**
   * Get current red prop state
   */
  getRedPropState(): PropState {
    return { ...this.redPropState };
  }

  /**
   * Get both prop states
   */
  getPropStates(): PropStates {
    return {
      blue: this.getBluePropState(),
      red: this.getRedPropState(),
    };
  }

  /**
   * Update prop states from interpolation result
   */
  updatePropStates(interpolationResult: InterpolationResult): PropStates {
    // Only update blue prop state if hand is present (null = hand not in sequence)
    if (interpolationResult.blueAngles) {
      const blueUpdate: Partial<PropState> = {
        centerPathAngle: interpolationResult.blueAngles.centerPathAngle,
        staffRotationAngle: interpolationResult.blueAngles.staffRotationAngle,
      };
      if (
        "x" in interpolationResult.blueAngles &&
        "y" in interpolationResult.blueAngles
      ) {
        blueUpdate.x = interpolationResult.blueAngles.x;
        blueUpdate.y = interpolationResult.blueAngles.y;
      }
      this.updateBluePropState(blueUpdate);
    }

    // Only update red prop state if hand is present (null = hand not in sequence)
    if (interpolationResult.redAngles) {
      const redUpdate: Partial<PropState> = {
        centerPathAngle: interpolationResult.redAngles.centerPathAngle,
        staffRotationAngle: interpolationResult.redAngles.staffRotationAngle,
      };
      if (
        "x" in interpolationResult.redAngles &&
        "y" in interpolationResult.redAngles
      ) {
        redUpdate.x = interpolationResult.redAngles.x;
        redUpdate.y = interpolationResult.redAngles.y;
      }
      this.updateRedPropState(redUpdate);
    }

    return this.getPropStates();
  }

  /**
   * Update blue prop state
   * Dash motions provide their own x,y coordinates, other motions only provide angles
   * CRITICAL: Must clear x,y when not provided to avoid stale DASH coordinates persisting
   */
  updateBluePropState(updates: Partial<PropState>): void {
    const newState: PropState = {
      centerPathAngle:
        updates.centerPathAngle ?? this.bluePropState.centerPathAngle,
      staffRotationAngle:
        updates.staffRotationAngle ?? this.bluePropState.staffRotationAngle,
    };

    // Only include x,y if explicitly provided in updates (DASH motions)
    // This ensures stale x,y from previous DASH motion doesn't persist into non-DASH motions
    if (updates.x !== undefined) newState.x = updates.x;
    if (updates.y !== undefined) newState.y = updates.y;

    this.bluePropState = newState;
  }

  /**
   * Update red prop state
   * Dash motions provide their own x,y coordinates, other motions only provide angles
   * CRITICAL: Must clear x,y when not provided to avoid stale DASH coordinates persisting
   */
  updateRedPropState(updates: Partial<PropState>): void {
    const newState: PropState = {
      centerPathAngle:
        updates.centerPathAngle ?? this.redPropState.centerPathAngle,
      staffRotationAngle:
        updates.staffRotationAngle ?? this.redPropState.staffRotationAngle,
    };

    // Only include x,y if explicitly provided in updates (DASH motions)
    // This ensures stale x,y from previous DASH motion doesn't persist into non-DASH motions
    if (updates.x !== undefined) newState.x = updates.x;
    if (updates.y !== undefined) newState.y = updates.y;

    this.redPropState = newState;
  }

  /**
   * Set prop states directly (for initialization)
   */
  setPropStates(blue: PropState, red: PropState): void {
    this.bluePropState = { ...blue };
    this.redPropState = { ...red };
  }

  /**
   * Reset prop states to default
   */
  resetPropStates(): void {
    this.bluePropState = {
      centerPathAngle: 0,
      staffRotationAngle: Math.PI,
    };
    this.redPropState = {
      centerPathAngle: Math.PI,
      staffRotationAngle: 0,
    };
  }
}
