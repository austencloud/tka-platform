/**
 * UFOEntranceAnimator - Handles UFO entrance animation logic
 *
 * Pure animation calculator for UFO appearance effects.
 * Extracted from UFOSystem.updateEntering() for single responsibility.
 */

import type {
  IUFOEntranceAnimator,
  EntranceAnimationInput,
  EntranceAnimationResult,
} from "../contracts/IUFOEntranceAnimator";

export class UFOEntranceAnimator implements IUFOEntranceAnimator {
  calculate(input: EntranceAnimationInput): EntranceAnimationResult {
    const { stateTimer, enterDuration, entranceType, startY, targetY } = input;
    const progress = Math.min(1, stateTimer / enterDuration);

    let opacity = 0;
    let scale = 1;
    let flashIntensity = 0;
    let y = startY;

    switch (entranceType) {
      case "warp":
        if (progress < 0.3) {
          // Flash phase - bright shield pulse
          flashIntensity = 1 - progress / 0.3;
          opacity = progress / 0.3;
          scale = 0.8 + 0.4 * (progress / 0.3); // Slight scale pulse
        } else {
          // Settle phase
          flashIntensity = 0;
          opacity = 1;
          scale = 1.2 - 0.2 * ((progress - 0.3) / 0.7); // Shrink back to normal
        }
        y = targetY;
        break;

      case "zoom":
        // Zoom: approach from far away (tiny to full size)
        // Ease-out for deceleration effect
        const zoomEase = 1 - Math.pow(1 - progress, 3);
        scale = 0.05 + 0.95 * zoomEase;
        opacity = 0.5 + 0.5 * zoomEase;
        y = targetY;
        break;

      case "descend":
        // Descend: drop down from above, slowing as it arrives
        const descendEase = 1 - Math.pow(1 - progress, 2); // Ease-out
        y = startY + (targetY - startY) * descendEase;
        opacity = 0.8 + 0.2 * progress;
        scale = 1;
        break;

      case "fade":
      default:
        // Simple fade in
        opacity = progress;
        scale = 1;
        y = targetY;
        break;
    }

    // Normalize final values when complete
    const isComplete = progress >= 1;
    if (isComplete) {
      opacity = 1;
      scale = 1;
      flashIntensity = 0;
    }

    return {
      opacity,
      scale,
      flashIntensity,
      y,
      isComplete,
    };
  }
}
