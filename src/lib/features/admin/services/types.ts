/**
 * Co-exported types from retired interface contracts.
 */

// === From IAuditLogger ===

export type AuditActionType =
  | "role_changed"
  | "account_disabled"
  | "account_enabled"
  | "user_data_reset"
  | "user_deleted"
  | "challenge_created"
  | "challenge_updated"
  | "challenge_deleted"
  | "announcement_created"
  | "announcement_updated"
  | "announcement_deleted"
  | "flag_updated"
  | "other";
export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  action: AuditActionType;
  performedBy: string; // admin user ID
  affectedUserId?: string; // user being affected (if applicable)
  summary: string; // human-readable description
  details?: Record<string, unknown>; // additional metadata
}

// === From ISystemStateManager ===

export interface CachedUserMetadata {
  id: string;
  displayName: string;
  email: string | null;
  photoURL: string | null;
  sequenceCount: number;
  publicSequenceCount: number;
  totalViews: number;
  shareCount: number;
  challengesCompleted: number;
  achievementCount: number;
  currentStreak: number;
  totalXP: number;
  lastActivityDate: Date | null;
  createdAt: Date | null;
  disabled: boolean;
  role: string;
  /** Guest session flag. True for un-upgraded anonymous auth users. */
  isAnonymous: boolean;
  /** Attribution record captured at signup + any self-reported updates. Null for older accounts. */
  attribution: Record<string, unknown> | null;
  /** Persistent last-known IP location (admin view). */
  lastLocation?: import("$lib/shared/presence/domain/models/presence-models").PresenceLocation | null;
}
export interface CachedChallenge {
  id: string;
  name: string;
  description: string | null;
  difficulty: string;
  xpReward: number;
  sequenceId: string | null;
  scheduledDate: Date | null;
  createdAt: Date | null;
  type: "daily" | "train";
}
export interface CachedAnnouncement {
  id: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  audiences: string[];
  displayMode: "modal" | "banner";
  createdAt: Date | null;
  expiresAt: Date | null;
  actionLabel?: string;
  actionUrl?: string;
}
export interface SystemState {
  users: CachedUserMetadata[];
  challenges: CachedChallenge[];
  announcements: CachedAnnouncement[];
  loadedAt: number;
  expiresAt: number;
}

// === From IAnalyticsDataProvider ===

export interface SummaryMetrics {
  totalUsers: number;
  activeToday: number;
  sequencesCreated: number;
  challengesCompleted: number;
  previousTotalUsers: number;
  previousActiveToday: number;
  previousSequencesCreated: number;
  previousChallengesCompleted: number;
}
export interface UserActivityPoint {
  date: string;
  activeUsers: number;
}
export interface ContentStatistics {
  totalSequences: number;
  publicSequences: number;
  totalViews: number;
  totalShares: number;
}
export interface TopSequenceData {
  id: string;
  name: string;
  word: string;
  views: number;
  creator: string;
}
export interface EngagementMetrics {
  challengeParticipants: number;
  achievementsUnlocked: number;
  activeStreaks: number;
  totalXPEarned: number;
  totalUsers: number;
  totalAchievementsPossible: number;
}
export interface AnalyticsTimeRange {
  days: number;
  startDate: Date;
  endDate: Date;
}
export interface EventTypeBreakdown {
  eventType: string;
  count: number;
  label: string;
  color: string;
}
export interface ModuleUsageData {
  module: string;
  views: number;
  label: string;
  color: string;
}
export interface RecentActivityEvent {
  id: string;
  eventType: string;
  category: string;
  timestamp: Date;
  userId: string;
  metadata?: Record<string, unknown>;
  user?: {
    displayName: string;
    photoURL: string | null;
    email: string | null;
  };
}

// === From IPostHogAnalyticsProvider ===

export interface PostHogSummaryMetrics {
  totalUsers: number;
  activeUsers7d: number;
  totalSessions7d: number;
  avgSessionDurationSeconds: number;
}

export interface UserSegments {
  creators: number; // Created 5+ sequences
  consumers: number; // Viewed 10+ but created 0
  learners: number; // Completed 3+ lessons
  lurkers: number; // <5 sessions and no content
}

export interface PostHogDashboardLinks {
  retention: string;
  insights: string;
  persons: string;
  replay: string;
  events: string;
}

// === From IPostHogUserAnalytics ===

export interface UserEngagementSummary {
  /** ISO timestamp of last activity */
  lastActiveAt: string | null;
  /** ISO timestamp of account creation (from PostHog person properties) */
  memberSince: string | null;
  /** Number of sessions in the specified period */
  sessionsCount: number;
  /** Average session duration in milliseconds */
  avgSessionDuration: number;
  /** Total time spent in app in the period (ms) */
  totalTimeSpent: number;
}

export interface ModuleActivityBreakdown {
  /** Module name (browse, create, learn, etc.) */
  module: string;
  /** Percentage of time/activity in this module (0-100) */
  percentage: number;
  /** Number of events in this module */
  eventCount: number;
}

export interface ContentMetrics {
  /** Sequences created */
  sequencesCreated: number;
  /** Sequences saved to library */
  sequencesSaved: number;
  /** Sequences exported (PNG, etc.) */
  sequencesExported: number;
  /** Collections created */
  collectionsCreated: number;
  /** Sequences shared (public) */
  sequencesShared: number;
}

export interface PostHogSessionSummary {
  /** PostHog session ID */
  sessionId: string;
  /** Session start time */
  startedAt: Date;
  /** Session end time (null if ongoing) */
  endedAt: Date | null;
  /** Session duration in milliseconds */
  duration: number;
  /** Modules visited during session */
  modules: string[];
  /** URL for PostHog session replay */
  replayUrl: string | null;
  /** Whether session recording is available */
  hasRecording: boolean;
}

export type TimePeriod = "today" | "week" | "month" | "all";

// === From IUserActivityTracker ===

export interface UserWithActivity {
  userId: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  online: boolean;
  lastSeen: number;
  currentModule?: string;
  currentTab?: string | null;
  sessionId?: string;
  recentEventCount?: number;
}

export interface SessionSummary {
  sessionId: string;
  startedAt: Date;
  endedAt?: Date;
  duration: number;
  eventCount: number;
  modules: string[];
}

export interface UserActivityQueryOptions {
  userId: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  sessionId?: string;
}
