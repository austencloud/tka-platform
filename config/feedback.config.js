/**
 * Feedback System Configuration
 *
 * Centralized configuration for the feedback management system.
 * All hardcoded values that might need to change are extracted here.
 *
 * IMPORTANT: Claim-related thresholds are also defined in:
 *   src/lib/features/feedback/config/claim-config.ts
 *
 * The TypeScript file is the single source of truth for the frontend.
 * This file mirrors those values for CLI compatibility (Node.js can't import TS).
 * Keep both files in sync when updating thresholds.
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
 * Claim Management - Stale Thresholds
 *
 * SYNC WITH: src/lib/features/feedback/config/claim-config.ts
 *
 * Claims are considered "stale" (abandonable) when:
 * 1. No activity for ACTIVITY_TIMEOUT_MS (45 min default), OR
 * 2. Total claim time exceeds TOTAL_CLAIM_MAX_MS (8 hours default)
 *
 * The activity-based check catches crashed/abandoned sessions.
 * The hard cap prevents indefinite claim hoarding.
 */
export const STALE_THRESHOLDS = {
  // No activity for this long = stale (agent likely crashed or forgot)
  ACTIVITY_TIMEOUT_MS: parseInt(env.STALE_ACTIVITY_MS) || 45 * 60 * 1000, // 45 minutes

  // Hard cap on total claim time, even with activity
  TOTAL_CLAIM_MAX_MS: parseInt(env.STALE_TOTAL_MS) || 8 * 60 * 60 * 1000, // 8 hours

  // Show warning when approaching staleness (for heartbeat reminders)
  WARNING_THRESHOLD_MS: parseInt(env.STALE_WARNING_MS) || 30 * 60 * 1000, // 30 minutes

  // How long a claim request waits before auto-approving
  REQUEST_WAIT_MS: parseInt(env.CLAIM_REQUEST_WAIT_MS) || 15 * 60 * 1000, // 15 minutes
};

/**
 * Agent Session Configuration
 *
 * SYNC WITH: src/lib/features/feedback/config/claim-config.ts
 */
export const AGENT_SESSION_CONFIG = {
  // How long an agent session can be inactive before cleanup
  SESSION_TIMEOUT_MS: parseInt(env.AGENT_SESSION_TIMEOUT_MS) || 60 * 60 * 1000, // 1 hour

  // Valid agent types that can register sessions
  VALID_AGENT_TYPES: ['claude-cli', 'human', 'ci'],
};

/**
 * Emergency Override Configuration
 *
 * SYNC WITH: src/lib/features/feedback/config/claim-config.ts
 */
export const EMERGENCY_CONFIG = {
  // Cooldown between emergency actions (prevents abuse)
  COOLDOWN_MS: parseInt(env.EMERGENCY_COOLDOWN_MS) || 60 * 60 * 1000, // 1 hour

  // Whether to require double confirmation for emergency actions
  REQUIRE_CONFIRMATION: true,
};

// Legacy alias for backward compatibility
export const STALE_CLAIM_MS = STALE_THRESHOLDS.ACTIVITY_TIMEOUT_MS;

// Priority order for claiming (first has highest priority)
// Empty string = no priority set (these get worked on first to force triage)
export const PRIORITY_ORDER = ["", "high", "medium", "low"];

/**
 * Valid State Transitions
 *
 * Defines the allowed status changes in the feedback lifecycle.
 * Any transition not in this map is invalid and will be rejected.
 */
export const VALID_TRANSITIONS = {
  'new': ['in-progress'],                    // Can only claim
  'in-progress': ['new', 'in-review'],       // Can unclaim or resolve
  'in-review': ['in-progress', 'completed'], // Can need-work or confirm
  'completed': ['archived', 'in-review'],    // Can archive or reopen for more testing
  'archived': ['new'],                       // Can reopen (admin only)
};

/**
 * Journal Entry Types
 *
 * All activity on a feedback item is logged to an append-only journal.
 * This enables work recovery and audit trails.
 */
export const JOURNAL_TYPES = {
  CLAIMED: 'claimed',           // Agent claimed the item
  HEARTBEAT: 'heartbeat',       // Agent sent keep-alive signal
  NOTE: 'note',                 // Admin/resolution note added
  SUBTASK: 'subtask',           // Subtask created/updated
  STATUS_CHANGE: 'status_change', // Status transitioned
  FILE_TOUCHED: 'file_touched', // Agent reported editing a file
  UNCLAIMED: 'unclaimed',       // Item released (voluntary or stale)
  CLAIM_REQUESTED: 'claim_requested', // Another agent requested the claim
  CLAIM_STOLEN: 'claim_stolen', // Emergency takeover occurred
};

/**
 * WIP (Work In Progress) Limits
 * Soft limits per Kanban column - shows warning when exceeded but allows override
 */
export const WIP_LIMITS = {
  'new': 0,           // No limit - inbound queue
  'in-progress': 4,   // Key bottleneck (global across all agents)
  'in-review': 5,     // Buffer for testing
  'completed': 0,     // No limit - staging area
};

/**
 * Swim Lane Configuration
 * Lanes are derived from existing fields, not stored
 */
export const SWIM_LANE_CONFIG = {
  critical: {
    id: 'critical',
    label: 'Critical',
    color: '#ef4444',
    icon: 'fa-fire',
    collapsed: false,
  },
  normal: {
    id: 'normal',
    label: 'Normal',
    color: '#3b82f6',
    icon: 'fa-circle',
    collapsed: false,
  },
  internal: {
    id: 'internal',
    label: 'Internal',
    color: '#6b7280',
    icon: 'fa-code',
    collapsed: true,
  },
  backlog: {
    id: 'backlog',
    label: 'Backlog',
    color: '#94a3b8',
    icon: 'fa-clock',
    collapsed: true,
  },
};

export const SWIM_LANE_ORDER = ['critical', 'normal', 'internal', 'backlog'];

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
    `Your feedback was included in version ${version}! Thank you for helping improve Flow Arts Composer.`,

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

/**
 * Notification Events
 *
 * Controls which events trigger email and/or in-app message notifications.
 */
export const NOTIFICATION_EVENTS = {
  claim: { email: true, message: true },
  "in-review": { email: true, message: true },
  "create-feedback": { email: false, message: true },
  note: { email: false, message: true },
};

// Default export for convenience
export default {
  ADMIN_USER_ID,
  ADMIN_USER,
  STALE_CLAIM_MS,
  STALE_THRESHOLDS,
  AGENT_SESSION_CONFIG,
  EMERGENCY_CONFIG,
  VALID_TRANSITIONS,
  JOURNAL_TYPES,
  PRIORITY_ORDER,
  WIP_LIMITS,
  SWIM_LANE_CONFIG,
  SWIM_LANE_ORDER,
  FEEDBACK_STATUSES,
  FEEDBACK_PRIORITIES,
  FEEDBACK_TYPES,
  ARCHIVE_REASONS,
  MESSAGE_TEMPLATES,
  NOTIFICATION_TYPES,
  NOTIFICATION_EVENTS,
};
