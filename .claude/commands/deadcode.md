---
description: Find and remove unused code from the codebase
allowed-tools: Bash Read Edit Write Glob Grep Task TodoWrite
argument-hint: "[scope | --list | --claims | --stats]"
---

# Dead Code Detection

## Run

```bash
node scripts/find-deadcode.cjs --auto-claim
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
node scripts/find-deadcode.cjs --auto-claim

# Claim specific scope
node scripts/find-deadcode.cjs --claim features/compose

# List all scopes with status
node scripts/find-deadcode.cjs --list

# Show active claims
node scripts/find-deadcode.cjs --claims

# Show summary stats
node scripts/find-deadcode.cjs --stats

# Release a scope
node scripts/find-deadcode.cjs --release features/compose

# Mark item as false positive (won't appear again)
node scripts/find-deadcode.cjs --false-positive "path/to/file.ts"
```
