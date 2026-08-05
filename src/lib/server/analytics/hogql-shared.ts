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

/** SQL fragment excluding dev hosts and admin accounts. Used in WHERE clauses. */
export function pulseProdFilter(): string {
  const uidList = EXCLUDED_ADMIN_UIDS.map((u) => `'${escapeHogQL(u)}'`).join(", ");
  return `
    coalesce(properties."$host", '') NOT LIKE 'localhost%'
    AND coalesce(properties."$host", '') NOT LIKE '192.168.%'
    AND coalesce(properties."$host", '') != 'dev.tkaflowarts.com'
    AND distinct_id NOT IN (${uidList})
  `;
}
