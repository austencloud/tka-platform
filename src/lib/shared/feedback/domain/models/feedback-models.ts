/**
 * Feedback Domain Models
 *
 * Type definitions for feedback submission and management.
 */

/**
 * Draft persistence data structure
 */
export interface FeedbackDraft {
  formData: FeedbackFormData;
  timestamp: number;
}

/**
 * Device context data captured on feedback submission
 */
export interface DeviceContext {
  // Device & Browser
  userAgent: string;
  platform: string;
  isTouchDevice: boolean;

  // Viewport & Screen
  viewportWidth: number;
  viewportHeight: number;
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;

  // App Context
  appVersion: string;
  currentModule?: string;
  currentTab?: string;

  // Timestamp
  capturedAt: Date;
}

/**
 * Feedback type classification
 */
export type FeedbackType = "bug" | "feature" | "general";
export const FEEDBACK_TYPES = ["bug", "feature", "general"] as const;
export function isFeedbackType(value: unknown): value is FeedbackType {
  return (
    typeof value === "string" &&
    (FEEDBACK_TYPES as readonly string[]).includes(value)
  );
}

/**
 * Feedback priority levels
 */
export type FeedbackPriority = "low" | "medium" | "high" | "critical";

/**
 * Feedback status for admin management
 * 4 Kanban columns + archived (hidden, versioned)
 */
export type FeedbackStatus =
  | "new" // Unclaimed, ready to be picked up
  | "in-progress" // Agent is working on it
  | "in-review" // Done, waiting for tester confirmation
  | "completed" // Confirmed working, ready for next release
  | "archived"; // Tagged with version, historical record
