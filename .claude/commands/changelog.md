---
description: Generate user-friendly changelog
allowed-tools: Bash Read Grep Glob
---

# Changelog Generation

## Run

```bash
git tag -l "v*" --sort=-version:refname | head -1
git log $(git tag -l "v*" --sort=-version:refname | head -1)..HEAD --oneline --no-merges
```

## Categorize

**Include:** feat, fix, perf, UI changes
**Exclude:** refactor, chore, test, docs, ci, build

## Rewrite for Users

Transform technical messages to plain language:

- Before: `fix(nav): settings tab not persisting`
- After: `Fixed settings not saving when switching modules`

## Output Format

```
### Bug Fixes
- [plain language]

### New Features
- [plain language]

### Improvements
- [plain language]
```
