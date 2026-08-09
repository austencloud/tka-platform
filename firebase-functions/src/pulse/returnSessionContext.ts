/**
 * A private session handoff must have been written beside the public activity
 * update that fired Pulse. Without the timestamp check, a failed client write
 * could attach yesterday's replay to today's notification.
 */
export const RETURN_SESSION_CONTEXT_MAX_SKEW_MS = 5 * 60 * 1000;

interface TimestampLike {
  toMillis?: () => number;
}

export interface ReturnSessionContextData {
  postHogSessionId?: unknown;
  postHogSessionCapturedAt?: unknown;
}

function timestampToMillis(value: unknown): number | null {
  if (!value) return null;
  const timestamp = value as TimestampLike;
  if (typeof timestamp.toMillis === "function") {
    const millis = timestamp.toMillis();
    return Number.isFinite(millis) ? millis : null;
  }
  if (typeof value === "string") {
    const millis = Date.parse(value);
    return Number.isNaN(millis) ? null : millis;
  }
  return null;
}

export function resolveFreshPostHogSessionId(
  data: ReturnSessionContextData | undefined,
  activityTimestampMs: number
): string | null {
  const sessionId = data?.postHogSessionId;
  const capturedAt = timestampToMillis(data?.postHogSessionCapturedAt);
  if (
    typeof sessionId !== "string" ||
    sessionId.length === 0 ||
    capturedAt === null
  ) {
    return null;
  }

  return Math.abs(activityTimestampMs - capturedAt) <=
    RETURN_SESSION_CONTEXT_MAX_SKEW_MS
    ? sessionId
    : null;
}
