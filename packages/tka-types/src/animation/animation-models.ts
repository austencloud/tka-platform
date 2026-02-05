import type { GridLocation } from "../pictograph/grid-enums";
import type {
  MotionType,
  Orientation,
  RotationDirection,
} from "../pictograph/pictograph-enums";

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

export interface AnimatedMotionParams {
  startLocation: GridLocation;
  endLocation: GridLocation;
  motionType: MotionType;
  turns: number | "fl";
  rotationDirection: RotationDirection;
  startOrientation: Orientation;
  endOrientation: Orientation;
}

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
  turns?: number | "fl";
  rotationDirection?: RotationDirection;
  startOrientation?: Orientation;
  endOrientation?: Orientation;
}
