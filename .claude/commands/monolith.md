---
description: Detect monolithic files and propose decomposition
allowed-tools: Bash Read Edit Write Glob Grep Task TodoWrite
---

# Monolith Detection

## Run

```bash
set +o onecmd; npx -p @austencloud/code-quality ac-monolith --auto-claim
```

## Workflow

Read `.claude/rules/monolith-workflow.md` for complete workflow, then:

1. **Parse CLAIMED_FILE** from output
2. **Read the file** and identify responsibilities
3. **Propose decomposition** using DI service pattern
4. **Get confirmation** before proceeding
5. **Extract services** following the mandatory pattern
6. **Release claim** when done
