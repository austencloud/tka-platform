import type {
  IFeedbackTypeResolver,
  FeedbackTypeConfig,
} from "../contracts/IFeedbackTypeResolver";
import type { FeedbackType } from "../../domain/models/feedback-models";
import { TYPE_CONFIG } from "../../domain/models/feedback-models";

/**
 * Resolves type-specific configuration for feedback forms.
 */
export class FeedbackTypeResolver implements IFeedbackTypeResolver {
  private readonly encouragementMessages: Record<FeedbackType, string> = {
    bug: "Include steps to reproduce, error messages, and screenshots for faster fixes.",
    feature:
      "Dream big! Describe exactly what you'd love to see in the app and how it would help you.",
    general:
      "Share your thoughts on the app experience - what's working, what's confusing, what could be smoother.",
  };

  getTypeConfig(type: FeedbackType): FeedbackTypeConfig {
    return TYPE_CONFIG[type];
  }

  getEncouragementMessage(type: FeedbackType): string {
    return (
      this.encouragementMessages[type] ?? this.encouragementMessages.general
    );
  }
}
