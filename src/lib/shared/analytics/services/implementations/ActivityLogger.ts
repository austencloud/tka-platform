/**
 * Activity Log Service Implementation
 *
 * Logs user activity events to Firestore for analytics tracking.
 * Events are stored in users/{userId}/activityLog subcollection.
 */

import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  getDocs,
  Timestamp,
  collectionGroup,
} from "firebase/firestore";
import { logEvent } from "firebase/analytics";
import { getFirestoreInstance, auth, analytics } from "../../../auth/firebase";
import type {
  IActivityLogger,
  ActivityQueryOptions,
} from "../contracts/IActivityLogger";
import type { ISessionTracker } from "../contracts/ISessionTracker";
import type {
  ActivityEvent,
  ActivityEventType,
  ActivityCategory,
  ActivityMetadata,
  ActivitySummary,
} from "../../domain/models/ActivityEvent";

// Batch writes to reduce Firestore calls
const WRITE_BUFFER_MS = 1000;
const MAX_BUFFER_SIZE = 10;

export class ActivityLogger implements IActivityLogger {
  private writeBuffer: ActivityEvent[] = [];
  private flushTimeout: ReturnType<typeof setTimeout> | null = null;
  private sessionTrackingService: ISessionTracker | null = null;
  private isFlushingBuffer = false; // Mutex to prevent concurrent flushes

