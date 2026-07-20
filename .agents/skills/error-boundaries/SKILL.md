---
name: error-boundaries
description: Use when adding error handling, try/catch blocks, or considering whether a failure path needs user-facing feedback. Enforces earned-not-defensive philosophy.
---

<!-- generated from .claude by scripts/sync-codex-skills.mjs; do not edit directly -->

# Error-to-Feedback Boundaries

**Earned, not defensive.** Only add error boundaries where failures are silent, user-blocking, or proven flaky.

Use `getErrorHandler().showUserError()` with:
- `message` — for the user
- `technicalDetails` — for debugging
- `context` — `{ module, tab, action }`

Full guide with candidate files: `docs/reference/error-boundaries.md`.
