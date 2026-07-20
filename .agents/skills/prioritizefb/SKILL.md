---
name: prioritizefb
description: Use when feedback items lack priority and need triage
---

<!-- generated from .claude by scripts/sync-codex-skills.mjs; do not edit directly -->

# Prioritize Feedback

## Run

```powershell
node scripts/fetch-feedback.js prioritize --json
```

## Scope

Only sets priority on items that lack one. For claiming and working on feedback, use `$fb`.

## Priority Criteria

**HIGH:** Blocks core workflows, data loss risk, crashes, auth issues
**MEDIUM:** Degrades experience, missing expected functionality, UX friction
**LOW:** Polish/cosmetic, edge cases, nice-to-haves

## Workflow

1. Fetch unprioritized items
2. Analyze each with TKA context (flow artists creating choreography)
3. Present table with recommendations
4. Get confirmation
5. Apply: `node scripts/fetch-feedback.js <id> priority <level>`
