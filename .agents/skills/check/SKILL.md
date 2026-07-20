---
name: check
description: Use when TypeScript errors need analysis and fixing, or after large refactors
---

<!-- generated from .claude by scripts/sync-codex-skills.mjs; do not edit directly -->

# TypeScript Check

## Run

```powershell
npx tsc --noEmit
```

## Strategy

| Errors | Approach |
|--------|----------|
| <10 simple | Fix directly |
| 10-30 independent | 2-4 parallel subagents |
| 30-50 moderate | Parallel subagents up to the available concurrency limit |
| >50 or complex | Root-cause batches with focused verification after each batch |

## Workflow

1. Run tsc, analyze error count and types
2. Check for cascading errors (one root cause = many errors)
3. Present summary and recommended strategy
4. Get confirmation before fixing
5. Execute fixes (directly or via subagents)
