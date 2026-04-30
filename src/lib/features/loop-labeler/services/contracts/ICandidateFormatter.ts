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

  /**
   * Derive components from a transformation pattern.
   */
  deriveComponentsFromPattern(pattern: string): ComponentId[];

  /**
   * Extract rotation direction from a transformation pattern.
   */
  extractRotationDirection(pattern: string): "cw" | "ccw" | null;

  /**
   * Format a human-readable description for a candidate designation.
   */
  formatCandidateDescription(
    transformation: string,
    direction: "cw" | "ccw" | null
  ): string;

  /**
   * Build candidate designations from common transformations.
   */
  buildCandidateDesignations(
    allCommon: string[],
    interval: 2 | 4,
    rotationDirection: "cw" | "ccw" | null
  ): CandidateInfo[];

  /**
   * Convert CandidateInfo to CandidateDesignation.
   */
  toCandidateDesignation(info: CandidateInfo): CandidateDesignation;

  /**
   * Convert internal beat pairs to public interface.
   */
  toPublicStepPairs(internal: InternalStepPair[]): StepPairRelationship[];
}
