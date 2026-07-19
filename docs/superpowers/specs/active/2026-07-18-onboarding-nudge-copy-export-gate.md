# Nudge Copy + Export-Gate Consolidation — Remediation Spec

**Date:** 2026-07-18
**Status:** Ready for Fable
**Severity:** P1 + P2/P3
**Source:** 2026-07-18-onboarding-adversarial-audit.md (dimension: copy-messaging)
**Design surface:** Copy is Austen's voice — draft to the writing guide, flag final strings for owner eye. The wiring is mechanical.

## Context

The tutorial and tab-intro copy is clean. The defects are all in the guest→account
**nudge layer**: the same "create an account" ask appears in four incompatible
phrasings, four of nine centralized nudge strings are dead while the real gates
hand-roll their own copy, the export gate opens a signup modal whose subtitle
talks about *saving* not *exporting* (its dedicated copy exists but is unused),
and a loop-locked nudge drops undefined TKA jargon at the persuasion moment. This
is the exact AuthNudge fragmentation flagged 2026-06-18, still unfixed.

## Findings covered

| id | sev | file:line | defect |
|---|---|---|---|
| authnudge-four-phrasings | **P1** | `src/lib/shared/auth/domain/auth-nudge-trigger.ts:12` | The same ask varies: "Create a free account", "Sign up free", button "Create Account - free". Prior 2026-06-18 finding, unfixed. |
| export-gate-wrong-copy | P1 | `src/lib/shared/auth/domain/export-gate.ts:18` + `auth-nudge-trigger.ts:16` | `ensureFullAccountForExport()` opens a generic signup modal whose subtitle is about saving; the dedicated `export` nudge string has zero call sites. |
| dead-nudge-strings | P2 | `auth-nudge-trigger.ts:13` + `src/lib/features/library/services/library-save-service.ts:139` | `save`/`export`/`generate-cap`/`edit-community` (4 of 9) have zero call sites while the save-cap fires its own hand-rolled toast. |
| loop-locked-jargon | P3 | `auth-nudge-trigger.ts:24` | Loop-locked-guest nudge uses "Rotated LOOPs" / "LOOP type" with zero gloss to a first-time guest. |

## Requirements

1. **One phrasing for the account ask.** Collapse to a single verb + single modifier used across all nine nudge entries and the button (e.g. one canonical "Create a free account" / button "Create account"). No variant "Sign up free" / "Create Account - free" survives.
2. **Export gate uses its own reason.** Route `ensureFullAccountForExport()` through `<AuthNudge trigger="export">` (or pass an `export` reason into `authDrawerState.show`) so the modal copy is about exporting, not saving. The dead `export` string gets a live call site or is folded into the trigger map.
3. **No dead strings, no hand-rolled duplicates.** Every centralized nudge string either has a live call site or is deleted. The save-cap toast (`library-save-service.ts:139`) either uses the centralized `generate-cap`/`save` string or the unused string is removed — one source of nudge copy.
4. **No unglossed jargon at the persuasion moment.** The loop-locked nudge either adds a one-clause gloss of "Rotated LOOP" or fires only after the user has seen a LOOP explanation.
5. **All copy passes the writing guide** (`docs/reference/ai-writing-guide.md`): no em dashes, no superlatives (seamless/revolutionary), no vague benefits, no "Whether you're…", vary sentence length, features must exist. Clickable CTAs look like buttons (`clickables-look-like-buttons.md`).

## Recommended approach

- Make `auth-nudge-trigger.ts` the single source of nudge copy; delete the local hand-rolled strings and point their call sites at it (the same consolidation pattern used for chips/crossfade primitives).
- Draft the canonical strings, then surface the final list to Austen before shipping — copy is his voice (`no-ghostwriting` applies to first-person; these are UI strings, but the value-prop wording still deserves an owner glance).

## Open questions for Fable

- **The canonical account ask.** Propose the one verb+modifier and the button label; hold for owner confirmation.
- **Loop-locked nudge timing.** Gloss inline vs gate the nudge behind a LOOP explanation — depends on where in the funnel it fires.

## Acceptance criteria

- [ ] Grep shows one phrasing of the account ask across all nudge entries + button (no "Sign up free" / "Create Account - free" variants).
- [ ] Export gate modal copy references exporting, not saving (runtime or string trace); the `export` nudge string has a live call site.
- [ ] Zero dead nudge strings (every centralized string has a call site; grep proof).
- [ ] The save-cap toast draws from the centralized copy, not a local duplicate.
- [ ] Loop-locked nudge either glosses the jargon or is gated behind a LOOP explanation.
- [ ] All new/changed strings pass a writing-guide check (no em dashes/superlatives/AI-isms).
- [ ] Final copy confirmed by Austen before ship.
- [ ] `npm run check` clean.

## Verification

Grep the nudge strings for uniqueness + dead-string count; runtime-check the export modal copy. Owner sign-off on final wording.

## Out of scope

The AuthNudge component's a11y/layout (Spec 4). Analytics on nudge impressions (Spec 1).
