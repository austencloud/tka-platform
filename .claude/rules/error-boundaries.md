# Error-to-Feedback Boundaries

**Earned, not defensive.** Only add error boundaries where failures are silent, user-blocking, or proven flaky. Full guide with candidate files in `docs/reference/error-boundaries.md`.

Use `container.items.errorHandler.showUserError()` with message (for user), technicalDetails (for debugging), and context (module, tab, action).
