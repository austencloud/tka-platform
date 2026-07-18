---
description: Use when the user wants other sessions' or machines' work pulled into this checkout — "pull my changes", "do a full pull", "check again, they pushed", "get the .vscode changes from main", "sync up", "merge to 5173". Fetches and integrates safely across parallel agent sessions without clobbering anyone's in-flight work.
argument-hint: "[what to pull, e.g. 'main', '.vscode from main', or blank for full sync]"
---

# Sync This Checkout

**Args:** `$ARGUMENTS`

Austen runs many agents and machines against this repo at once. Syncing means
bringing remote work in WITHOUT disturbing the uncommitted work other live
sessions have in this same tree.

## Always start with

```bash
git fetch origin
git log HEAD..origin/<current-branch> --oneline   # what's incoming
git status --short                                 # what's dirty locally
```

Report what's incoming before touching anything. "Check again, they pushed"
means exactly this: fetch + report — then integrate if clean.

## Integrate — pick the narrowest move that satisfies the ask

| Ask | Move |
|---|---|
| Specific paths ("my .vscode changes from main") | `git checkout origin/main -- <paths>` — surgical, nothing else moves |
| Full pull, no incoming/dirty overlap | `git pull --ff-only` (merge commit only if genuinely diverged) |
| Incoming files overlap uncommitted local changes | STOP. List the exact overlapping files and ask — those edits may belong to another live session |
| "Merge to 5173" | Get the work onto the branch the primary dev server checkout is on (commit + merge/push there); HMR picks it up, no restart |

## Never

- `git stash` (multi-agent tree — stashing hides another session's work;
  standing rule `feedback_no_stash_multi_agent`)
- `git reset --hard`, `git checkout -- .`, rebase of shared history
- Resolving an overlap by discarding local edits you didn't write

## Verify after

`git status --short` + `git log --oneline -3`, and say what actually arrived.
If nothing was incoming, say that plainly — "already up to date with
origin/main as of <sha>".
