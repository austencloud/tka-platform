/**
 * @tka/sequence-engine
 *
 * Platform-agnostic sequence engine for TKA letter transitions,
 * bridge finding, and orientation propagation.
 *
 * Both MCP server (Node.js) and browser app consume this package.
 * Browser-only extensions (BrowserDataProvider, constraints) stay in the app.
 */

// Domain types
export * from "./core/types/sequence-engine-types.js";

// Orientation
export type {
  IOrientationCalculator,
  IOrientationPropagator,
} from "./core/orientation/IOrientationPropagator.js";
export {
  OrientationCalculator,
  OrientationPropagator,
} from "./core/orientation/OrientationPropagator.js";

// Service contracts (transition graph - will move to core/ in next task)
export type { ITransitionGraph } from "./services/contracts/ITransitionGraph.js";

// Data provider contracts
export type {
  ISequenceDataProvider,
  LetterVariationData,
} from "./data/contracts/ISequenceDataProvider.js";

// Service implementations (transition graph - will move to core/ in next task)
export { TransitionGraph } from "./services/implementations/TransitionGraph.js";
