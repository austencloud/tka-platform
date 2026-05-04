import type { FeedbackTypeConfig } from "./contracts/types";
import type { FeedbackType } from "../domain/models/feedback-models";
import { TYPE_CONFIG } from "../domain/models/feedback-models";

/**
 * Resolves type-specific configuration for feedback forms.
 */

const encouragementMessages: Record<FeedbackType, string> = {
  bug: "Steps to reproduce, error messages, and screenshots help a lot.",
  feature:
    "What would you like to see, and how would it help your workflow?",
  general: "",
};

export function getTypeConfig(type: FeedbackType): FeedbackTypeConfig {
  return TYPE_CONFIG[type];
}

export function getEncouragementMessage(type: FeedbackType): string {
  return (
    encouragementMessages[type] ?? encouragementMessages.general
  );
}