  constructor(sessionTrackingService: ISessionTracker) {
    this.sessionTrackingService = sessionTrackingService;

    // Set up session end callback
    this.sessionTrackingService.onSessionEnd(async () => {
      const duration = this.sessionTrackingService?.getSessionDuration() ?? 0;
      await this.log("session_end", "session", { duration });
    });

    // Flush buffer on page unload
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => this.flushBuffer());
    }
  }

  /**
   * Check if logging is available (user authenticated and Firestore ready)
   */
  private isAvailable(): boolean {
    return auth.currentUser !== null;
  }

  /**
   * Get current user ID
   */
  private getUserId(): string | null {
    return auth.currentUser?.uid ?? null;
  }

  /**
   * Get client info for event context
   */
  private getClientInfo(): ActivityEvent["client"] {
    if (typeof window === "undefined") return undefined;

    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
    };
  }

  /**
   * Log event to Firebase Analytics (aggregate analytics, dashboards, demographics)
   * This provides: user demographics, device info, geography, funnel analysis,
   * retention reports, A/B testing, and Google Ads integration.
   *
   * Events logged here appear in Firebase Console:
   * https://console.firebase.google.com/project/the-kinetic-alphabet/analytics/events
   */
  private logToFirebaseAnalytics(
    eventType: ActivityEventType,
    category: ActivityCategory,
    metadata?: ActivityMetadata
  ): void {
    if (!analytics) return;

    try {
      // Firebase Analytics event names: snake_case, max 40 chars
      // Prefix with 'tka_' to distinguish custom events from automatic ones
      const eventName = `tka_${eventType}`;

      // Build params object - Firebase Analytics has limits:
      // - Max 25 parameters per event
      // - Parameter names: max 40 chars, alphanumeric + underscores
      // - Parameter values: max 100 chars for strings
      const params: Record<string, string | number | boolean> = {
        category,
      };

      // Add relevant metadata (only primitive types, truncate strings)
      if (metadata) {
        if (metadata["module"])
          params["module"] = String(metadata["module"]).slice(0, 100);
        if (metadata["sequenceId"])
          params["sequence_id"] = String(metadata["sequenceId"]).slice(0, 100);
        if (metadata["word"])
          params["word"] = String(metadata["word"]).slice(0, 100);
        if (metadata["sequenceLength"])
          params["sequence_length"] = Number(metadata["sequenceLength"]);
        if (metadata["generationType"])
          params["generation_type"] = String(metadata["generationType"]).slice(
            0,
            100
          );
        if (metadata["loopType"])
          params["cap_type"] = String(metadata["loopType"]).slice(0, 100);
        if (metadata["shareMethod"])
          params["share_method"] = String(metadata["shareMethod"]).slice(
            0,
            100
          );
        if (metadata["exportFormat"])
          params["export_format"] = String(metadata["exportFormat"]).slice(
            0,
            100
          );
        if (metadata["achievementId"])
          params["achievement_id"] = String(metadata["achievementId"]).slice(
            0,
            100
          );
        if (metadata["xpAmount"])
          params["xp_amount"] = Number(metadata["xpAmount"]);
        if (metadata["newLevel"])
          params["new_level"] = Number(metadata["newLevel"]);
        if (metadata["settingKey"])
          params["setting_key"] = String(metadata["settingKey"]).slice(0, 100);
        if (metadata["lessonId"])
          params["lesson_id"] = String(metadata["lessonId"]).slice(0, 100);
        if (metadata["quizId"])
          params["quiz_id"] = String(metadata["quizId"]).slice(0, 100);
        if (metadata["score"] !== undefined)
          params["score"] = Number(metadata["score"]);
        if (metadata["correct"] !== undefined)
          params["correct"] = Boolean(metadata["correct"]);
        if (metadata["durationMs"])
          params["duration_ms"] = Number(metadata["durationMs"]);
      }

      logEvent(analytics, eventName, params);
    } catch (error) {
      // Silently fail - Firebase Analytics is optional enhancement
      console.warn("Firebase Analytics event failed:", error);
    }
  }

  /**
   * Add event to write buffer and schedule flush
   */
  private bufferEvent(event: ActivityEvent): void {
    this.writeBuffer.push(event);

    // Flush immediately if buffer is full
    if (this.writeBuffer.length >= MAX_BUFFER_SIZE) {
      this.flushBuffer();
      return;
    }

    // Schedule flush if not already scheduled
    if (!this.flushTimeout) {
      this.flushTimeout = setTimeout(() => this.flushBuffer(), WRITE_BUFFER_MS);
    }
  }

  /**
   * Flush buffered events to Firestore
   */
  private async flushBuffer(): Promise<void> {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }

    if (this.writeBuffer.length === 0) return;

    // Prevent concurrent flush operations
    if (this.isFlushingBuffer) return;
    this.isFlushingBuffer = true;

    const eventsToWrite = [...this.writeBuffer];
    this.writeBuffer = [];

    try {
      const firestore = await getFirestoreInstance();

      // Write each event (could be optimized with batch writes)
      for (const event of eventsToWrite) {
        try {
          const activityRef = collection(
            firestore,
            `users/${event.userId}/activityLog`
          );

          // Build document data, excluding undefined fields (Firestore doesn't accept undefined)
          const docData: Record<string, unknown> = {
            userId: event.userId,
            category: event.category,
            eventType: event.eventType,
            timestamp: Timestamp.fromDate(event.timestamp),
          };

          // Add sessionId if present
          if (event.sessionId) {
            docData["sessionId"] = event.sessionId;
          }

          // Only add metadata if it's defined and has properties
          if (event.metadata !== undefined) {
            // Filter out undefined values from metadata
            const filteredMetadata = Object.fromEntries(
              Object.entries(event.metadata).filter(([, v]) => v !== undefined)
            );
            if (Object.keys(filteredMetadata).length > 0) {
              docData["metadata"] = filteredMetadata;
            }
          }

          // Only add client info if defined
          if (event.client !== undefined) {
            docData["client"] = event.client;
          }

          await addDoc(activityRef, docData);
        } catch (error) {
          // "Already exists" can happen with Firestore offline persistence
          // when a retry succeeds after the original write already completed
          const isAlreadyExists = error instanceof Error &&
            error.message.includes("already exists");

          if (isAlreadyExists) {
            // Event was already logged - this is fine, just skip
            console.debug("[ActivityLogger] Event already logged, skipping duplicate");
          } else {
            console.error("Failed to log activity event:", error);
          }
          // Don't re-buffer failed events to avoid infinite loops
        }
      }
    } finally {
      // Always release mutex, even if something throws
      this.isFlushingBuffer = false;
    }
  }

  /**
   * Log a single activity event
   *
   * Dual logging:
   * 1. Firestore: Per-user activity history (queryable, for your admin dashboard)
   * 2. Firebase Analytics: Aggregate metrics (demographics, funnels, retention)
   */
  async log(
    eventType: ActivityEventType,
    category: ActivityCategory,
    metadata?: ActivityMetadata
  ): Promise<void> {
    // Always log to Firebase Analytics (works even without auth)
    // This gives you demographics, device info, geography, etc.
    this.logToFirebaseAnalytics(eventType, category, metadata);

    // Log to Firestore only if user is authenticated
    // This maintains your per-user activity history
    if (!this.isAvailable()) return;

    const userId = this.getUserId();
    if (!userId) return;

    const event: ActivityEvent = {
      userId,
      sessionId: this.sessionTrackingService?.getSessionId(),
      category,
      eventType,
      timestamp: new Date(),
      metadata,
      client: this.getClientInfo(),
    };

    this.bufferEvent(event);
  }

  /**
   * Log a session start event
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
   * Note: Querying across all users requires collection group queries and indexes
   */
  async queryEvents(options: ActivityQueryOptions): Promise<ActivityEvent[]> {
    if (!this.isAvailable()) return [];

    try {
      // If querying a specific user, use subcollection
      if (options.userId) {
        return this.queryUserEvents(options);
      }

      // Otherwise use collection group query (requires index)
      return this.queryAllEvents(options);
    } catch (error) {
      console.error("Failed to query activity events:", error);
      return [];
    }
  }

  /**
   * Query events for a specific user
   */
  private async queryUserEvents(
    options: ActivityQueryOptions
  ): Promise<ActivityEvent[]> {
    const firestore = await getFirestoreInstance();
    const activityRef = collection(
      firestore,
      `users/${options.userId}/activityLog`
    );

    try {
      // Try simple query first - just get all events and filter in memory
      // This avoids needing composite indexes
      let q = query(
        activityRef,
        orderBy("timestamp", options.orderDirection ?? "desc")
      );

      if (options.limit) {
        q = query(q, firestoreLimit(options.limit * 2)); // Get extra to allow for filtering
      }

      const snapshot = await getDocs(q);
      let events = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data["userId"] as string,
          sessionId: data["sessionId"] as string | undefined,
          category: data["category"] as ActivityCategory,
          eventType: data["eventType"] as ActivityEventType,
          timestamp: (data["timestamp"] as Timestamp).toDate(),
          metadata: data["metadata"] as ActivityMetadata | undefined,
          client: data["client"] as ActivityEvent["client"],
        };
      });

      // Filter in memory to avoid complex Firestore queries
      if (options.startDate) {
        events = events.filter((e) => e.timestamp >= options.startDate!);
      }

      if (options.endDate) {
        events = events.filter((e) => e.timestamp <= options.endDate!);
      }

      if (options.category) {
        events = events.filter((e) => e.category === options.category);
      }

      if (options.eventType) {
        events = events.filter((e) => e.eventType === options.eventType);
      }

      if (options.limit) {
        events = events.slice(0, options.limit);
      }

      return events;
    } catch (error) {
      console.error("📊 [ActivityLog] Query failed:", error);
      return [];
    }
  }

  /**
   * Query events across all users using collection group
   * Falls back to current user's events if collection group query fails (requires index)
   */
  private async queryAllEvents(
    options: ActivityQueryOptions
  ): Promise<ActivityEvent[]> {
    // Firestore has a maximum limit of 10000 documents per query
    const FIRESTORE_MAX_LIMIT = 10000;

    try {
      const firestore = await getFirestoreInstance();
      // Collection group query for activityLog across all users
      const activityGroupRef = collectionGroup(firestore, "activityLog");

      let q = query(
        activityGroupRef,
        orderBy("timestamp", options.orderDirection ?? "desc")
      );

      if (options.startDate) {
        q = query(
          q,
          where("timestamp", ">=", Timestamp.fromDate(options.startDate))
        );
      }

      if (options.endDate) {
        q = query(
          q,
          where("timestamp", "<=", Timestamp.fromDate(options.endDate))
        );
      }

      // Apply limit, capping at Firestore's maximum
      const safeLimit = options.limit
        ? Math.min(options.limit, FIRESTORE_MAX_LIMIT)
        : FIRESTORE_MAX_LIMIT;
      q = query(q, firestoreLimit(safeLimit));

      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data["userId"] as string,
          sessionId: data["sessionId"] as string | undefined,
          category: data["category"] as ActivityCategory,
          eventType: data["eventType"] as ActivityEventType,
          timestamp: (data["timestamp"] as Timestamp).toDate(),
          metadata: data["metadata"] as ActivityMetadata | undefined,
          client: data["client"] as ActivityEvent["client"],
        };
      });
    } catch (error) {
      // Collection group query failed - likely missing index
      // Fall back to querying current user's events only
      console.warn(
        "📊 [ActivityLog] Collection group query failed (missing index?). Falling back to current user events.",
        error
      );

      const userId = this.getUserId();
      if (userId) {
        return this.queryUserEvents({ ...options, userId });
      }
      return [];
    }
  }

  /**
   * Get activity summary for a date range
   */
  async getActivitySummary(
    startDate: Date,
    endDate: Date
  ): Promise<ActivitySummary[]> {
    const events = await this.queryEvents({
      startDate,
      endDate,
      orderDirection: "asc",
    });

    // Group events by date
    const summaryByDate = new Map<string, ActivitySummary>();

    for (const event of events) {
      const dateKey = event.timestamp.toISOString().split("T")[0] ?? "";

      if (!summaryByDate.has(dateKey)) {
        summaryByDate.set(dateKey, {
          date: dateKey,
          activeUsers: 0,
          totalEvents: 0,
          byCategory: {} as Record<ActivityCategory, number>,
          byEventType: {},
        });
      }

      const summary = summaryByDate.get(dateKey)!;
      summary.totalEvents++;
      summary.byCategory[event.category] =
        (summary.byCategory[event.category] ?? 0) + 1;
      summary.byEventType[event.eventType] =
        (summary.byEventType[event.eventType] ?? 0) + 1;
    }

    // Calculate unique users per day
    const usersByDate = new Map<string, Set<string>>();
    for (const event of events) {
      const dateKey = event.timestamp.toISOString().split("T")[0] ?? "";
      if (!usersByDate.has(dateKey)) {
        usersByDate.set(dateKey, new Set());
      }
      usersByDate.get(dateKey)!.add(event.userId);
    }

    for (const [dateKey, users] of usersByDate) {
      const summary = summaryByDate.get(dateKey);
      if (summary) {
        summary.activeUsers = users.size;
      }
    }

    return Array.from(summaryByDate.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  }

  /**
   * Get daily active user counts for a date range
   */
  async getDailyActiveUsers(
    startDate: Date,
    days: number
  ): Promise<Map<string, number>> {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + days);

    const events = await this.queryEvents({
      startDate,
      endDate,
      orderDirection: "asc",
    });

    // Initialize all days with 0
    const dailyUsers = new Map<string, Set<string>>();
    for (let i = 0; i < days; i++) {
      const dayDate = new Date(startDate);
      dayDate.setDate(dayDate.getDate() + i);
      const dateKey = dayDate.toISOString().split("T")[0] ?? "";
      dailyUsers.set(dateKey, new Set());
    }

    // Count unique users per day
    for (const event of events) {
      const dateKey = event.timestamp.toISOString().split("T")[0] ?? "";
      if (dailyUsers.has(dateKey)) {
        dailyUsers.get(dateKey)!.add(event.userId);
      }
    }

    // Convert to counts
    const result = new Map<string, number>();
    for (const [dateKey, users] of dailyUsers) {
      result.set(dateKey, users.size);
    }

    return result;
  }

  /**
   * Get event counts by type for a date range
   */
  async getEventCounts(
    startDate: Date,
    endDate: Date
  ): Promise<Map<ActivityEventType, number>> {
    const events = await this.queryEvents({
      startDate,
      endDate,
    });

    const counts = new Map<ActivityEventType, number>();
    for (const event of events) {
      counts.set(event.eventType, (counts.get(event.eventType) ?? 0) + 1);
    }

    return counts;
  }
}
