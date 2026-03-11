---
description: Use when preparing release notes or reviewing what changed since last version
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

## Scope

This generates raw changelog text. For full release packaging (version bump, GitHub release, feedback archival), use `/release` instead.

## Output Format

```
### Bug Fixes
- [plain language]

### New Features
- [plain language]

### Improvements
- [plain language]
```
