/**
 * Friction scoring for triage.
 *
 * Score finds CANDIDATE sessions worth reading. It does not rank issues —
 * issues rank by distinct users affected (see session-issue-register).
 *
 * Weights are a calibrated guess and are expected to move after the first real
 * run. Tests assert behavior (each signal contributes; a Nina-shaped session
 * wins) rather than exact totals, so tuning does not break them.
 */
import type { TriageSessionRow } from "./session-triage-queries";

export interface FrictionReason {
  signal: "exception" | "rage-click" | "dead-click" | "silent-abandon" | "bounce" | "new-user";
  detail: string;
  points: number;
}

export interface FrictionScore {
  total: number;
  reasons: FrictionReason[];
}

export interface ScoreContext {
  /** True when this uid's first-ever event falls inside this session. */
  isNewUser: boolean;
}

const WEIGHTS = {
  exception: { each: 15, cap: 45 },
  rageClick: { each: 8, cap: 32 },
  deadClick: { each: 4, cap: 16 },
  silentAbandon: 20,
  bounce: 18,
  newUser: 12,
} as const;

/** A visit long enough that leaving empty-handed means something went wrong. */
const SILENT_ABANDON_MIN_MS = 20_000;
const BOUNCE_MAX_MS = 30_000;

/**
 * In-app routes are /app/<module>/..., so the module is the SECOND segment.
 * Public routes (/q, /sequence, /notation) carry it in the first.
 */
export function resolveModule(
  topSegments: readonly string[],
  subSegments: readonly string[]
): string | null {
  const top = topSegments[0];
  if (!top) return null;
  if (top === "app") return subSegments[0] ?? "app";
  return top;
}

export function scoreSession(row: TriageSessionRow, ctx: ScoreContext): FrictionScore {
  const reasons: FrictionReason[] = [];

  if (row.exceptionCount > 0) {
    const points = Math.min(row.exceptionCount * WEIGHTS.exception.each, WEIGHTS.exception.cap);
    reasons.push({
      signal: "exception",
      detail: `${row.exceptionCount} exception${row.exceptionCount === 1 ? "" : "s"}`,
      points,
    });
  }

  if (row.rageClickCount > 0) {
    const points = Math.min(row.rageClickCount * WEIGHTS.rageClick.each, WEIGHTS.rageClick.cap);
    reasons.push({
      signal: "rage-click",
      detail: `${row.rageClickCount} rage click${row.rageClickCount === 1 ? "" : "s"}`,
      points,
    });
  }

  if (row.deadClickCount > 0) {
    const points = Math.min(row.deadClickCount * WEIGHTS.deadClick.each, WEIGHTS.deadClick.cap);
    reasons.push({
      signal: "dead-click",
      detail: `${row.deadClickCount} dead click${row.deadClickCount === 1 ? "" : "s"}`,
      points,
    });
  }

  // Stayed a while inside a module and produced nothing — the silent-failure class.
  const module = resolveModule(row.topSegments, row.subSegments);
  if (module && row.contentActionCount === 0 && row.durationMs >= SILENT_ABANDON_MIN_MS) {
    reasons.push({
      signal: "silent-abandon",
      detail: `${Math.round(row.durationMs / 1000)}s in ${module}, produced nothing`,
      points: WEIGHTS.silentAbandon,
    });
  }

  if (row.durationMs < BOUNCE_MAX_MS && row.pageviewCount <= 1 && row.contentActionCount === 0) {
    reasons.push({
      signal: "bounce",
      detail: `left after ${Math.round(row.durationMs / 1000)}s on one page`,
      points: WEIGHTS.bounce,
    });
  }

  // Only weights up a session that already showed friction — a happy first
  // visit should not rank.
  if (ctx.isNewUser && reasons.length > 0) {
    reasons.push({
      signal: "new-user",
      detail: "first-ever session",
      points: WEIGHTS.newUser,
    });
  }

  return { total: reasons.reduce((sum, r) => sum + r.points, 0), reasons };
}
