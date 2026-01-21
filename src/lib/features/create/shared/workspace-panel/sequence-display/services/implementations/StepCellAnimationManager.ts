/**
 * StepCellAnimationManager
 *
 * Manages animation state for a single StepCell. Each cell instance should
 * have its own manager instance to track its individual animation state.
 *
 * This class consolidates the animation state management that was previously
 * spread across multiple $effect blocks and state variables in StepCell.svelte.
 */

import type { StepData } from "../../../../domain/models/StepData";
import type {
  IStepCellAnimationManager,
  StepCellAnimationState,
  StepCellAnimationConfig,
} from "../contracts/IStepCellAnimationManager";

/**
 * Creates a pictograph signature representing the fundamental structure
 * independent of transformations (which only change arrow locations/rotations).
 */
function getPictographSignature(stepData: StepData): string {
  if (stepData.isBlank) return "blank";

  const hasBlue = !!stepData.motions?.blue;
  const hasRed = !!stepData.motions?.red;
  const motionStructure = `${hasBlue ? "B" : ""}${hasRed ? "R" : ""}`;

  return `${stepData.letter || "null"}-${motionStructure}`;
}

export class StepCellAnimationManager implements IStepCellAnimationManager {
  // Animation state
  private hasAnimated = false;
  private animationName: string;
  private enableTransitions = false;

  // Tracking for change detection
  private previousBeatId = "";
  private previousEpoch = 0;
  private previousSignature = "";
  private previousIdForTransitions = "";

  // Timer for disabling transitions after animation completes
  private transitionTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: StepCellAnimationConfig = {}) {
    this.animationName = config.initialAnimationName ?? "gentleBloom";
  }

  getState(): StepCellAnimationState {
    return {
      hasAnimated: this.hasAnimated,
      animationName: this.animationName,
      enableTransitions: this.enableTransitions,
    };
  }

  shouldAnimateIn(shouldAnimate: boolean, isBlank: boolean): boolean {
    // Animate when:
    // 1. shouldAnimate prop is true (parent says this step should animate)
    // 2. hasAnimated is false (haven't animated yet)
    // 3. beat is not blank
    return shouldAnimate && !this.hasAnimated && !isBlank;
  }

  isVisible(shouldAnimate: boolean, index: number, isBlank: boolean): boolean {
    // If it should animate but hasn't yet, hide it (will become visible via animation)
    if (shouldAnimate && !this.hasAnimated) return false;

    // Special case: Start position tile (index -1) should be visible even when blank
    if (index === -1) return true;

    // If it's a blank beat, never show it
    if (isBlank) return false;

    // Otherwise, show it
    return true;
  }

  onBeatChanged(beatId: string): void {
    if (beatId !== this.previousBeatId) {
      this.hasAnimated = false;
      this.previousBeatId = beatId;
    }
  }

  onEpochChanged(epoch: number): void {
    if (epoch !== this.previousEpoch) {
      this.hasAnimated = false;
      this.previousEpoch = epoch;
    }
  }

  onDataChanged(beat: StepData): void {
    const currentSignature = getPictographSignature(beat);
    const signatureChanged = currentSignature !== this.previousSignature;
    const idChanged = beat.id !== this.previousIdForTransitions;

    // Only enable fade transitions when loading genuinely different content
    // (id changed AND signature changed). Transforms keep same id.
    if (idChanged && signatureChanged && !beat.isBlank) {
      this.enableTransitions = true;

      // Clear any existing timer
      if (this.transitionTimer) {
        clearTimeout(this.transitionTimer);
      }

      // Disable transitions after animation completes
      this.transitionTimer = setTimeout(() => {
        this.enableTransitions = false;
        this.transitionTimer = null;
      }, 350); // Match pictograph fade-in duration
    }

    this.previousSignature = currentSignature;
    this.previousIdForTransitions = beat.id;
  }

  onAnimationEnd(shouldAnimateIn: boolean): void {
    // Only mark as animated if we're currently supposed to be animating.
    // This prevents stale animationend events from old animations
    // from incorrectly setting hasAnimated=true before the new animation starts.
    if (shouldAnimateIn) {
      this.hasAnimated = true;
    }
  }

  setAnimationName(name: string): void {
    this.animationName = name;
  }

  reset(): void {
    this.hasAnimated = false;
    this.enableTransitions = false;
    this.previousBeatId = "";
    this.previousEpoch = 0;
    this.previousSignature = "";
    this.previousIdForTransitions = "";

    if (this.transitionTimer) {
      clearTimeout(this.transitionTimer);
      this.transitionTimer = null;
    }
  }
}

/**
 * Factory function for creating StepCellAnimationManager instances.
 * Each StepCell component should create its own instance.
 */
export function createStepCellAnimationManager(
  config?: StepCellAnimationConfig
): IStepCellAnimationManager {
  return new StepCellAnimationManager(config);
}
