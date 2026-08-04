# Session Triage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn real user sessions in PostHog into a tracked register of recurring issues, ranked by how many distinct people hit each one, viewable as an admin tab.

**Architecture:** One shared HogQL module feeds two consumers — the existing admin API route and a new `tsx` CLI. The CLI ranks sessions by friction signals; the `/sessions` skill reads the top ones, clusters them into a Firestore `sessionIssues` register, and files feedback items. An admin Triage tab renders the register.

**Tech Stack:** TypeScript, SvelteKit, Svelte 5 runes, PostHog HogQL API, Firestore (Admin SDK via `scripts/lib/firestore-provider.js`), Vitest, `tsx`.

**Spec:** `docs/superpowers/specs/2026-08-04-session-triage-design.md`

**Working directory:** Primary checkout on `main` (`E:/tka-platform`). Per `.claude/rules/worktree-workflow.md`, do NOT create a branch or worktree.

**Commit discipline:** Every commit uses an explicit pathspec (`git commit -m "..." -- path/a path/b`) per `.claude/rules/commit-only-your-own-changes.md`. The index is shared with other sessions; a bare `git commit` will sweep in their work.

---

## Conventions you need before starting

**Running one test file:**
```bash
npx vitest run --config tests/config/vitest.config.ts tests/unit/<name>.test.ts
```

**Running the CLI:**
```bash
npx tsx scripts/triage-sessions.ts <subcommand>
```

**Type checking (expensive — do NOT run per-step):** `npm run check` is a 2–3 minute cold command. Run it once before the final commit of a task group, not after each edit. Per `.claude/rules/fast-iteration-loop.md`, capture once and grep:
```bash
npm run check > /tmp/check.log 2>&1; grep -niE "error" /tmp/check.log
```

**Never start a dev server.** Port 5173 is Austen's and is already running. Use it for the visual verification in Task 7.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/server/analytics/hogql-shared.ts` | `escapeHogQL`, `EXCLUDED_ADMIN_UIDS`, `pulseProdFilter` — moved out of the route so the CLI can use them |
| `src/lib/server/analytics/session-triage-queries.ts` | The three triage HogQL builders + row types |
| `src/lib/server/analytics/session-friction-score.ts` | Pure scoring function. No I/O |
| `src/lib/server/analytics/session-issue-register.ts` | Pure register logic: recurrence matching, watermark, resolve-on-silence |
| `src/routes/api/admin/analytics/+server.ts` | Modified: imports shared helpers, adds `triage-sessions` type |
| `scripts/triage-sessions.ts` | CLI: `analyze` / `stats` / `<sessionId>` |
| `scripts/lib/session-issue-store.ts` | Firestore read/write for `sessionIssues` + meta doc |
| `.claude/skills/sessions/SKILL.md` | The triage workflow |
| `src/lib/features/admin/components/triage/TriagePanel.svelte` | The tab |
| `src/lib/features/admin/components/triage/IssueCard.svelte` | One issue |
| `src/lib/features/admin/components/triage/SightingSparkline.svelte` | Per-day bar strip |
| `src/lib/shared/navigation/config/tab-definitions.ts` | Modified: `triage` entry |
| `src/lib/features/admin/components/AdminDashboard.svelte` | Modified: lazy-load the panel |

Scoring and register logic are pure and separate from I/O specifically so they can be unit tested without mocking PostHog or Firestore.

---

## Task 1: Extract shared HogQL helpers

Moving three things out of the route so the CLI can import them without duplicating the admin-exclusion filter. If the filter is duplicated it will drift, and drift here means Austen's own sessions silently pollute the triage list.

**Files:**
- Create: `src/lib/server/analytics/hogql-shared.ts`
- Modify: `src/routes/api/admin/analytics/+server.ts`
- Test: `tests/unit/analytics/hogql-shared.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/analytics/hogql-shared.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  escapeHogQL,
  pulseProdFilter,
  EXCLUDED_ADMIN_UIDS,
} from "$lib/server/analytics/hogql-shared";

describe("escapeHogQL", () => {
  it("escapes single quotes so a uid cannot break out of a literal", () => {
    expect(escapeHogQL("o'brien")).toBe("o\\'brien");
  });

  it("escapes backslashes before quotes", () => {
    expect(escapeHogQL("a\\b")).toBe("a\\\\b");
  });
});

describe("pulseProdFilter", () => {
  it("excludes every admin uid", () => {
    const sql = pulseProdFilter();
    for (const uid of EXCLUDED_ADMIN_UIDS) {
      expect(sql).toContain(uid);
    }
  });

  it("excludes localhost, LAN, and the dev host", () => {
    const sql = pulseProdFilter();
    expect(sql).toContain("localhost%");
    expect(sql).toContain("192.168.%");
    expect(sql).toContain("dev.tkaflowarts.com");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run --config tests/config/vitest.config.ts tests/unit/analytics/hogql-shared.test.ts
```
Expected: FAIL — cannot resolve `$lib/server/analytics/hogql-shared`.

- [ ] **Step 3: Create the shared module**

Create `src/lib/server/analytics/hogql-shared.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run --config tests/config/vitest.config.ts tests/unit/analytics/hogql-shared.test.ts
```
Expected: PASS, 4 tests.

- [ ] **Step 5: Make the route import them instead of defining them**

In `src/routes/api/admin/analytics/+server.ts`:

Delete the local `EXCLUDED_ADMIN_UIDS` const, the `pulseProdFilter` function, and the `escapeHogQL` function. Add to the imports at the top:

```ts
import {
  escapeHogQL,
  pulseProdFilter,
} from "$lib/server/analytics/hogql-shared";
```

Leave every call site unchanged — the names and signatures are identical.

- [ ] **Step 6: Verify the route still type-checks**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "analytics" || echo "no analytics errors"
```
Expected: `no analytics errors`. (If `tsc -p` is not configured for this file, fall back to `npm run check:fast` and grep for `analytics`.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/server/analytics/hogql-shared.ts tests/unit/analytics/hogql-shared.test.ts src/routes/api/admin/analytics/+server.ts
git commit -m "refactor(analytics): extract shared HogQL helpers for reuse by triage CLI" -- src/lib/server/analytics/hogql-shared.ts tests/unit/analytics/hogql-shared.test.ts src/routes/api/admin/analytics/+server.ts
```

---

## Task 2: Triage HogQL query builders

Three queries that do not exist today. The two existing session builders both require a `userId`; these do not.

**Files:**
- Create: `src/lib/server/analytics/session-triage-queries.ts`
- Test: `tests/unit/analytics/session-triage-queries.test.ts`

Background on module derivation: the in-app routes live under `/app/[...path]`, so the first URL segment is `app` for most real usage and the meaningful module name is the **second** segment. Public routes (`/q`, `/sequence`, `/notation`) use the first. The query returns both segments and the scorer resolves it.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/analytics/session-triage-queries.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  buildTriageSessionsQuery,
  buildTriageSessionEventsQuery,
  buildFirstSeenQuery,
} from "$lib/server/analytics/session-triage-queries";

describe("buildTriageSessionsQuery", () => {
  const sql = buildTriageSessionsQuery("2026-08-01T00:00:00Z", 20);

  it("groups by session rather than filtering to one user", () => {
    expect(sql).toContain("GROUP BY session_id");
    expect(sql).not.toContain("distinct_id = '");
  });

  it("keeps the admin exclusion filter", () => {
    expect(sql).toContain("PBp3GSBO6igCKPwJyLZNmVEmamI3");
    expect(sql).toContain("dev.tkaflowarts.com");
  });

  it("selects every signal the scorer needs", () => {
    for (const col of [
      "exception_count",
      "rage_click_count",
      "dead_click_count",
      "pageview_count",
      "content_action_count",
      "modules",
      "duration",
    ]) {
      expect(sql).toContain(col);
    }
  });

  it("clamps the limit to 200", () => {
    expect(buildTriageSessionsQuery("2026-08-01T00:00:00Z", 9999)).toContain("LIMIT 200");
  });

  it("escapes the since timestamp", () => {
    expect(buildTriageSessionsQuery("2026'--", 5)).toContain("2026\\'--");
  });
});

describe("buildTriageSessionEventsQuery", () => {
  it("resolves a session without needing a userId", () => {
    const sql = buildTriageSessionEventsQuery("s_9a1c", 500);
    expect(sql).toContain("s_9a1c");
    expect(sql).not.toContain("distinct_id = '");
    expect(sql).toContain("exception_message");
  });
});

