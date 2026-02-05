// Contracts
export type { IAngleCalculator } from "./contracts/IAngleCalculator";
export type { IMotionCalculator } from "./contracts/IMotionCalculator";
export type { IEndpointCalculator } from "./contracts/IEndpointCalculator";
export type {
  IAnimationStateManager,
  InterpolationResult,
} from "./contracts/IAnimationStateManager";
export type { IPropInterpolator } from "./contracts/IPropInterpolator";
export type {
  IStepCalculator,
  StepCalculationResult,
} from "./contracts/IStepCalculator";
export type { ICoordinateUpdater } from "./contracts/ICoordinateUpdater";
export type { IAnimationLoop } from "./contracts/IAnimationLoop";
export type {
  IAnimationRenderer,
  AnimationVisibilitySettings,
  RenderSceneParams,
} from "./contracts/IAnimationRenderer";
export type { ISVGGenerator, PropSvgData } from "./contracts/ISVGGenerator";
export type {
  ITrailCapturer,
  TrailCapturePropStates,
  TrailCaptureConfig,
  IAnimationCacheService,
  IPerformanceMonitorService,
} from "./contracts/ITrailCapturer";
export type { ISequenceAnimationOrchestrator } from "./contracts/ISequenceAnimationOrchestrator";

// Computation implementations
export { AngleCalculator } from "./computation/AngleCalculator";
export { MotionCalculator } from "./computation/MotionCalculator";
export { EndpointCalculator } from "./computation/EndpointCalculator";
export { PropInterpolator } from "./computation/PropInterpolator";
export { StepCalculator } from "./computation/StepCalculator";
export { AnimationStateManager } from "./computation/AnimationStateManager";
export { CoordinateUpdater } from "./computation/CoordinateUpdater";
export { AnimationLoop } from "./computation/AnimationLoop";

// Domain constants
export { PI, TWO_PI, HALF_PI, LOCATION_ANGLES } from "./domain/math-constants";
export { ANIMATION_CONSTANTS } from "./domain/animation-constants";

// Rendering layer
export { Canvas2DAnimationRenderer } from "./rendering/Canvas2DAnimationRenderer";
export { Canvas2DApplicationManager } from "./rendering/Canvas2DApplicationManager";
export { Canvas2DImageLoader } from "./rendering/Canvas2DImageLoader";
export { Canvas2DTrailRenderer } from "./rendering/Canvas2DTrailRenderer";
export { Canvas2DFadeManager } from "./rendering/Canvas2DFadeManager";
export type { FadeState } from "./rendering/Canvas2DFadeManager";
export { Canvas2DGridFadeManager } from "./rendering/Canvas2DGridFadeManager";
export type { GridFadeState } from "./rendering/Canvas2DGridFadeManager";
export { Canvas2DVisibilityFadeManager } from "./rendering/Canvas2DVisibilityFadeManager";
export type { VisibilityFadeState } from "./rendering/Canvas2DVisibilityFadeManager";
export { SVGGenerator } from "./rendering/SVGGenerator";
export type { SVGGeneratorConfig } from "./rendering/SVGGenerator";

// Orchestration
export { SequenceAnimationOrchestrator } from "./orchestration/SequenceAnimationOrchestrator";
export type { OrchestratorConfig } from "./orchestration/SequenceAnimationOrchestrator";

// Factory
export {
  createAnimationPipeline,
  type AnimationPipelineConfig,
  type AnimationPipeline,
} from "./createAnimationPipeline";

// Utilities
export {
  getMotionColor,
  applyColorToSvg,
  applyMotionColorToSvg,
  shouldPreserveColor,
  MOTION_COLOR_MAP,
  ACCENT_COLORS_TO_PRESERVE,
  type ThemeMode,
} from "./utils/svg-color-utils";
