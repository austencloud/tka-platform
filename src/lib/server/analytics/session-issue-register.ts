/**
 * Pure logic for the sessionIssues register. No Firestore, no network — the
 * store in scripts/lib/session-issue-store.ts owns I/O.
 */

export type IssueStatus = "open" | "watching" | "resolved" | "dismissed";

export interface Evidence {
  sessionId: string;
  uid: string;
  occurredAt: string;
  summary: string;
  replayUrl: string;
}

export interface SessionIssue {
  id: string;
  title: string;
  status: IssueStatus;
  codeSite: string | null;
  route: string;
  feedbackId: string | null;
  firstSeen: string;
  lastSeen: string;
  /** Distinct users affected — the ranking key. */
  affectedUids: string[];
  evidence: Evidence[];
  resolvedAt: string | null;
  resolvedReason: string | null;
}

export interface Sighting extends Evidence {
  codeSite: string | null;
  route: string;
}

/** Quiet period before a fixed issue is considered gone. */
export const SILENCE_DAYS = 14;

/**
 * Find the issue a new sighting belongs to, or null to start a new one.
 *
 * Code site is the strong signal: the same file:line is the same bug wherever
 * it is reached from. Route is only a fallback for sightings nobody could pin
 * to a file, and it may only join an issue that is itself unpinned — two
 * different code sites on one route are two different bugs.
 *
 * `dismissed` issues never match: dismissing means "stop telling me". `resolved`
 * issues DO match, so a returning bug reopens instead of forking a duplicate.
 */
export function matchIssue(issues: readonly SessionIssue[], s: Sighting): SessionIssue | null {
  const candidates = issues.filter((i) => i.status !== "dismissed");

  if (s.codeSite) {
    return candidates.find((i) => i.codeSite === s.codeSite) ?? null;
  }

  // Unpinned sighting: prefer an equally unpinned issue on the route, then any
  // issue on that route, since we have no file to discriminate with.
  return (
    candidates.find((i) => i.codeSite === null && i.route === s.route) ??
    candidates.find((i) => i.route === s.route) ??
    null
  );
}

/**
 * Fold a sighting into an issue. Pure — returns a new issue, never mutates.
 * Re-processing the same session is a no-op, so a re-run after a partial
 * failure cannot inflate the counts.
 */
export function applySighting(issue: SessionIssue, s: Sighting): SessionIssue {
  const affectedUids = issue.affectedUids.includes(s.uid)
    ? issue.affectedUids
    : [...issue.affectedUids, s.uid];

  const evidence = issue.evidence.some((e) => e.sessionId === s.sessionId)
    ? issue.evidence
    : [
        ...issue.evidence,
        {
          sessionId: s.sessionId,
          uid: s.uid,
          occurredAt: s.occurredAt,
          summary: s.summary,
          replayUrl: s.replayUrl,
        },
      ];

  const reopening = issue.status === "resolved";

  return {
    ...issue,
    affectedUids,
    evidence,
    lastSeen: s.occurredAt > issue.lastSeen ? s.occurredAt : issue.lastSeen,
    firstSeen: s.occurredAt < issue.firstSeen ? s.occurredAt : issue.firstSeen,
    status: reopening ? "open" : issue.status,
    resolvedAt: reopening ? null : issue.resolvedAt,
    resolvedReason: reopening ? null : issue.resolvedReason,
  };
}

/**
 * Resolve ONLY when the signal stopped AND the fix shipped. Silence alone is
 * not evidence of a fix — low traffic looks identical.
 */
export function shouldResolveOnSilence(
  issue: SessionIssue,
  feedbackStatus: string | null,
  now: Date
): boolean {
  if (issue.status === "resolved" || issue.status === "dismissed") return false;
  if (!issue.feedbackId) return false;
  if (feedbackStatus !== "completed") return false;

  const quietMs = now.getTime() - new Date(issue.lastSeen).getTime();
  return quietMs >= SILENCE_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Advance the watermark to the newest session seen. Never moves backwards, so
 * a partial run re-reads rather than skipping sessions.
 */
export function nextWatermark(current: string, sessionStarts: readonly string[]): string {
  return sessionStarts.reduce((max, t) => (t > max ? t : max), current);
}
