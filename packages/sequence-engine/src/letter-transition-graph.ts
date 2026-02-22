/**
 * Letter Transition Graph - Singleton Holder
 *
 * Provides module-level access to the initialized transition graph.
 * The consuming application must call setLetterTransitionGraph() during startup
 * before any code calls getLetterTransitionGraph().
 */

import type { ITransitionGraph } from "./services/contracts/ITransitionGraph.js";

let instance: ITransitionGraph | null = null;

/**
 * Register the initialized transition graph instance.
 * Must be called before getLetterTransitionGraph().
 */
export function setLetterTransitionGraph(graph: ITransitionGraph): void {
  instance = graph;
}

/**
 * Get the initialized transition graph.
 * Throws if setLetterTransitionGraph() has not been called.
 */
export function getLetterTransitionGraph(): ITransitionGraph {
  if (!instance) {
    throw new Error(
      "TransitionGraph not initialized. Call setLetterTransitionGraph() first."
    );
  }
  return instance;
}
