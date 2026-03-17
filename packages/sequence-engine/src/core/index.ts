/**
 * Core Layer - Stable primitives that rarely change
 *
 * Types, orientation calculation, transition graph, and data provider contracts.
 */

// Types
export * from "./types/sequence-engine-types.js";

// Orientation
export {
  calculateEndOrientation,
  calculateOrientations,
  getHandpathDirection,
  switchOrientation,
} from "./orientation/OrientationCalculator.js";
export type { Orientation, OrientationInput } from "./orientation/OrientationCalculator.js";
export type {
  IOrientationCalculator,
  IOrientationPropagator,
} from "./orientation/IOrientationPropagator.js";
export { OrientationCalculator, OrientationPropagator } from "./orientation/OrientationPropagator.js";

// Transition graph
export type { ITransitionGraph } from "./transition-graph/ITransitionGraph.js";
export { TransitionGraph } from "./transition-graph/TransitionGraph.js";
export { setLetterTransitionGraph, getLetterTransitionGraph } from "./transition-graph/LetterTransitionGraph.js";

// Data provider contracts
export type { ISequenceDataProvider, LetterVariationData } from "./data/ISequenceDataProvider.js";
