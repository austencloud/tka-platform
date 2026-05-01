---
name: done
description: Use when completing a feedback item or logging a quick fix as done
---

# Done Command

**Args:** `$ARGUMENTS`

## Scope

For working on feedback (reading, claiming, implementing): use `/fb`. This skill only marks items done or quick-logs completed work.

## Mode Detection

- First arg is 20+ alphanumeric chars -> complete existing feedback
- First arg has spaces/is descriptive -> auto-create and complete

## Complete Existing

```bash
node scripts/fetch-feedback.js <id> completed "admin notes"
```

## Auto-Create (Quick Log)

```bash
node scripts/submit-feedback.js "Title" "Description" --type feature --module system --tab general --user austen
node scripts/fetch-feedback.js <new-id> completed "Title"
node scripts/fetch-feedback.js <new-id> internal-only true
```

Parse feedback ID from submit output to use in subsequent commands.
