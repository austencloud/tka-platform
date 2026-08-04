# Session Triage — Design

**Date:** 2026-08-04
**Status:** Approved, ready for planning
**Visual reference:** `static/sketches/2026-08-04-session-triage-report.html`

## Problem

Real users hit bugs that never become feedback items. They rage-click, bounce, and
leave. The only record is a PostHog session nobody watches.

This has been proven to work exactly once. On 2026-07-12 a single guest session
("Nina") was watched by hand and produced three root-caused bugs:

| Bug | Site |
|---|---|
| Tunnel view freezes on accidental tap | `TunnelArtView.svelte:39` |
| uid-swap race breaks collections on anonymous → Google sign-in | `collection-manager.ts:644`, `GoogleOneTap.svelte:105-116` |
| Google sign-in errors silently swallowed | `AccountPopover.svelte:114-118` |

It was a one-off manual watch. Nothing made it repeatable, and nothing tracked
whether those bugs kept happening afterwards.

Two gaps close here:

1. **No cross-user session query.** `buildSessionsQuery` and
   `buildSessionEventsQuery` in `src/routes/api/admin/analytics/+server.ts` are both
   hardcoded to a single `userId`. There is no "recent sessions across all users."
2. **No memory.** Nothing accumulates *who* hit *what*, so recurrence is invisible
   and prioritization has no evidence behind it.

## What exists already (verified 2026-08-04)

- **PostHog** holds sessions and replays, production only
  (`src/lib/shared/analytics/services/posthog.ts`). Autocapture is on, so
  `$rageclick` / `$dead_click` are available. Session replay is on in prod.
  A `before_send` hook already strips known-noise `$exception` events, so the
  exception signal arrives pre-cleaned.
- **`POSTHOG_PERSONAL_API_KEY`** and **`POSTHOG_PROJECT_ID`** are already in `.env`.
- **`/api/admin/analytics`** already runs HogQL server-side behind `requireAdmin`,
  with rate limiting and audit logging, and already has a `pulseProdFilter()` that
  excludes localhost, `192.168.*`, `dev.tkaflowarts.com`, and Austen's two admin UIDs.
- **`feedback`** Firestore collection plus `/fb`, `/submitfb`, `/prioritizefb`, `/done`.
- **Admin tab pattern:** `tab-definitions.ts` entry + lazy-loaded panel in
  `AdminDashboard.svelte` + a folder under `components/` (`pulse/`, `seo/`, `analytics/`).

Nothing needs building on the PostHog side. Sessions are already machine-readable
as text event streams, including exception type and message — so **reading**
sessions replaces **watching** them, which was the expensive part of the Nina pass.

## Never hand-roll — what was searched

- **`voice-review` skill + `scripts/fetch-voice-sessions.cjs`** — closest existing
  analog (fetch → review → find patterns → act). **Adopting its shape**
  (`analyze` / `stats` / `<id>` subcommands, tiered priority output), but a new
  skill: different data source (PostHog vs Firestore `voiceSessions`), different
  subject (real users vs Austen), different action (bug triage vs regex promotion).
- **`gsd-session-report`** — Claude Code token usage. Unrelated.
- **`UserSessionInspector.svelte` / `PulseDashboard.svelte`** — existing admin
  analytics surfaces. Per-user and live-visitor respectively; neither does
  cross-user friction ranking or keeps a register. The Triage tab follows their
  lazy-load and layout conventions.
- **HogQL builders** — extending the existing route rather than writing a second
  PostHog client.
- **`scripts/fetch-feedback.js submit`** — reused verbatim for filing.

## Non-goals

- No agent runs inside the app. The skill writes; the tab reads.
- No replay watching in the pipeline. Replay links are an escalation path for a
  human, not an input.
- No scheduled function. See Staleness.
- Not a general analytics dashboard. Pulse and Analytics already cover that.

## Architecture

