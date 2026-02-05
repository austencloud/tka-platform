/**
 * Sequence Engine - Shared letter transition and sequence building
 *
 * Platform-agnostic engine for:
 * - Letter transition graph (valid letter sequences)
 * - Bridge finding (BFS shortest path)
 * - Orientation propagation
 * - Constraint-based variation selection
 *
 * Both MCP server and browser (Spell tab) consume this engine.
 */

// Domain types
export * from "./domain/models/SequenceEngineTypes";

// Service contracts
export type { ITransitionGraph } from "./services/contracts/ITransitionGraph";
export type {
  IOrientationCalculator,
  IOrientationPropagator,
} from "./services/contracts/IOrientationPropagator";

// Data provider contracts
export type {
  ISequenceDataProvider,
  LetterVariationData,
} from "./data/contracts/ISequenceDataProvider";

// Service implementations
export { TransitionGraph } from "./services/implementations/TransitionGraph";
export {
  OrientationCalculator,
  OrientationPropagator,
  calculateEndOrientation,
} from "./services/implementations/OrientationPropagator";

// Browser data provider (only for browser contexts)
export {
  BrowserDataProvider,
  createBrowserDataProvider,
} from "./data/implementations/BrowserDataProvider";

// Constraints (re-export from constraints submodule)
export * from "./constraints";
