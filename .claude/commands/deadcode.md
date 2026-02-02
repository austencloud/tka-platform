---
description: Find and remove unused code from the codebase
allowed-tools: Bash Read Edit Write Glob Grep Task TodoWrite
argument-hint: "[scope | --list | --claims | --stats]"
---

# Dead Code Detection

## Run

```bash
set +o onecmd; npx -p @austencloud/code-quality ac-deadcode --auto-claim
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
set +o onecmd; npx -p @austencloud/code-quality ac-deadcode --auto-claim

# Claim specific scope
set +o onecmd; npx -p @austencloud/code-quality ac-deadcode --claim features/compose

# List all scopes with status
set +o onecmd; npx -p @austencloud/code-quality ac-deadcode --list

# Show active claims
set +o onecmd; npx -p @austencloud/code-quality ac-deadcode --claims

# Show summary stats
set +o onecmd; npx -p @austencloud/code-quality ac-deadcode --stats

# Release a scope
set +o onecmd; npx -p @austencloud/code-quality ac-deadcode --release features/compose

# Mark item as false positive (won't appear again)
set +o onecmd; npx -p @austencloud/code-quality ac-deadcode --false-positive "path/to/file.ts"
```
