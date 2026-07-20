#!/usr/bin/env node
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { loadSeoMeasurementConfig } from "./config";

const DASHBOARD_NAME = "SEO | Flow Arts Software";
const MANAGED_TAG = "seo-measurement-managed";

interface PostHogInsightSpec {
  name: string;
  description: string;
  display: "ActionsLineGraph" | "ActionsTable";
  query: string;
}

interface PostHogRecord {
  id: number;
  name?: string | null;
  description?: string | null;
  query?: unknown;
  dashboards?: number[];
  dashboard_tiles?: Array<{ dashboard_id: number }>;
  tags?: unknown[];
}

interface PaginatedResponse<T> {
  next?: string | null;
  results?: T[];
}

function quote(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function organicSessionsCte(host: string, timeZone: string): string {
  return `organic_sessions AS (
  SELECT
    session_id AS sid,
    "$start_timestamp" AS started_at
  FROM sessions
  WHERE "$start_timestamp" >= now() - INTERVAL 90 DAY
    AND "$entry_hostname" = ${quote(host)}
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
  WHERE timestamp >= now() - INTERVAL 91 DAY
    AND properties."$host" = ${quote(host)}
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
        AND relevant_events.properties.sequence_length >= 1
      ) OR (
        relevant_events.event = 'sequence_autosaved'
        AND relevant_events.properties.beat_count >= 1
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
)`;
}

export function getPostHogDashboardSpec(options: {
  host: string;
  timeZone: string;
}): PostHogInsightSpec[] {
  const cte = organicSessionsCte(options.host, options.timeZone);
  const timeZone = quote(options.timeZone);
  const host = quote(options.host);

  return [
    {
      name: "SEO | Organic Composer funnel by day",
      description:
        "Google organic sessions landing on Composer, then launch, activation, and completion within one session.",
      display: "ActionsLineGraph",
      query: `WITH ${cte}
SELECT
  toDate(toTimeZone(started_at, ${timeZone})) AS day,
  count() AS organic_sessions,
  countIf(reached_step >= 1) AS launched,
  countIf(reached_step >= 2) AS activated,
  countIf(reached_step >= 3) AS completed
FROM per_session
GROUP BY day
ORDER BY day`,
    },
    {
      name: "SEO | Organic Composer conversion",
      description:
        "Ninety-day Google organic Composer funnel totals and session conversion rates.",
      display: "ActionsTable",
      query: `WITH ${cte}
SELECT
  count() AS organic_sessions,
  countIf(reached_step >= 1) AS launched,
  countIf(reached_step >= 2) AS activated,
  countIf(reached_step >= 3) AS completed,
  round(100 * countIf(reached_step >= 1) / nullIf(count(), 0), 1) AS launch_rate,
  round(100 * countIf(reached_step >= 2) / nullIf(count(), 0), 1) AS activation_rate,
  round(100 * countIf(reached_step >= 3) / nullIf(count(), 0), 1) AS completion_rate
FROM per_session`,
    },
    {
      name: "SEO | Composer LCP and INP p75",
      description:
        "Daily native PostHog field measurements for Composer loading and interaction latency.",
      display: "ActionsLineGraph",
      query: `SELECT
  toDate(toTimeZone(timestamp, ${timeZone})) AS day,
  round(quantile(0.75)(toFloat(properties."$web_vitals_LCP_value")), 0) AS lcp_p75_ms,
  round(quantile(0.75)(toFloat(properties."$web_vitals_INP_value")), 0) AS inp_p75_ms
FROM events
WHERE event = '$web_vitals'
  AND timestamp >= now() - INTERVAL 90 DAY
  AND properties."$host" = ${host}
  AND properties."$pathname" = '/composer'
GROUP BY day
ORDER BY day`,
    },
    {
      name: "SEO | Composer CLS p75",
      description:
        "Daily native PostHog field measurements for Composer visual stability.",
      display: "ActionsLineGraph",
      query: `SELECT
  toDate(toTimeZone(timestamp, ${timeZone})) AS day,
  round(quantile(0.75)(toFloat(properties."$web_vitals_CLS_value")), 3) AS cls_p75
FROM events
WHERE event = '$web_vitals'
  AND timestamp >= now() - INTERVAL 90 DAY
  AND properties."$host" = ${host}
  AND properties."$pathname" = '/composer'
GROUP BY day
ORDER BY day`,
    },
  ];
}

function insightQuery(spec: PostHogInsightSpec) {
  return {
    kind: "DataVisualizationNode",
    display: spec.display,
    source: {
      kind: "HogQLQuery",
      name: spec.name,
      query: spec.query,
    },
  };
}

function loadEnvironment(): void {
  const path = resolve(process.cwd(), ".env");
  if (existsSync(path)) process.loadEnvFile(path);
}

class PostHogApi {
  constructor(
    private readonly baseUrl: string,
    private readonly projectId: string,
    private readonly apiKey: string
  ) {}

  private async request<T>(
    method: "GET" | "POST" | "PATCH",
    path: string,
    body?: unknown
  ): Promise<T> {
    const response = await fetch(new URL(path, this.baseUrl), {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    if (!response.ok) {
      const scopeHint =
        response.status === 401 || response.status === 403
          ? " The personal API key needs dashboard:read, dashboard:write, insight:read, insight:write, and query:read scopes."
          : "";
      throw new Error(
        `PostHog ${method} ${path} failed with HTTP ${response.status}.${scopeHint} ${text.slice(0, 300)}`
      );
    }
    return (text ? JSON.parse(text) : {}) as T;
  }

  async list<T>(resource: "dashboards" | "insights", search: string) {
    const results: T[] = [];
    const includeDashboards =
      resource === "insights" ? "&include_dashboards=true" : "";
    let path: string | null =
      `/api/projects/${this.projectId}/${resource}/?search=${encodeURIComponent(search)}&limit=100${includeDashboards}`;
    while (path) {
      const page: PaginatedResponse<T> = await this.request("GET", path);
      results.push(...(page.results ?? []));
      path = page.next
        ? new URL(page.next).pathname + new URL(page.next).search
        : null;
    }
    return results;
  }

  query(query: string): Promise<unknown> {
    return this.request("POST", `/api/projects/${this.projectId}/query/`, {
      query: { kind: "HogQLQuery", query },
    });
  }

  createDashboard(body: unknown): Promise<PostHogRecord> {
    return this.request(
      "POST",
      `/api/projects/${this.projectId}/dashboards/`,
      body
    );
  }

  createInsight(body: unknown): Promise<PostHogRecord> {
    return this.request(
      "POST",
      `/api/projects/${this.projectId}/insights/`,
      body
    );
  }

  updateInsight(id: number, body: unknown): Promise<PostHogRecord> {
    return this.request(
      "PATCH",
      `/api/projects/${this.projectId}/insights/${id}/`,
      body
    );
  }
}

function dashboardIds(record: PostHogRecord): number[] {
  return [
    ...(record.dashboards ?? []),
    ...(record.dashboard_tiles ?? []).map((tile) => tile.dashboard_id),
  ].filter((id, index, values) => values.indexOf(id) === index);
}

async function main(): Promise<void> {
  loadEnvironment();
  const config = loadSeoMeasurementConfig();
  const apply = process.argv.includes("--apply");
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY?.trim();
  const projectId = process.env.POSTHOG_PROJECT_ID?.trim();
  if (!apiKey || !projectId) {
    throw new Error(
      "POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID are required"
    );
  }
  const rawHost = process.env.POSTHOG_API_HOST?.trim() || "us.posthog.com";
  const baseUrl = rawHost.startsWith("http") ? rawHost : `https://${rawHost}`;
  const siteHost = config.site.host;
  const timeZone = config.site.reportingTimeZone;
  const api = new PostHogApi(baseUrl, projectId, apiKey);
  const spec = getPostHogDashboardSpec({ host: siteHost, timeZone });

  const [dashboards, ...insightLists] = await Promise.all([
    api.list<PostHogRecord>("dashboards", DASHBOARD_NAME),
    ...spec.map((insight) => api.list<PostHogRecord>("insights", insight.name)),
  ]);
  const exactDashboards = dashboards.filter(
    (dashboard) => dashboard.name === DASHBOARD_NAME
  );
  if (exactDashboards.length > 1) {
    throw new Error(`Multiple PostHog dashboards are named ${DASHBOARD_NAME}`);
  }
  for (const [index, records] of insightLists.entries()) {
    const exact = records.filter((record) => record.name === spec[index]!.name);
    if (exact.length > 1) {
      throw new Error(
        `Multiple PostHog insights are named ${spec[index]!.name}`
      );
    }
  }

  for (const insight of spec) await api.query(insight.query);

  if (!apply) {
    const dashboardAction = exactDashboards.length === 0 ? "create" : "reuse";
    const createCount = insightLists.filter(
      (records, index) =>
        !records.some((record) => record.name === spec[index]!.name)
    ).length;
    process.stdout.write(
      `PostHog plan validated: ${dashboardAction} one dashboard, create ${createCount} insights, reconcile ${spec.length - createCount}. Re-run with --apply to write it.\n`
    );
    return;
  }

  const dashboard =
    exactDashboards[0] ??
    (await api.createDashboard({
      name: DASHBOARD_NAME,
      description:
        "Organic acquisition, Composer activation, completion, and field performance for the Flow Arts Software experiment.",
      pinned: true,
      tags: [MANAGED_TAG, "seo"],
    }));

  for (const [index, insight] of spec.entries()) {
    const body = {
      name: insight.name,
      description: insight.description,
      query: insightQuery(insight),
      dashboards: [dashboard.id],
      tags: [MANAGED_TAG, "seo"],
    };
    const existing = insightLists[index]!.find(
      (record) => record.name === insight.name
    );
    if (!existing) {
      await api.createInsight(body);
      continue;
    }
    const isCurrent =
      existing.description === insight.description &&
      JSON.stringify(existing.query) === JSON.stringify(body.query) &&
      dashboardIds(existing).includes(dashboard.id);
    if (!isCurrent) await api.updateInsight(existing.id, body);
  }

  process.stdout.write(
    `PostHog dashboard ${DASHBOARD_NAME} is provisioned with ${spec.length} managed insights.\n`
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`PostHog dashboard provisioning failed: ${message}\n`);
    process.exitCode = 1;
  });
}
