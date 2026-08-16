/**
 * Core Orientation - Re-exports all orientation primitives
 */
export {
  calculateEndOrientation,
  calculateOrientations,
  getHandpathDirection,
  switchOrientation,
  RADIAL_CW_CYCLE,
} from "./OrientationCalculator.js";
export type { Orientation, OrientationInput } from "./OrientationCalculator.js";

export {
  orientationClass,
  isRadialOrientation,
  layerOf,
  collapseLayer,
  layerClassDelta,
  flipsLayer,
  flipVectorOf,
  applyFlip,
  flipBetween,
  layerSignature,
  layerPatternOf,
  signatureFromPattern,
  patternFromSignature,
  isLayerClosed,
  mirrorPattern,
  layerMetrics,
  signaturePeriod,
  formatSignature,
  formatPattern,
  parsePattern,
  parseSignature,
} from "./layer-signature.js";
export type {
  LayerId,
  CollapsedLayerId,
  FlipVector,
  LayerPattern,
  LayerMetrics,
  LayerMotionInput,
  LayerStepInput,
} from "./layer-signature.js";

export type {
  IOrientationCalculator,
  IOrientationPropagator,
} from "./IOrientationPropagator.js";

export { OrientationCalculator, OrientationPropagator } from "./OrientationPropagator.js";
