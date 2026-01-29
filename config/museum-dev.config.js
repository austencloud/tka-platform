/**
 * Museum Development Tracking System Configuration
 *
 * Centralized configuration for creative worldbuilding/museum development tracking.
 * Fork of the feedback system, adapted for decision tracking and session preservation.
 *
 * Key differences from feedback:
 * - No notifications (internal tool only)
 * - Bidirectional linking between items
 * - Session transcripts stored directly
 * - Verdicts instead of releases for archiving
 *
 * Usage:
 *   import config from '../config/museum-dev.config.js';
 *   const { ITEM_TYPES, LINK_TYPES } = config;
 */

// Environment variable overrides (for future flexibility)
const env = process.env;

/**
 * Admin Configuration
 * Same as feedback system - Austen is the sole user
 */
export const ADMIN_USER_ID =
  env.MUSEUM_ADMIN_UID || "PBp3GSBO6igCKPwJyLZNmVEmamI3";

export const ADMIN_USER = {
  userId: ADMIN_USER_ID,
  displayName: env.MUSEUM_ADMIN_NAME || "Austen Cloud",
  email: env.MUSEUM_ADMIN_EMAIL || "austencloud@gmail.com",
};

/**
 * Item Types
 *
 * The primary categorization of tracked items.
 */
export const ITEM_TYPES = ["session", "decision", "question", "element", "reference"];

/**
 * Element Subtypes
 *
 * For items with type='element', further categorization.
 */
export const ELEMENT_SUBTYPES = [
  "wing",       // Museum wing/section
  "artifact",   // Interactive exhibit or object
  "plaque",     // Text/explanation display
  "character",  // Character or entity in the world
  "mechanic",   // Game/interaction mechanic
  "audio",      // Sound design element
  "visual",     // Visual design element
];

/**
 * Link Types
 *
 * Relationships between items for bidirectional linking.
 */
export const LINK_TYPES = [
  "spawned",      // Session spawned this decision/question
  "derived",      // This item was derived from another
  "related",      // General relationship
  "contradicts",  // This item contradicts another (useful for tracking rejected ideas)
  "answers",      // This item answers a question
];

/**
 * Verdict Types
 *
 * For decisions - what happened to this idea?
 */
export const VERDICT_TYPES = [
  "accepted",    // Idea accepted and will be implemented
  "rejected",    // Idea rejected (but preserved for history)
  "deferred",    // Idea deferred for later consideration
  "superseded",  // Idea replaced by a better one
];

/**
 * Claim Management - Stale Thresholds
 *
 * Reused from feedback system.
 * Claims are considered "stale" (abandonable) when:
 * 1. No activity for ACTIVITY_TIMEOUT_MS (45 min default), OR
 * 2. Total claim time exceeds TOTAL_CLAIM_MAX_MS (8 hours default)
 */
export const STALE_THRESHOLDS = {
  // No activity for this long = stale
  ACTIVITY_TIMEOUT_MS: parseInt(env.STALE_ACTIVITY_MS) || 45 * 60 * 1000, // 45 minutes

  // Hard cap on total claim time
  TOTAL_CLAIM_MAX_MS: parseInt(env.STALE_TOTAL_MS) || 8 * 60 * 60 * 1000, // 8 hours

  // Warning when approaching staleness
  WARNING_THRESHOLD_MS: parseInt(env.STALE_WARNING_MS) || 30 * 60 * 1000, // 30 minutes
};

/**
 * Agent Session Configuration
 */
export const AGENT_SESSION_CONFIG = {
  SESSION_TIMEOUT_MS: parseInt(env.AGENT_SESSION_TIMEOUT_MS) || 60 * 60 * 1000, // 1 hour
  VALID_AGENT_TYPES: ["claude-cli", "human"],
};

/**
 * Valid State Transitions
 *
 * Same lifecycle as feedback for consistency.
 */
export const VALID_TRANSITIONS = {
  new: ["in-progress"],
  "in-progress": ["new", "in-review"],
  "in-review": ["in-progress", "completed"],
  completed: ["archived", "in-review"],
  archived: ["new"],
};

/**
 * Journal Entry Types
 *
 * All activity is logged to an append-only journal.
 */
export const JOURNAL_TYPES = {
  CLAIMED: "claimed",
  HEARTBEAT: "heartbeat",
  NOTE: "note",
  STATUS_CHANGE: "status_change",
  LINK_ADDED: "link_added",
  LINK_REMOVED: "link_removed",
  VERDICT_SET: "verdict_set",
  TRANSCRIPT_ATTACHED: "transcript_attached",
  ATTACHMENT_ADDED: "attachment_added",
  UNCLAIMED: "unclaimed",
};

/**
 * Valid Status Values
 */
export const STATUSES = [
  "new",
  "in-progress",
  "in-review",
  "completed",
  "archived",
];

/**
 * Archive Reasons
 */
export const ARCHIVE_REASONS = [
  "accepted",     // Decision accepted and documented
  "rejected",     // Decision rejected (but preserved)
  "superseded",   // Replaced by newer decision
  "completed",    // Question answered or element finalized
  "deferred",     // Will revisit later
];

/**
 * Firestore Collection Names
 */
export const COLLECTIONS = {
  ITEMS: "museumDev",
  SESSIONS: "museumDevSessions",
};

/**
 * Attachment Types
 */
export const ATTACHMENT_TYPES = [
  "image",      // Concept art, reference images
  "audio",      // Sound design, music references
  "document",   // PDFs, markdown files
  "url",        // External links
];

/**
 * Default Tags for Quick Categorization
 */
export const DEFAULT_TAGS = [
  "order",           // The Order faction
  "vtg",             // VTG/notation related
  "flow-arts",       // Flow arts culture
  "museum-layout",   // Physical museum structure
  "character",       // Character development
  "mechanic",        // Game/interaction mechanics
  "lore",            // Worldbuilding lore
  "tone",            // Tone/style decisions
];

// Default export for convenience
export default {
  ADMIN_USER_ID,
  ADMIN_USER,
  ITEM_TYPES,
  ELEMENT_SUBTYPES,
  LINK_TYPES,
  VERDICT_TYPES,
  STALE_THRESHOLDS,
  AGENT_SESSION_CONFIG,
  VALID_TRANSITIONS,
  JOURNAL_TYPES,
  STATUSES,
  ARCHIVE_REASONS,
  COLLECTIONS,
  ATTACHMENT_TYPES,
  DEFAULT_TAGS,
};
