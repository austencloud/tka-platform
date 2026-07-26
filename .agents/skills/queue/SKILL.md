---
name: queue
description: Use when starting a session and needing to pick work, when asking what to work on next, when triaging or re-scoring specs, or when user says $queue
---

<!-- generated from .claude by scripts/sync-codex-skills.mjs; do not edit directly -->

# Spec Queue

## Default Behavior: PICK AND GO

When invoked without arguments (`$queue`):

1. Read frontmatter from every `.md` in `docs/superpowers/specs/backlog/` and `docs/superpowers/specs/active/` (~155 files, ~4K tokens — not worth optimizing)
2. Compute score for each: `value × effort_multiplier` (see Scoring table)
3. Skip any spec where `depends_on` names a spec that isn't shipped
4. Pick the highest-scoring non-blocked spec. Break ties by effort (smaller wins)
5. **Drift-check the pick before acting on it** (see `$queue drift`). A spec that
   misreports its own state is the one failure this queue cannot absorb: acting
   on "not yet built" when the thing is already shipped means rebuilding live
   code. Run the detector on the pick; if it comes back `DIVERGENT`,
   `GHOST_PATHS`, or `LIKELY_DONE`, reconcile the spec against the repo FIRST and
   tell the user what diverged instead of starting the work it describes.
6. Tell the user in ONE sentence: "Top of queue: **[name]** (value [V] × [effort] = [score]) — [remaining]. Starting."
7. Read the full spec and its `plan_path` (if set), then begin working

**Do NOT list the full queue.** Do NOT present options. Do NOT ask the user to choose. The ranking already decided — just start.

If the user wants to override: they'll say so.

### Session Budget Awareness

At >60% context usage, prefer XS/S specs over L/XL — an XS close-out is more valuable than starting an L that can't finish this session. Mention the constraint: "Context is at ~70%, picking XS/S items."

## `$queue list` — Full Ranked View

Only when the user explicitly asks to see the queue (`$queue list`, "show me the queue", "what's in the backlog"):

1. Read frontmatter from all specs in `active/` and `backlog/`
2. Compute scores at read time (no stored `score` field)
3. Output the compact ranked table (see Output Format below)

## `$queue triage [spec-name]` — Re-Score a Spec

