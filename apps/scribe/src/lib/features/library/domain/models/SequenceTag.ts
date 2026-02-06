/**
 * SequenceTag - Junction model linking sequences to tags
 *
 * Tracks the relationship between a sequence and a tag, including:
 * - Which tag is applied
 * - How it was applied (user vs AI vs rule-based)
 * - Confidence score for AI/rule-based tags
 * - When it was added
 *
 * This enables:
 * - Unified tag display (both user and AI tags)
 * - User override (delete any tag they don't like)
 * - Tracking tag source for analytics
 */

/**
 * SequenceTag - A tag applied to a sequence
 */
export interface SequenceTag {
  /** Reference to LibraryTag document ID */
  readonly tagId: string;

  /** How this tag was applied */
  readonly source: "user" | "ai" | "rule-based";

  /** Confidence score (0-1) for AI/rule-based tags */
  readonly confidence?: number;

  /** When this tag was added */
  readonly addedAt: Date;
}

/**
 * Create a new SequenceTag
 */
export function createSequenceTag(
  tagId: string,
  source: "user" | "ai" | "rule-based" = "user",
  confidence?: number
): SequenceTag {
  return {
    tagId,
    source,
    confidence,
    addedAt: new Date(),
  };
}

/**
 * Check if a tag was added by the user
 */
export function isUserTag(tag: SequenceTag): boolean {
  return tag.source === "user";
}

/**
 * Check if a tag was added by AI
 */
export function isAITag(tag: SequenceTag): boolean {
  return tag.source === "ai" || tag.source === "rule-based";
}

/**
 * Get confidence display string
 */
export function getConfidenceLabel(tag: SequenceTag): string | null {
  if (!tag.confidence) return null;
  const percentage = Math.round(tag.confidence * 100);
  return `${percentage}%`;
}
