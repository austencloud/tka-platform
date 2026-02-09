/**
 * Constraint Analysis Module
 *
 * Tools for analyzing constraint feasibility before generation.
 */

export {
  analyzeTransition,
  analyzeWord,
  explainImpossibility,
  type TransitionAnalysis,
  type WordAnalysis,
} from "./transition-analyzer.js";

export {
  buildTransitionMatrix,
  analyzeWordFeasibility,
  suggestAlternatives,
  explainConstraintImpossibility,
  getTransitionMatrix,
  clearTransitionMatrixCache,
  type TransitionFeasibility,
  type TransitionMatrix,
  type WordFeasibility,
} from "./transition-matrix.js";
