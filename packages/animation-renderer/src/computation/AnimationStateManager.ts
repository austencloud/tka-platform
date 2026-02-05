import type { PropState, PropStates } from "@tka/types";
import type {
  IAnimationStateManager,
  InterpolationResult,
} from "../contracts/IAnimationStateManager";

export class AnimationStateManager implements IAnimationStateManager {
  private bluePropState: PropState = {
    centerPathAngle: 0,
    staffRotationAngle: 0,
  };

  private redPropState: PropState = {
    centerPathAngle: 0,
    staffRotationAngle: 0,
  };

  getBluePropState(): PropState {
    return { ...this.bluePropState };
  }

  getRedPropState(): PropState {
    return { ...this.redPropState };
  }

  getPropStates(): PropStates {
    return {
      blue: this.getBluePropState(),
      red: this.getRedPropState(),
    };
  }

  updatePropStates(interpolationResult: InterpolationResult): PropStates {
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

    return this.getPropStates();
  }

  updateBluePropState(updates: Partial<PropState>): void {
    const newState: PropState = {
      centerPathAngle:
        updates.centerPathAngle ?? this.bluePropState.centerPathAngle,
      staffRotationAngle:
        updates.staffRotationAngle ?? this.bluePropState.staffRotationAngle,
    };
    if (updates.x !== undefined) newState.x = updates.x;
    if (updates.y !== undefined) newState.y = updates.y;
    this.bluePropState = newState;
  }

  updateRedPropState(updates: Partial<PropState>): void {
    const newState: PropState = {
      centerPathAngle:
        updates.centerPathAngle ?? this.redPropState.centerPathAngle,
      staffRotationAngle:
        updates.staffRotationAngle ?? this.redPropState.staffRotationAngle,
    };
    if (updates.x !== undefined) newState.x = updates.x;
    if (updates.y !== undefined) newState.y = updates.y;
    this.redPropState = newState;
  }

  setPropStates(blue: PropState, red: PropState): void {
    this.bluePropState = { ...blue };
    this.redPropState = { ...red };
  }

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
