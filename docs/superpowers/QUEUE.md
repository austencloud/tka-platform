# Spec & Plan Queue

> **Do not read this file for queue data.** Run `/queue` or `/queue list` instead.
> Frontmatter in `specs/active/` and `specs/backlog/` is the source of truth.

## Directory Layout

```
specs/
  shipped/    completed specs (historical reference)
  active/     in-flight specs with resume points
  backlog/    scored and ranked (read frontmatter for live data)
  archived/   superseded, rejected, or deprioritized
  .claims/    lock files for parallel agent safety
plans/
  shipped/    active/    backlog/
```

## Scoring

`value (1-5) × effort_multiplier` — higher = better ROI.

| Effort | Multiplier |
|--------|-----------|
| XS | 5 |
| S | 4 |
| M | 3 |
| L | 2 |
| XL | 1 |

## Frontmatter Schema

```yaml
---
status: backlog
value: 4
effort: M
remaining: "One-line resume point"
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-04-26
---
```
