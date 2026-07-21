/**
 * Admin endpoint to proxy PostHog analytics queries.
 * Keeps the PostHog Personal API Key server-side.
 *
 * POST /api/admin/analytics
 * Per-user: { type: "engagement" | "activity" | "content" | "sessions", userId: string, period?, limit? }
 * Global: Pulse queries plus { type: "seo-scorecard" | "seo-history" }
 *
 * Requires admin role.
 */
import type { RequestHandler } from "@sveltejs/kit";
import { json, error } from "@sveltejs/kit";
import { requireAdmin } from "$lib/server/auth/requireAdmin";
import { env } from "$env/dynamic/private";
import { RATE_LIMITS } from "$lib/server/security/rate-limiter";
import { withRateLimit } from "$lib/server/security/withRateLimit";
import { logAdminAction } from "$lib/server/security/audit-logger";

const POSTHOG_API_BASE = "https://us.i.posthog.com/api";

type QueryType =
  | "engagement"
  | "activity"
  | "content"
  | "sessions"
  | "pulse-overview"
  | "pulse-breakdown"
  | "pulse-feed"
  | "pulse-live"
  | "seo-scorecard"
  | "seo-history";
type TimePeriod = "today" | "week" | "month" | "all";
type PulseDimension = "country" | "city" | "referrer" | "device";

/** Global pulse queries are site-wide; per-user queries require a userId. */
const GLOBAL_QUERY_TYPES: ReadonlySet<string> = new Set([
  "pulse-overview",
  "pulse-breakdown",
  "pulse-feed",
  "pulse-live",
  "seo-scorecard",
  "seo-history",
]);

/**
 * Admin/dev noise excluded from all global pulse metrics: localhost + dev
 * hosts, and Austen's own account UIDs (stable production admin accounts).
 */
const EXCLUDED_ADMIN_UIDS = [
  "PBp3GSBO6igCKPwJyLZNmVEmamI3",
  "8IKsYlGhWxbZDd4ss1bnEZS5eBB3",
];

function pulseProdFilter(): string {
  const uidList = EXCLUDED_ADMIN_UIDS.map((u) => `'${escapeHogQL(u)}'`).join(
    ", "
  );
  return `
    coalesce(properties."$host", '') NOT LIKE 'localhost%'
    AND coalesce(properties."$host", '') NOT LIKE '192.168.%'
    AND coalesce(properties."$host", '') != 'dev.tkaflowarts.com'
    AND distinct_id NOT IN (${uidList})
  `;
}

function getPostHogHeaders() {
  if (!env.POSTHOG_PERSONAL_API_KEY) {
    throw error(500, "POSTHOG_PERSONAL_API_KEY not configured");
  }
  return {
    Authorization: `Bearer ${env.POSTHOG_PERSONAL_API_KEY}`,
    "Content-Type": "application/json",
  };
}

function getProjectId(): string {
  if (!env.POSTHOG_PROJECT_ID) {
    throw error(500, "POSTHOG_PROJECT_ID not configured");
  }
  return env.POSTHOG_PROJECT_ID;
}

function getPeriodInterval(period: TimePeriod): string {
  switch (period) {
    case "today":
      return "1 day";
    case "week":
      return "7 day";
    case "month":
      return "30 day";
    case "all":
      return "365 day";
  }
}

