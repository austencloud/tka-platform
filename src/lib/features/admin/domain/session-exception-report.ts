import type {
  PostHogSessionEvent,
  PostHogSessionSummary,
} from "../services/types";

export interface SessionExceptionReportUser {
  id: string;
  displayName?: string | null;
  username?: string | null;
  email?: string | null;
}

export interface SessionExceptionGroup {
  type: string;
  message: string;
  count: number;
  routes: string[];
  firstSeenAt: Date;
  lastSeenAt: Date;
}

interface SessionExceptionReportInput {
  user: SessionExceptionReportUser;
  session: PostHogSessionSummary;
  events: PostHogSessionEvent[];
}

const UNKNOWN_TYPE = "Unknown exception type";
const UNKNOWN_MESSAGE = "No exception message captured";

export function groupSessionExceptions(
  events: PostHogSessionEvent[]
): SessionExceptionGroup[] {
  const exceptionEvents = events
    .filter(
      (
        event
      ): event is PostHogSessionEvent & {
        exception: NonNullable<PostHogSessionEvent["exception"]>;
      } => event.exception !== null
    )
    .sort(
      (left, right) => left.timestamp.getTime() - right.timestamp.getTime()
    );
  const groups = new Map<
    string,
    SessionExceptionGroup & { routeSet: Set<string> }
  >();

  for (const event of exceptionEvents) {
    const type = cleanText(event.exception.type) || UNKNOWN_TYPE;
    const message = cleanText(event.exception.message) || UNKNOWN_MESSAGE;
    const key = JSON.stringify([type, message]);
    const existing = groups.get(key);

    if (existing) {
      existing.count += 1;
      existing.lastSeenAt = event.timestamp;
      if (event.path && !existing.routeSet.has(event.path)) {
        existing.routeSet.add(event.path);
        existing.routes.push(event.path);
      }
      continue;
    }

    const routes = event.path ? [event.path] : [];
    groups.set(key, {
      type,
      message,
      count: 1,
      routes,
      routeSet: new Set(routes),
      firstSeenAt: event.timestamp,
      lastSeenAt: event.timestamp,
    });
  }

  return [...groups.values()]
    .sort(
      (left, right) =>
        right.count - left.count ||
        left.firstSeenAt.getTime() - right.firstSeenAt.getTime()
    )
    .map(({ routeSet: _routeSet, ...group }) => group);
}

export function buildSessionExceptionReport({
  user,
  session,
  events,
}: SessionExceptionReportInput): string {
  const groups = groupSessionExceptions(events);
  const loadedExceptionCount = groups.reduce(
    (total, group) => total + group.count,
    0
  );
  const lines = [
    "# TKA session exception report",
    "",
    "Investigate and fix the exception patterns captured in this TKA user session. This report contains the available PostHog evidence, so PostHog access is not required. Verify each root cause in the codebase and treat repeated occurrences as one failure pattern until the evidence separates them.",
    "",
    "## User",
    `- Name: ${cleanText(user.displayName) || "Unknown user"}`,
    `- Username: ${formatUsername(user.username)}`,
    `- User ID: ${user.id}`,
    `- Email: ${cleanText(user.email) || "Not available"}`,
    "",
    "## Session",
    `- Session ID: ${session.sessionId}`,
    `- Started: ${session.startedAt.toISOString()}`,
    `- Ended: ${session.endedAt?.toISOString() ?? "Ongoing or not captured"}`,
    `- Duration: ${formatDuration(session.duration)}`,
    `- Route: ${formatRoute(session)}`,
    `- Modules: ${session.modules.length > 0 ? session.modules.join(", ") : "Not captured"}`,
    `- Client: ${formatClient(session)}`,
    `- Loaded events: ${events.length} of ${session.eventCount} reported`,
    `- Loaded exception events: ${loadedExceptionCount} of ${session.exceptionCount} reported`,
    `- Coverage: ${formatCoverage(loadedExceptionCount, session.exceptionCount)}`,
  ];

  if (session.postHogUrl) {
    lines.push(`- PostHog reference: ${session.postHogUrl}`);
  }

  lines.push("", `## Exception patterns (${groups.length})`);

  if (groups.length === 0) {
    lines.push(
      "",
      "No exception events were present in the loaded event trail."
    );
    return lines.join("\n");
  }

  for (const [index, group] of groups.entries()) {
    lines.push(
      "",
      `### ${index + 1}. ${group.type}`,
      `- Message: ${JSON.stringify(group.message)}`,
      `- Occurrences: ${group.count}`,
      `- Routes: ${group.routes.length > 0 ? group.routes.join(", ") : "Not captured"}`
    );

    if (group.count === 1) {
      lines.push(
        `- Seen: ${formatOccurrence(group.firstSeenAt, session.startedAt)}`
      );
    } else {
      lines.push(
        `- First seen: ${formatOccurrence(group.firstSeenAt, session.startedAt)}`,
        `- Last seen: ${formatOccurrence(group.lastSeenAt, session.startedAt)}`
      );
    }
  }

  return lines.join("\n");
}

function cleanText(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function formatUsername(username: string | null | undefined): string {
  const cleanUsername = cleanText(username).replace(/^@+/, "");
  return cleanUsername ? `@${cleanUsername}` : "Not available";
}

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];

  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(" ");
}

function formatRoute(session: PostHogSessionSummary): string {
  const entry = session.entryPath;
  const exit = session.exitPath;
  if (entry && exit) return entry === exit ? entry : `${entry} -> ${exit}`;
  return entry ?? exit ?? "Not captured";
}

function formatClient(session: PostHogSessionSummary): string {
  return (
    [session.deviceType, session.browser, session.operatingSystem]
      .filter(Boolean)
      .join(" | ") || "Not captured"
  );
}

function formatCoverage(loaded: number, reported: number): string {
  if (loaded === reported) {
    return "Every exception reported by the session summary is present in the loaded trail.";
  }
  if (loaded < reported) {
    const missing = reported - loaded;
    return `Partial. ${missing} reported exception ${missing === 1 ? "event is" : "events are"} not present in the loaded trail.`;
  }
  return `Inconsistent. The loaded trail contains ${loaded - reported} more exception ${loaded - reported === 1 ? "event" : "events"} than the session summary.`;
}

function formatOccurrence(timestamp: Date, sessionStartedAt: Date): string {
  const offset = Math.max(0, timestamp.getTime() - sessionStartedAt.getTime());
  return `${timestamp.toISOString()} (+${formatDuration(offset)})`;
}
