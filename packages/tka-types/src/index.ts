// Foundation
export { Letter, getLetterType } from "./foundation/Letter";
export { LetterType } from "./foundation/LetterType";
export {
  type TimeSignature,
  TIME_SIGNATURES,
  type TimeSignatureKey,
  DEFAULT_TIME_SIGNATURE,
} from "./foundation/TimeSignature";

// Pictograph enums
export {
  VTGTiming,
  VTGDirection,
  MotionType,
  HandMotionType,
  HandPath,
  SkewDirection,
  MotionColor,
  RotationDirection,
  Orientation,
  VectorDirection,
  VTGMode,
  ElementalType,
  GlyphType,
} from "./pictograph/pictograph-enums";

// Grid enums
export {
  GridLocation,
  GridPositionGroup,
  GridPosition,
  GridMode,
} from "./pictograph/grid-enums";

// Prop type
export { PropType } from "./pictograph/PropType";

// Pictograph models
export type { ArrowPlacementData } from "./pictograph/ArrowPlacementData";
export type { PropPlacementData } from "./pictograph/PropPlacementData";
export type { MotionData } from "./pictograph/MotionData";
export type { PictographData } from "./pictograph/PictographData";
export type { MotionEndpoints } from "./pictograph/MotionEndpoints";
export type { ArrowSvgData, SVGDimensions, ISvgConfig } from "./pictograph/svg-models";

// Sequence
export type { StepData } from "./sequence/StepData";
export type { StartPositionData } from "./sequence/StartPositionData";
export type {
  SequenceData,
  PropDimensions,
  SequenceMetadata,
} from "./sequence/SequenceData";
export { LOOPType } from "./sequence/LOOPType";

// Animation
export type {
  AnimationConfig,
  AnimationState,
  PropVisibility,
  AnimatedMotionParams,
  LetterIdentificationResult,
  LetterMapping,
} from "./animation/animation-models";
export type { PropState, PropStates } from "./animation/PropState";
export type { TrailPoint, TrailSettings } from "./animation/TrailTypes";
export {
  TrailMode,
  TrackingMode,
  TrailEffect,
} from "./animation/TrailTypes";
export type {
  QualityHints,
  QualityAdaptationConfig,
} from "./animation/QualityTypes";
export {
  QualityTier,
  DeviceTier,
  QUALITY_TIER_PARAMS,
} from "./animation/QualityTypes";
