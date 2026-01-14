---
description: Claim and work on next feedback item
allowed-tools: Bash Read Edit Write Glob Grep Task
---

# Feedback Queue

**Args:** `$ARGUMENTS` (optional priority filter: low/medium/high)

## Run

```bash
node scripts/fetch-feedback.js $ARGUMENTS
```

## Workflow

Read `.claude/rules/fb-workflow.md` for complete workflow, then:

1. **Display feedback verbatim** before any analysis
2. **Triage complexity** (TRIVIAL/MEDIUM/COMPLEX)
3. **Get confirmation** before working
4. **Delegate or implement** based on triage
5. **Move to in-review** with admin notes
6. **Offer to mark complete** (don't auto-complete)
