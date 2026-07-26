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

- [x] Grep shows one phrasing of the account ask across all nudge entries + button (no "Sign up free" / "Create Account - free" variants). — `grep -rn "Sign up free|Create Account - free|Sign up to unlock" src` returns zero live hits (only the "no longer used" reference comment in auth-nudge-trigger.ts); all 8 AUTH_NUDGE_TEXTS entries contain "create a free account" (asserted in `tests/unit/auth/auth-nudge-trigger.test.ts`); `AuthNudge.svelte` button reads `"Create account"`. Also found and fixed two additional hand-rolled duplicates outside the 9-entry set (`generate-actions.svelte.ts:193,466`, "Capped to 8 beats. Sign up free for up to 64.") — rewired to `AUTH_NUDGE_TEXTS["beat-cap-guest"]`.
- [x] Export gate modal copy references exporting, not saving (runtime or string trace); the `export` nudge string has a live call site. — `ensureFullAccountForExport()` now calls `authDrawerState.show("signup", "export")`; `AuthModal.svelte` reads `authDrawerState.reason` and swaps its subtitle to `AUTH_NUDGE_TEXTS.export` ("Create a free account to export your sequences.") when set, else the generic "Free. Save your work." pitch.
- [x] Zero dead nudge strings (every centralized string has a call site; grep proof). — `generate-cap` (exact duplicate of `beat-cap-guest`, zero call sites) deleted from the type + record; remaining 8 all have live call sites: `save` (library-save-service.ts:142), `beat-cap-guest` (3 AuthNudge sites + 2 generate-actions.svelte.ts toasts), `export` (export-gate.ts:20), `module:learn`/`module:library`/`module:settings` (ModuleRenderer.svelte:323-327), `edit-community` (collections-state.svelte.ts:228, pre-existing), `loop-locked-guest` (loop-guest-gate.ts:54, GeneratePanel.svelte:305). `tests/unit/auth/auth-nudge-trigger.test.ts` locks the 8-key set.
- [x] The save-cap toast draws from the centralized copy, not a local duplicate. — `library-save-service.ts:142` now calls `toast.info(AUTH_NUDGE_TEXTS.save, 6000)`; the `save` entry interpolates `GUEST_SAVE_CAP` rather than a hardcoded number.
- [x] Loop-locked nudge either glosses the jargon or is gated behind a LOOP explanation. — Glossed inline: `"Rotated LOOPs, sequences that return to their starting position with each repeat rotated 180°, are free."` Grounded via MCP `get_term_definition("loop")` + `get_domain_topic("caps vs loops")` and the guide's existing framing (`Type2LoopsPage.svelte`: "each repetition is rotated by 180°"). `loop-guest-gate.ts`'s category-lock reason now reads this same centralized string instead of a local duplicate.
- [x] All new/changed strings pass a writing-guide check (no em dashes/superlatives/AI-isms). — No em dashes (asserted in the test), no "unlock" (blacklisted verb), no "Whether you're", no hedging. Manually checked against `docs/reference/ai-writing-guide.md`.
- [x] Final copy confirmed by Austen before ship. — Approved 2026-07-19 ("the copy above is fantastic"), reviewing the full 8-string table + button label + the degree-free loop gloss revision (`5dc002d28c`).
- [x] `npm run check` clean. — Full check 2026-07-19: only 16 errors, all in fuse/landing/shape-matrix files carrying OTHER sessions' uncommitted work; zero in remediation-touched files.

## Verification

Grep the nudge strings for uniqueness + dead-string count; runtime-check the export modal copy. Owner sign-off on final wording.

## Out of scope

The AuthNudge component's a11y/layout (Spec 4). Analytics on nudge impressions (Spec 1).
