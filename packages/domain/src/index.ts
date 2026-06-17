export type { GlossaryCategory, GlossaryEntry } from "./types/glossary.js";
export type {
  MotionPattern,
  LetterTypeDefinition,
  Letter,
  LetterTypeNumber,
  LetterTypeName,
  LetterTypeInfo,
} from "./types/letter.js";
export type {
  CompoundCategory,
  CompoundLetter,
  CompoundCategoryInfo,
} from "./types/compound.js";
export type {
  LoopComponent,
  LoopBaseComponent,
  CompoundLoopType,
  LoopTransform,
  LoopFixedPointEntry,
  LoopComposabilityEntry,
} from "./types/loop.js";
export type {
  InversionPair,
  CompoundPair,
  CounterpartPair,
  CounterpartSubType,
  GammaInternalGroup,
} from "./types/transformation.js";
export type { ReversalType } from "./types/reversal.js";
export type { PositionName, PositionDefinition } from "./types/position.js";
export type { MotionTypeName, MotionTypeDefinition } from "./types/motion.js";
export type { RotationDefinition } from "./types/rotation.js";
export type { GridModeName, GridModeDefinition } from "./types/grid.js";
export type { VTGMapping } from "./types/vtg.js";
export type {
  MajorLevel,
  KnowledgeConcept,
  UserKnowledgeOverlay,
} from "./types/curriculum.js";

export { GLOSSARY } from "./data/glossary.js";
export { LETTER_TYPES } from "./data/letter-types.js";
export {
  COMPOUND_LETTERS,
  COMPOUND_CATEGORIES,
  WHY_COMPOUNDS_MATTER,
} from "./data/compound-letters.js";
export {
  LOOP_DEFINITION,
  LOOP_BASE_COMPONENTS,
  COMPOUND_LOOP_TYPES,
  LOOP_CONSTRUCTION_PRINCIPLES,
  LOOP_TURN_INDEPENDENCE,
  LOOP_COMPOSITIONAL_NOTATION,
  LOOP_FIXED_POINT_THEOREM,
  LOOP_FIXED_POINTS,
  LOOP_COMPOUND_FIXED_POINTS,
  LOOP_ROTATE_ALWAYS_INNER,
  LOOP_COMPOSABILITY_MATRICES,
  LOOP_COMPOSITIONAL_KEY_RESULTS,
} from "./data/loops.js";
export {
  TRANSFORMATION_DESCRIPTION,
  INVERSION_PAIRS,
  INVERSION_PAIR_DESCRIPTIONS,
  COMPOUND_PAIRS,
  ALPHA_BETA_COUNTERPARTS,
  GAMMA_INTERNAL_GROUPS,
} from "./data/letter-transformations.js";
export {
  REVERSAL_DEFINITION,
  REVERSAL_TYPES,
  REVERSAL_NOTATION,
} from "./data/reversals.js";

export {
  ALL_LETTERS,
  LETTER_TO_TYPE,
  getLetterType,
  isValidLetter,
  getLettersByType,
} from "./constants/letter-registry.js";
export {
  TERM_ALIASES,
  resolveTermAlias,
} from "./constants/alias-map.js";
export {
  POSITION_DEFINITIONS,
  FOUNDATION_POSITIONS,
  SKEWED_POSITIONS,
  CENTRIC_POSITIONS,
  ALL_POSITIONS,
  getPositionsAtLevel,
} from "./constants/position-groups.js";

export {
  TYPE_DEFINITIONS,
  getTypeExplanation,
  getTypeComparison,
} from "./reference/type-explanations.js";
export type { TypeDefinition } from "./reference/type-explanations.js";
export {
  TYPE_NAMING_ORIGINS,
  getTypeNamingOrigin,
} from "./reference/type-naming.js";
export {
  getPositionExplanation,
  getPositionComparison,
} from "./reference/position-explanations.js";
export {
  MOTION_TYPE_DEFINITIONS,
  getMotionTypeExplanation,
  getMotionTypeComparison,
} from "./reference/motion-explanations.js";
export {
  ROTATION_DEFINITIONS,
  getRotationExplanation,
} from "./reference/rotation-explanations.js";
export {
  GRID_MODE_DEFINITIONS,
  getGridModeExplanation,
} from "./reference/grid-explanations.js";
export {
  VTG_MAPPINGS,
  getVTGMapping,
} from "./reference/vtg-mapping.js";
export { getAlphabetOverview } from "./reference/alphabet-overview.js";
export {
  COMMON_QUESTIONS,
  getCommonAnswer,
} from "./reference/common-questions.js";
export {
  DOMAIN_TOPICS,
  listDomainTopics,
  findDomainTopic,
} from "./reference/domain-topics.js";
export {
  TYPE1_ROTATION,
  getType1Rotation,
  PRECISE_QUARTER_SAME_EXPLANATION,
  PLAIN_QUARTER_SAME_EXPLANATION,
} from "./reference/rotation-invariant.js";
export type {
  VtgGroup,
  RotationPattern,
  Type1RotationEntry,
} from "./reference/rotation-invariant.js";

export { KNOWLEDGE_GRAPH } from "./curriculum/knowledge-graph.js";
export {
  getConceptById,
  getConceptsByLevel,
  isConceptUnlocked,
  getAvailableTerms,
  getNumericLevel,
  isTermKnown,
  getNextConcept,
} from "./curriculum/knowledge-helpers.js";
export { deriveUserOverlay } from "./curriculum/user-overlay.js";
export {
  getLevelConstraints,
  getExplanationGuidance,
} from "./curriculum/level-constraints.js";

export type { DomainGlossary } from "./i18n/types.js";
export { GLOSSARIES } from "./i18n/glossaries.js";
