export type { CAPDefinition, CAPDefinitionScope } from "./data/definitions.js";
export type {
  ElementaryPatternNotation,
  CAPPatternType,
  CAPSegment,
  CAPAssembly,
  CAPFeasibilityRule,
  CAPTrigModel,
  CAPMathModel,
} from "./data/mathematics.js";
export type { EightStepSegment, EightStepCAP } from "./data/eight-step-cap.js";
export type {
  CAPTransition,
  DirectionChange,
  PatternCharacter,
} from "./data/transitions.js";
export type { SourceDocument } from "./data/documents.js";

// Types (from reference files)
export type {
  CAPSearchResult,
  CAPSearchResultType,
} from "./reference/search.js";
export type {
  TrochoidClassification,
  TrochoidFrame,
  TrochoidParameters,
  TrochoidPoint,
} from "./mathematics/trochoid.js";
export type {
  CAPCycleContinuity,
  CAPJoinErrorKind,
  CAPJoinSolution,
  CAPJunctionContinuity,
  EvaluatedCAPAssemblyFrame,
  ResolvedCAPAssembly,
  ResolvedCAPSegment,
  SampledCAPAssembly,
} from "./mathematics/assembly.js";

export { CAP_DEFINITIONS } from "./data/definitions.js";
export { CAP_MATH_MODEL } from "./data/mathematics.js";
export { EIGHT_STEP_CAPS } from "./data/eight-step-cap.js";
export { CAP_TRANSITIONS } from "./data/transitions.js";
export { CAP_CONTRIBUTORS } from "./data/contributors.js";
export { CAP_GLOSSARY } from "./data/glossary.js";
export { CAP_DOCUMENTS } from "./data/documents.js";
export { CAP_EXTERNAL_LINKS } from "./data/external-links.js";
export {
  classifyTrochoid,
  countTrochoidFeatures,
  evaluateTrochoid,
  isCycloidTrochoid,
  recommendedTrochoidSampleCount,
  sampleTrochoid,
  validateTrochoidParameters,
} from "./mathematics/trochoid.js";
export {
  CAP_JOIN_TOLERANCE,
  CAPJoinError,
  evaluateCAPAssembly,
  evaluateResolvedCAPSegment,
  resolveCAPAssembly,
  sampleResolvedCAPAssembly,
  sampleResolvedCAPSegment,
  solveCAPJoinPhases,
} from "./mathematics/assembly.js";

export {
  getCAPDefinition,
  listCAPDefinitions,
} from "./reference/definition-lookup.js";
export {
  getCAPFormula,
  getCAPAssembly,
  listCAPFeasibilityRules,
} from "./reference/math-lookup.js";
export {
  getCAPTransition,
  listCAPTransitions,
} from "./reference/transition-lookup.js";
export { searchCAPs } from "./reference/search.js";
