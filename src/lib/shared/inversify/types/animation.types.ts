/**
 * Animation Service Type Identifiers
 *
 * Services for animating sequences and rendering animations.
 */

export const AnimationTypes = {
  // Orchestration
  ISequenceAnimationOrchestrator: Symbol.for("ISequenceAnimationOrchestrator"),
  IAnimationLoop: Symbol.for("IAnimationLoop"),
  IAnimationPlaybackController: Symbol.for("IAnimationPlaybackController"),
  IAnimationStateService: Symbol.for("IAnimationStateService"),
  IAnimationStorageManager: Symbol.for("IAnimationStorageManager"),
  IAnimationControlService: Symbol.for("IAnimationControlService"),

  // Beat & Prop Calculation
  IBeatCalculationService: Symbol.for("IBeatCalculationService"),
  IPropInterpolationService: Symbol.for("IPropInterpolationService"),
  ISequenceLoopabilityChecker: Symbol.for("ISequenceLoopabilityChecker"),

  // Calculation Services
  IAngleCalculator: Symbol.for("IAngleCalculator"),
  ICoordinateUpdater: Symbol.for("ICoordinateUpdater"),
  IMotionCalculator: Symbol.for("IMotionCalculator"),
  IEndpointCalculator: Symbol.for("IEndpointCalculator"),
  IAngleCalculationService: Symbol.for("IAngleCalculationService"),
  IMotionCalculationService: Symbol.for("IMotionCalculationService"),
  IEndpointCalculationService: Symbol.for("IEndpointCalculationService"),
  ICoordinateUpdateService: Symbol.for("ICoordinateUpdateService"),

  // Rendering
  ICanvasRenderer: Symbol.for("ICanvasRenderer"),
  IAnimationRenderer: Symbol.for("IAnimationRenderer"),
  /** @deprecated Use IAnimationRenderer instead */
  IPixiAnimationRenderer: Symbol.for("IAnimationRenderer"), // Alias for backward compatibility
  ISVGGenerator: Symbol.for("ISVGGenerator"),

  // Trail
  ITrailCapturer: Symbol.for("ITrailCapturer"),

  // Mode-Specific
  ISequenceNormalizer: Symbol.for("ISequenceNormalizer"),
  ITunnelModeSequenceManager: Symbol.for("ITunnelModeSequenceManager"),

  // Data
  IAnimatedPictographDataService: Symbol.for("IAnimatedPictographDataService"),
  IMotionParameterService: Symbol.for("IMotionParameterService"),

  // State Providers
  IDarkModeProvider: Symbol.for("IDarkModeProvider"),
} as const;
