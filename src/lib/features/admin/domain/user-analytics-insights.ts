import type {
  ContentMetrics,
  ModuleActivityBreakdown,
  UserActivitySessionSummary,
  UserEngagementSummary,
} from "../services/types";

export type AnalyticsSignalTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger";

export interface AnalyticsSignal {
  id: "exceptions" | "session-shape" | "behavior";
  tone: AnalyticsSignalTone;
  icon: string;
  title: string;
  detail: string;
}

interface AnalyticsSnapshot {
  engagement: UserEngagementSummary | null;
  activity: ModuleActivityBreakdown[];
  content: ContentMetrics | null;
  sessions: UserActivitySessionSummary[];
}

export function buildUserAnalyticsSignals({
  engagement,
  activity,
  content,
  sessions,
}: AnalyticsSnapshot): AnalyticsSignal[] {
  const postHogSessions = sessions.filter(
    (session) => session.source === "posthog"
  );
  const composerSessions = sessions.filter(
    (session) => session.source === "composer"
  );
  const exceptionCount = postHogSessions.reduce(
    (sum, session) => sum + session.exceptionCount,
    0
  );
  const affectedSessions = postHogSessions.filter(
    (session) => session.exceptionCount > 0
  ).length;
  const singleEventSessions = postHogSessions.filter(
    (session) => session.eventCount <= 1
  ).length;
  const dominantModule = [...activity].sort(
    (left, right) => right.eventCount - left.eventCount
  )[0];

  const exceptionSignal: AnalyticsSignal =
    exceptionCount > 0
      ? {
          id: "exceptions",
          tone: "danger",
          icon: "fa-bug",
          title: `${exceptionCount} ${plural(exceptionCount, "exception")}`,
          detail: `${affectedSessions} of ${sessions.length} loaded ${plural(sessions.length, "session")}`,
        }
      : postHogSessions.length > 0
        ? {
            id: "exceptions",
            tone: "success",
            icon: "fa-circle-check",
            title: "No exceptions detected",
            detail: `Checked ${postHogSessions.length} recent ${plural(postHogSessions.length, "session")}`,
          }
        : composerSessions.length > 0
          ? {
              id: "exceptions",
              tone: "info",
              icon: "fa-database",
              title: "Composer records recovered",
              detail: "PostHog exceptions were not captured for these sessions",
            }
          : {
              id: "exceptions",
              tone: "neutral",
              icon: "fa-shield",
              title: "No sessions to inspect",
              detail: "Try a wider activity window",
            };

  const sessionSignal: AnalyticsSignal =
    singleEventSessions > 0
      ? {
          id: "session-shape",
          tone: "warning",
          icon: "fa-triangle-exclamation",
          title: `${singleEventSessions} single-event ${plural(singleEventSessions, "session")}`,
          detail: "Possible quick exits or incomplete tracking",
        }
      : engagement && engagement.sessionsCount > 0
        ? {
            id: "session-shape",
            tone: "info",
            icon: "fa-clock",
            title: `${engagement.sessionsCount} ${plural(engagement.sessionsCount, "session")} in this window`,
            detail: `${formatDuration(engagement.totalTimeSpent)} total · ${formatDuration(engagement.avgSessionDuration)} average`,
          }
        : {
            id: "session-shape",
            tone: "neutral",
            icon: "fa-clock",
            title: "No measured session time",
            detail: "No duration data in this window",
          };

  const contentActionCount = content
    ? content.sequencesCreated +
      content.sequencesSaved +
      content.sequencesExported +
      content.collectionsCreated +
      content.sequencesShared
    : 0;
  const behaviorSignal: AnalyticsSignal = dominantModule
    ? {
        id: "behavior",
        tone: "info",
        icon: "fa-route",
        title: `${titleCase(dominantModule.module)} leads activity`,
        detail: `${dominantModule.percentage}% of page views · ${dominantModule.eventCount} ${plural(dominantModule.eventCount, "view")}`,
      }
    : content && contentActionCount > 0
      ? {
          id: "behavior",
          tone: "info",
          icon: "fa-layer-group",
          title: `${contentActionCount} content ${plural(contentActionCount, "action")}`,
          detail: `${content.sequencesSaved} saves · ${content.sequencesCreated} creates`,
        }
      : {
          id: "behavior",
          tone: "neutral",
          icon: "fa-route",
          title: "No module pattern yet",
          detail: "No page views in this window",
        };

  return [exceptionSignal, sessionSignal, behaviorSignal];
}

function plural(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}

function titleCase(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDuration(milliseconds: number): string {
  const minutes = Math.round(milliseconds / 60000);
  if (minutes < 1) return "under 1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}
