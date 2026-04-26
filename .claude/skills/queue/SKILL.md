---
description: Use when starting a session and needing to pick work, when asking what to work on next, when triaging or re-scoring specs, or when user says /queue
---

# Spec Queue

Live-ranked view of all active and backlog specs. Reads YAML frontmatter from spec files, scores them, and outputs a prioritized table.

## Run

Read all specs in `docs/superpowers/specs/active/` and `docs/superpowers/specs/backlog/`. Parse YAML frontmatter from each file. Compute scores and output the ranked view below.

## Frontmatter Schema

Every active/backlog spec has this frontmatter:

```yaml
---
status: backlog          # active | backlog | blocked
value: 4                 # 1-5 (5 = highest user/product value)
effort: M                # XS | S | M | L | XL
score: 12                # value × effort_multiplier (precomputed)
remaining: "One-line description of what's left"
blocked_by: ""           # optional — physical blocker
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

## Output Format

Group specs into tiers by score, then print one table per group:

```
## ACTIVE (N specs)
  Name                         | Remaining
  sequence-viewer-redesign     | Resume Phase 2 Task 11
  ...

## TIER 1: CLOSE-OUTS (score 16+)
  #  Score  Effort  Name                        Remaining
  1  20     S       effect-state-unification     Trail path into tipEffectMap
  ...

## TIER 2: QUICK WINS (score 12-15)
  ...

## TIER 3: STRATEGIC (score 8-11)
  ...

## TIER 4: DEFER (score <8)
  ...

## BLOCKED
  Name                    Blocked By
  arrow-tip-z-promotion   Manual Illustrator workflow
  ...

## STALE (last_triaged >30 days from today)
  Name              Last Triaged    Days Ago
  ...
```

## Process

1. `Glob` for `docs/superpowers/specs/active/*.md` and `docs/superpowers/specs/backlog/*.md`
2. `Read` each file (first 10 lines is enough for frontmatter)
3. Parse the YAML between `---` markers
4. Flag files with missing or malformed frontmatter as `[NO METADATA]`
5. Separate `blocked` status specs into the BLOCKED section
6. Sort remaining by score descending, then by value descending for ties
7. Group into tiers and print
8. Check `last_triaged` — if >30 days from today, append to STALE section
9. Print summary line: `N active, N backlog, N blocked, N stale. Top pick: [highest-score spec]`

## Re-Triaging

If user asks to re-triage or update scores:

1. Read the spec's full content + check git log for recent commits touching its deliverables
2. Update frontmatter fields (`value`, `effort`, `remaining`, `last_triaged`)
3. If spec is now complete, move it to `specs/shipped/` with `git mv`
4. If spec is now blocked, set `status: blocked` and fill `blocked_by`

## Directory Layout Reference

```
docs/superpowers/
  QUEUE.md              ← snapshot (regenerate with /queue)
  specs/
    shipped/   162      ← done
    active/      5      ← in-flight
    backlog/    54      ← scored and ranked
    archived/   21      ← superseded/rejected/shelved
  plans/
    shipped/   137
    active/      4
    backlog/    46
```
