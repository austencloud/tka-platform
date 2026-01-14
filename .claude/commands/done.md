---
description: Mark feedback completed or auto-create and complete
allowed-tools: Bash Read
---

# Done Command

**Args:** `$ARGUMENTS`

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
