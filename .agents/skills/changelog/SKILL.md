---
name: changelog
description: Use when preparing release notes or reviewing what changed since last version
---

<!-- generated from .claude by scripts/sync-codex-skills.mjs; do not edit directly -->

# Changelog Generation

## Run

```powershell
$latestTag = git tag --list "v*" --sort=-version:refname | Select-Object -First 1
if ($latestTag) {
  git log "$latestTag..HEAD" --oneline --no-merges
} else {
  git log --oneline --no-merges
}
```

## Categorize

**Include:** feat, fix, perf, UI changes
**Exclude:** refactor, chore, test, docs, ci, build

## Rewrite for Users

Transform technical messages to plain language:

- Before: `fix(shop): filter not persisting selection`
- After: `Fixed filters not saving when switching categories`

## Output Format

```
### Bug Fixes
- [plain language]

### New Features
- [plain language]

### Improvements
- [plain language]
```
