import { randomUUID } from "crypto";

/**
 * Keep feedback ownership stable across separate CLI commands issued by the
 * same Codex or Claude thread. Other shells still receive a one-command ID.
 */
export function resolveFeedbackSessionId(
  env = process.env,
  createFallback = randomUUID
) {
  return (
    env.CODEX_THREAD_ID?.trim() ||
    env.CLAUDE_CODE_SESSION_ID?.trim() ||
    createFallback()
  );
}

/**
 * Re-running `claim <id>` after user approval is safe. The same thread refreshes
 * its lease, an expired lease is reclaimed, and another live owner is protected.
 */
export function chooseSpecificClaimAction(item, sessionId, isStale) {
  if (item.status !== "in-progress") return "claim";
  if (item.claimSession === sessionId && !isStale) return "refresh";
  if (isStale) return "reclaim";
  return "blocked";
}
