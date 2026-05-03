/**
 * PostHog Activity Logger Implementation
 *
 * PostHog activity logger implementation.
 * Drop-in replacement for the Firestore-based ActivityLogger.
 *
 * PostHog handles:
 * - Event buffering and batching
 * - Session tracking (automatic)
 * - User identification (via identifyUser in posthog.ts)
 * - Offline event queuing
 */

import { browser } from "$app/environment";
import { captureEvent } from "../posthog";
import type {
  ActivityQueryOptions,
} from "../contracts/types";
import type {
  ActivityEvent,
  ActivityEventType,
  ActivityCategory,
  ActivityMetadata,
  ActivitySummary,
} from "../../domain/models/ActivityEvent";

export class PostHogActivityLogger {
  /**
   * Log a single activity event to PostHog
   */
  async log(
    eventType: ActivityEventType,
    category: ActivityCategory,
    metadata?: ActivityMetadata
  ): Promise<void> {
    if (!browser) return;

    // Build properties object for PostHog
    const properties: Record<string, unknown> = {
      category,
    };

    // Map metadata fields to PostHog properties
    if (metadata) {
      // Navigation context
      if (metadata.module !== undefined) properties.module = metadata.module;
      if (metadata.panel !== undefined) properties.panel = metadata.panel;
      if (metadata.previousModule !== undefined)
        properties.previous_module = metadata.previousModule;

      // Sequence context
      if (metadata.sequenceId !== undefined)
        properties.sequence_id = metadata.sequenceId;
      if (metadata.sequenceWord !== undefined)
        properties.word = metadata.sequenceWord;
      if (metadata.sequenceLength !== undefined)
        properties.sequence_length = metadata.sequenceLength;
      if (metadata.isPublic !== undefined)
        properties.is_public = metadata.isPublic;

      // Generation context
      if (metadata.generationType !== undefined)
        properties.generation_type = metadata.generationType;
      if (metadata.loopType !== undefined)
        properties.cap_type = metadata.loopType;

      // Learn context
      if (metadata.lessonId !== undefined)
        properties.lesson_id = metadata.lessonId;
      if (metadata.quizId !== undefined) properties.quiz_id = metadata.quizId;
      if (metadata.score !== undefined) properties.score = metadata.score;
      if (metadata.correct !== undefined)
        properties.correct = metadata.correct;

      // Achievement context
      if (metadata.achievementId !== undefined)
        properties.achievement_id = metadata.achievementId;
      if (metadata.challengeId !== undefined)
        properties.challenge_id = metadata.challengeId;
      if (metadata.xpAmount !== undefined)
        properties.xp_amount = metadata.xpAmount;
      if (metadata.newLevel !== undefined)
        properties.new_level = metadata.newLevel;

      // Settings context
      if (metadata.settingKey !== undefined)
        properties.setting_key = metadata.settingKey;
      if (metadata.oldValue !== undefined)
        properties.old_value = metadata.oldValue;
      if (metadata.newValue !== undefined)
        properties.new_value = metadata.newValue;

      // Share context
      if (metadata.shareMethod !== undefined)
        properties.share_method = metadata.shareMethod;
      if (metadata.exportFormat !== undefined)
        properties.export_format = metadata.exportFormat;

      // Social context
      if (metadata.targetUserId !== undefined)
        properties.target_user_id = metadata.targetUserId;

      // Duration tracking
      if (metadata.duration !== undefined)
        properties.duration_ms = metadata.duration;

      // Include any additional custom properties
      for (const [key, value] of Object.entries(metadata)) {
        // Skip already-mapped fields
        if (
          ![
            "module",
            "panel",
            "previousModule",
            "sequenceId",
            "sequenceWord",
            "sequenceLength",
            "isPublic",
            "generationType",
            "loopType",
            "lessonId",
            "quizId",
            "score",
            "correct",
            "achievementId",
            "challengeId",
            "xpAmount",
            "newLevel",
            "settingKey",
            "oldValue",
            "newValue",
            "shareMethod",
            "exportFormat",
            "targetUserId",
            "duration",
          ].includes(key)
        ) {
          properties[key] = value;
        }
      }
    }

    // Capture the event - PostHog handles batching and delivery
    captureEvent(eventType, properties);
  }

