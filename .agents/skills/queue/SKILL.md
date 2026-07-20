---
name: queue
description: Use when starting a session and needing to pick work, when asking what to work on next, when triaging or re-scoring specs, or when user says $queue
---

<!-- generated from .claude by scripts/sync-codex-skills.mjs; do not edit directly -->

# Spec Queue

## Default Behavior: PICK AND GO

When invoked without arguments (`$queue`):

1. Read frontmatter from every `.md` in `docs/superpowers/specs/backlog/` and `docs/superpowers/specs/active/` (typically ~57 files, ~3K tokens — not worth optimizing)
2. Compute score for each: `value × effort_multiplier` (see Scoring table)
3. Skip any spec where `depends_on` names a spec that isn't shipped
4. Pick the highest-scoring non-blocked spec. Break ties by effort (smaller wins)
5. Tell the user in ONE sentence: "Top of queue: **[name]** (value [V] × [effort] = [score]) — [remaining]. Starting."
6. Read the full spec and its `plan_path` (if set), then begin working

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
