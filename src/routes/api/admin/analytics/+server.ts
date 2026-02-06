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
import { requireFirebaseUser } from "$lib/server/auth/requireFirebaseUser";
import { getAdminDb } from "$lib/server/firebaseAdmin";
import {
  POSTHOG_PERSONAL_API_KEY,
  POSTHOG_PROJECT_ID,
} from "$env/static/private";

const POSTHOG_API_BASE = "https://us.i.posthog.com/api";

type QueryType = "engagement" | "activity" | "content" | "sessions";
type TimePeriod = "today" | "week" | "month" | "all";

async function isAdmin(uid: string): Promise<boolean> {
  const db = getAdminDb();
  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists) return false;
  const data = userDoc.data();
  return data?.role === "admin" || data?.isAdmin === true;
}

function getPostHogHeaders() {
  if (!POSTHOG_PERSONAL_API_KEY) {
    throw error(500, "POSTHOG_PERSONAL_API_KEY not configured");
  }
  return {
    Authorization: `Bearer ${POSTHOG_PERSONAL_API_KEY}`,
    "Content-Type": "application/json",
  };
}

function getProjectId(): string {
  if (!POSTHOG_PROJECT_ID) {
    throw error(500, "POSTHOG_PROJECT_ID not configured");
  }
  return POSTHOG_PROJECT_ID;
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
  return `
    SELECT
      max(timestamp) as last_active,
      count(distinct $session_id) as sessions_count
    FROM events
    WHERE distinct_id = {userId}
      AND timestamp > now() - interval 30 day
  `.replace("{userId}", `'${userId.replace(/'/g, "")}'`);
}

function buildActivityQuery(userId: string, period: TimePeriod): string {
  const interval = getPeriodInterval(period);
  return `
    SELECT
      properties.module as module,
      count() as event_count
    FROM events
    WHERE distinct_id = {userId}
      AND timestamp > now() - interval ${interval}
      AND properties.module IS NOT NULL
    GROUP BY properties.module
    ORDER BY event_count DESC
  `.replace("{userId}", `'${userId.replace(/'/g, "")}'`);
}

function buildContentQuery(userId: string): string {
  return `
    SELECT
      event,
      count() as count
    FROM events
    WHERE distinct_id = {userId}
      AND event IN (
        'sequence_create',
        'sequence_save',
        'sequence_export',
        'sequence_share',
        'collection_create'
      )
    GROUP BY event
  `.replace("{userId}", `'${userId.replace(/'/g, "")}'`);
}

function buildSessionsQuery(userId: string, limit: number): string {
  return `
    SELECT
      $session_id as session_id,
      min(timestamp) as started_at,
      max(timestamp) as ended_at,
      dateDiff('millisecond', min(timestamp), max(timestamp)) as duration,
      groupArray(distinct properties.module) as modules
    FROM events
    WHERE distinct_id = {userId}
      AND $session_id IS NOT NULL
      AND timestamp > now() - interval 30 day
    GROUP BY $session_id
    ORDER BY started_at DESC
    LIMIT ${Math.min(limit, 50)}
  `.replace("{userId}", `'${userId.replace(/'/g, "")}'`);
}

export const POST: RequestHandler = async (event) => {
  try {
    console.log("[analytics] POST request received");

    const caller = await requireFirebaseUser(event);
    console.log("[analytics] Authenticated user:", caller.uid);

    const callerIsAdmin = await isAdmin(caller.uid);
    console.log("[analytics] Is admin:", callerIsAdmin);
    if (!callerIsAdmin) {
      throw error(403, "Admin access required");
    }

    const body = await event.request.json();
    const { type, userId, period, limit } = body as {
      type: QueryType;
      userId: string;
      period?: TimePeriod;
      limit?: number;
    };
    console.log("[analytics] Query:", { type, userId, period, limit });

    if (!type || !userId) {
      throw error(400, "type and userId are required");
    }

    console.log("[analytics] Env check - PROJECT_ID:", POSTHOG_PROJECT_ID ? "set" : "MISSING");
    console.log("[analytics] Env check - API_KEY:", POSTHOG_PERSONAL_API_KEY ? `set (${POSTHOG_PERSONAL_API_KEY.slice(0, 8)}...)` : "MISSING");

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

    console.log("[analytics] Executing HogQL query for:", type);
    const result = await executeHogQLQuery(query);
    console.log("[analytics] Query result rows:", result?.results?.length ?? 0);

    return json({ success: true, type, results: result?.results ?? [] });
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "status" in err) {
      throw err;
    }
    console.error("[analytics] Unhandled error:", err);
    throw error(500, "Analytics query failed");
  }
};
