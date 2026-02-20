# Dead Code Workflow

## Purpose

Find and remove unused exports, unreferenced files, and abandoned code systematically. Uses feature-level scoping so multiple agents can work through the codebase without conflict.

---

## Auto-Claim (Race-Safe)

```bash
npx -p @austencloud/code-quality ac-deadcode --auto-claim
```

This atomically finds and claims the next available scope. Parse `CLAIMED_SCOPE:` from output.

---

## Scope System

Scopes are feature-level:

| Type | Examples |
|------|----------|
| Features | `features/create`, `features/feedback`, `features/compose` |
| Shared | `shared/pictograph`, `shared/animation-engine`, `shared/di` |

Each scope can only be claimed by one agent at a time. Claims expire after 2 hours.

---

## After Claiming

1. **Review each dead item** shown in the output
2. **For each item**, read the file and determine the action:
   - **DELETE** - File is truly unused, remove it
   - **DEFER** - User wants to keep it (incomplete feature, etc.)
   - **FALSE POSITIVE** - File is actually used (entry point, dynamic import, etc.)

---

## Decision Guide

### DELETE when:

- File has no imports anywhere in codebase
- Exports are not used by any other file
- File is not an entry point (route, hook, DI container)
- Not referenced in any config file

### DEFER when:

- User says "we started working on that"
- Part of an incomplete feature flagged for completion
- Has TODO comments indicating future use
- User wants to review the content first

### FALSE POSITIVE when:

- Dynamic imports (`await import(...)`)
- Entry points (routes, hooks, DI containers)
- Files referenced in configs (vite.config.ts, etc.)
- Test utilities only used by test files
- Type-only files used via `/// <reference types="..." />`

---

## Marking Decisions

After user confirms each decision:

### For DELETE:

```bash
# Delete the file
rm "src/lib/path/to/file.ts"

# Update tracker (done automatically on next scan)
```

### For FALSE POSITIVE:

```bash
npx -p @austencloud/code-quality ac-deadcode --false-positive "lib/path/to/file.ts"
```

### For DEFER:

Note it in your response, move to next item. Deferred items will appear again on future scans.

---

## Completing a Scope

After processing all items in a scope:

1. **Release the claim:**
   ```bash
   npx -p @austencloud/code-quality ac-deadcode --release features/compose
   ```

2. **Report summary:**
   - How many items reviewed
   - How many deleted
   - How many marked as false positive
   - How many deferred

---

## Commands Reference

```bash
# Start working
npx -p @austencloud/code-quality ac-deadcode --auto-claim     # Claim next scope and scan

# View status
npx -p @austencloud/code-quality ac-deadcode --list           # List all scopes
npx -p @austencloud/code-quality ac-deadcode --claims         # Show active claims
npx -p @austencloud/code-quality ac-deadcode --stats          # Show statistics

# Manual operations
npx -p @austencloud/code-quality ac-deadcode --claim <scope>  # Claim specific scope
npx -p @austencloud/code-quality ac-deadcode --release <scope> # Release a claim
npx -p @austencloud/code-quality ac-deadcode --false-positive <path> # Mark false positive
npx -p @austencloud/code-quality ac-deadcode --clear-expired  # Remove stale claims
```

---

## Detection Limitations

The script uses import scanning which may miss:

1. **Dynamic imports** - `await import("./path")` not detected
2. **String-based references** - Configs that reference paths as strings
3. **CSS/SCSS imports** - Styles imported in non-standard ways
4. **Framework magic** - SvelteKit routes, +page/+layout files (these are pre-filtered)

Always manually verify before deleting files with confidence < 80%.

---

## Multi-Agent Coordination

When running multiple `/deadcode` agents in parallel:

1. Each agent runs `--auto-claim` independently
2. Atomic locking prevents two agents claiming the same scope
3. If an agent dies mid-work, claims expire after 2 hours
4. Use `--claims` to see what other agents are working on
5. Use `--clear-expired` to clean up abandoned claims

---

## What NOT to Delete

Even if flagged as dead, never delete without checking:

- Files in `src/lib/shared/di/` - DI container registrations
- Files matching `*Container.ts` - Container configs
- Files in `src/routes/` - SvelteKit routing (pre-filtered but verify)
- Files with `// @ts-nocheck` or `/* eslint-disable */` at top - might be intentional
- Anything the user says "wait, we need that"

When in doubt, ask the user before deleting.
