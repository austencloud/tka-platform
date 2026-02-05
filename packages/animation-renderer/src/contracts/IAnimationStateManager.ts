import type { PropState, PropStates } from "@tka/types";

export interface InterpolationResult {
  blueAngles: {
    centerPathAngle: number;
    staffRotationAngle: number;
    x?: number;
    y?: number;
  };
  redAngles: {
    centerPathAngle: number;
    staffRotationAngle: number;
    x?: number;
    y?: number;
  };
  isValid: boolean;
}

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
