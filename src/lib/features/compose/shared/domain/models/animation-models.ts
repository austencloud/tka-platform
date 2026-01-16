import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type {
  MotionType,
  RotationDirection,
  Orientation,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

// Note: InterpolationResult and StepCalculationResult are defined in service contracts
// (services/contracts/IAnimationStateManager.ts and services/contracts/IStepCalculator.ts)
// Note: MotionEndpoints is now defined in shared domain types

export interface AnimationConfig {
  duration: number;
  easing: string;
  autoPlay: boolean;
  loop: boolean;
}

export interface AnimationState {
  isPlaying: boolean;
  currentFrame: number;
  totalFrames: number;
  progress: number;
  currentStep: number;
}

export interface PropVisibility {
  blue: boolean;
  red: boolean;
}

/**
 * Motion Test Parameters
 * Domain model for motion testing and configuration
 */
export interface AnimatedMotionParams {
  startLocation: GridLocation;
  endLocation: GridLocation;
  motionType: MotionType;
  turns: number | "fl"; // Support both numeric turns and float
  rotationDirection: RotationDirection;
  startOrientation: Orientation;
  endOrientation: Orientation;
}

// Legacy alias for backward compatibility
export type MotionTestParams = AnimatedMotionParams;

// ============================================================================
// NOTE: Motion calculation logic has been moved to services
// - calculateMotionEndpoints() → EndpointCalculator service
// - lerpAngle() → AngleCalculator service
// Domain models should only contain data structures, not business logic
// ============================================================================

export interface LetterIdentificationResult {
  letter: string;
  confidence: number;
  isValid: boolean;
}

export interface LetterMapping {
  startPosition: GridLocation;
  endPosition: GridLocation;
  blueMotionType: MotionType;
  redMotionType: MotionType;
  // Add other motion properties as needed
  turns?: number | "fl";
  rotationDirection?: RotationDirection;
  startOrientation?: Orientation;
  endOrientation?: Orientation;
}
