---
name: error-boundaries
description: Use when adding error handling, try/catch blocks, or considering whether a failure path needs user-facing feedback. Enforces earned-not-defensive philosophy.
---

# Error-to-Feedback Boundaries

**Earned, not defensive.** Only add error boundaries where failures are silent, user-blocking, or proven flaky.

```typescript
import { getErrorHandler } from '$lib/shared/application/getErrorHandler';

getErrorHandler().showUserError({
  message,          // for the user
  technicalDetails, // for debugging
  context: { module, tab, action },
});
```

Full guide with candidate files: `docs/reference/error-boundaries.md`.
