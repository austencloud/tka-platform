# Tab Intro System (Removed)

`TabIntro.svelte` (plus its content config, `config/tab-intro-content.ts`)
was deleted 2026-07-19. It was a full-screen, per-tab introduction overlay
meant to replace the old `ModuleOnboarding.svelte` carousel, but the
migration was never carried out for any tab: it had zero mount points
anywhere in the app from the day it shipped.

## History

- `ModuleOnboarding.svelte` (the original multi-page module onboarding
  carousel) was deleted first, along with its Firestore-synced per-module
  completion storage (`markModuleOnboardingComplete`/
  `hasCompletedModuleOnboarding` + the `modules` sub-object). Commit
  `7abd31d196`.
- `TabIntro.svelte` was meant to replace it with a lighter, local-only,
  per-tab dismissal (`tabIntroSeen:${moduleId}:${tabId}` in localStorage).
  It received real feature work (focus trap, reduced motion, ghost-sizer
  layout) as recently as commit `f06d43756e`, but no tab ever adopted it.
  Confirmed by independent zero-importer greps on two separate occasions.
- Deleted 2026-07-19 (owner decision, resolving finding
  `tabintro-synced-vs-local` in
  `docs/superpowers/specs/active/2026-07-18-onboarding-dead-code-sweep.md`):
  `components/TabIntro.svelte`, `config/tab-intro-content.ts`, and the dead
  `tabIntroSeen:*` suppression logic in `tests/screenshots/capture.spec.ts`.

## What's still here

Nothing in this directory serves per-tab intros anymore. What remains
(`config/storage-keys.ts`, `services/onboarding-persister.ts`,
`services/types.ts`) is APP-WIDE onboarding completion/skip status and the
What's New "last seen version" cloud sync. Both live, both unrelated to
TabIntro. See those files' own docstrings for their current scope.

## If a tab wants an intro again

Treat this as a fresh design decision, not a resurrection of the deleted
code. Worth considering before writing anything new: a lighter one-shot
tooltip/coachmark instead of a full-screen takeover, and whether dismissal
should sync cross-device (the old TabIntro never did; it was local-only).
