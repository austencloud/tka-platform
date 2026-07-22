import { createRequire } from "node:module";
import type { FunnelDailyRow } from "./core";

const require = createRequire(import.meta.url);
const { runQuery } = require("../posthog-query.cjs") as {
  runQuery: (
    hogql: string,
    options?: {
      apiKey?: string;
      projectId?: string;
      apiHost?: string;
    }
  ) => Promise<{ columns?: string[]; results?: unknown[][] }>;
};

interface PostHogQueryOptions {
  host: string;
  reportingTimeZone: string;
  startDate: string;
  endDate: string;
  treatmentPaths: readonly string[];
  apiKey?: string;
  projectId?: string;
}

function quote(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function datePredicate(
  column: string,
  options: PostHogQueryOptions,
  exclusiveEndOffset = 1
): string {
  const start = quote(options.startDate);
  const endExclusive = quote(
    addCalendarDays(options.endDate, exclusiveEndOffset)
  );
  const timeZone = quote(options.reportingTimeZone);
  return `toDate(toTimeZone(${column}, ${timeZone})) >= toDate(${start})
    AND toDate(toTimeZone(${column}, ${timeZone})) < toDate(${endExclusive})`;
}

function addCalendarDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function safeHogQlInteger(expression: string): string {
  return `toIntOrZero(toString(${expression}))`;
}

export function buildSeoFunnelQuery(options: PostHogQueryOptions): string {
  const host = quote(options.host);
  const timeZone = quote(options.reportingTimeZone);
  return `
WITH organic_sessions AS (
  SELECT
    session_id AS sid,
    "$start_timestamp" AS started_at
  FROM sessions
  WHERE ${datePredicate('"$start_timestamp"', options)}
    AND "$entry_hostname" = ${host}
    AND "$entry_pathname" = '/composer'
    AND "$channel_type" = 'Organic Search'
    AND (
      positionCaseInsensitive("$entry_referring_domain", 'google') > 0
      OR lower(coalesce("$entry_utm_source", '')) = 'google'
    )
),
relevant_events AS (
  SELECT timestamp, event, properties
  FROM events
  WHERE ${datePredicate("timestamp", options, 2)}
    AND properties."$host" = ${host}
    AND event IN (
      'landing_cta_click',
      'sequence_generate',
      'sequence_autosaved',
      'sequence_save',
      'sequence_export',
      'sequence_share',
      'link_copy'
    )
),
per_session AS (
  SELECT
    organic_sessions.sid,
    organic_sessions.started_at,
    windowFunnel(86400)(
      toUnixTimestamp(relevant_events.timestamp),
      relevant_events.event = 'landing_cta_click'
        AND relevant_events.properties.page = 'composer'
        AND relevant_events.properties.destination = '/create',
      (
        relevant_events.event = 'sequence_generate'
        AND ${safeHogQlInteger(
          "relevant_events.properties.sequence_length"
        )} >= 1
      ) OR (
        relevant_events.event = 'sequence_autosaved'
        AND ${safeHogQlInteger("relevant_events.properties.beat_count")} >= 1
      ),
      relevant_events.event IN (
        'sequence_save',
        'sequence_export',
        'sequence_share',
        'link_copy'
      )
    ) AS reached_step
  FROM organic_sessions
  LEFT JOIN relevant_events
    ON organic_sessions.sid = relevant_events.properties."$session_id"
  GROUP BY organic_sessions.sid, organic_sessions.started_at
)
SELECT
  toString(toDate(toTimeZone(started_at, ${timeZone}))) AS data_date,
  count() AS organic_composer_sessions,
  countIf(reached_step >= 1) AS composer_opened_sessions,
  countIf(reached_step >= 2) AS activated_sessions,
  countIf(reached_step >= 3) AS completed_sessions
FROM per_session
GROUP BY data_date
ORDER BY data_date`;
}

export function buildWebVitalsQuery(options: PostHogQueryOptions): string {
  const host = quote(options.host);
  const timeZone = quote(options.reportingTimeZone);
  const paths = [...new Set(options.treatmentPaths)].map(quote).join(", ");
  if (!paths) throw new Error("At least one treatment path is required");

  return `
SELECT
  toString(toDate(toTimeZone(timestamp, ${timeZone}))) AS data_date,
  round(quantile(0.75)(toFloat(properties."$web_vitals_LCP_value")), 0) AS lcp_p75,
  round(quantile(0.75)(toFloat(properties."$web_vitals_INP_value")), 0) AS inp_p75,
  round(quantile(0.75)(toFloat(properties."$web_vitals_CLS_value")), 3) AS cls_p75
FROM events
WHERE event = '$web_vitals'
  AND ${datePredicate("timestamp", options)}
  AND properties."$host" = ${host}
  AND properties."$pathname" IN (${paths})
GROUP BY data_date
ORDER BY data_date`;
}

function asNumber(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function fetchPostHogSeoDaily(
  options: PostHogQueryOptions
): Promise<FunnelDailyRow[]> {
  const queryOptions = {
    apiKey: options.apiKey,
    projectId: options.projectId,
  };
  const [funnel, vitals] = await Promise.all([
    runQuery(buildSeoFunnelQuery(options), queryOptions),
    runQuery(buildWebVitalsQuery(options), queryOptions),
  ]);
  const byDate = new Map<string, FunnelDailyRow>();

  for (const row of funnel.results ?? []) {
    const date = String(row[0]);
    byDate.set(date, {
      date,
      organicComposerSessions: asNumber(row[1]),
      composerOpenedSessions: asNumber(row[2]),
      activatedSessions: asNumber(row[3]),
      completedSessions: asNumber(row[4]),
      lcpP75: null,
      inpP75: null,
      clsP75: null,
    });
  }

  for (const row of vitals.results ?? []) {
    const date = String(row[0]);
    const current = byDate.get(date) ?? {
      date,
      organicComposerSessions: 0,
      composerOpenedSessions: 0,
      activatedSessions: 0,
      completedSessions: 0,
      lcpP75: null,
      inpP75: null,
      clsP75: null,
    };
    current.lcpP75 = asNullableNumber(row[1]);
    current.inpP75 = asNullableNumber(row[2]);
    current.clsP75 = asNullableNumber(row[3]);
    byDate.set(date, current);
  }

  return [...byDate.values()].sort((left, right) =>
    left.date.localeCompare(right.date)
  );
}
