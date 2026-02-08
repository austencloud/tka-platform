---
description: Create a new release version
---

# Release Command

## Run

```bash
node scripts/release.js --dry-run
```

## Workflow

Read `.claude/rules/release-workflow.md` for complete workflow, then:

1. **Gather changes** from both feedback AND git commits
2. **Rewrite changelog** in user-friendly language (no jargon)
3. **Show preview** to user
4. **Get confirmation** via AskUserQuestion
5. **Execute release** with your rewritten changelog
6. **Ask about pushing** to remote
