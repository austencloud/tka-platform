/**
 * UFOExitAnimator - Handles UFO exit animation logic
 *
 * Pure animation calculator for UFO departure effects.
 * Extracted from UFOSystem.updateExiting() for single responsibility.
 */

import type {
  IUFOExitAnimator,
  ExitAnimationInput,
  ExitAnimationResult,
} from "../contracts/IUFOExitAnimator";

export class UFOExitAnimator implements IUFOExitAnimator {
  calculate(input: ExitAnimationInput): ExitAnimationResult {
    const { stateTimer, exitDuration, exitType, currentY, size, speedMult } = input;
    const progress = Math.min(1, stateTimer / exitDuration);

    let opacity = 1;
    let scale = 1;
    let flashIntensity = 0;
    let yDelta = 0;

    switch (exitType) {
      case "warp":
        // Warp out: flash bright then vanish instantly
        if (progress < 0.4) {
          // Charge-up phase - shield brightens
          flashIntensity = progress / 0.4;
          opacity = 1;
          scale = 1 + 0.2 * (progress / 0.4); // Slight grow
        } else if (progress < 0.5) {
          // Flash peak
          flashIntensity = 1;
          opacity = 1;
          scale = 1.2;
        } else {
          // Instant vanish after flash
          opacity = 0;
          flashIntensity = Math.max(0, 1 - (progress - 0.5) / 0.5);
        }
        break;

      case "zoom":
        // Zoom away: rapidly shrink to dot and vanish
        // Ease-in for acceleration effect
        const zoomEase = Math.pow(progress, 2);
        scale = Math.max(0, 1 - zoomEase);
        opacity = Math.max(0, 1 - zoomEase * 0.8);
        // Slight upward drift as it flies away
        yDelta = -2 * speedMult;
        break;

      case "shootUp":
        // Shoot up: rapid acceleration upward, leaves screen
        // Quadratic acceleration
        const shootSpeed = progress * progress * 25 * speedMult;
        yDelta = -shootSpeed;
        // Calculate if still visible (caller will apply yDelta first)
        opacity = currentY + yDelta > -size * 2 ? 1 : 0;
        scale = 1;
        break;

      case "fade":
      default:
        // Simple fade out
        opacity = Math.max(0, 1 - progress);
        scale = 1;
        break;
    }

    // Check if exit is complete
    const isComplete =
      progress >= 1 ||
      (exitType === "shootUp" && currentY + yDelta < -size * 2) ||
      (exitType === "warp" && progress >= 0.6);

    return {
      opacity,
      scale,
      flashIntensity,
      yDelta,
      isComplete,
    };
  }
}
