/**
 * Admin endpoint to manage PostHog feature flags.
 * Proxies requests to PostHog's Feature Flags API.
 *
 * Endpoints:
 * - GET: List all feature flags
 * - PATCH: Update a feature flag
 *
 * Requires admin role and POSTHOG_PERSONAL_API_KEY env var.
 */
import type { RequestHandler } from "@sveltejs/kit";
import { json, error } from "@sveltejs/kit";
import { requireFirebaseUser } from "$lib/server/auth/requireFirebaseUser";
import { getAdminDb } from "$lib/server/firebaseAdmin";
import { POSTHOG_PERSONAL_API_KEY, POSTHOG_PROJECT_ID } from "$env/static/private";

const POSTHOG_API_BASE = "https://us.i.posthog.com/api";

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

/**
 * GET /api/admin/feature-flags
 * List all feature flags from PostHog
 */
export const GET: RequestHandler = async (event) => {
  try {
    const caller = await requireFirebaseUser(event);
    const callerIsAdmin = await isAdmin(caller.uid);
    if (!callerIsAdmin) {
      throw error(403, "Admin access required");
    }

    const projectId = getProjectId();
    const response = await fetch(
      `${POSTHOG_API_BASE}/projects/${projectId}/feature_flags/`,
      { headers: getPostHogHeaders() }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[feature-flags] PostHog API error:", errorText);
      throw error(response.status, `PostHog API error: ${response.statusText}`);
    }

    const data = await response.json();
    return json(data);
  } catch (err: unknown) {
    if (typeof err === "object" && err && "status" in err) {
      throw err;
    }
    console.error("[feature-flags] Error:", err);
    throw error(500, "Failed to fetch feature flags");
  }
};

/**
 * PATCH /api/admin/feature-flags
 * Update a feature flag in PostHog
 *
 * Body: { flagKey: string, enabled?: boolean, filters?: object }
 */
export const PATCH: RequestHandler = async (event) => {
  try {
    const caller = await requireFirebaseUser(event);
    const callerIsAdmin = await isAdmin(caller.uid);
    if (!callerIsAdmin) {
      throw error(403, "Admin access required");
    }

    const body = await event.request.json();
    const { flagKey, enabled, filters } = body;

    if (!flagKey) {
      throw error(400, "flagKey is required");
    }

    const projectId = getProjectId();

    // First, get the flag ID by key
    const listResponse = await fetch(
      `${POSTHOG_API_BASE}/projects/${projectId}/feature_flags/?search=${encodeURIComponent(flagKey)}`,
      { headers: getPostHogHeaders() }
    );

    if (!listResponse.ok) {
      throw error(listResponse.status, "Failed to find feature flag");
    }

    const listData = await listResponse.json();
    const flag = listData.results?.find((f: { key: string }) => f.key === flagKey);

    if (!flag) {
      // Flag doesn't exist - create it
      const createResponse = await fetch(
        `${POSTHOG_API_BASE}/projects/${projectId}/feature_flags/`,
        {
          method: "POST",
          headers: getPostHogHeaders(),
          body: JSON.stringify({
            key: flagKey,
            name: flagKey.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            active: enabled ?? true,
            filters: filters ?? { groups: [{ properties: [], rollout_percentage: 100 }] },
          }),
        }
      );

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error("[feature-flags] Create error:", errorText);
        throw error(createResponse.status, "Failed to create feature flag");
      }

      const created = await createResponse.json();
      return json({ success: true, flag: created, action: "created" });
    }

    // Update existing flag
    const updates: Record<string, unknown> = {};
    if (typeof enabled === "boolean") {
      updates.active = enabled;
    }
    if (filters) {
      updates.filters = filters;
    }

    const updateResponse = await fetch(
      `${POSTHOG_API_BASE}/projects/${projectId}/feature_flags/${flag.id}/`,
      {
        method: "PATCH",
        headers: getPostHogHeaders(),
        body: JSON.stringify(updates),
      }
    );

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error("[feature-flags] Update error:", errorText);
      throw error(updateResponse.status, "Failed to update feature flag");
    }

    const updated = await updateResponse.json();
    return json({ success: true, flag: updated, action: "updated" });
  } catch (err: unknown) {
    if (typeof err === "object" && err && "status" in err) {
      throw err;
    }
    console.error("[feature-flags] Error:", err);
    throw error(500, "Failed to update feature flag");
  }
};