  /**
   * Log a session start event
   * Note: PostHog tracks sessions automatically, but we still emit this
   * for consistency with the existing API and for explicit session markers.
   */
  async logSessionStart(): Promise<void> {
    await this.log("session_start", "session");
  }

  /**
   * Log a module/page view
   */
  async logModuleView(module: string, previousModule?: string): Promise<void> {
    await this.log("module_view", "navigation", {
      module,
      previousModule,
    });
  }

  /**
   * Log a sequence action
   */
  async logSequenceAction(
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
  ): Promise<void> {
    const eventType = `sequence_${action}` as ActivityEventType;
    await this.log(eventType, "sequence", {
      sequenceId,
      ...metadata,
    });
  }

  /**
   * Log a share action
   */
  async logShareAction(
    action: "sequence_share" | "sequence_export" | "link_copy",
    metadata?: Partial<ActivityMetadata>
  ): Promise<void> {
    await this.log(action, "share", metadata);
  }

  /**
   * Log an achievement/XP event
   */
  async logAchievementAction(
    action:
      | "achievement_unlock"
      | "challenge_start"
      | "challenge_complete"
      | "xp_earn"
      | "level_up",
    metadata?: Partial<ActivityMetadata>
  ): Promise<void> {
    await this.log(action, "achievement", metadata);
  }

  /**
   * Log a settings change
   */
  async logSettingChange(
    settingKey: string,
    oldValue: string | number | boolean,
    newValue: string | number | boolean
  ): Promise<void> {
    await this.log("setting_change", "settings", {
      settingKey,
      oldValue,
      newValue,
    });
  }

  /**
   * Query activity events
   *
   * Note: PostHog is not designed for client-side querying of raw events.
   * This method returns an empty array as event querying should be done
   * through the PostHog dashboard or API from a backend service.
   *
   * For admin dashboards that need this data, use the PostHog API directly
   * from a server-side endpoint with proper authentication.
   */
  async queryEvents(_options: ActivityQueryOptions): Promise<ActivityEvent[]> {
    console.warn(
      "[PostHogActivityLogger] queryEvents is not supported. " +
        "Use PostHog dashboard or API for event queries."
    );
    return [];
  }

  /**
   * Get activity summary for a date range
   *
   * Note: PostHog provides this through its dashboard and insights.
   * This method returns an empty array for the same reason as queryEvents.
   */
  async getActivitySummary(
    _startDate: Date,
    _endDate: Date
  ): Promise<ActivitySummary[]> {
    console.warn(
      "[PostHogActivityLogger] getActivitySummary is not supported. " +
        "Use PostHog dashboard or API for analytics."
    );
    return [];
  }

  /**
   * Get daily active user counts
   *
   * Note: PostHog tracks DAU automatically. Access through PostHog dashboard.
   */
  async getDailyActiveUsers(
    _startDate: Date,
    _days: number
  ): Promise<Map<string, number>> {
    console.warn(
      "[PostHogActivityLogger] getDailyActiveUsers is not supported. " +
        "Use PostHog dashboard for DAU metrics."
    );
    return new Map();
  }

  /**
   * Get event counts by type
   *
   * Note: PostHog provides event counts through its insights feature.
   */
  async getEventCounts(
    _startDate: Date,
    _endDate: Date
  ): Promise<Map<ActivityEventType, number>> {
    console.warn(
      "[PostHogActivityLogger] getEventCounts is not supported. " +
        "Use PostHog dashboard or API for event counts."
    );
    return new Map();
  }
}
