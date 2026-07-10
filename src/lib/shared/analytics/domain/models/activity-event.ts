/**
 * Activity Event Model
 *
 * Represents a single user activity event for analytics tracking.
 * Events are stored in Firestore under users/{userId}/activityLog
 */

/**
 * Categories of activity events
 */
export type ActivityCategory =
  | "session" // Login, logout, app open
  | "navigation" // Module/page views
  | "sequence" // Create, edit, save, delete sequences
  | "share" // Share actions
  | "social" // Follow, like, comment
  | "learn" // Quiz, lessons, tutorials
  | "settings" // Settings changes
  | "shop"; // Storefront configurator interactions

/**
 * Specific event types within each category
 */
export type ActivityEventType =
  // Session events
  | "session_start"
  | "session_end"
  // Navigation events
  | "module_view"
  | "panel_open"
  | "panel_close"
  // Sequence events
  | "sequence_create"
  | "sequence_save"
  | "sequence_delete"
  | "sequence_edit"
  | "sequence_view"
  | "sequence_play" // Animation playback
  | "sequence_generate" // Auto-generation
  // Share events
  | "sequence_share"
  | "sequence_export"
  | "link_copy"
  // Social events
  | "user_follow"
  | "user_unfollow"
  | "sequence_like"
  | "sequence_unlike"
  | "sequence_favorite"
  | "sequence_unfavorite"
  // Learn events
  | "lesson_start"
  | "lesson_complete"
  | "quiz_start"
  | "quiz_complete"
  | "quiz_answer"
  // Settings events
  | "setting_change"
  | "prop_type_change"
  | "theme_change"
  // Shop events (usage-gated features: if nobody fires these, the feature goes)
  | "shop_loop_advanced_opened"
  | "shop_loop_advanced_customized";

/**
 * Metadata that can be attached to events
 */
export interface ActivityMetadata {
  // Navigation context
  module?: string;
  panel?: string;
  previousModule?: string;

  // Sequence context
  sequenceId?: string;
  sequenceWord?: string;
  sequenceLength?: number;
  isPublic?: boolean;

  // Generation context
  generationType?: string;
  loopType?: string;

  // Learn context
  lessonId?: string;
  quizId?: string;
  score?: number;
  correct?: boolean;

  // Settings context
  settingKey?: string;
  oldValue?: string | number | boolean;
  newValue?: string | number | boolean;

  // Share context
  shareMethod?: string;
  exportFormat?: string;

  // Social context
  targetUserId?: string;

  // Duration tracking (ms)
  duration?: number;

  // Any additional custom data
  [key: string]: unknown;
}

/**
 * A single activity event
 */
export interface ActivityEvent {
  /** Unique event ID (auto-generated) */
  id?: string;

  /** User who performed the action */
  userId: string;

  /** Session ID for grouping events */
  sessionId?: string;

  /** Category of the event */
  category: ActivityCategory;

  /** Specific event type */
  eventType: ActivityEventType;

  /** When the event occurred */
  timestamp: Date;

  /** Additional event-specific data */
  metadata?: ActivityMetadata;

  /** Client info for debugging */
  client?: {
    userAgent?: string;
    platform?: string;
    screenWidth?: number;
    screenHeight?: number;
  };
}

/**
 * Summary of activity for a time period
 */
export interface ActivitySummary {
  /** Date of the summary (YYYY-MM-DD) */
  date: string;

  /** Number of unique active users */
  activeUsers: number;

  /** Total events logged */
  totalEvents: number;

  /** Breakdown by category */
  byCategory: Record<ActivityCategory, number>;

  /** Breakdown by event type */
  byEventType: Record<string, number>;
}
