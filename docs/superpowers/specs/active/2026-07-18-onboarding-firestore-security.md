# Onboarding-Adjacent Security + Auth-Flow Hardening — Remediation Spec

**Date:** 2026-07-18
**Status:** Ready for Fable
**Severity:** P1 + P2
**Source:** 2026-07-18-onboarding-adversarial-audit.md (dimension: auth-security)
**Design surface:** Security-sensitive. Fable must confirm the exact predicate and prove no legitimate path breaks. **Requires deploy** (`firebase deploy --only firestore:rules`) — owner-gated.

## Context

The guest-first onboarding model (shipped 2026-06-19) says: guest = anonymous
uid; full-account gates use `isFullUser()`, not `isAuthenticated()` (which an
anon guest satisfies). The audit found the split applied correctly across almost
every social/messaging surface — except the collections public-publish path and
two legacy root rule blocks. An anonymous guest can currently push content to the
world-readable community feed.

## Findings covered

| id | sev | file:line | defect |
|---|---|---|---|
| anon-collection-publish | **P1** | `firestore.rules:531` | `users/{userId}/collections` isPublic write uses `isAuthenticated()`-based `isOwner()` while every sibling public surface requires `isFullUser()`. Anon guests can publish public collections. |
| legacy-root-rules-open | P2 | `firestore.rules:560` | Legacy root `/sequences` and `/collections` blocks allow any authenticated (incl. anon) write; `/sequences` is world-readable with no `isPublic` gate. No app call sites, but rules are enforced against the raw SDK. |
| email-link-auto-complete | P3 | `src/lib/shared/auth/state/auth-state.svelte.ts:347` | Email-link sign-in auto-completes on page load with no confirm step, so a corporate link-prescanner consumes the single-use `oobCode` before the human clicks; the wrong-device fallback uses `window.prompt`. |

## Requirements

1. Writing or holding a **public** collection requires `isFullUser()`. Specifically: when the write sets `isPublic == true`, or the existing resource has `isPublic == true`, require `isFullUser()`. Private, owner-only collection writes stay open to guests (consistent with "play/save is open").
2. Add the matching **client-side** gate so a guest attempting to publish gets an AuthNudge, not a silent rules rejection (cross-ref Spec 6 nudge copy). Touch `CollectionCard` / `collections-state`.
3. Legacy root `/sequences` and `/collections`: delete the blocks if truly unused, or tighten writes to `isFullUser()` and add an `isPublic` read gate to `/sequences`.
4. No regression to the shipped `isFullUser()` surfaces (publicSequences, publicHandPaths, publicSoloProps, conversations, videos, feedback, following/followers — all already correct; do not loosen them).
5. **Email-link sign-in requires an explicit confirm.** Add a "Finish signing in" interstitial so the `oobCode` is not consumed by a link-prescanner on load, and replace the wrong-device `window.prompt` with an in-page email field. (P3 — smallest item; can ship independently.)

## Recommended approach

- Mirror the exact predicate already used by `publicSequences` for consistency — read that rule and reuse its shape so the codebase has one public-write pattern.
- Prefer tightening over deleting the legacy root blocks only if a data-migration or external client still reads them; otherwise delete (grep for any non-app reader first).
- Pair every rules tightening with a client gate so the UX is an explained nudge, never a bare permission error.

## Open questions for Fable

- **Delete vs tighten** the legacy root `/sequences` `/collections` blocks — confirm nothing (old shared links, exports, external tooling) still reads them before deleting.
- **isPublic predicate shape** — confirm the resource-vs-request condition covers both "publishing now" and "already public, editing" without blocking un-publish (setting `isPublic=false` should stay allowed for the owner).

## Acceptance criteria

- [x] An anonymous guest cannot create or convert a collection to `isPublic == true` (rules unit test via the emulator, or `firebase_validate_security_rules`). — `npm run test:rules`: "an anonymous guest CANNOT create a collection with isPublic == true" + "...CANNOT convert an existing private collection to public" both pass against the live emulator.
- [x] A full user can still publish, edit, and un-publish their own collection. — `npm run test:rules`: "a full user CAN publish", "...CAN edit a collection that stays public", "...CAN un-publish" all pass.
- [x] Guest attempting to publish gets a client-side AuthNudge (not a raw rules error). — `collections-state.svelte.ts` `setPublic()` now gates on `isFullAccountUser()` before the write, toasts the existing `edit-community` copy, and opens `authDrawerState.show("signup")`.
- [x] Legacy root `/sequences` `/collections` either removed or `isFullUser()`-gated; `/sequences` no longer world-readable without an `isPublic` gate. — `/collections` deleted (zero readers/writers found); `/sequences` tightened to `isFullUser()` writes + `isPublic`/owner/admin read gate (kept, not deleted — one live reader: the admin preview debug tool). See executor report for full grep evidence.
- [x] No shipped `isFullUser()` surface was loosened (diff review). — diff touches only the 3 rule blocks named in Findings; `publicSequences`/`publicHandPaths`/`publicSoloProps`/conversations/videos/feedback/following/followers untouched.
- [x] `firebase deploy --only firestore:rules` completed (owner-authorized) — deployed 2026-07-19 by orchestrator after emulator verification; "released rules firestore.rules to cloud.firestore", compile clean (3 pre-existing warnings unchanged).
- [x] Email-link sign-in shows a "Finish signing in" confirm before consuming the code; wrong-device fallback uses an in-page field, not `window.prompt`. — `email-link-completion.ts` split into read-only detection (`isEmailLinkPending`, `getSavedEmailForSignIn`) and the code-consuming `completeEmailLinkSignIn(explicitEmail?)`, which now only runs from `EmailLinkConfirmModal.svelte`'s "Finish signing in" button click (mounted globally in `AppShellLoader.svelte`). The auto-complete-on-boot call in `auth-state.svelte.ts` and the auto-complete-on-mount fallback in `EmailLinkAuth.svelte` were both removed — those were the two unattended consumption paths. `window.prompt` deleted entirely; wrong-device path is an in-page `<input type="email">` in the modal. `grep -rn "window.prompt" src` returns zero hits (only doc-comment references). `tests/unit/auth/email-link-completion.test.ts` (10 tests) proves `signInWithEmailLink`/`linkWithCredential` are never called without a saved-or-explicit email, and that `window.prompt` is never invoked.

## Verification

Rules unit tests against the Firebase emulator (or `firebase_validate_security_rules`). Confirm both the deny (anon publish) and allow (full-user publish/unpublish) paths. Security changes are not "done" until deployed and re-verified live.

## Out of scope

Broader firestore.rules audit beyond onboarding-adjacent surfaces. Account-state hygiene (Spec 2).
