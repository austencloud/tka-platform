/**
 * Activity Log Service Interface
 *
 * Service for logging and querying user activity events.
 */

import type {
  ActivityEvent,
  ActivityEventType,
  ActivityCategory,
  ActivityMetadata,
  ActivitySummary,
} from "../../domain/models/ActivityEvent";

/**
 * Options for querying activity events
 */
export interface ActivityQueryOptions {
  /** Filter by user ID */
  userId?: string;

  /** Filter by category */
  category?: ActivityCategory;

  /** Filter by event type */
  eventType?: ActivityEventType;

  /** Start date (inclusive) */
  startDate?: Date;

  /** End date (inclusive) */
  endDate?: Date;

  /** Maximum number of results */
  limit?: number;

  /** Order by timestamp */
  orderDirection?: "asc" | "desc";
}

/**
 * Service for logging and querying user activity
 */
export interface IActivityLogger {
  /**
   * Log a single activity event
   * @param eventType - The type of event
   * @param category - The category of event
   * @param metadata - Optional additional data
   */
  log(
    eventType: ActivityEventType,
    category: ActivityCategory,
    metadata?: ActivityMetadata
  ): Promise<void>;

  /**
   * Log a session start event
   */
  logSessionStart(): Promise<void>;

  /**
   * Log a module/page view
   * @param module - The module being viewed
   * @param previousModule - The previous module (if any)
   */
  logModuleView(module: string, previousModule?: string): Promise<void>;

  /**
   * Log a sequence action
   * @param action - The action type (create, save, delete, etc.)
   * @param sequenceId - The sequence ID
   * @param metadata - Additional sequence data
   */
  logSequenceAction(
    action:
      | "create"
      | "save"
      | "delete"
      | "edit"
      | "view"
      | "play"
      | "generate",
    sequenceId: string,
    metadata?: Partial<ActivityMetadata>
  ): Promise<void>;

  /**
   * Log a share action
   * @param action - The share action type
   * @param metadata - Share details
   */
  logShareAction(
    action: "sequence_share" | "sequence_export" | "link_copy",
    metadata?: Partial<ActivityMetadata>
  ): Promise<void>;

  /**
   * Log an achievement/XP event
   * @param action - The achievement action type
   * @param metadata - Achievement details
   */
  logAchievementAction(
    action:
      | "achievement_unlock"
      | "challenge_start"
      | "challenge_complete"
      | "xp_earn"
      | "level_up",
    metadata?: Partial<ActivityMetadata>
  ): Promise<void>;

  /**
   * Log a settings change
   * @param settingKey - The setting that changed
   * @param oldValue - Previous value
   * @param newValue - New value
   */
  logSettingChange(
    settingKey: string,
    oldValue: string | number | boolean,
    newValue: string | number | boolean
  ): Promise<void>;

  /**
   * Query activity events
   * @param options - Query options
   */
  queryEvents(options: ActivityQueryOptions): Promise<ActivityEvent[]>;

  /**
   * Get activity summary for a date range
   * @param startDate - Start of range
   * @param endDate - End of range
   */
  getActivitySummary(
    startDate: Date,
    endDate: Date
  ): Promise<ActivitySummary[]>;

  /**
   * Get daily active user counts for a date range
   * @param startDate - Start of range
   * @param days - Number of days
   */
  getDailyActiveUsers(
    startDate: Date,
    days: number
  ): Promise<Map<string, number>>;

  /**
   * Get event counts by type for a date range
   * @param startDate - Start of range
   * @param endDate - End of range
   */
  getEventCounts(
    startDate: Date,
    endDate: Date
  ): Promise<Map<ActivityEventType, number>>;
}