describe("buildFirstSeenQuery", () => {
  it("returns the first-ever event time per uid", () => {
    const sql = buildFirstSeenQuery(["u_a", "u_b"]);
    expect(sql).toContain("min(timestamp)");
    expect(sql).toContain("'u_a'");
    expect(sql).toContain("'u_b'");
    expect(sql).toContain("GROUP BY uid");
  });

  it("is safe with an empty uid list", () => {
    expect(buildFirstSeenQuery([])).toContain("LIMIT 0");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run --config tests/config/vitest.config.ts tests/unit/analytics/session-triage-queries.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Write the query module**

Create `src/lib/server/analytics/session-triage-queries.ts`:

```ts
/**
 * Cross-user session queries for triage.
 *
 * The two session builders in the admin analytics route are hardcoded to a
 * single userId. Triage needs the opposite: recent sessions across ALL real
 * users, ranked by friction. These builders return query strings only — no
 * I/O, no credentials — so both the API route and the CLI can use them.
 */
import { escapeHogQL, pulseProdFilter } from "./hogql-shared";

/** Events that mean the user actually produced something. */
export const CONTENT_ACTION_EVENTS = [
  "sequence_create",
  "sequence_save",
  "sequence_autosaved",
  "sequence_export",
  "sequence_share",
  "collection_create",
] as const;

/** One row of the triage sessions query. */
export interface TriageSessionRow {
  sessionId: string;
  uid: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  eventCount: number;
  exceptionCount: number;
  rageClickCount: number;
  deadClickCount: number;
  pageviewCount: number;
  contentActionCount: number;
  /** First URL segment of each pageview, e.g. "app", "q", "sequence". */
  topSegments: string[];
  /** Second URL segment, meaningful when the first is "app". */
  subSegments: string[];
  entryPath: string;
  exitPath: string;
  browser: string;
  operatingSystem: string;
  deviceType: string;
}

/** One row of the session events query. */
export interface TriageEventRow {
  eventId: string;
  occurredAt: string;
  event: string;
  route: string;
  detail: string;
  exceptionType: string | null;
  exceptionMessage: string | null;
}

const MAX_SESSIONS = 200;
const MAX_EVENTS = 500;

/** Recent sessions across all real users, newest first. */
export function buildTriageSessionsQuery(sinceIso: string, limit: number): string {
  const since = escapeHogQL(sinceIso);
  const contentEvents = CONTENT_ACTION_EVENTS.map((e) => `'${e}'`).join(", ");
  const n = Math.min(Math.max(limit, 1), MAX_SESSIONS);

  return `
    SELECT
      "$session_id" as session_id,
      argMax(distinct_id, timestamp) as uid,
      toString(min(timestamp)) as started_at,
      toString(max(timestamp)) as ended_at,
      dateDiff('millisecond', min(timestamp), max(timestamp)) as duration,
      count() as event_count,
      countIf(event = '$exception') as exception_count,
      countIf(event = '$rageclick') as rage_click_count,
      countIf(event = '$dead_click') as dead_click_count,
      countIf(event = '$pageview') as pageview_count,
      countIf(event IN (${contentEvents})) as content_action_count,
      arrayDistinct(arrayFilter(x -> x != '', groupArray(
        if(event = '$pageview',
           splitByChar('/', ifNull(path(properties."$current_url"), ''))[2], '')
      ))) as top_segments,
      arrayDistinct(arrayFilter(x -> x != '', groupArray(
        if(event = '$pageview',
           splitByChar('/', ifNull(path(properties."$current_url"), ''))[3], '')
      ))) as sub_segments,
      argMinIf(path(properties."$current_url"), timestamp,
        event = '$pageview' AND properties."$current_url" IS NOT NULL) as entry_path,
      argMaxIf(path(properties."$current_url"), timestamp,
        event = '$pageview' AND properties."$current_url" IS NOT NULL) as exit_path,
      argMax(properties."$browser", timestamp) as browser,
      argMax(properties."$os", timestamp) as operating_system,
      argMax(properties."$device_type", timestamp) as device_type
    FROM events
    WHERE timestamp > toDateTime('${since}')
      AND "$session_id" != ''
      AND ${pulseProdFilter()}
    GROUP BY session_id
    ORDER BY started_at DESC
    LIMIT ${n}
  `;
}

/** Ordered event stream for one session, any user. */
export function buildTriageSessionEventsQuery(sessionId: string, limit: number): string {
  const safe = escapeHogQL(sessionId);
  const n = Math.min(Math.max(limit, 1), MAX_EVENTS);
  return `
    SELECT
      toString(uuid) as event_id,
      toString(timestamp) as occurred_at,
      event,
      if(properties."$current_url" IS NULL, '', path(properties."$current_url")) as route,
      coalesce(properties."$el_text", properties."$event_type", '') as detail,
      properties."$exception_type" as exception_type,
      properties."$exception_message" as exception_message
    FROM events
    WHERE "$session_id" = '${safe}'
    ORDER BY timestamp ASC
    LIMIT ${n}
  `;
}

/**
 * First-ever event timestamp per uid. Used to decide whether a session belongs
 * to a brand-new user, which weights the friction score up.
 */
export function buildFirstSeenQuery(uids: readonly string[]): string {
  if (uids.length === 0) {
    return `SELECT distinct_id as uid, toString(min(timestamp)) as first_seen
            FROM events GROUP BY uid LIMIT 0`;
  }
  const list = uids.map((u) => `'${escapeHogQL(u)}'`).join(", ");
  return `
    SELECT distinct_id as uid, toString(min(timestamp)) as first_seen
    FROM events
    WHERE distinct_id IN (${list})
    GROUP BY uid
  `;
}

/** Maps a raw HogQL row array to a typed row. Column order must match the SELECT. */
export function parseTriageSessionRow(row: unknown[]): TriageSessionRow {
  return {
    sessionId: String(row[0] ?? ""),
    uid: String(row[1] ?? ""),
    startedAt: String(row[2] ?? ""),
    endedAt: String(row[3] ?? ""),
    durationMs: Number(row[4] ?? 0),
    eventCount: Number(row[5] ?? 0),
    exceptionCount: Number(row[6] ?? 0),
    rageClickCount: Number(row[7] ?? 0),
    deadClickCount: Number(row[8] ?? 0),
    pageviewCount: Number(row[9] ?? 0),
    contentActionCount: Number(row[10] ?? 0),
    topSegments: Array.isArray(row[11]) ? (row[11] as string[]) : [],
    subSegments: Array.isArray(row[12]) ? (row[12] as string[]) : [],
    entryPath: String(row[13] ?? ""),
    exitPath: String(row[14] ?? ""),
    browser: String(row[15] ?? ""),
    operatingSystem: String(row[16] ?? ""),
    deviceType: String(row[17] ?? ""),
  };
}

/** Maps a raw HogQL row array to a typed event row. */
export function parseTriageEventRow(row: unknown[]): TriageEventRow {
  return {
    eventId: String(row[0] ?? ""),
    occurredAt: String(row[1] ?? ""),
    event: String(row[2] ?? ""),
    route: String(row[3] ?? ""),
    detail: String(row[4] ?? ""),
    exceptionType: row[5] == null ? null : String(row[5]),
    exceptionMessage: row[6] == null ? null : String(row[6]),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run --config tests/config/vitest.config.ts tests/unit/analytics/session-triage-queries.test.ts
```
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(analytics): add cross-user session triage HogQL builders" -- src/lib/server/analytics/session-triage-queries.ts tests/unit/analytics/session-triage-queries.test.ts
```

---

## Task 3: Friction scoring

Pure function. This is the judgment the whole pipeline rests on, and the weights are a first guess — the tests lock in *behavior* (each signal contributes, a Nina-shaped session wins), not exact totals, so calibration later doesn't break the suite.

**Files:**
- Create: `src/lib/server/analytics/session-friction-score.ts`
- Test: `tests/unit/analytics/session-friction-score.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/analytics/session-friction-score.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { scoreSession, resolveModule } from "$lib/server/analytics/session-friction-score";
import type { TriageSessionRow } from "$lib/server/analytics/session-triage-queries";

function row(over: Partial<TriageSessionRow> = {}): TriageSessionRow {
  return {
    sessionId: "s_test",
    uid: "u_test",
    startedAt: "2026-08-01 10:00:00",
    endedAt: "2026-08-01 10:05:00",
    durationMs: 300_000,
    eventCount: 20,
    exceptionCount: 0,
    rageClickCount: 0,
    deadClickCount: 0,
    pageviewCount: 3,
    contentActionCount: 2,
    topSegments: ["app"],
    subSegments: ["compose"],
    entryPath: "/app/compose",
    exitPath: "/app/compose",
    browser: "Chrome",
    operatingSystem: "Windows",
    deviceType: "Desktop",
    ...over,
  };
}

describe("resolveModule", () => {
  it("uses the second segment for in-app routes", () => {
    expect(resolveModule(["app"], ["compose"])).toBe("compose");
  });

  it("uses the first segment for public routes", () => {
    expect(resolveModule(["q"], [])).toBe("q");
  });

  it("returns null when there are no pageviews", () => {
    expect(resolveModule([], [])).toBeNull();
  });
});

describe("scoreSession", () => {
  it("scores a clean productive session at zero", () => {
    const s = scoreSession(row(), { isNewUser: false });
    expect(s.total).toBe(0);
    expect(s.reasons).toHaveLength(0);
  });

  it("scores exceptions", () => {
    const s = scoreSession(row({ exceptionCount: 2 }), { isNewUser: false });
    expect(s.total).toBeGreaterThan(0);
    expect(s.reasons.map((r) => r.signal)).toContain("exception");
  });

  it("scores rage clicks even with zero exceptions", () => {
    const s = scoreSession(row({ rageClickCount: 5 }), { isNewUser: false });
    expect(s.total).toBeGreaterThan(0);
    expect(s.reasons.map((r) => r.signal)).toContain("rage-click");
  });

  it("flags a module entered with no content actions", () => {
    const s = scoreSession(
      row({ contentActionCount: 0, durationMs: 120_000 }),
      { isNewUser: false }
    );
    expect(s.reasons.map((r) => r.signal)).toContain("silent-abandon");
  });

  it("does not flag silent abandon for a very short visit", () => {
    const s = scoreSession(
      row({ contentActionCount: 0, durationMs: 5_000, pageviewCount: 1 }),
      { isNewUser: false }
    );
    expect(s.reasons.map((r) => r.signal)).not.toContain("silent-abandon");
  });

  it("flags a short single-page bounce", () => {
    const s = scoreSession(
      row({ durationMs: 11_000, pageviewCount: 1, contentActionCount: 0 }),
      { isNewUser: false }
    );
    expect(s.reasons.map((r) => r.signal)).toContain("bounce");
  });

  it("weights new users up", () => {
    const base = scoreSession(row({ rageClickCount: 3 }), { isNewUser: false });
    const fresh = scoreSession(row({ rageClickCount: 3 }), { isNewUser: true });
    expect(fresh.total).toBeGreaterThan(base.total);
  });

  it("caps any single signal so one noisy session cannot dominate", () => {
    const many = scoreSession(row({ rageClickCount: 500 }), { isNewUser: false });
    const some = scoreSession(row({ rageClickCount: 4 }), { isNewUser: false });
    expect(many.total).toBeLessThan(some.total + 100);
  });

  it("ranks a Nina-shaped session above an ordinary one", () => {
    const nina = scoreSession(
      row({
        exceptionCount: 3,
        rageClickCount: 6,
        contentActionCount: 0,
        durationMs: 134_000,
        subSegments: ["tunnel"],
      }),
      { isNewUser: true }
    );
    const ordinary = scoreSession(row({ exceptionCount: 1 }), { isNewUser: false });
    expect(nina.total).toBeGreaterThan(ordinary.total);
  });

  it("explains itself — every scored signal has a human-readable reason", () => {
    const s = scoreSession(row({ exceptionCount: 1, rageClickCount: 2 }), { isNewUser: true });
    for (const r of s.reasons) {
      expect(r.detail.length).toBeGreaterThan(0);
      expect(r.points).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run --config tests/config/vitest.config.ts tests/unit/analytics/session-friction-score.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Write the scorer**

Create `src/lib/server/analytics/session-friction-score.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run --config tests/config/vitest.config.ts tests/unit/analytics/session-friction-score.test.ts
```
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(analytics): friction scoring for session triage" -- src/lib/server/analytics/session-friction-score.ts tests/unit/analytics/session-friction-score.test.ts
```

---

## Task 4: Issue register logic

Pure functions for the parts that are easy to get subtly wrong: recurrence matching, watermark advancement, and resolve-on-silence. All I/O lives in Task 6.

**Files:**
- Create: `src/lib/server/analytics/session-issue-register.ts`
- Test: `tests/unit/analytics/session-issue-register.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/analytics/session-issue-register.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  matchIssue,
  applySighting,
  shouldResolveOnSilence,
  nextWatermark,
  type SessionIssue,
  type Sighting,
} from "$lib/server/analytics/session-issue-register";

function issue(over: Partial<SessionIssue> = {}): SessionIssue {
  return {
    id: "ISS-001",
    title: "Sign-in click does nothing",
    status: "open",
    codeSite: "AccountPopover.svelte:114",
    route: "/",
    feedbackId: "FB-248",
    firstSeen: "2026-07-29T00:00:00Z",
    lastSeen: "2026-07-29T00:00:00Z",
    affectedUids: ["u_a"],
    evidence: [
      { sessionId: "s_1", uid: "u_a", occurredAt: "2026-07-29T00:00:00Z", summary: "x", replayUrl: "" },
    ],
    resolvedAt: null,
    resolvedReason: null,
    ...over,
  };
}

function sighting(over: Partial<Sighting> = {}): Sighting {
  return {
    sessionId: "s_2",
    uid: "u_b",
    occurredAt: "2026-08-02T00:00:00Z",
    summary: "4 rage clicks, bounced in 11s",
    replayUrl: "https://us.posthog.com/replay/s_2",
    codeSite: "AccountPopover.svelte:114",
    route: "/",
    ...over,
  };
}

describe("matchIssue", () => {
  it("matches on code site first", () => {
    const m = matchIssue([issue()], sighting({ route: "/somewhere-else" }));
    expect(m?.id).toBe("ISS-001");
  });

  it("falls back to route when the sighting has no code site", () => {
    const m = matchIssue([issue()], sighting({ codeSite: null }));
    expect(m?.id).toBe("ISS-001");
  });

  it("returns null for an unrelated sighting", () => {
    const m = matchIssue([issue()], sighting({ codeSite: "Other.svelte:1", route: "/browse" }));
    expect(m).toBeNull();
  });

  it("never matches a dismissed issue", () => {
    expect(matchIssue([issue({ status: "dismissed" })], sighting())).toBeNull();
  });

  it("matches a resolved issue so it can reopen", () => {
    const m = matchIssue([issue({ status: "resolved" })], sighting());
    expect(m?.id).toBe("ISS-001");
  });
});

describe("applySighting", () => {
  it("adds a new uid to affectedUids", () => {
    const out = applySighting(issue(), sighting());
    expect(out.affectedUids).toEqual(["u_a", "u_b"]);
  });

  it("does not double-count a repeat visitor", () => {
    const out = applySighting(issue(), sighting({ uid: "u_a" }));
    expect(out.affectedUids).toEqual(["u_a"]);
  });

  it("is idempotent for a session already recorded", () => {
    const once = applySighting(issue(), sighting());
    const twice = applySighting(once, sighting());
    expect(twice.evidence).toHaveLength(2);
  });

  it("advances lastSeen", () => {
    expect(applySighting(issue(), sighting()).lastSeen).toBe("2026-08-02T00:00:00Z");
  });

  it("reopens a resolved issue", () => {
    const out = applySighting(issue({ status: "resolved", resolvedAt: "2026-08-01T00:00:00Z" }), sighting());
    expect(out.status).toBe("open");
    expect(out.resolvedAt).toBeNull();
  });
});

describe("shouldResolveOnSilence", () => {
  const now = new Date("2026-08-20T00:00:00Z");

  it("resolves when quiet 14 days AND feedback completed", () => {
    expect(shouldResolveOnSilence(issue({ lastSeen: "2026-08-01T00:00:00Z" }), "completed", now)).toBe(true);
  });

  it("does NOT resolve on silence alone", () => {
    expect(shouldResolveOnSilence(issue({ lastSeen: "2026-08-01T00:00:00Z" }), "in-progress", now)).toBe(false);
  });

  it("does NOT resolve when recently seen even if feedback completed", () => {
    expect(shouldResolveOnSilence(issue({ lastSeen: "2026-08-19T00:00:00Z" }), "completed", now)).toBe(false);
  });

  it("does NOT resolve an issue with no linked feedback", () => {
    expect(shouldResolveOnSilence(issue({ lastSeen: "2026-08-01T00:00:00Z", feedbackId: null }), null, now)).toBe(false);
  });

  it("leaves an already-resolved issue alone", () => {
    expect(shouldResolveOnSilence(issue({ status: "resolved", lastSeen: "2026-08-01T00:00:00Z" }), "completed", now)).toBe(false);
  });
});

describe("nextWatermark", () => {
  it("returns the newest session start", () => {
    expect(nextWatermark("2026-08-01T00:00:00Z", ["2026-08-03T00:00:00Z", "2026-08-02T00:00:00Z"]))
      .toBe("2026-08-03T00:00:00Z");
  });

  it("never moves backwards", () => {
    expect(nextWatermark("2026-08-05T00:00:00Z", ["2026-08-02T00:00:00Z"]))
      .toBe("2026-08-05T00:00:00Z");
  });

  it("holds steady on an empty run", () => {
    expect(nextWatermark("2026-08-05T00:00:00Z", [])).toBe("2026-08-05T00:00:00Z");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run --config tests/config/vitest.config.ts tests/unit/analytics/session-issue-register.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Write the register logic**

Create `src/lib/server/analytics/session-issue-register.ts`:

```ts
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
 * Find the issue a sighting belongs to. Code site is the strong signal; route
 * is the fallback when the agent could not pin a file. Dismissed issues never
 * match — dismissing means "stop telling me about this".
 */
export function matchIssue(issues: readonly SessionIssue[], s: Sighting): SessionIssue | null {
  const candidates = issues.filter((i) => i.status !== "dismissed");

  if (s.codeSite) {
    const byCode = candidates.find((i) => i.codeSite === s.codeSite);
    if (byCode) return byCode;
  }

  const byRoute = candidates.find((i) => i.codeSite === null && i.route === s.route);
  if (byRoute) return byRoute;

  // A sighting with no code site can still join an issue on the same route.
  if (!s.codeSite) {
    const loose = candidates.find((i) => i.route === s.route);
    if (loose) return loose;
  }

  return null;
}

/** Record a sighting against an issue. Reopens it if it had been resolved. */
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run --config tests/config/vitest.config.ts tests/unit/analytics/session-issue-register.test.ts
```
Expected: PASS, 18 tests.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(analytics): session issue register logic with resolve-on-silence" -- src/lib/server/analytics/session-issue-register.ts tests/unit/analytics/session-issue-register.test.ts
```

---

## Task 5: The CLI

**Files:**
- Create: `scripts/triage-sessions.ts`
- Modify: `package.json` (add a `triage` script)

- [ ] **Step 1: Write the CLI**

Create `scripts/triage-sessions.ts`:

```ts
/**
 * Session triage CLI. Reads real user sessions from PostHog and ranks them by
 * friction so the /sessions skill can decide which to read in full.
 *
 *   npx tsx scripts/triage-sessions.ts analyze --since 2026-08-01T00:00:00Z
 *   npx tsx scripts/triage-sessions.ts analyze --days 7 --limit 20
 *   npx tsx scripts/triage-sessions.ts stats --days 30
 *   npx tsx scripts/triage-sessions.ts s_9a1c --format md
 *
 * Talks to PostHog directly with POSTHOG_PERSONAL_API_KEY. The admin API route
 * needs a Firebase admin token that a CLI does not have.
 */
import "dotenv/config";
import {
  buildTriageSessionsQuery,
  buildTriageSessionEventsQuery,
  buildFirstSeenQuery,
  parseTriageSessionRow,
  parseTriageEventRow,
  type TriageSessionRow,
} from "../src/lib/server/analytics/session-triage-queries.js";
import { scoreSession, resolveModule } from "../src/lib/server/analytics/session-friction-score.js";

const POSTHOG_API_BASE = "https://us.i.posthog.com/api";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name}. Add it to .env before running triage.`);
    process.exit(1);
  }
  return v;
}

async function hogql(query: string): Promise<unknown[][]> {
  const key = requireEnv("POSTHOG_PERSONAL_API_KEY");
  const projectId = requireEnv("POSTHOG_PROJECT_ID");

  const res = await fetch(`${POSTHOG_API_BASE}/projects/${projectId}/query/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`PostHog API error ${res.status}: ${body.slice(0, 500)}`);
    process.exit(1);
  }

  const json = (await res.json()) as { results?: unknown[][] };
  return json.results ?? [];
}

function replayUrl(sessionId: string): string {
  const projectId = process.env.POSTHOG_PROJECT_ID ?? "";
  return `https://us.posthog.com/project/${projectId}/replay/${sessionId}`;
}

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function sinceFromArgs(): string {
  const explicit = arg("--since");
  if (explicit) return explicit;
  const days = Number(arg("--days") ?? 7);
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/** ISO → the format ClickHouse's toDateTime() accepts. */
function toClickhouse(iso: string): string {
  return iso.replace("T", " ").replace(/\.\d+Z?$/, "").replace("Z", "");
}

async function analyze(): Promise<void> {
  const since = sinceFromArgs();
  const limit = Number(arg("--limit") ?? 20);
  const asJson = process.argv.includes("--json");

  const rows = (await hogql(buildTriageSessionsQuery(toClickhouse(since), 200))).map(
    parseTriageSessionRow
  );

  if (rows.length === 0) {
    if (asJson) console.log(JSON.stringify({ since, sessions: [] }, null, 2));
    else console.log(`No sessions since ${since}.`);
    return;
  }

  // Which of these users are brand new? Their first-ever event is in-window.
  const uids = [...new Set(rows.map((r) => r.uid))];
  const firstSeen = new Map<string, string>();
  for (const row of await hogql(buildFirstSeenQuery(uids))) {
    firstSeen.set(String(row[0]), String(row[1]));
  }

  const sinceCh = toClickhouse(since);
  const scored = rows
    .map((r: TriageSessionRow) => {
      const first = firstSeen.get(r.uid) ?? "";
      const isNewUser = first !== "" && first >= sinceCh;
      return { row: r, score: scoreSession(r, { isNewUser }) };
    })
    .filter((s) => s.score.total > 0)
    .sort((a, b) => b.score.total - a.score.total)
    .slice(0, limit);

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          since,
          scanned: rows.length,
          surfaced: scored.length,
          sessions: scored.map(({ row, score }) => ({
            sessionId: row.sessionId,
            uid: row.uid,
            startedAt: row.startedAt,
            durationMs: row.durationMs,
            module: resolveModule(row.topSegments, row.subSegments),
            entryPath: row.entryPath,
            exitPath: row.exitPath,
            device: `${row.browser} / ${row.operatingSystem} / ${row.deviceType}`,
            replayUrl: replayUrl(row.sessionId),
            score: score.total,
            reasons: score.reasons,
          })),
        },
        null,
        2
      )
    );
    return;
  }

  console.log(`\nPostHog · since ${since}`);
  console.log(`${rows.length} sessions scanned · ${scored.length} with friction\n`);
  console.log("SCORE  WHEN                 WHO         SESSION      SIGNALS");
  for (const { row, score } of scored) {
    const when = row.startedAt.slice(0, 16);
    const who = row.uid.slice(0, 10).padEnd(10);
    const sig = score.reasons.map((r) => r.detail).join(" · ");
    console.log(`${String(score.total).padStart(5)}  ${when}  ${who}  ${row.sessionId.slice(0, 11).padEnd(11)}  ${sig}`);
  }
  console.log("");
}

async function stats(): Promise<void> {
  const since = sinceFromArgs();
  const rows = (await hogql(buildTriageSessionsQuery(toClickhouse(since), 200))).map(
    parseTriageSessionRow
  );

  const total = rows.length;
  const withException = rows.filter((r) => r.exceptionCount > 0).length;
  const bounced = rows.filter((r) => r.durationMs < 30_000 && r.pageviewCount <= 1).length;
  const users = new Set(rows.map((r) => r.uid)).size;

  const byExitPath = new Map<string, number>();
  for (const r of rows.filter((x) => x.exceptionCount > 0)) {
    byExitPath.set(r.exitPath, (byExitPath.get(r.exitPath) ?? 0) + 1);
  }
  const worst = [...byExitPath.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  console.log(`\nSince ${since}`);
  console.log(`  sessions        ${total}`);
  console.log(`  distinct users  ${users}`);
  console.log(`  with exception  ${withException} (${total ? Math.round((withException / total) * 100) : 0}%)`);
  console.log(`  bounced         ${bounced} (${total ? Math.round((bounced / total) * 100) : 0}%)`);
  if (worst.length) {
    console.log(`\n  routes with most exception sessions:`);
    for (const [path, n] of worst) console.log(`    ${String(n).padStart(3)}  ${path}`);
  }
  console.log("");
}

async function showSession(sessionId: string): Promise<void> {
  const events = (await hogql(buildTriageSessionEventsQuery(sessionId, 500))).map(parseTriageEventRow);

  if (events.length === 0) {
    console.error(`No events for session ${sessionId}. Check the id.`);
    process.exit(1);
  }

  const start = new Date(events[0].occurredAt).getTime();
  console.log(`\n## ${sessionId}`);
  console.log(`${replayUrl(sessionId)}\n`);
  console.log("```");
  for (const e of events) {
    const offset = Math.max(0, Math.round((new Date(e.occurredAt).getTime() - start) / 1000));
    const mm = String(Math.floor(offset / 60)).padStart(2, "0");
    const ss = String(offset % 60).padStart(2, "0");
    const extra = e.exceptionMessage
      ? `${e.exceptionType ?? "Error"}: ${e.exceptionMessage}`
      : e.detail;
    console.log(`${mm}:${ss}  ${e.event.padEnd(16)} ${e.route.padEnd(24)} ${extra}`);
  }
  console.log("```\n");
}

async function main(): Promise<void> {
  const cmd = process.argv[2];
  if (!cmd || cmd === "--help") {
    console.log("Usage: tsx scripts/triage-sessions.ts <analyze|stats|SESSION_ID> [flags]");
    console.log("  analyze [--since ISO | --days N] [--limit N] [--json]");
    console.log("  stats   [--since ISO | --days N]");
    console.log("  <sessionId>");
    process.exit(0);
  }

  if (cmd === "analyze") return analyze();
  if (cmd === "stats") return stats();
  return showSession(cmd);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
```

- [ ] **Step 2: Add the npm script**

In `package.json`, alongside the other `tsx` scripts (near `"seo:measure"`), add:

```json
    "triage": "tsx scripts/triage-sessions.ts",
```

- [ ] **Step 3: Verify the help path runs with no credentials needed**

```bash
npx tsx scripts/triage-sessions.ts --help
```
Expected: the usage block, exit 0.

- [ ] **Step 4: Verify a real query against PostHog**

```bash
npx tsx scripts/triage-sessions.ts stats --days 30
```
Expected: a stats block with a non-zero session count. If it prints `Missing POSTHOG_PERSONAL_API_KEY`, the `.env` is not being loaded — check that `dotenv/config` resolved.

**This is the first real-data checkpoint. Report the actual output.** If exception rate is 0% across 30 days, that is suspicious — the `before_send` hook may be filtering more than expected, and it should be investigated before continuing.

- [ ] **Step 5: Verify analyze surfaces sessions**

```bash
npx tsx scripts/triage-sessions.ts analyze --days 30 --limit 10
```
Expected: a ranked table. Confirm none of the surfaced uids are the two admin UIDs from `hogql-shared.ts` — if any appear, the exclusion filter is not being applied and that is a blocker.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(scripts): session triage CLI with friction ranking" -- scripts/triage-sessions.ts package.json
```

---

## Task 6: Firestore issue store

**Files:**
- Create: `scripts/lib/session-issue-store.ts`

Firestore shape:
- `sessionIssues/{issueId}` — one `SessionIssue`
- `sessionTriageMeta/state` — `{ reviewedThrough, reviewedSessionIds, aliases }`

- [ ] **Step 1: Write the store**

Create `scripts/lib/session-issue-store.ts`:

```ts
/**
 * Firestore I/O for the session triage register. All judgment lives in
 * src/lib/server/analytics/session-issue-register.ts; this file only reads
 * and writes.
 */
import { initFirestore, getAdminAuth } from "./firestore-provider.js";
import type { SessionIssue } from "../../src/lib/server/analytics/session-issue-register.js";

const ISSUES = "sessionIssues";
const META_DOC = "sessionTriageMeta/state";

export interface TriageMeta {
  reviewedThrough: string;
  reviewedSessionIds: string[];
  /** uid → human-readable alias, e.g. "nina". Hand-editable. */
  aliases: Record<string, string>;
}

const DEFAULT_META: TriageMeta = {
  reviewedThrough: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  reviewedSessionIds: [],
  aliases: {},
};

/* eslint-disable @typescript-eslint/no-explicit-any */
async function db(): Promise<any> {
  const { db } = (await initFirestore()) as any;
  return db;
}

export async function loadMeta(): Promise<TriageMeta> {
  const snap = await (await db()).doc(META_DOC).get();
  if (!snap.exists) return { ...DEFAULT_META };
  return { ...DEFAULT_META, ...(snap.data() as Partial<TriageMeta>) };
}

export async function saveMeta(meta: TriageMeta): Promise<void> {
  await (await db()).doc(META_DOC).set(meta, { merge: true });
}

export async function loadIssues(): Promise<SessionIssue[]> {
  const snap = await (await db()).collection(ISSUES).get();
  return snap.docs.map((d: any) => ({ ...(d.data() as SessionIssue), id: d.id }));
}

export async function saveIssue(issue: SessionIssue): Promise<void> {
  const { id, ...rest } = issue;
  await (await db()).collection(ISSUES).doc(id).set(rest, { merge: true });
}

/** Next sequential id, e.g. ISS-004. */
export async function nextIssueId(): Promise<string> {
  const issues = await loadIssues();
  const max = issues.reduce((m, i) => {
    const n = Number(i.id.replace("ISS-", ""));
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `ISS-${String(max + 1).padStart(3, "0")}`;
}

/**
 * uid → display name via Firebase Auth, falling back to a stable coined alias
 * for guests. Never stores email.
 */
export async function resolveDisplayNames(
  uids: readonly string[],
  aliases: Record<string, string>
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const auth = await getAdminAuth();

  for (const uid of uids) {
    if (aliases[uid]) {
      out[uid] = aliases[uid];
      continue;
    }
    let name: string | null = null;
    if (auth) {
      try {
        const rec = await (auth as any).getUser(uid);
        name = rec.displayName ?? null;
      } catch {
        name = null; // guest or deleted account
      }
    }
    out[uid] = name ?? `guest-${uid.slice(0, 4).toLowerCase()}`;
  }
  return out;
}
```

- [ ] **Step 2: Verify it reads without crashing on an empty collection**

```bash
TKA_ADMIN=1 npx tsx -e "import('./scripts/lib/session-issue-store.ts').then(async m => { console.log('meta', await m.loadMeta()); console.log('issues', (await m.loadIssues()).length); console.log('nextId', await m.nextIssueId()); })"
```
Expected: a default meta object, `issues 0`, `nextId ISS-001`. Requires `serviceAccountKey.json` in the repo root.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(scripts): Firestore store for the session issue register" -- scripts/lib/session-issue-store.ts
```

---

## Task 7: The `/sessions` skill

**Files:**
- Create: `.claude/skills/sessions/SKILL.md`

- [ ] **Step 1: Write the skill**

Create `.claude/skills/sessions/SKILL.md`:

````markdown
---
description: Use when reviewing real user sessions for bugs and friction patterns, or when the user says /sessions
argument-hint: "[analyze|stats|<session-id>]"
---

# User Session Triage

**Args:** `$ARGUMENTS`

Reviews real user sessions from PostHog, clusters recurring problems into the
Firestore `sessionIssues` register, and files feedback items for the ones worth
fixing. Ranks by **distinct users affected**, not severity.

---

## Workflow (default, no args)

### 1. Read the watermark

```bash
TKA_ADMIN=1 npx tsx -e "import('./scripts/lib/session-issue-store.ts').then(async m => console.log((await m.loadMeta()).reviewedThrough))"
```

### 2. Analyze everything since

```bash
npx tsx scripts/triage-sessions.ts analyze --since <watermark> --limit 20 --json
```

Skip any session already in `reviewedSessionIds`.

### 3. Read the top sessions

For each of the top-ranked sessions:

```bash
npx tsx scripts/triage-sessions.ts <sessionId>
```

Read the event stream. Decide what actually went wrong. Name the code site if
you can find it — grep the route and the exception message against the codebase.
A code site is what makes recurrence matching reliable, so spend the effort.

### 4. Cluster

Load the existing register and match each finding:

- Same code site → recurrence. Append evidence, extend `affectedUids`.
- No match → new issue. Give it a title describing the USER's experience
  ("Sign-in click does nothing, silently"), not the stack trace.
- Fewer than 2 users and no code site → `status: "watching"`. Do not file
  feedback for these.

Use `matchIssue` and `applySighting` from
`src/lib/server/analytics/session-issue-register.ts`. Do not reimplement the
matching rules.

### 5. Resolve-on-silence

For each open issue with a linked feedback item, check the feedback status:

```bash
node scripts/fetch-feedback.js <feedbackId>
```

Apply `shouldResolveOnSilence`. It resolves ONLY when quiet 14+ days AND the
feedback is `completed`. Silence alone never resolves anything.

### 6. Write the register

Save issues, then advance the watermark LAST via `nextWatermark` — if a write
fails partway, a stale watermark means the next run re-reads rather than skips.

### 7. Report

Three tiers, ordered by distinct users affected:

```
## Session Triage · <N> sessions since <date>

### Needs a decision
[issue · N users / M sessions · code site · feedback status]

### Closed this run
[resolved-on-silence, with both dates as evidence]

### Watching
[single-sighting patterns, no action]
```

### 8. File feedback — ASK FIRST

Never file without confirmation; this writes to the shared feedback queue.

```bash
node scripts/fetch-feedback.js add \
  --title "<user-facing title>" \
  --description "<what happens, N users affected, session ids, code site>" \
  --type bug --priority <low|medium|high> --module <module> --user austen
```

Write the returned id back to the issue's `feedbackId`.

---

## For `stats`

```bash
npx tsx scripts/triage-sessions.ts stats --days 30
```

Report the numbers and flag anything anomalous. Do not update the register.

## For `<session-id>`

```bash
npx tsx scripts/triage-sessions.ts <session-id>
```

Read it in detail. Do not update the register unless asked.

---

## Rules

- **Never invent a code site.** If you cannot find it by grepping, leave it
  `null` and let route matching handle it. A wrong code site poisons recurrence
  matching for every future run.
- **Never file feedback without confirmation.**
- **Never resolve on silence alone.**
- Watch for the same uid appearing across many issues — that is one frustrated
  user, not N independent problems.
- The score is a candidate finder. Reading the event stream is what decides
  whether something is real.
````

- [ ] **Step 2: Verify the skill is discoverable**

```bash
ls .claude/skills/sessions/SKILL.md && head -4 .claude/skills/sessions/SKILL.md
```
Expected: the frontmatter block with `description:`.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(skills): /sessions triage workflow" -- .claude/skills/sessions/SKILL.md
```

---

## Task 8: Admin Triage tab

Visual layout comes from `static/sketches/2026-08-04-session-triage-report.html`. Read that file before writing the components — it already solves the 4K band, the root ramp, and the mobile table.

**Files:**
- Create: `src/lib/features/admin/components/triage/SightingSparkline.svelte`
- Create: `src/lib/features/admin/components/triage/IssueCard.svelte`
- Create: `src/lib/features/admin/components/triage/TriagePanel.svelte`
- Modify: `src/lib/shared/navigation/config/tab-definitions.ts`
- Modify: `src/lib/features/admin/components/AdminDashboard.svelte`

- [ ] **Step 1: Add the tab definition**

In `src/lib/shared/navigation/config/tab-definitions.ts`, append to the admin tab array (after the `analytics` entry):

```ts
  {
    id: "triage",
    labelKey: "tab_admin_triage",
    descKey: "tab_desc_admin_triage",
    label: "Triage",
    icon: '<i class="fas fa-user-injured" aria-hidden="true"></i>',
    description: "Recurring issues found in real user sessions",
    color: "#e11d48",
    gradient: "linear-gradient(135deg, #fb7185 0%, #e11d48 100%)",
  },
```

- [ ] **Step 2: Build the sparkline**

Create `src/lib/features/admin/components/triage/SightingSparkline.svelte`:

```svelte
<script lang="ts">
  /** Per-day sighting counts for the last N days. Empty days render as a stub. */
  let { occurredAts, days = 14 }: { occurredAts: string[]; days?: number } = $props();

  const buckets = $derived.by(() => {
    const out = new Array(days).fill(0);
    const now = Date.now();
    for (const iso of occurredAts) {
      const age = Math.floor((now - new Date(iso).getTime()) / 86_400_000);
      if (age >= 0 && age < days) out[days - 1 - age] += 1;
    }
    return out;
  });

  const peak = $derived(Math.max(1, ...buckets));
</script>

<div class="spark" role="img" aria-label={`${occurredAts.length} sightings over ${days} days`}>
  {#each buckets as n}
    <i class:zero={n === 0} style:height={`${n === 0 ? 6 : Math.round((n / peak) * 100)}%`}></i>
  {/each}
</div>
<div class="spark-label">sightings / day</div>

<style>
  .spark { display: flex; align-items: flex-end; gap: 3px; height: 2.6rem; }
  .spark i {
    display: block; width: 0.5rem; border-radius: 2px 2px 0 0;
    background: color-mix(in srgb, var(--semantic-danger, #ef4444) 70%, transparent);
  }
  .spark i.zero { background: var(--theme-border, #262b34); }
  .spark-label {
    font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.07em;
    color: var(--theme-text-tertiary, #6d7787); font-weight: 700; margin-top: 0.35rem;
  }
</style>
```

- [ ] **Step 3: Build the issue card**

Create `src/lib/features/admin/components/triage/IssueCard.svelte`:

```svelte
<script lang="ts">
  import type { SessionIssue } from "$lib/server/analytics/session-issue-register";
  import SightingSparkline from "./SightingSparkline.svelte";

  let {
    issue,
    names,
    onStatusChange,
  }: {
    issue: SessionIssue;
    names: Record<string, string>;
    onStatusChange: (id: string, status: SessionIssue["status"]) => void;
  } = $props();

  const userCount = $derived(issue.affectedUids.length);
  const tone = $derived(userCount >= 4 ? "hot" : userCount >= 2 ? "mid" : "low");
  const sightingDates = $derived(issue.evidence.map((e) => e.occurredAt));
</script>

<article class="issue" class:top={tone === "hot"}>
  <div class="head">
    <div class="impact {tone}">
      <div class="n">{userCount}</div>
      <div class="l">{userCount === 1 ? "user" : "users"}</div>
    </div>

    <div class="title">
      <h3>{issue.title}</h3>
      <div class="meta">
        {#if issue.status === "resolved"}
          <span class="pill done">✓ resolved on silence</span>
        {/if}
        {#if issue.feedbackId}
          <span class="pill fb">{issue.feedbackId}</span>
        {/if}
        {#if issue.codeSite}
          <span class="pill code">{issue.codeSite}</span>
        {/if}
        <span class="pill">{issue.evidence.length} sessions</span>
        <span class="pill">first {issue.firstSeen.slice(0, 10)}</span>
      </div>
    </div>

    <div class="spark-wrap">
      <SightingSparkline occurredAts={sightingDates} />
    </div>
  </div>

  <div class="who">
    {#each issue.affectedUids as uid}
      <span class="face">{names[uid] ?? uid.slice(0, 8)}</span>
    {/each}
  </div>

  <details>
    <summary>{issue.evidence.length} sessions of evidence</summary>
    <div class="table-scroll">
      <table>
        <thead>
          <tr><th>When</th><th>Who</th><th>Session</th><th>What happened</th><th></th></tr>
        </thead>
        <tbody>
          {#each issue.evidence as e}
            <tr>
              <td class="when">{e.occurredAt.slice(0, 10)}</td>
              <td>{names[e.uid] ?? e.uid.slice(0, 8)}</td>
              <td class="sid">{e.sessionId.slice(0, 12)}</td>
              <td>{e.summary}</td>
              <td>
                {#if e.replayUrl}
                  <a class="replay" href={e.replayUrl} target="_blank" rel="noreferrer">▶ Replay</a>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </details>

  <div class="actions">
    {#if issue.status !== "dismissed"}
      <button type="button" onclick={() => onStatusChange(issue.id, "dismissed")}>Dismiss</button>
    {/if}
    {#if issue.status === "watching"}
      <button type="button" onclick={() => onStatusChange(issue.id, "open")}>Promote to open</button>
    {/if}
  </div>
</article>

<style>
  .issue {
    background: var(--theme-surface, #15181e);
    border: 1px solid var(--theme-border, #262b34);
    border-radius: 14px; margin-bottom: 1.1rem; overflow: hidden;
  }
  .issue.top { border-color: color-mix(in srgb, var(--semantic-danger, #ef4444) 45%, var(--theme-border, #262b34)); }

  .head { display: grid; grid-template-columns: 4.5rem 1fr auto; gap: 1.25rem; align-items: center; padding: 1.25rem 1.4rem; }
  @media (max-width: 760px) { .head { grid-template-columns: 1fr; gap: 0.9rem; } }

  .impact { text-align: center; }
  .impact .n { font-size: 2.4rem; font-weight: 680; line-height: 1; font-variant-numeric: tabular-nums; }
  .impact.hot .n { color: var(--semantic-danger, #ef4444); }
  .impact.mid .n { color: var(--semantic-warning, #f0a93c); }
  .impact.low .n { color: var(--theme-text-tertiary, #6d7787); }
  .impact .l { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--theme-text-tertiary, #6d7787); font-weight: 700; }

  h3 { margin: 0 0 0.4rem; font-size: 1.12rem; font-weight: 620; }
  .meta { display: flex; flex-wrap: wrap; gap: 0.45rem; }
  .pill {
    font-size: 0.78rem; font-weight: 600; padding: 0.22rem 0.6rem; border-radius: 999px;
    background: var(--theme-surface-raised, #222731); color: var(--theme-text-secondary, #a3acba); white-space: nowrap;
  }
  .pill.code { font-family: ui-monospace, monospace; font-size: 0.74rem; }
  .pill.fb { background: color-mix(in srgb, var(--semantic-info, #6b93ff) 14%, transparent); color: var(--semantic-info, #6b93ff); }
  .pill.done { background: color-mix(in srgb, var(--semantic-success, #4fc794) 15%, transparent); color: var(--semantic-success, #4fc794); }

  .who { display: flex; flex-wrap: wrap; gap: 0.4rem; padding: 0 1.4rem 1.15rem; }
  .face {
    background: var(--theme-surface-raised, #1a1e25); border: 1px solid var(--theme-border, #262b34);
    padding: 0.3rem 0.65rem; border-radius: 999px; font-size: 0.84rem; font-weight: 550;
  }

  details { border-top: 1px solid var(--theme-border, #262b34); }
  summary { cursor: pointer; padding: 0.8rem 1.4rem; font-size: 0.85rem; font-weight: 600; min-height: 44px; }
  /* The evidence table is the one thing too wide for a phone — it scrolls
     inside itself so the page body never scrolls horizontally. */
  .table-scroll { overflow-x: auto; }
  table { width: 100%; min-width: 32rem; border-collapse: collapse; font-size: 0.85rem; }
  th { text-align: left; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--theme-text-tertiary, #6d7787); padding: 0.5rem 1.4rem; }
  td { padding: 0.62rem 1.4rem; border-top: 1px solid var(--theme-border, #262b34); }
  .when { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .sid { font-family: ui-monospace, monospace; font-size: 0.78rem; color: var(--theme-text-tertiary, #6d7787); }

  .replay, .actions button {
    display: inline-flex; align-items: center; min-height: 44px; padding: 0.32rem 0.7rem;
    border-radius: 8px; border: 1px solid var(--theme-border, #262b34);
    background: var(--theme-surface, #15181e); color: var(--theme-text, #eef1f5);
    font-size: 0.78rem; font-weight: 600; text-decoration: none; cursor: pointer;
  }
  .actions { display: flex; gap: 0.5rem; padding: 0 1.4rem 1.2rem; }
</style>
```

- [ ] **Step 4: Build the panel**

Create `src/lib/features/admin/components/triage/TriagePanel.svelte`:

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import type { SessionIssue } from "$lib/server/analytics/session-issue-register";
  import IssueCard from "./IssueCard.svelte";
  import { collection, doc, getDocs, getFirestore, setDoc } from "firebase/firestore";

  let issues = $state<SessionIssue[]>([]);
  let names = $state<Record<string, string>>({});
  let reviewedThrough = $state<string | null>(null);
  let loading = $state(true);
  let loadError = $state<string | null>(null);

  const byUsers = (a: SessionIssue, b: SessionIssue) => b.affectedUids.length - a.affectedUids.length;
  const open = $derived(issues.filter((i) => i.status === "open").sort(byUsers));
  const resolved = $derived(issues.filter((i) => i.status === "resolved").sort(byUsers));
  const watching = $derived(issues.filter((i) => i.status === "watching").sort(byUsers));

  const staleDays = $derived(
    reviewedThrough
      ? Math.floor((Date.now() - new Date(reviewedThrough).getTime()) / 86_400_000)
      : null
  );

  const totalUsers = $derived(new Set(issues.flatMap((i) => i.affectedUids)).size);

  onMount(async () => {
    try {
      const db = getFirestore();
      const snap = await getDocs(collection(db, "sessionIssues"));
      issues = snap.docs.map((d) => ({ ...(d.data() as SessionIssue), id: d.id }));

      const metaSnap = await getDocs(collection(db, "sessionTriageMeta"));
      const state = metaSnap.docs.find((d) => d.id === "state")?.data() as
        | { reviewedThrough?: string; aliases?: Record<string, string> }
        | undefined;
      reviewedThrough = state?.reviewedThrough ?? null;
      names = state?.aliases ?? {};
    } catch (err) {
      loadError = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  });

  async function onStatusChange(id: string, status: SessionIssue["status"]) {
    const previous = issues;
    issues = issues.map((i) => (i.id === id ? { ...i, status } : i));
    try {
      await setDoc(doc(getFirestore(), "sessionIssues", id), { status }, { merge: true });
    } catch {
      issues = previous; // roll back a failed write rather than lying about it
    }
  }
</script>

<div class="triage">
  {#if loading}
    <p class="state">Loading triage register…</p>
  {:else if loadError}
    <p class="state error">Could not load the register: {loadError}</p>
  {:else}
    <header>
      <div>
        <h2>Session Triage</h2>
        <p class="sub">{issues.length} tracked issues · {totalUsers} users affected</p>
      </div>
      {#if staleDays !== null}
        <span class="stale" class:warn={staleDays > 7}>
          last triaged {staleDays === 0 ? "today" : `${staleDays}d ago`}
        </span>
      {:else}
        <span class="stale warn">never triaged — run /sessions</span>
      {/if}
    </header>

    {#if issues.length === 0}
      <p class="state">
        Nothing tracked yet. Run <code>/sessions</code> to triage recent user sessions.
      </p>
    {:else}
      {#if open.length}
        <h3 class="sec">Needs a decision <span>ranked by distinct users affected</span></h3>
        {#each open as issue (issue.id)}
          <IssueCard {issue} {names} {onStatusChange} />
        {/each}
      {/if}

      {#if resolved.length}
        <h3 class="sec">Closed <span>fix landed, signal stopped</span></h3>
        {#each resolved as issue (issue.id)}
          <IssueCard {issue} {names} {onStatusChange} />
        {/each}
      {/if}

      {#if watching.length}
        <h3 class="sec">Watching <span>not enough signal to act on yet</span></h3>
        {#each watching as issue (issue.id)}
          <IssueCard {issue} {names} {onStatusChange} />
        {/each}
      {/if}
    {/if}
  {/if}
</div>

<style>
  .triage { padding: 1.5rem 0 4rem; }
  header { display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-end; justify-content: space-between; margin-bottom: 1.5rem; }
  h2 { margin: 0 0 0.25rem; font-size: 1.6rem; font-weight: 650; letter-spacing: -0.02em; }
  .sub { margin: 0; color: var(--theme-text-secondary, #a3acba); font-size: 0.95rem; }
  .stale {
    font-size: 0.8rem; font-weight: 600; padding: 0.4rem 0.75rem; border-radius: 999px;
    background: var(--theme-surface-raised, #222731); color: var(--theme-text-secondary, #a3acba);
  }
  .stale.warn {
    background: color-mix(in srgb, var(--semantic-warning, #f0a93c) 14%, transparent);
    color: var(--semantic-warning, #f0a93c);
  }
  .sec { display: flex; align-items: baseline; gap: 0.75rem; margin: 2rem 0 1rem; font-size: 1.05rem; font-weight: 650; }
  .sec span { color: var(--theme-text-tertiary, #6d7787); font-size: 0.85rem; font-weight: 400; }
  .state { color: var(--theme-text-secondary, #a3acba); padding: 2rem 0; }
  .state.error { color: var(--semantic-danger, #ef4444); }
</style>
```

- [ ] **Step 5: Wire the lazy load into AdminDashboard**

In `src/lib/features/admin/components/AdminDashboard.svelte`:

Add alongside the other lazy-load declarations:

```ts
  let TriagePanel: typeof import("./triage/TriagePanel.svelte").default | null = $state(null);
  let triageError = $state(false);

  function loadTriage() {
    triageError = false;
    import("./triage/TriagePanel.svelte")
      .then((mod) => {
        TriagePanel = mod.default;
      })
      .catch((err) => {
        console.error("Failed to load Triage Panel:", err);
        triageError = true;
      });
  }
```

Add to the existing `$effect`:

```ts
    if (activeSection === "triage" && !TriagePanel && !triageError) {
      loadTriage();
    }
```

Add the panel, following the same markup shape as the `seo` panel:

```svelte
        <div id="triage-panel" role="tabpanel" aria-labelledby="triage-tab">
          {#if activeSection === "triage"}
            {#if TriagePanel}
              <TriagePanel />
            {:else if triageError}
              <p>Failed to load the Triage panel.</p>
            {:else}
              <p>Loading triage…</p>
            {/if}
          {/if}
        </div>
```

Match the surrounding `{#if activeSection === ...}` structure exactly — read lines 110–225 before editing.

- [ ] **Step 6: Type check**

```bash
npm run check > /tmp/check.log 2>&1; grep -niE "triage|error" /tmp/check.log | head -20
```
Expected: no errors mentioning `triage`. Fix any that appear.

- [ ] **Step 7: Seed one fake issue so the tab has something to render**

```bash
TKA_ADMIN=1 npx tsx -e "
import('./scripts/lib/session-issue-store.ts').then(async m => {
  await m.saveIssue({
    id: 'ISS-001', title: 'Sample issue — delete me', status: 'open',
    codeSite: 'AccountPopover.svelte:114', route: '/', feedbackId: null,
    firstSeen: new Date(Date.now()-6*864e5).toISOString(),
    lastSeen: new Date().toISOString(),
    affectedUids: ['u_aaa','u_bbb','u_ccc','u_ddd'],
    evidence: [
      { sessionId:'s_1', uid:'u_aaa', occurredAt:new Date(Date.now()-6*864e5).toISOString(), summary:'4 rage clicks, bounced in 11s', replayUrl:'' },
      { sessionId:'s_2', uid:'u_bbb', occurredAt:new Date(Date.now()-2*864e5).toISOString(), summary:'3 rage clicks, bounced in 14s', replayUrl:'' }
    ],
    resolvedAt: null, resolvedReason: null
  });
  console.log('seeded');
});
"
```

- [ ] **Step 8: Visual verification — REQUIRED**

Per `.claude/rules/visual-verification-mandatory.md`, this is a new surface. Do not skip and do not ask permission.

```powershell
pwsh -NoProfile -File scripts/launch-chrome-debug.ps1 -Url about:blank
```

Open `https://localhost:5173/admin` in a background page, sign in as admin if needed, select the Triage tab, then screenshot at every viewport below.

**Note:** DevTools `emulate` under-reports by roughly 10% on this machine (memory: `reference_devtools_emulate_dpr`). Multiply each target by 1.1 and verify `innerWidth` with `evaluate_script` before trusting a frame.

| Target | Pass to `emulate` |
|---|---|
| 1920 × 1080 | `2112x1188x1` |
| 2560 × 1440 | `2816x1584x1` |
| 3840 × 2160 | `4224x2376x1` |
| 1440 × 900 | `1584x990x1` |
| 820 × 1180 | `902x1298x1` |
| 960 × 412 | `1056x453x1` |
| 375 × 667 | `413x734x1` |

Use `format: "webp", quality: 70`. At each width check: no control absurdly wide, no dead space, no orphan rows, no horizontal body scroll, sparkline legible.

Also run this measurement pass — it catches the class of bug that shipped a 1765px button:

```js
() => ({
  css: innerWidth,
  scrollWidth: document.documentElement.scrollWidth,
  widestControl: Math.max(...[...document.querySelectorAll('button, .pill, .replay')]
    .map(e => e.getBoundingClientRect().width))
})
```
`scrollWidth` must not exceed `css`. `widestControl` must stay well under half the viewport.

Clear emulation and close only the page you opened. Never close the shared browser.

- [ ] **Step 9: Delete the seeded sample issue**

```bash
TKA_ADMIN=1 npx tsx -e "import('./scripts/lib/firestore-provider.js').then(async m => { const {db} = await m.initFirestore(); await db.collection('sessionIssues').doc('ISS-001').delete(); console.log('deleted'); })"
```

- [ ] **Step 10: Commit**

```bash
git commit -m "feat(admin): session triage tab" -- src/lib/features/admin/components/triage/ src/lib/features/admin/components/AdminDashboard.svelte src/lib/shared/navigation/config/tab-definitions.ts
```

---

## Task 9: First real run and calibration

- [ ] **Step 1: Run the full triage**

Invoke `/sessions` and let it work end to end against real data.

- [ ] **Step 2: Assess the ranking honestly**

Report to Austen:
- How many sessions scanned, how many surfaced
- Whether the top-ranked sessions were actually worth reading
- False positives (surfaced, nothing wrong) and near-misses
- Whether any admin/dev sessions leaked past the filter (a blocker if so)

- [ ] **Step 3: Adjust weights if warranted**

Edit `WEIGHTS` in `session-friction-score.ts`. The behavior tests should still
pass — if a weight change breaks one, the change probably went too far.

```bash
npx vitest run --config tests/config/vitest.config.ts tests/unit/analytics/
```

- [ ] **Step 4: Delete the mockup**

The sketch has served its purpose once the tab exists:

```bash
git rm static/sketches/2026-08-04-session-triage-report.html
git commit -m "chore(sketch): remove session triage mockup, superseded by the admin tab" -- static/sketches/2026-08-04-session-triage-report.html
```

- [ ] **Step 5: Commit any calibration**

```bash
git commit -m "tune(analytics): calibrate friction weights against real sessions" -- src/lib/server/analytics/session-friction-score.ts
```

---

## Self-review notes

**Spec coverage:** shared query module (T1–2), route type — see gap below, CLI (T5), friction ranking (T3), `sessionIssues` + meta (T4, T6), skill (T7), tab (T8), staleness banner (T8 step 4), resolve-on-silence (T4), identity/aliases (T6), error handling (T5), testing (T1–4), build order (task order), calibration (T9).

**One deliberate deviation from the spec.** The spec lists a `triage-sessions` type on `/api/admin/analytics`. It is not in this plan. Nothing consumes it: the CLI hits PostHog directly, and the tab reads Firestore, not PostHog. Adding an endpoint with no caller is dead code. If the tab later needs live unreviewed-session counts, add it then — the query builders are already extracted and importable, which was the real reason to do Task 1.

**Known risk — `$dead_click`.** Autocapture is enabled, but `$dead_click` specifically depends on PostHog's dead-click detection being on for the project. If Task 5 Step 5 shows zero dead-click sessions across 30 days, the signal is unavailable; drop that weight rather than leaving a dead input. `$rageclick` and `$exception` are confirmed present in existing queries.

**Known risk — `CONTENT_ACTION_EVENTS`.** Carried over from the route's existing list. Only `collection_create` and `sequence_autosaved` were confirmed by grep; the others may never fire, which would make silent-abandon over-trigger. Verify against real data in Task 9 and trim the list.
