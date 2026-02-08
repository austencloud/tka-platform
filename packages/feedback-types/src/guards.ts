/**
 * Type guards for feedback domain types.
 */

import type {
  FeedbackStatus,
  FeedbackType,
  ArchiveReason,
} from "./enums.js";
import { FEEDBACK_STATUSES, FEEDBACK_TYPES, ARCHIVE_REASONS } from "./enums.js";

export function isFeedbackStatus(value: unknown): value is FeedbackStatus {
  return (
    typeof value === "string" &&
    (FEEDBACK_STATUSES as readonly string[]).includes(value)
  );
}

export function isFeedbackType(value: unknown): value is FeedbackType {
  return (
    typeof value === "string" &&
    (FEEDBACK_TYPES as readonly string[]).includes(value)
  );
}

export function isArchiveReason(value: unknown): value is ArchiveReason {
  return (
    typeof value === "string" &&
    (ARCHIVE_REASONS as readonly string[]).includes(value)
  );
}
