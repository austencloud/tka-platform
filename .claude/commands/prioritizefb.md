---
description: Auto-prioritize unprioritized feedback
allowed-tools: Bash
---

# Prioritize Feedback

## Run

```bash
node scripts/fetch-feedback.js prioritize --json
```

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
