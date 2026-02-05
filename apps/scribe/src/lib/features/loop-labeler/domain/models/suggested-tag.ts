/**
 * Suggested Tag Domain Model
 *
 * Tags suggested by rule-based analysis with confidence scores.
 * Used by auto-tagging systems to classify and categorize sequences.
 */

/**
 * Tag categories for organization
 */
export type TagCategory =
  | "difficulty"
  | "structure"
  | "prop"
  | "motion"
  | "grid"
  | "position";

/**
 * Source of the tag suggestion
 */
export type TagSource = "rule-based" | "ml" | "user" | "inherited";

/**
 * A suggested tag with confidence score
 */
export interface SuggestedTag {
  /** The tag string (e.g., "beginner", "circular", "poi") */
  readonly tag: string;

  /** Category for grouping related tags */
  readonly category: TagCategory;

  /** Confidence score from 0-1 (1 = certain) */
  readonly confidence: number;

  /** Source of the suggestion */
  readonly source: TagSource;

  /** Optional reason explaining why this tag was suggested */
  readonly reason?: string;

  /** Whether this tag conflicts with another suggested tag */
  readonly conflictsWith?: readonly string[];
}

/**
 * Result of tag suggestion analysis
 */
export interface TagSuggestionResult {
  /** All suggested tags, sorted by confidence (highest first) */
  readonly suggestions: readonly SuggestedTag[];

  /** High-confidence tags (>= 0.8) */
  readonly highConfidence: readonly SuggestedTag[];

  /** Medium-confidence tags (0.5 - 0.79) */
  readonly mediumConfidence: readonly SuggestedTag[];

  /** Low-confidence tags (< 0.5) */
  readonly lowConfidence: readonly SuggestedTag[];

  /** Tags with conflicts detected */
  readonly conflicts: readonly SuggestedTag[];
}

/**
 * Helper: Create a suggested tag
 */
export function createSuggestedTag(
  tag: string,
  category: TagCategory,
  confidence: number,
  reason?: string,
  conflictsWith?: string[]
): SuggestedTag {
  return {
    tag,
    category,
    confidence: Math.max(0, Math.min(1, confidence)),
    source: "rule-based",
    reason,
    conflictsWith,
  };
}

/**
 * Helper: Sort tags by confidence (descending)
 */
export function sortByConfidence(tags: SuggestedTag[]): SuggestedTag[] {
  return [...tags].sort((a, b) => b.confidence - a.confidence);
}

/**
 * Helper: Group tags by confidence level
 */
export function groupByConfidenceLevel(
  tags: readonly SuggestedTag[]
): TagSuggestionResult {
  const sorted = sortByConfidence([...tags]);

  const highConfidence = sorted.filter((t) => t.confidence >= 0.8);
  const mediumConfidence = sorted.filter(
    (t) => t.confidence >= 0.5 && t.confidence < 0.8
  );
  const lowConfidence = sorted.filter((t) => t.confidence < 0.5);
  const conflicts = sorted.filter(
    (t) => t.conflictsWith && t.conflictsWith.length > 0
  );

  return {
    suggestions: sorted,
    highConfidence,
    mediumConfidence,
    lowConfidence,
    conflicts,
  };
}
