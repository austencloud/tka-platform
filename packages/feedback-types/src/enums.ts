/**
 * Feedback system enums and literal union types.
 *
 * These are the canonical type definitions shared across all AustenCloud apps,
 * the feedback CLI, and any other tooling that touches the feedback system.
 */

export type FeedbackType = "bug" | "feature" | "general";
export type FeedbackStatus =
  | "new"
  | "in-progress"
  | "in-review"
  | "completed"
  | "archived";
export type FeedbackPriority = "low" | "medium" | "high" | "critical";
export type ArchiveReason =
  | "released"
  | "declined"
  | "duplicate"
  | "wont-fix"
  | "deferred"
  | "invalid";
export type ClaimHealth = "none" | "active" | "stale" | "orphaned";
export type StaleReason =
  | "no-claim-time"
  | "exceeded-max-time"
  | "no-activity";
export type AgentType = "claude-cli" | "human" | "ci";
export type FeedbackSource = "app" | "terminal";
export type TesterConfirmationStatus =
  | "pending"
  | "confirmed"
  | "needs-work"
  | "no-response";
export type SubtaskStatus = "pending" | "in-progress" | "completed";
export type ChangelogCategory = "fixed" | "added" | "improved";

export const FEEDBACK_STATUSES: readonly FeedbackStatus[] = [
  "new",
  "in-progress",
  "in-review",
  "completed",
  "archived",
];
export const FEEDBACK_TYPES: readonly FeedbackType[] = [
  "bug",
  "feature",
  "general",
];
export const ARCHIVE_REASONS: ArchiveReason[] = [
  "released",
  "declined",
  "duplicate",
  "wont-fix",
  "deferred",
  "invalid",
];
