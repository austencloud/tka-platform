/**
 * HogQL helpers shared by the admin analytics route and the triage CLI.
 *
 * These live outside the route so both consumers use ONE copy of the
 * admin-exclusion filter. A duplicated filter drifts, and drift here means
 * Austen's own sessions quietly pollute triage results.
 */

/**
 * Admin/dev noise excluded from all global metrics: localhost + dev hosts,
 * and Austen's own account UIDs (stable production admin accounts).
 */
export const EXCLUDED_ADMIN_UIDS = [
  "PBp3GSBO6igCKPwJyLZNmVEmamI3",
  "8IKsYlGhWxbZDd4ss1bnEZS5eBB3",
] as const;

export function escapeHogQL(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/**
 * Match every event PostHog has merged into one account identity.
 *
 * `identify()` keeps the original distinct ID on historical events. Filtering
 * events by the Firebase UID alone therefore drops the anonymous activity that
 * led to signup. PostHog's identity table is the canonical link between those
 * IDs and the shared person.
 */
export function personIdentityFilter(distinctId: string): string {
  const safeId = escapeHogQL(distinctId);
  return `person_id IN (
    SELECT person_id
    FROM person_distinct_ids
    WHERE distinct_id = '${safeId}'
  )`;
}

/**
 * Automation identities that browse production. Verified 2026-08-05:
 * `agent-codex-claude` had 91 events on tkaflowarts.com and took two of the
 * top ten friction slots with hour-long "produced nothing" sessions — a parked
 * agent tab, scored as a struggling user. Matched by prefix so future agent
 * identities are excluded automatically. Real Firebase uids are 28-char
 * alphanumeric and never start with "agent-".
 */
export const EXCLUDED_AGENT_UID_PREFIX = "agent-";

/** SQL fragment excluding dev hosts, admin accounts, and agent automation. */
export function pulseProdFilter(): string {
  const uidList = EXCLUDED_ADMIN_UIDS.map((u) => `'${escapeHogQL(u)}'`).join(", ");
  return `
    coalesce(properties."$host", '') NOT LIKE 'localhost%'
    AND coalesce(properties."$host", '') NOT LIKE '192.168.%'
    AND coalesce(properties."$host", '') != 'dev.tkaflowarts.com'
    AND distinct_id NOT IN (${uidList})
    AND distinct_id NOT LIKE '${EXCLUDED_AGENT_UID_PREFIX}%'
  `;
}