export const FEEDBACK_STATUSES = [
  "new",
  "in-progress",
  "in-review",
  "completed",
  "archived",
] as const;
export function isFeedbackStatus(value: unknown): value is FeedbackStatus {
  return (
    typeof value === "string" &&
    (FEEDBACK_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Feedback source - where the feedback originated
 * - "app": Submitted through the in-app feedback form
 * - "terminal": Created via CLI/Claude Code (dev work log)
 * - "agent": Submitted via the ingest endpoint by an LLM agent
 */
export type FeedbackSource = "app" | "terminal" | "agent";

/**
 * Archive reason - why feedback was archived
 * Used to categorize the outcome of feedback that didn't go through
 * the normal release path
 */
export type ArchiveReason =
  | "released" // Included in a version release (normal path)
  | "declined" // Won't implement - out of scope or not aligned with vision
  | "duplicate" // Already exists or covered by another item
  | "wont-fix" // Working as intended, not a bug
  | "deferred" // Will revisit later (may have deferredUntil date)
  | "invalid"; // Not enough info, can't reproduce, or spam

export const ARCHIVE_REASONS: ArchiveReason[] = [
  "released",
  "declined",
  "duplicate",
  "wont-fix",
  "deferred",
  "invalid",
];

export function isArchiveReason(value: unknown): value is ArchiveReason {
  return (
    typeof value === "string" &&
    (ARCHIVE_REASONS as readonly string[]).includes(value)
  );
}

/**
 * Tester confirmation status after admin resolves feedback
 */
export type TesterConfirmationStatus =
  | "pending" // Waiting for tester to confirm
  | "confirmed" // Tester confirms fix works
  | "needs-work" // Tester says it needs more work
  | "no-response"; // Tester hasn't responded after timeout

/**
 * Subtask status for prerequisite tracking
 */
export type SubtaskStatus = "pending" | "in-progress" | "completed";

/**
 * Subtask for breaking down complex feedback into prerequisites
 * Created by agents when feedback is too large to implement directly
 */
export interface FeedbackSubtask {
  id: string; // Unique within parent (e.g., "1", "2", or short slug)
  title: string; // Short title (2-5 words)
  description: string; // What needs to be done
  status: SubtaskStatus;
  completedAt?: Date;
  dependsOn?: string[]; // IDs of subtasks this depends on
}

/**
 * Core feedback item stored in Firestore
 */
export interface FeedbackItem {
  id: string;
  createdAt: Date;
  userId: string;
  userEmail: string;
  userDisplayName: string;
  userPhotoURL?: string; // Profile avatar

  // Feedback content
  type: FeedbackType;
  title: string;
  description: string;
  priority?: FeedbackPriority;
  imageUrls?: string[]; // Screenshots attached to feedback
  // Staging paths set by the client on submit; consumed + deleted by the
  // promoteFeedbackImages onCreate trigger, which then populates imageUrls.
  stagedImagePaths?: string[];

  // Original content (write-once, never overwritten)
  // Preserved for long-term analysis of user language patterns and mental models
  originalTitle?: string;
  originalDescription?: string;

  // Context (auto-captured)
  capturedModule: string;
  capturedTab: string;
  deviceContext?: DeviceContext; // Browser/device info for debugging

  // Source tracking
  source?: FeedbackSource; // "app" = in-app form, "terminal" = CLI/dev log, "agent" = ingest endpoint
  sourceAgent?: string; // Agent identifier when source is "agent" (e.g., "claude-chat")

  // Assignment
  assignedTo?: string; // userId of assigned developer (from contributors)
  assignedToName?: string; // Display name for fast rendering

  // Admin management
  status: FeedbackStatus;
  adminNotes?: string; // Admin-only: internal summary of what was fixed
  userFacingNotes?: string; // User-visible: friendly explanation for the submitter
  changelogEntry?: string; // User-facing changelog text, captured at completion
  updatedAt?: Date;

  // Claim tracking
  claimedAt?: Date; // When an agent claimed this item
  claimedBy?: string; // userId of who claimed it (for accountability)
  claimToken?: string; // Unique token for race-safe claiming (UUID, first 8 chars shown in UI)
  claimSession?: string; // Session ID for this claim (for agent tracking)
  lastActivity?: Date; // Most recent heartbeat/activity timestamp
  lastActivityType?: string; // Type of last activity (claimed, heartbeat, file_touch, etc.)

  // Subtasks (optional - for complex feedback requiring prerequisites)
  subtasks?: FeedbackSubtask[];

  // Admin response to tester (visible to tester)
  adminResponse?: AdminResponse;

  // Tester confirmation (after admin marks as resolved)
  testerConfirmation?: TesterConfirmation;

  // Soft delete
  isDeleted?: boolean;
  deletedAt?: Date;
  deletedBy?: string;

  // Version tracking (set when archived)
  fixedInVersion?: string; // e.g., "0.2.0"
  archivedAt?: Date; // When moved to archive
  archiveReason?: ArchiveReason; // Why it was archived (released, declined, etc.)

  // Message tracking (prevents duplicate notifications)
  lastNotifiedAt?: Date; // When user was last notified about this item
  lastNotifiedStatus?: FeedbackStatus; // Status when last notified

  // Deferment (archived items scheduled for reactivation)
  deferredUntil?: Date; // When to reactivate this item
  reactivatedAt?: Date; // When this was reactivated from deferment
  reactivatedFrom?: Date; // Original deferredUntil date when reactivated

  // Status change history
  statusHistory?: StatusHistoryEntry[];
}

/**
 * Admin response to tester - visible in tester's "My Feedback" view
 */
export interface AdminResponse {
  message: string;
  respondedAt: Date;
  respondedBy: string; // admin userId
}

/**
 * Tester's confirmation after fix is implemented
 */
export interface TesterConfirmation {
  status: TesterConfirmationStatus;
  comment?: string;
  respondedAt?: Date;
}

/**
 * Status change history entry
 * Tracks who made the change for accountability and audit trails
 */
export interface StatusHistoryEntry {
  status: FeedbackStatus;
  timestamp: Date;
  fromStatus?: FeedbackStatus;
  actorId?: string; // userId of who made the change (or "system" for automated)
  actorName?: string; // Display name for UI
  notes?: string; // Optional notes about this transition
}

/**
 * Form data for feedback submission
 * Simplified: just type and description. Title is auto-generated.
 * Priority and context are handled separately (admin-assigned and auto-captured).
 */
export interface FeedbackFormData {
  type: FeedbackType;
  title: string;
  description: string;
}

/**
 * Form validation errors
 */
export interface FeedbackFormErrors {
  type?: string;
  title?: string;
  description?: string;
}

/**
 * Form submission status
 */
export type FeedbackSubmitStatus = "idle" | "submitting" | "success" | "error";

/**
 * Upload progress during feedback submission.
 * Uses a single 0–1 fraction representing aggregate bytes across all images.
 */
export interface FeedbackUploadProgress {
  phase: "saving" | "uploading";
  /** 0–1 representing aggregate bytesTransferred / totalBytes across all images */
  fraction: number;
}

/**
 * Callback for reporting upload progress during feedback submission.
 */
export type FeedbackProgressCallback = (progress: FeedbackUploadProgress) => void;

/**
 * Per-image staging state. Tracks an individual image's upload to the
 * staging area, from the moment it's attached until submit or removal.
 */
export interface StagedImageState {
  status: "uploading" | "uploaded" | "failed";
  /** 0–1 upload progress fraction */
  fraction: number;
  /** Firebase Storage download URL, available once status is "uploaded" */
  downloadUrl?: string;
  /** Storage path for cancellation or deletion */
  storagePath: string;
}

/**
 * Filter options for manage tab
 */
export interface FeedbackFilterOptions {
  type: FeedbackType | "all";
  status: FeedbackStatus | "all";
  priority: FeedbackPriority | "all";
}

/**
 * Status display configuration - 4 Kanban columns + archived
 */
export const STATUS_CONFIG: Record<
  FeedbackStatus,
  { label: string; color: string; icon: string }
> = {
  new: { label: "New", color: "#3b82f6", icon: "fa-inbox" },
  "in-progress": { label: "In Progress", color: "#f59e0b", icon: "fa-spinner" },
  "in-review": { label: "In Review", color: "#8b5cf6", icon: "fa-eye" },
  completed: { label: "Completed", color: "#10b981", icon: "fa-check-circle" },
  archived: { label: "Archived", color: "#6b7280", icon: "fa-archive" },
};

/**
 * Tester confirmation status display configuration
 */
export const CONFIRMATION_STATUS_CONFIG: Record<
  TesterConfirmationStatus,
  { label: string; color: string; icon: string }
> = {
  pending: {
    label: "Awaiting Confirmation",
    color: "#f59e0b",
    icon: "fa-clock",
  },
  confirmed: { label: "Confirmed Working", color: "#10b981", icon: "fa-check" },
  "needs-work": { label: "Needs More Work", color: "#ef4444", icon: "fa-redo" },
  "no-response": {
    label: "No Response",
    color: "#6b7280",
    icon: "fa-question",
  },
};

/**
 * Priority display configuration
 */
export const PRIORITY_CONFIG: Record<
  FeedbackPriority,
  { label: string; color: string; icon: string }
> = {
  low: { label: "Low", color: "#6b7280", icon: "fa-arrow-down" },
  medium: { label: "Medium", color: "#f59e0b", icon: "fa-minus" },
  high: { label: "High", color: "#f97316", icon: "fa-arrow-up" },
  critical: { label: "Critical", color: "#ef4444", icon: "fa-exclamation" },
};

/**
 * Feedback type display configuration
 */
export const TYPE_CONFIG: Record<
  FeedbackType,
  { label: string; color: string; icon: string; placeholder: string }
> = {
  bug: {
    label: "Bug Report",
    color: "#ef4444",
    icon: "fa-bug",
    placeholder: "What happened? What did you expect instead?",
  },
  feature: {
    label: "Feature Request",
    color: "#8b5cf6",
    icon: "fa-lightbulb",
    placeholder: "What would you like to see in the app?",
  },
  general: {
    label: "General Feedback",
    color: "#3b82f6",
    icon: "fa-comment",
    placeholder: "What's on your mind?",
  },
};

/**
 * Archive reason display configuration
 */
export const ARCHIVE_REASON_CONFIG: Record<
  ArchiveReason,
  { label: string; color: string; icon: string; description: string }
> = {
  released: {
    label: "Released",
    color: "#10b981",
    icon: "fa-rocket",
    description: "Included in a version release",
  },
  declined: {
    label: "Declined",
    color: "#6b7280",
    icon: "fa-times-circle",
    description: "Won't implement - out of scope",
  },
  duplicate: {
    label: "Duplicate",
    color: "#f59e0b",
    icon: "fa-clone",
    description: "Already exists or covered by another item",
  },
  "wont-fix": {
    label: "Won't Fix",
    color: "#6b7280",
    icon: "fa-ban",
    description: "Working as intended",
  },
  deferred: {
    label: "Deferred",
    color: "#3b82f6",
    icon: "fa-clock",
    description: "Will revisit later",
  },
  invalid: {
    label: "Invalid",
    color: "#ef4444",
    icon: "fa-exclamation-triangle",
    description: "Not enough info or can't reproduce",
  },
};
