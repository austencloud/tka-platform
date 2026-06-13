/**
 * Admin endpoint to proxy PostHog analytics queries.
 * Keeps the PostHog Personal API Key server-side.
 *
 * POST /api/admin/analytics
 * Body: { type: "engagement" | "activity" | "content" | "sessions", userId: string, period?: TimePeriod, limit?: number }
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

type QueryType = "engagement" | "activity" | "content" | "sessions";
type TimePeriod = "today" | "week" | "month" | "all";

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

export const POST: RequestHandler = async (event) => {
  try {
    const caller = await requireAdmin(event);

    const blocked = await withRateLimit(event, RATE_LIMITS.ADMIN, "user", caller.uid);
    if (blocked) return blocked;

    const body = await event.request.json();
    const { type, userId, period, limit } = body as {
      type: QueryType;
      userId: string;
      period?: TimePeriod;
      limit?: number;
    };
    if (!type || !userId) {
      throw error(400, "type and userId are required");
    }

    // Validate userId - Firebase UIDs are alphanumeric, typically 28 chars
    if (typeof userId !== "string" || !/^[a-zA-Z0-9]{1,128}$/.test(userId)) {
      throw error(400, "Invalid userId format");
    }

    let query: string;
    switch (type) {
      case "engagement":
        query = buildEngagementQuery(userId);
        break;
      case "activity":
        query = buildActivityQuery(userId, period ?? "week");
        break;
      case "content":
        query = buildContentQuery(userId);
        break;
      case "sessions":
        query = buildSessionsQuery(userId, limit ?? 10);
        break;
      default:
        throw error(400, `Unknown query type: ${type}`);
    }

    const result = await executeHogQLQuery(query);

    logAdminAction({
      uid: caller.uid,
      action: "analytics_query",
      target: userId,
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
