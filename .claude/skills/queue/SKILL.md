---
description: Use when starting a session and needing to pick work, when asking what to work on next, when triaging or re-scoring specs, or when user says /queue
---

# Spec Queue

## Default Behavior: PICK AND GO

When invoked without arguments (`/queue`):

1. Read frontmatter from the top 5 backlog specs by score (don't read all 59)
2. Pick the #1 non-blocked spec
3. Tell the user in ONE sentence: "Top of queue: **[name]** (score [N], effort [E]) — [remaining]. Starting."
4. Read the full spec, then begin working on it

**Do NOT list the full queue.** Do NOT present options. Do NOT ask the user to choose. The whole point is the ranking already decided — just start.

If the user wants to override: they'll say so. That's cheaper than dumping 59 items.

## `/queue list` — Full Ranked View

Only when the user explicitly asks to see the queue (`/queue list`, "show me the queue", "what's in the backlog"):

1. Glob `docs/superpowers/specs/active/*.md` and `docs/superpowers/specs/backlog/*.md`
2. Read first 10 lines of each for frontmatter
3. Output the compact ranked table (see Output Format below)

## `/queue triage [spec-name]` — Re-Score a Spec

1. Read the full spec + grep git log for recent commits
2. Update frontmatter (value, effort, remaining, last_triaged)
3. If complete → `git mv` to shipped/
4. If blocked → set status: blocked + blocked_by

## Frontmatter Schema

```yaml
---
status: backlog          # active | backlog | blocked
value: 4                 # 1-5 (5 = highest)
effort: M                # XS | S | M | L | XL
score: 12                # value × effort_multiplier (precomputed)
remaining: "What's left"
blocked_by: ""           # optional
last_triaged: 2026-04-26
---
```

## Scoring

Score = `value × effort_multiplier`. Higher = better ROI.

| Effort | Multiplier |
|--------|-----------|
| XS | 5 |
| S | 4 |
| M | 3 |
| L | 2 |
| XL | 1 |

## Output Format (for `/queue list` only)

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
  Name                    Blocked By

## STALE (last_triaged >30 days)
  Name              Last Triaged    Days Ago
```

Summary line: `N active, N backlog, N blocked, N stale. Top pick: [highest-score spec]`

## How to Find the Top Spec Quickly

Specs are in `docs/superpowers/specs/backlog/`. The `score` field in frontmatter is precomputed. To find the top without reading all files:

```bash
grep -l "^score: 20" docs/superpowers/specs/backlog/*.md
```

If no score-20 hits, try 16, then 12. First match = top pick.

## Directory Layout

```
docs/superpowers/
  specs/
    shipped/    completed
    active/     in-flight (5)
    backlog/    scored and ranked (54)
    archived/   superseded/rejected/shelved (21)
  plans/
    shipped/    active/    backlog/
```
