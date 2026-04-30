import type { ComponentId } from "../../domain/constants/loop-components";
import type { CandidateDesignation } from "../../domain/models/label-models";
import type {
  CandidateInfo,
  InternalStepPair,
} from "../../domain/models/internal-step-models";
import type { StepPairRelationship } from "./IStepPairAnalyzer";

/**
 * Result from formatting beat pair transformations.
 */
export interface FormattedTransformations {
  primary: string[];
  all: string[];
}

/**
 * Service for formatting transformations and building candidate designations.
 */
export interface ICandidateFormatter {
  /**
   * Format a single raw transformation into human-readable string.
   */
  formatSingleTransformation(raw: string): string;

  /**
   * Format raw transformations into human-readable strings.
   * Returns both primary (highest-priority) and all valid transformations.
   */
  formatBeatPairTransformations(
    rawTransformations: string[]
  ): FormattedTransformations;

  /** @deprecated Pipeline Stage 6 (build-candidates) supersedes this for uniform detection. Retained for modular fallback path. */
  deriveComponentsFromPattern(pattern: string): ComponentId[];

  /**
   * Convert CandidateInfo to CandidateDesignation.
   */
  toCandidateDesignation(info: CandidateInfo): CandidateDesignation;

  /**
   * Convert internal beat pairs to public interface.
   */
  toPublicStepPairs(internal: InternalStepPair[]): StepPairRelationship[];
}
