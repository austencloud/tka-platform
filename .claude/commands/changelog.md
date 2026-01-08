---
description: Generate user-friendly changelog from completed feedback items
allowed-tools: Bash Read Grep Glob WebFetch
---

# Changelog Generation

Generate a user-friendly changelog by analyzing completed feedback items and git commits.

## Step 1: Check completed feedback

First, check what feedback items are in "completed" status (ready for the next release). These represent actual resolved issues that users reported.

Read the feedback items in Firestore via the app's version service, or if that's not accessible, check git commits related to feedback fixes.

## Step 2: Get git commits since last release

```bash
git tag -l "v*" --sort=-version:refname | head -1
git log $(git tag -l "v*" --sort=-version:refname | head -1)..HEAD --oneline --no-merges 2>/dev/null || git log --oneline --no-merges -30
```

## Step 3: Cross-reference and categorize

Match feedback items with their corresponding commits where possible. Categorize as:

### User-Facing (include in changelog)

- `feat:` / `feature:` - New features users will see
- `fix:` / `bug:` - Bug fixes that affected user experience
- `perf:` - Performance improvements users will notice
- `style:` - UI/UX changes (but NOT code style changes)
- Commits mentioning UI components, user flows, or visible behavior

### Internal (exclude from user changelog, but note for dev section)

- `refactor:` - Code restructuring with no behavior change
- `chore:` - Maintenance tasks, dependencies, tooling
- `test:` - Test additions/changes
- `docs:` - Documentation updates
- `ci:` / `build:` - CI/CD and build changes
- Commits about barrel exports, imports, types, interfaces
- Backend-only changes users won't notice

## Step 4: Rewrite for users

Transform technical commit messages and feedback titles into plain language that anyone can understand:

**Before:** `fix(nav): settings tab not persisting selected state on module switch`
**After:** `Fixed settings not saving when switching between modules`

**Before:** `feat(discover): add favorites functionality to sequence cards`
**After:** `Added ability to save your favorite sequences`

**Before:** `perf(pictograph): optimize canvas rendering for large sequences`
**After:** `Improved animation performance for complex sequences`

**Feedback title:** `Can't drag cards in kanban on mobile`
**Changelog:** `Fixed drag and drop on mobile devices`

## Output Format

Present the changelog in this format:

```
## User-Facing Changelog

### Bug Fixes
- [plain language description]
- [plain language description]

### New Features
- [plain language description]

### Improvements
- [plain language description]

---

## Developer Notes (X commits)
- refactor: [original message]
- chore: [original message]
- test: [original message]
```

## Final Step

After generating, ask: "Would you like me to save these changelog entries to v{VERSION}? You can also edit individual entries before saving."

If user confirms, update the version's changelog entries in Firestore using the version state.
