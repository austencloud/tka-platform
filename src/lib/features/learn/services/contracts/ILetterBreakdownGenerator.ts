/**
 * ILetterBreakdownGenerator
 *
 * Produces deterministic, correct letter descriptions and comparisons
 * from structured domain data. No LLM needed - everything is derivable
 * from type, positions, rotation types, and VTG mode.
 *
 * Used by MisconceptionHint and QuizMisconceptionSummary to build
 * factually correct seed messages for TIKA.
 */

export interface LetterBreakdown {
  letter: string;
  typeNumber: number;
  typeName: string;
  positionDescription: string;
  motionDescription: string;
  vtgMode?: string;
  vtgElement?: string;
  motionGroup?: string;
  upgradeFrom?: string;
  summary: string;
}

export interface LetterComparison {
  letterA: LetterBreakdown;
  letterB: LetterBreakdown;
  relationship: ComparisonRelationship;
  explanation: string;
}

export type ComparisonRelationship =
  | "same-type-different-position"
  | "same-type-different-rotation"
  | "same-type-different-group"
  | "cross-type-upgrade"
  | "cross-type-confusion"
  | "same-position-different-type"
  | "unrelated";

export interface ILetterBreakdownGenerator {
  getBreakdown(letter: string): LetterBreakdown | null;
  compare(letterA: string, letterB: string): LetterComparison | null;
}
