/**
 * Display configuration for feedback UI.
 *
 * Labels, colors, and icons for each enum value.
 * UI components use these instead of hardcoding display logic.
 */

import type {
  FeedbackStatus,
  FeedbackType,
  FeedbackPriority,
  ArchiveReason,
  TesterConfirmationStatus,
} from "./enums.js";


export const STATUS_CONFIG: Record<
  FeedbackStatus,
  { label: string; color: string; icon: string }
> = {
  new: { label: "New", color: "#3b82f6", icon: "fa-inbox" },
  "in-progress": {
    label: "In Progress",
    color: "#f59e0b",
    icon: "fa-spinner",
  },
  "in-review": { label: "In Review", color: "#8b5cf6", icon: "fa-eye" },
  completed: { label: "Completed", color: "#10b981", icon: "fa-check-circle" },
  archived: { label: "Archived", color: "#6b7280", icon: "fa-archive" },
};


export const CONFIRMATION_STATUS_CONFIG: Record<
  TesterConfirmationStatus,
  { label: string; color: string; icon: string }
> = {
  pending: {
    label: "Awaiting Confirmation",
    color: "#f59e0b",
    icon: "fa-clock",
  },
  confirmed: {
    label: "Confirmed Working",
    color: "#10b981",
    icon: "fa-check",
  },
  "needs-work": {
    label: "Needs More Work",
    color: "#ef4444",
    icon: "fa-redo",
  },
  "no-response": {
    label: "No Response",
    color: "#6b7280",
    icon: "fa-question",
  },
};


export const PRIORITY_CONFIG: Record<
  FeedbackPriority,
  { label: string; color: string; icon: string }
> = {
  low: { label: "Low", color: "#6b7280", icon: "fa-arrow-down" },
  medium: { label: "Medium", color: "#f59e0b", icon: "fa-minus" },
  high: { label: "High", color: "#f97316", icon: "fa-arrow-up" },
  critical: { label: "Critical", color: "#ef4444", icon: "fa-exclamation" },
};


export const TYPE_CONFIG: Record<
  FeedbackType,
  { label: string; color: string; icon: string; placeholder: string }
> = {
  bug: {
    label: "Bug Report",
    color: "#ef4444",
    icon: "fa-bug",
    placeholder: "What went wrong? Describe the issue in detail...",
  },
  feature: {
    label: "Feature Request",
    color: "#8b5cf6",
    icon: "fa-lightbulb",
    placeholder: "Describe the feature and how it would help you...",
  },
  general: {
    label: "General Feedback",
    color: "#3b82f6",
    icon: "fa-comment",
    placeholder: "Share your thoughts, suggestions, or observations...",
  },
};

// ── Archive reason display ─────────────────────────────────────────

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