```
PostHog HogQL
     │
     ├── src/lib/server/analytics/session-triage-queries.ts   (one copy of the SQL)
     │        │                                  │
     │        ▼                                  ▼
     │   /api/admin/analytics            scripts/triage-sessions.ts
     │   (type: "triage-sessions")       (tsx, direct PostHog)
     │        │                                  │
     │        ▼                                  ▼
     │   Admin → Triage tab  ◄──── Firestore ────┤  /sessions skill
     │   (read + light edits)     sessionIssues  │  (cluster, judge, write)
     │                                           ▼
     │                                  scripts/fetch-feedback.js submit
```

### 1. `src/lib/server/analytics/session-triage-queries.ts`

The cross-user friction HogQL, extracted so route and CLI cannot drift. Exports
builders returning query strings; no I/O, no credentials. Reuses `pulseProdFilter()`.

Two queries:

- `buildTriageSessionsQuery(sinceIso, limit)` — recent sessions across all users
  with the per-session aggregates needed for scoring.
- `buildAllUsersSessionEventsQuery(sessionId, limit)` — the ordered event stream
  for one session, without requiring a `userId` (the current one demands both).

### 2. API route addition

One new `QueryType`: `"triage-sessions"`, treated as a global query (added to
`GLOBAL_QUERY_TYPES`, no `userId` required). Inherits `requireAdmin`, rate
limiting, and audit logging unchanged.

### 3. `scripts/triage-sessions.ts`

Run with `tsx`. Talks to PostHog directly with `POSTHOG_PERSONAL_API_KEY` — the
API route needs an admin Firebase token that a CLI does not have. Imports the
same builders as the route.

| Command | Output |
|---|---|
| `analyze --since <iso> [--limit 20]` | Friction-ranked sessions, JSON or table |
| `stats [--days 30]` | Volume, exception rate, bounce rate, top broken routes |
| `<sessionId> [--format md]` | Ordered event stream for one session |

`--since` is primary; `--days N` is sugar. The skill passes the stored watermark
so already-reviewed sessions are skipped, which is what keeps repeat runs cheap.

### 4. Friction ranking

Weighted score per session, all from fields already queryable:

| Signal | Failure class it catches |
|---|---|
| `$exception` count | Hard failures |
| `$rageclick` / `$dead_click` | Freezes — the Tunnel tap bug, invisible to exception counts |
| Entered a module, 0 content actions, exited | Silent failures — the swallowed sign-in error |
| Bounce < 30s with 1 pageview | Onboarding cliff |
| Guest / first-seen uid | New-user friction, weighted up |

Every surfaced session prints its score **with the contributing reasons**, so the
weights can be corrected against real data. All five signals are present in the
Nina session; it would rank first.

Weights are a starting guess. The first run is as much calibration as triage.

### 5. `sessionIssues` Firestore collection

One document per recurring issue.

```
{
  id, title, status: "open" | "watching" | "resolved" | "dismissed",
  codeSite: "AccountPopover.svelte:114" | null,
  route, feedbackId: "FB-248" | null,
  firstSeen, lastSeen,
  affectedUids: string[],          // distinct users — the ranking key
  evidence: [ { sessionId, uid, occurredAt, summary, replayUrl } ],
  resolvedAt, resolvedReason
}
```

Plus a single `sessionTriageMeta/state` doc holding `reviewedThrough` (the
watermark), `reviewedSessionIds`, and the `aliases` map.

Ranking is by **distinct users affected**, not by score. Score finds candidates;
user count decides priority. Consequence to accept: a severe bug hitting one
person ranks below a mild one hitting six. Reviewed at first calibration.

### 6. Admin → Triage tab

`src/lib/features/admin/components/triage/TriagePanel.svelte`, lazy-loaded in
`AdminDashboard.svelte` exactly like `PulseDashboard`, plus a `triage` entry in
`src/lib/shared/navigation/config/tab-definitions.ts`.

Layout is specified by the sketch. Sections: stat strip → Needs a decision →
Closed this run → Watching. Per issue: distinct-user count as the headline number,
title, status/code-site/feedback pills, a per-day sighting sparkline, user chips,
and collapsed evidence rows with replay links.

