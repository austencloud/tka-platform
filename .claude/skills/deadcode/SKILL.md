---
description: Find and remove unused code from the codebase
argument-hint: "[scope | --list | --claims | --stats]"
---

# Dead Code Detection

## Run

```bash
npx -p @austencloud/code-quality ac-deadcode --auto-claim
```

## Workflow

Read `.claude/rules/deadcode-workflow.md` for complete workflow, then:

1. **Parse CLAIMED_SCOPE** from output
2. **Review each dead item** in that scope
3. **Get user confirmation** before any deletion
4. **Mark items** as deleted, deferred, or false-positive
5. **Release scope** when done

## Quick Commands

```bash
# Auto-claim next scope and start reviewing
npx -p @austencloud/code-quality ac-deadcode --auto-claim

# Claim specific scope
npx -p @austencloud/code-quality ac-deadcode --claim features/compose

# List all scopes with status
npx -p @austencloud/code-quality ac-deadcode --list

# Show active claims
npx -p @austencloud/code-quality ac-deadcode --claims

# Show summary stats
npx -p @austencloud/code-quality ac-deadcode --stats

# Release a scope
npx -p @austencloud/code-quality ac-deadcode --release features/compose

# Mark item as false positive (won't appear again)
npx -p @austencloud/code-quality ac-deadcode --false-positive "path/to/file.ts"
```
