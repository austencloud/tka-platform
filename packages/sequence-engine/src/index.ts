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

// Service contracts
export type { ITransitionGraph } from "./services/contracts/ITransitionGraph.js";
export type {
  IOrientationCalculator,
  IOrientationPropagator,
} from "./services/contracts/IOrientationPropagator.js";

// Data provider contracts
export type {
  ISequenceDataProvider,
  LetterVariationData,
} from "./data/contracts/ISequenceDataProvider.js";

// Service implementations
export { TransitionGraph } from "./services/implementations/TransitionGraph.js";
export {
  OrientationCalculator,
  OrientationPropagator,
} from "./services/implementations/OrientationPropagator.js";
