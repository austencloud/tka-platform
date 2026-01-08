/**
 * Feedback System Configuration
 *
 * Centralized configuration for the feedback management system.
 * All hardcoded values that might need to change are extracted here.
 *
 * Usage:
 *   import config from '../config/feedback.config.js';
 *   const { ADMIN_USER_ID, STALE_CLAIM_MS } = config;
 */

// Environment variable overrides (for future flexibility)
const env = process.env;

/**
 * Admin Configuration
 */
export const ADMIN_USER_ID =
  env.FEEDBACK_ADMIN_UID || "PBp3GSBO6igCKPwJyLZNmVEmamI3";

export const ADMIN_USER = {
  userId: ADMIN_USER_ID,
  displayName: env.FEEDBACK_ADMIN_NAME || "Austen Cloud",
  email: env.FEEDBACK_ADMIN_EMAIL || "austencloud@gmail.com",
  photoURL:
    env.FEEDBACK_ADMIN_PHOTO ||
    "https://lh3.googleusercontent.com/a/ACg8ocJ3KdjUMAOYNbg_fpHXouXfgTPntLXQVQVQwb_bsbViiAQujwYYJg=s96-c",
};

/**
 * Claim Management
 */
// Items claimed longer than this can be reclaimed by another agent
export const STALE_CLAIM_MS = parseInt(env.STALE_CLAIM_MS) || 2 * 60 * 60 * 1000; // 2 hours

// Priority order for claiming (first has highest priority)
// Empty string = no priority set (these get worked on first to force triage)
export const PRIORITY_ORDER = ["", "high", "medium", "low"];

/**
 * Valid Status Values
 */
export const FEEDBACK_STATUSES = [
  "new",
  "in-progress",
  "in-review",
  "completed",
  "archived",
];

/**
 * Valid Priority Values
 */
export const FEEDBACK_PRIORITIES = ["low", "medium", "high", "critical"];

/**
 * Valid Feedback Types
 */
export const FEEDBACK_TYPES = ["bug", "feature", "general"];

/**
 * Archive Reasons (for declined/deferred feedback)
 * Used to categorize why feedback was archived without being released
 */
export const ARCHIVE_REASONS = [
  "released", // Included in a version release (normal path)
  "declined", // Won't implement - out of scope or not aligned with vision
  "duplicate", // Already exists or covered by another item
  "wont-fix", // Working as intended, not a bug
  "deferred", // Will revisit later (may have deferredUntil date)
  "invalid", // Not enough info, can't reproduce, or spam
];

/**
 * Message Templates
 */
export const MESSAGE_TEMPLATES = {
  // When feedback moves to completed
  completed: (notes) =>
    notes
      ? `Your feedback has been addressed: ${notes}`
      : "Your feedback has been addressed and is ready for the next release!",

  // When feedback is included in a release
  released: (version) =>
    `Your feedback was included in version ${version}! Thank you for helping improve TKA Scribe.`,

  // When feedback is archived without release
  archived: (notes) =>
    notes
      ? `Your feedback has been resolved: ${notes}`
      : "Your feedback has been resolved. Thank you for your input!",
};

/**
 * Notification Types
 */
export const NOTIFICATION_TYPES = {
  FEEDBACK_RESOLVED: "feedback-resolved",
  FEEDBACK_RELEASED: "feedback-released",
  FEEDBACK_COMMENTED: "feedback-commented",
};

// Default export for convenience
export default {
  ADMIN_USER_ID,
  ADMIN_USER,
  STALE_CLAIM_MS,
  PRIORITY_ORDER,
  FEEDBACK_STATUSES,
  FEEDBACK_PRIORITIES,
  FEEDBACK_TYPES,
  ARCHIVE_REASONS,
  MESSAGE_TEMPLATES,
  NOTIFICATION_TYPES,
};
