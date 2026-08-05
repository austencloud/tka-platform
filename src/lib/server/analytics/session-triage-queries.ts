/**
 * Cross-user session queries for triage.
 *
 * The two session builders in the admin analytics route are hardcoded to a
 * single userId. Triage needs the opposite: recent sessions across ALL real
 * users, ranked by friction. These builders return query strings only — no
 * I/O, no credentials — so both the API route and the CLI can use them.
 */
import { escapeHogQL, pulseProdFilter } from "./hogql-shared";

/** Events that mean the user actually produced something. */
export const CONTENT_ACTION_EVENTS = [
  "sequence_create",
  "sequence_save",
  "sequence_autosaved",
  "sequence_export",
  "sequence_share",
  "collection_create",
] as const;

/** One row of the triage sessions query. */
export interface TriageSessionRow {
  sessionId: string;
  uid: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  eventCount: number;
  exceptionCount: number;
  rageClickCount: number;
  deadClickCount: number;
  pageviewCount: number;
  contentActionCount: number;
  /** First URL segment of each pageview, e.g. "app", "q", "sequence". */
  topSegments: string[];
  /** Second URL segment, meaningful when the first is "app". */
  subSegments: string[];
  entryPath: string;
  exitPath: string;
  browser: string;
  operatingSystem: string;
  deviceType: string;
}

/** One row of the session events query. */
export interface TriageEventRow {
  eventId: string;
  occurredAt: string;
  event: string;
  route: string;
  detail: string;
  exceptionType: string | null;
  exceptionMessage: string | null;
}

const MAX_SESSIONS = 200;
const MAX_EVENTS = 500;

/** Recent sessions across all real users, newest first. */
export function buildTriageSessionsQuery(sinceIso: string, limit: number): string {
  const since = escapeHogQL(sinceIso);
  const contentEvents = CONTENT_ACTION_EVENTS.map((e) => `'${e}'`).join(", ");
  const n = Math.min(Math.max(limit, 1), MAX_SESSIONS);

  return `
    SELECT
      "$session_id" as session_id,
      argMax(distinct_id, timestamp) as uid,
      toString(min(timestamp)) as started_at,
      toString(max(timestamp)) as ended_at,
      dateDiff('millisecond', min(timestamp), max(timestamp)) as duration,
      count() as event_count,
      countIf(event = '$exception') as exception_count,
      countIf(event = '$rageclick') as rage_click_count,
      countIf(event = '$dead_click') as dead_click_count,
      countIf(event = '$pageview') as pageview_count,
      countIf(event IN (${contentEvents})) as content_action_count,
      arrayDistinct(arrayFilter(x -> x != '', groupArray(
        if(event = '$pageview',
           splitByChar('/', ifNull(path(properties."$current_url"), ''))[2], '')
      ))) as top_segments,
      arrayDistinct(arrayFilter(x -> x != '', groupArray(
        if(event = '$pageview',
           splitByChar('/', ifNull(path(properties."$current_url"), ''))[3], '')
      ))) as sub_segments,
      argMinIf(path(properties."$current_url"), timestamp,
        event = '$pageview' AND properties."$current_url" IS NOT NULL) as entry_path,
      argMaxIf(path(properties."$current_url"), timestamp,
        event = '$pageview' AND properties."$current_url" IS NOT NULL) as exit_path,
      argMax(properties."$browser", timestamp) as browser,
      argMax(properties."$os", timestamp) as operating_system,
      argMax(properties."$device_type", timestamp) as device_type
    FROM events
    WHERE timestamp > toDateTime('${since}')
      AND "$session_id" != ''
      AND ${pulseProdFilter()}
    GROUP BY session_id
    ORDER BY started_at DESC
    LIMIT ${n}
  `;
}

/** Ordered event stream for one session, any user. */
export function buildTriageSessionEventsQuery(sessionId: string, limit: number): string {
  const safe = escapeHogQL(sessionId);
  const n = Math.min(Math.max(limit, 1), MAX_EVENTS);
  return `
    SELECT
      toString(uuid) as event_id,
      toString(timestamp) as occurred_at,
      event,
      if(properties."$current_url" IS NULL, '', path(properties."$current_url")) as route,
      coalesce(properties."$el_text", properties."$event_type", '') as detail,
      properties."$exception_type" as exception_type,
      properties."$exception_message" as exception_message
    FROM events
    WHERE "$session_id" = '${safe}'
    ORDER BY timestamp ASC
    LIMIT ${n}
  `;
}

/**
 * First-ever event timestamp per uid. Used to decide whether a session belongs
 * to a brand-new user, which weights the friction score up.
 */
export function buildFirstSeenQuery(uids: readonly string[]): string {
  if (uids.length === 0) {
    return `SELECT distinct_id as uid, toString(min(timestamp)) as first_seen
            FROM events GROUP BY uid LIMIT 0`;
  }
  const list = uids.map((u) => `'${escapeHogQL(u)}'`).join(", ");
  return `
    SELECT distinct_id as uid, toString(min(timestamp)) as first_seen
    FROM events
    WHERE distinct_id IN (${list})
    GROUP BY uid
  `;
}

/** Maps a raw HogQL row array to a typed row. Column order must match the SELECT. */
export function parseTriageSessionRow(row: unknown[]): TriageSessionRow {
  return {
    sessionId: String(row[0] ?? ""),
    uid: String(row[1] ?? ""),
    startedAt: String(row[2] ?? ""),
    endedAt: String(row[3] ?? ""),
    durationMs: Number(row[4] ?? 0),
    eventCount: Number(row[5] ?? 0),
    exceptionCount: Number(row[6] ?? 0),
    rageClickCount: Number(row[7] ?? 0),
    deadClickCount: Number(row[8] ?? 0),
    pageviewCount: Number(row[9] ?? 0),
    contentActionCount: Number(row[10] ?? 0),
    topSegments: Array.isArray(row[11]) ? (row[11] as string[]) : [],
    subSegments: Array.isArray(row[12]) ? (row[12] as string[]) : [],
    entryPath: String(row[13] ?? ""),
    exitPath: String(row[14] ?? ""),
    browser: String(row[15] ?? ""),
    operatingSystem: String(row[16] ?? ""),
    deviceType: String(row[17] ?? ""),
  };
}

/** Maps a raw HogQL row array to a typed event row. */
export function parseTriageEventRow(row: unknown[]): TriageEventRow {
  return {
    eventId: String(row[0] ?? ""),
    occurredAt: String(row[1] ?? ""),
    event: String(row[2] ?? ""),
    route: String(row[3] ?? ""),
    detail: String(row[4] ?? ""),
    exceptionType: row[5] == null ? null : String(row[5]),
    exceptionMessage: row[6] == null ? null : String(row[6]),
  };
}