Tab actions (writes): change status, dismiss, rename a guest alias, open the
PostHog replay, open the linked feedback item. No clustering, no analysis.

Layout rules already verified in the sketch and carried over: fluid content band
(floor 1720 / 88vw / ceiling 2600), continuous 16→24px root ramp across 1680→3840,
stats 2-up below 900px, and the evidence table in its own `overflow-x` container.

### 7. The `/sessions` skill

`.claude/skills/sessions/SKILL.md`:

1. Read `reviewedThrough`; run `analyze --since`.
2. Pull event streams for top-ranked sessions.
3. For each: existing issue (recurrence) or new one. Recurrence matching is on
   code site first, then route + signal shape.
4. Write to Firestore — append evidence, extend `affectedUids`, advance the watermark.
5. Apply the resolve-on-silence rule.
6. Report three tiers, recurrence-count first.
7. **On confirmation only**, file new issues via `fetch-feedback.js submit` and
   write `feedbackId` back.

Step 7 is gated because it writes to the shared feedback queue.

### Resolve-on-silence

An issue moves to `resolved` when **both** hold:

- No new evidence for **14 days**, and
- Its linked feedback item is `completed`.

Silence alone never resolves anything — low traffic is not a fix. Recorded as
`resolvedReason: "silence-after-fix"` with both dates, and reopened on any new
sighting.

This is the highest-value output of the whole thing: confirmation in production
that a fix actually worked, which is otherwise invisible.

### Identity

`uid → displayName` via Firebase Admin (`TKA_ADMIN=1`, existing pattern). Guests
get a coined stable alias, hand-renameable in the tab or the meta doc — that is
how `nina` persists across sessions. **No emails stored.**

### Staleness

The register only refreshes when `/sessions` runs. The tab shows a
**"last triaged N days ago"** banner, escalating in tone past 7 days. No
scheduled function; nightly automation is deferred until staleness demonstrably
bites. Per memory, functions deploys here are manual, so avoiding a deploy story
is worth real money.

## Error handling

| Condition | Behavior |
|---|---|
| Missing `POSTHOG_PERSONAL_API_KEY` | Named error naming the variable; exit 1 |
| PostHog 4xx / 5xx / rate limit | Surface status and body; exit 1 |
| Empty window | Exit 0, "no new sessions" — distinct from failure |
| Unknown session id | Named error; exit 1 |
| `sessionIssues` empty | First-run path; create meta doc |
| Firestore write fails mid-run | Watermark advances **last**, after evidence writes, so a partial run re-reads rather than skipping |

The script exits non-zero on API failure specifically so the skill never reports
an empty window as "no friction found."

## Testing

Per the `testing` skill — test the silent bugs, skip what's obvious when broken.

Unit tests (`tests/unit/`), all pure functions:

- Friction scoring: each signal contributes; Nina-shaped session ranks top.
- Recurrence matching: same code site → recurrence, not a new issue.
- Watermark: advances correctly; a partial failure does not skip sessions.
- Resolve-on-silence: fires only when both conditions hold; silence alone does not;
  new sighting reopens.
- Alias stability across runs.

No end-to-end PostHog mock — that boundary is verified by running it against real
data. HogQL builders get a snapshot test only to catch accidental filter loss
(specifically: admin UIDs still excluded).

Tab is visual; verified by screenshot per `visual-verification-mandatory.md`.

## Build order

1. Shared query module + route type (unblocks everything, independently testable)
2. CLI script + scoring + unit tests
3. Firestore schema + register writes + watermark
4. `/sessions` skill
5. Triage tab
6. First real run, calibrate weights

1–4 deliver value without the tab. The tab is the accessibility win, not the engine.

## Deferred

- Scheduled ranking (see Staleness).
- Ranking by severity rather than user count.
- Correlating triage issues with agent sessions.
- Auto-suggesting the code site from stack traces.