/** Escape a value for safe interpolation into a HogQL single-quoted string literal. */
function escapeHogQL(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function executeHogQLQuery(
  query: string
): Promise<{ results: unknown[][] } | null> {
  const projectId = getProjectId();

  const response = await fetch(
    `${POSTHOG_API_BASE}/projects/${projectId}/query/`,
    {
      method: "POST",
      headers: getPostHogHeaders(),
      body: JSON.stringify({
        query: {
          kind: "HogQLQuery",
          query,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[analytics] PostHog query failed:", response.status, errorText);
    throw error(502, `PostHog API error: ${response.status}`);
  }

  return await response.json();
}

function buildEngagementQuery(userId: string): string {
  const safeId = escapeHogQL(userId);
  return `
    SELECT
      max(timestamp) as last_active,
      count(distinct $session_id) as sessions_count
    FROM events
    WHERE distinct_id = '${safeId}'
      AND timestamp > now() - interval 30 day
  `;
}

function buildActivityQuery(userId: string, period: TimePeriod): string {
  const safeId = escapeHogQL(userId);
  const interval = getPeriodInterval(period);
  // Derive module from the first URL path segment of pageview events.
  // Works with existing autocapture data without custom properties.
  return `
    SELECT
      splitByChar('/', ifNull(path(properties."$current_url"), ''))[2] as module,
      count() as event_count
    FROM events
    WHERE distinct_id = '${safeId}'
      AND timestamp > now() - interval ${interval}
      AND event = '$pageview'
      AND properties."$current_url" IS NOT NULL
    GROUP BY module
    HAVING module != ''
    ORDER BY event_count DESC
    LIMIT 10
  `;
}

function buildContentQuery(userId: string): string {
  const safeId = escapeHogQL(userId);
  return `
    SELECT
      event,
      count() as count
    FROM events
    WHERE distinct_id = '${safeId}'
      AND event IN (
        'sequence_create',
        'sequence_save',
        'sequence_export',
        'sequence_share',
        'collection_create'
      )
    GROUP BY event
  `;
}

function buildSessionsQuery(userId: string, limit: number): string {
  const safeId = escapeHogQL(userId);
  // Derive modules from pageview URLs instead of properties.module
  return `
    SELECT
      "$session_id" as session_id,
      min(timestamp) as started_at,
      max(timestamp) as ended_at,
      dateDiff('millisecond', min(timestamp), max(timestamp)) as duration,
      arrayDistinct(
        arrayFilter(
          x -> x != '',
          groupArray(
            if(event = '$pageview',
              splitByChar('/', ifNull(path(properties."$current_url"), ''))[2],
              ''
            )
          )
        )
      ) as modules
    FROM events
    WHERE distinct_id = '${safeId}'
      AND "$session_id" IS NOT NULL
      AND timestamp > now() - interval 30 day
    GROUP BY "$session_id"
    ORDER BY started_at DESC
    LIMIT ${Math.min(limit, 50)}
  `;
}

// --- Global Pulse queries (site-wide, not per-user) ---

function buildPulseOverviewQuery(): string {
  return `
    SELECT
      uniqIf(distinct_id, event = '$pageview' AND timestamp > now() - interval 1 day) as visitors_today,
      uniqIf(distinct_id, event = '$pageview' AND timestamp > now() - interval 7 day) as visitors_7d,
      uniqIf(distinct_id, event = '$pageview' AND timestamp > now() - interval 30 day) as visitors_30d,
      countIf(event = 'card_scanned' AND timestamp > now() - interval 1 day) as scans_today,
      countIf(event = 'card_scanned' AND timestamp > now() - interval 7 day) as scans_7d,
      countIf(event = 'card_scanned' AND timestamp > now() - interval 30 day) as scans_30d,
      countIf(event IN ('sequence_save', 'collection_create') AND timestamp > now() - interval 1 day) as saves_today,
      countIf(event IN ('sequence_save', 'collection_create') AND timestamp > now() - interval 7 day) as saves_7d,
      countIf(event IN ('sequence_save', 'collection_create') AND timestamp > now() - interval 30 day) as saves_30d
    FROM events
    WHERE timestamp > now() - interval 30 day
      AND ${pulseProdFilter()}
  `;
}

function buildPulseBreakdownQuery(dimension: PulseDimension): string {
  const dimExpr: Record<PulseDimension, string> = {
    country: `properties."$geoip_country_name"`,
    city: `concat(coalesce(properties."$geoip_city_name", ''), ', ', coalesce(properties."$geoip_country_name", ''))`,
    referrer: `properties."$referring_domain"`,
    device: `concat(coalesce(properties."$browser", '?'), ' · ', coalesce(properties."$os", '?'))`,
  };
  return `
    SELECT
      ${dimExpr[dimension]} as name,
      uniq(distinct_id) as visitors
    FROM events
    WHERE event = '$pageview'
      AND timestamp > now() - interval 30 day
      AND ${pulseProdFilter()}
    GROUP BY name
    HAVING name IS NOT NULL AND name != '' AND name != ', '
    ORDER BY visitors DESC
    LIMIT 12
  `;
}

function buildPulseFeedQuery(limit: number): string {
  return `
    SELECT
      toString(timestamp) as ts,
      event,
      distinct_id,
      properties."$geoip_city_name" as city,
      properties."$geoip_country_name" as country,
      properties."$device_type" as device
    FROM events
    WHERE event IN ('session_start', 'card_scanned', 'sequence_save', 'collection_create', '$identify')
      AND timestamp > now() - interval 14 day
      AND ${pulseProdFilter()}
    ORDER BY timestamp DESC
    LIMIT ${Math.min(limit, 100)}
  `;
}

function buildPulseLiveQuery(): string {
  return `
    SELECT
      uniq(distinct_id) as live_total,
      uniqIf(distinct_id, match(distinct_id, '^[A-Za-z0-9]{28}$') = 0) as live_anon
    FROM events
    WHERE timestamp > now() - interval 5 minute
      AND ${pulseProdFilter()}
  `;
}

function buildSeoScorecardQuery(): string {
  return `
    SELECT
      toString(timestamp) as captured_at,
      properties.snapshot_json as snapshot_json
    FROM events
    WHERE event = 'seo_measurement_snapshot'
      AND distinct_id = 'seo-measurement'
    ORDER BY timestamp DESC
    LIMIT 1
  `;
}

function buildSeoHistoryQuery(): string {
  return `
    SELECT
      toString(timestamp) as captured_at,
      toString(toDate(properties.generated_date)) as generated_date,
      properties.phase as phase,
      properties.decision_status as decision_status,
      properties.head_term_position as head_term_position,
      properties.treatment_impressions as treatment_impressions,
      properties.organic_activation_rate as organic_activation_rate,
      properties.ai_citation_rate as ai_citation_rate,
      properties.indexed_rate as indexed_rate
    FROM events
    WHERE event = 'seo_measurement_snapshot'
      AND distinct_id = 'seo-measurement'
    ORDER BY timestamp ASC
    LIMIT 180
  `;
}

export const POST: RequestHandler = async (event) => {
  try {
    const caller = await requireAdmin(event);

    const blocked = await withRateLimit(event, RATE_LIMITS.ADMIN, "user", caller.uid);
    if (blocked) return blocked;

    const body = await event.request.json();
    const { type, userId, period, limit, dimension } = body as {
      type: QueryType;
      userId?: string;
      period?: TimePeriod;
      limit?: number;
      dimension?: PulseDimension;
    };
    const isGlobal = GLOBAL_QUERY_TYPES.has(type);
    if (!type || (!isGlobal && !userId)) {
      throw error(400, "type and userId are required");
    }

    // Validate userId - Firebase UIDs are alphanumeric, typically 28 chars
    if (
      !isGlobal &&
      (typeof userId !== "string" || !/^[a-zA-Z0-9]{1,128}$/.test(userId))
    ) {
      throw error(400, "Invalid userId format");
    }

    let query: string;
    switch (type) {
      case "engagement":
        query = buildEngagementQuery(userId!);
        break;
      case "activity":
        query = buildActivityQuery(userId!, period ?? "week");
        break;
      case "content":
        query = buildContentQuery(userId!);
        break;
      case "sessions":
        query = buildSessionsQuery(userId!, limit ?? 10);
        break;
      case "pulse-overview":
        query = buildPulseOverviewQuery();
        break;
      case "pulse-breakdown": {
        const dims: PulseDimension[] = ["country", "city", "referrer", "device"];
        if (!dimension || !dims.includes(dimension)) {
          throw error(400, "pulse-breakdown requires a valid dimension");
        }
        query = buildPulseBreakdownQuery(dimension);
        break;
      }
      case "pulse-feed":
        query = buildPulseFeedQuery(limit ?? 60);
        break;
      case "pulse-live":
        query = buildPulseLiveQuery();
        break;
      case "seo-scorecard":
        query = buildSeoScorecardQuery();
        break;
      case "seo-history":
        query = buildSeoHistoryQuery();
        break;
      default:
        throw error(400, `Unknown query type: ${type}`);
    }

    const result = await executeHogQLQuery(query);

    logAdminAction({
      uid: caller.uid,
      action: "analytics_query",
      target: userId ?? "global",
      metadata: { queryType: type, ...(period != null && { period }) },
      ip: event.getClientAddress(),
    });

    return json({ success: true, type, results: result?.results ?? [] });
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "status" in err) {
      throw err;
    }
    console.error("[analytics] Unhandled error:", err);
    throw error(500, "Analytics query failed");
  }
};
