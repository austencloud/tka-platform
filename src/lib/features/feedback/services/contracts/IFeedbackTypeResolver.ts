import type { FeedbackType } from "../../domain/models/feedback-models";

export interface FeedbackTypeConfig {
  label: string;
  icon: string;
  color: string;
  placeholder: string;
}

/**
 * Resolves type-specific configuration for feedback forms.
 *
 * Provides colors, icons, labels, and encouragement messages based on feedback type.
 */
export interface IFeedbackTypeResolver {
  /**
   * Get the full configuration for a feedback type.
   *
   * @param type - The feedback type
   * @returns The type-specific configuration
   */
  getTypeConfig(type: FeedbackType): FeedbackTypeConfig;

  /**
   * Get an encouragement message for a feedback type.
   *
   * @param type - The feedback type
   * @returns A helpful message encouraging the user to provide good feedback
   */
  getEncouragementMessage(type: FeedbackType): string;
}
