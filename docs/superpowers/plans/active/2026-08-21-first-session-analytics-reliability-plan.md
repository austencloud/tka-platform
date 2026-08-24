# First-session analytics reliability implementation plan

**Goal:** Close the four silent gaps proven by the Krysten Ryan production
session while preserving guest work and current analytics taxonomy.

**Spec:** `docs/superpowers/specs/active/2026-08-21-first-session-analytics-reliability-design.md`

- [x] Synchronize display-name edits to Firebase Auth and the public user doc;
      cover retry and honest partial failure.
- [x] Add five-second Tunnel save deduplication with overlap, changed-state, and
      failure-retry coverage.
- [x] Reuse one Firebase-user-to-PostHog mapping from both the auth listener and
      same-UID `refreshUser()` path.
- [x] Finish and verify the pre-init PostHog identify queue already in flight.
- [x] Add the neutral-domain Cloudflare ingestion Worker, app host migration,
      CSP configuration, tests, and Wrangler dry-run/live verification.
- [x] Carry exact browser session context through the authenticated lifecycle
      endpoint without adding analytics fields to product documents.
- [x] Add idempotent server captures for linked upgrade, sequence save, and
      Tunnel save; remove overlapping browser completion ownership.
- [x] Make the tutorial offer decision funnel startup-safe and distinguish an
      actual prompt view from acceptance, decline, completion, or no choice.
- [x] Run focused application suites, scoped type checks, formatter/diff checks,
      and review only the files owned by this plan.