1. Read the full spec + grep git log for recent commits touching its deliverables
2. Update frontmatter: value, effort, remaining, last_triaged (today's date)
3. If all remaining work is done → `git mv` to `shipped/`, clear `remaining`
4. If blocked → set `depends_on` to the blocking spec path or `external: <description>`

## `$queue drift` — Detect Specs That Lie

```powershell
node scripts/spec-drift-detector.cjs                      # full report
node scripts/spec-drift-detector.cjs --quiet              # counts only
node scripts/spec-drift-detector.cjs --verdict DIVERGENT   # one bucket
node scripts/spec-drift-detector.cjs --json out.json       # machine-readable
```

Compares what each spec SAYS against what the repository DOES. Read-only; it
never edits a spec. Exit 1 when actionable drift exists.

| Verdict | Meaning | Action |
|---|---|---|
| `DIVERGENT` | claims not-built, but its own named files have heavy topical commit traffic since | **Rebuild hazard.** Reconcile before doing anything the spec says |
| `PHANTOM_OPEN` | every box in its acceptance ledger is checked, still in `active/` | Free close-out → `shipped/` |
| `LIKELY_DONE` | body declares implemented/shipped/superseded, still in `active/` | Verify, then move |
| `GHOST_PATHS` | most named deliverables were **deleted** (existed once, gone now) | Spec is describing removed code — likely superseded |
| `WATCH` | moderate topical traffic against a not-built claim | Inconclusive, glance at it |
| `NO_STATE` | no status line and no ledger | State unknowable from the file; needs a read |

**Adjudicate, don't auto-apply.** The detector shortlists; a human or agent
decides. Two known false-positive modes:

- **Homonyms.** Topic words match unrelated commits — `physical-merch-store`
  matched "SvelteKit page *store* migration", `error-boundary` matched
  "svelte-check *error*s". Check that the sample commit subjects are really
  about the spec.
- **Broad paths.** A spec naming `src/lib/features/` inherits traffic from the
  whole repo. The `N topical of M touching its paths` ratio exposes this — a low
  topical fraction with `0 on named files` is weak evidence.

Why this exists: `shop-operations-go-live` claimed "Not yet built" about a store
already taking Stripe payments, and seven onboarding specs sat "Ready for Fable"
with 45/50 ledger items done and one uncommitted command between them and closed.
Both were mechanically detectable. Hand-maintained `remaining` prose drifts
silently, and the Remaining Refresh Trigger below relies on discipline that does
not hold across many parallel agents — so detect it instead of trusting it.

## `$queue claim` — Parallel Agent Safety

When starting work on a spec, write a claim file:

```
docs/superpowers/specs/.claims/<spec-filename>.lock
```

Contents: `agent_id: <session-id>\nclaimed_at: <ISO timestamp>\ntask: <one-line description>`

Before picking a spec, check for an existing `.lock` file. If one exists and is <2 hours old, skip to the next spec. If >2 hours old, treat as stale and overwrite.

On session end or task completion, delete the lock file.

## When Done — Completion Handoff

After finishing work on a spec:

1. Run `npm run check` — must pass
2. Update the spec's `remaining` field to reflect what's left (or clear it if done)
3. If all remaining work is done:
   - `git mv` the spec to `shipped/`
   - Delete any `.claims/` lock file
   - Update `last_triaged` to today
4. If partially done:
   - Update `remaining` to describe the new resume point
   - Update `last_triaged` to today
   - Delete the `.claims/` lock file
5. Commit all changes (spec move + code) in one commit

## Frontmatter Schema

```yaml
---
status: backlog          # active | backlog
value: 4                 # 1-5 (5 = highest user impact)
effort: M                # XS | S | M | L | XL
remaining: "What's left"
depends_on: ""           # spec filename or "external: description"
plan_path: ""            # relative path to implementation plan
tags: []                 # domain tags for filtering
last_triaged: 2026-04-26
---
```

**No `score` field.** Score is computed at read time: `value × effort_multiplier`.

## Scoring

Score = `value × effort_multiplier`. Higher = better ROI.

| Effort | Multiplier | Example: value 4 |
|--------|-----------|-------------------|
| XS | 5 | 20 |
| S | 4 | 16 |
| M | 3 | 12 |
| L | 2 | 8 |
| XL | 1 | 4 |

Weights are intentionally steep: an XS task at value 3 (score 15) outranks an L task at value 4 (score 8). This matches the reality that small completable items deliver more value per session than ambitious starts.

## Output Format (for `$queue list` only)

```
## ACTIVE (N specs)
  Name                         | Remaining

## TIER 1: CLOSE-OUTS (score 16+)
  #  Score  Effort  Name                        Remaining

## TIER 2: QUICK WINS (score 12-15)
  ...

## TIER 3: STRATEGIC (score 8-11)
  ...

## TIER 4: DEFER (score <8)
  ...

## BLOCKED
  Name                    Depends On

## STALE (last_triaged >30 days)
  Name              Last Triaged    Days Ago
```

Summary line: `N active, N backlog, N blocked, N stale. Top pick: [highest-score spec]`

## New Spec Integration

When writing a new spec via brainstorming:

1. Save to `docs/superpowers/specs/backlog/YYYY-MM-DD-<topic>-design.md`
2. Include frontmatter with all schema fields
3. Set `last_triaged` to today's date
4. Compute appropriate `value` and `effort` during brainstorming
5. Set `plan_path` after the implementation plan is written

## Remaining Refresh Trigger

Update a spec's `remaining` field whenever:
- A commit touches files that are deliverables of that spec
- A `$queue triage` is run on the spec
- Work on the spec completes or pauses

The `remaining` field is the resume point for the next agent. It must be specific enough that a cold-start agent can pick up without re-reading the full spec.

## Directory Layout

```
docs/superpowers/
  specs/
    shipped/    completed
    active/     in-flight
    backlog/    scored and ranked
    archived/   superseded/rejected/shelved
    .claims/    lock files for parallel safety
  plans/
    shipped/    active/    backlog/
```
