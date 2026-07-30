---
status: archived
value: 4
effort: M
remaining: "Superseded by the shipped guest-first onboarding design, which corrected this audit and records its P1 findings as shipped, plus the active first-session activation design for the remaining funnel work."
depends_on: "2026-07-22-first-session-activation-design.md"
plan_path: ""
tags: []
last_triaged: 2026-07-30
---
# First-Time User Audit — Multidimensional

> **Archived 2026-07-30:** Superseded by
> `shipped/2026-06-19-guest-first-onboarding-design.md`, the corrected concrete
> form of this audit, and
> `active/2026-07-22-first-session-activation-design.md`, which owns the
> remaining save, account-preservation, and activation work. The later shipped
> design records this audit's post-signup confirmation, landing sign-in,
> viewer recovery, and guest-tab findings as completed.

**Date:** 2026-06-18
**Method:** 5 parallel codebase scouts (entry/routing, auth/signup, guest gating, create→save funnel, analytics) + spot verification.
**Status:** Code-level findings. Items marked ⏳ need runtime confirmation (browser or DevTools drive).

> This is a code-read audit. Where a claim depends on runtime behavior it is tagged ⏳ and appears in the manual checklist below for confirmation.

---

## The 7 dimensions of the first-time experience

1. **Arrive** — landing page, deep links (`/q/[code]`, `/sequence/[id]`), public pages.
2. **Navigate (pre-signup)** — module switcher, what's open vs gated, dead-ends.
3. **Cold start** — opening Create with nothing built.
4. **Build** — first start position / first beat.
5. **Keep** — save → Dexie → Firestore → R2 thumbnail.
6. **Return** — refresh/persistence, does the work survive.
7. **Sign up in place** — guest → full account, work carries over.

---

## What works (code-verified)

- **Guest can use the app without signing up.** `/create` (Assemble/Construct/Generate) and `/browse` (Gallery) are guest-accessible (`guest-access-config.ts:7-10`). The blocking gate (`ModuleRenderer.svelte:282`) only fires for non-guest modules.
- **Anonymous identity + tracking is already live.** PostHog inits in both landing and app mode (`+layout.svelte:169,275`); `identifyUser(user.uid,...)` fires for anonymous users too (`auth-state.svelte.ts:426`). Returning guests are trackable by stable Firebase uid; anon→signup activity merges automatically.
- **Save works for guests.** `ensureGuestIdentity()` provisions an anon uid; `LibrarySaveService` is Dexie-first (always succeeds locally), Firestore + R2 thumbnail are best-effort/non-blocking.
- **R2 thumbnail accepts anonymous tokens.** Cloud function `r2PresignUrl` requires auth but anon auth satisfies it; `callerUid === userId` check passes for the guest's own path (`firebase-functions/src/r2/index.ts:152,170`). Failure is swallowed anyway (`library-save-service.ts:250`).
- **Upgrade preserves work.** `linkWith*` keeps the same uid (seamless); collision path captures guest drafts and offers import ("Keep what you just made?").
- **Feedback works for guests.** Anon users have a `user` object → can submit; attributed to uid.

---

## Broken / confusing (prioritized)

### P0 — silent work-loss or silent failure
- **Generate/Spell tabs never call `ensureGuestIdentity()`.** Only Construct does (`construct-tab-state.svelte.ts:192`). A guest who starts in Generate, builds, and saves relies on the save-path call. That call now exists (`library-save-service.ts:64`), but the beat-1 provisioning is inconsistent across tabs. ⏳ confirm a Generate-first guest save persists.
- **Generate beat-cap truncation is silent.** `generate-actions.svelte.ts:138` does `.slice(0, maxSteps)` — a guest who generates a 9-beat word silently gets 8 with no toast/explanation. Violates "no silent loss." ⏳
- **Firestore sync + library refresh failures are console-only.** If sync fails, the sequence is in Dexie but never appears in the library list; user sees nothing. ⏳ confirm saved sequence appears in Browse after refresh.

### P1 — signup clarity
- **No confirmation after a successful (non-collision) signup.** Guest signs up, drawer closes, no "your work is now saved" toast. ~90% of signups (no email collision) get zero confirmation their guest work carried over.
- **Publish gate is late-stage.** "Sign in to publish" only appears on click; not surfaced earlier.
- **No "why sign up?" framing is consistent.** AuthNudge copy varies ("free" / "sign up free" / "sign in"); value prop is scattered.
- **No explicit "continue as guest" affordance.** Guest mode is implicit (dismiss the nudge). Returning account-holders have no obvious sign-in entry from the marketing landing.

### P1 — navigation dead-ends
- **`/q/[code]` and `/sequence/[id]` have no home/back affordance.** A first-timer arriving by link is stranded (browser back only). ⏳
- **Failed deep link (deleted sequence / stale QR) has no recovery page.** ⏳ confirm what renders.
- **Blocked Create tabs / hidden Browse tabs give no explanation.** Guest clicking a non-guest tab gets silence, not "sign in to unlock." ⏳

### P2 — philosophy tension (export gating)
- **Compose/export fully blocked for guests** — "play with everything, pay to take it home" says play (incl. previewing export) should be open; the wall belongs at the actual download. This is exactly **Slice D** (export gating policy). Not a bug; a queued decision.

### Cleanup
- **`src/lib/shared/auth/components/LandingPage.svelte` is orphaned** (zero importers). Dead code; delete candidate.

---

## Strategic question: gated signup vs open guest access

The owner is weighing reverting to a mandatory-signup wall to get usage tracking + feedback.

**Evidence says the wall buys little.** Anonymous auth + PostHog already deliver: per-device returning-guest tracking, full event/click/session capture, anon→signup funnel merge, and guest-attributable feedback. The *only* things a hard wall uniquely adds:
- **Email at first touch** (re-engagement, direct reply to feedback).
- Slightly simpler cohort segmentation.

**Cost of the wall:** ~5–10% signup-abandon friction, and total loss of early-funnel behavioral data for everyone who bounces at the wall (you'd see them only at signup, not their pre-signup clicks). It also throws away the guest-continuity work just shipped.

**Recommendation: stay open.** If email becomes the real need, capture it at a *value moment* (first save-to-keep, first feedback submit, or an export) rather than a cold wall — same email, far less friction. If the owner wants to pursue any gating change, it deserves its own brainstorm (it's an architecture decision).

---

## MANUAL CHECKLIST (run signed-out, fresh browser / incognito)

Funnel order. For each: do the action, confirm expected, note PASS/FAIL.

### Arrive
- [ ] Open `http://localhost:5173/` — landing renders, hero videos play, no errors in console.
- [ ] Landing explains what TKA is (or note: value prop unclear).
- [ ] "Open Composer" → lands in `/create` Construct, no forced login.
- [ ] Visit `/about`, `/roots`, `/terms`, `/privacy` — render; note if there's a way back to the app.
- [ ] Open a valid `/q/[code]` link — sequence viewer renders; note if there's any home/back affordance.
- [ ] Open a deliberately-bad `/q/BADCODE` — note what renders (error? blank? recovery?).

### Navigate (guest)
- [ ] Module switcher: Create + Browse open; Learn/Social/Tika/Compose/etc. show AuthNudge (not blank).
- [ ] In Create, click a non-guest tab (e.g. edit/record) — note if anything explains why it's unavailable.
- [ ] In Browse, confirm only Gallery shows; note whether missing tabs are confusing.
- [ ] "Go Premium" → `/premium` — note whether benefits/price are clear.

### Cold start + Build
- [ ] Open Create with nothing built — note if there's any "start here" guidance (expected: none currently).
- [ ] Construct: pick a start position — sequence starts, no error.
- [ ] Build to 8 beats — confirm the cap nudge appears at the right point ("guests up to 8…").
- [ ] Generate tab: generate a long word (9+ beats) — **does it warn you it was clipped to 8, or silently truncate?**

### Keep (save)
- [ ] Construct a short sequence → Save. Confirm: no `[guest-identity] … unavailable` warning in console; "Saved" succeeds.
- [ ] Watch console for the R2 thumbnail upload — does it succeed with the anon token, or error? (Save should still complete either way.)
- [ ] Generate a sequence (Generate tab) → Save **without ever touching Construct**. Confirm it persists (this is the tab that doesn't pre-provision identity).

### Return (persistence)
- [ ] After saving, refresh the page. Does the sequence come back in the working area?
- [ ] Does the saved sequence appear in the library/Browse list (Firestore sync), or only locally?

### Sign up in place
- [ ] As a guest with a saved sequence, sign up (email/password). Confirm: **is there any confirmation your guest work carried over?** (expected: none currently — flag if missing.)
- [ ] Sign up with an email that already has an account → confirm the "Keep what you just made?" import dialog appears and import works.
- [ ] After signup, confirm previously-guest sequences are present.

### Sign out
- [ ] Sign out. Confirm UI returns to signed-out state cleanly.
- [ ] Refresh — confirm the (same-device) guest session restores and guest work is still there.

### Every-button sweep (per module a guest can reach)
- [ ] Create: every toolbar/option button does something or clearly indicates it's gated.
- [ ] Viewer (`/q` and `/sequence`): play/pause, effects, props, tempo, share, export buttons — each responds.
- [ ] Browse Gallery: open a card, the viewer opens; back works.

---

## Live verification + fixes (2026-06-18)

Drove the signed-out funnel via Chrome DevTools (clean isolated guest context).

**Runtime-verified:**
- Anonymous auth works in-app: guest picks a start position → anon identity provisioned (`isAnonymous: true`). The original `admin-restricted-operation` blocker is cleared end-to-end, not just at project config.
- Guest nav is correctly filtered (Create / Browse / Feedback / Sign in). The earlier "guest sees Admin/Museum" finding was the **signed-in admin** profile — retracted.
- Length-knob cap is not a bug: at the cap, "Increase Length" fires the signup nudge (`LengthCard.svelte:61`) instead of incrementing. Retracted.
- Landing has a terse value prop ("Notation for flow arts") and **no sign-in link** (returning account-holders stranded — confirmed P1, not yet fixed).

**New bugs found live + FIXED (committed, not deployed where noted):**
| Bug | Fix | Commit |
|---|---|---|
| Beta onboarding used real `<input type=checkbox>` (violates no-checkboxes) | → `<button aria-pressed>` toggle (PreferencesTab convention); verified live: 0 checkboxes in DOM | `a9a0d3492b` |
| `AdminNotifier: new signup` fired on every anon identity (denied by rules) | guard `if (!user.isAnonymous)` at `user-document-manager.ts:123`; + `notifyUpgradeSignup()` on `linkWith*` so real upgrades still notify | `6c9dd327ec` |
| `What's New` version read → permission error for guests | `versions` collection → `allow read: if true` (release notes are public). **Needs `firebase deploy --only firestore:rules`** | `56d82c88bd` |
| Word-with-bridges silently truncated to tier cap (no feedback) | tier-aware `toast.info` only when truncation occurs (`generate-actions.svelte.ts:148`) | `bfb2ae7571` |

`npm run check` → exit 0 (clean) across all four.

**Deploy pile (committed, NOT deployed):** `firestore.rules` (What's New read + slice-B `isFullUser` gates) and the stale-anon cleanup function. Needs `firebase deploy --only firestore:rules,functions` (user-authorized).

**Still deferred:** save→Firestore→library persistence runtime confirmation — blocked by a concurrent session actively editing the OptionPicker/create files (create chunk recompiles every few seconds, remounting the page mid-action). Save path is code-sound (Dexie-first lands; R2 `r2PresignUrl` accepts the anon token; Firestore best-effort under `isOwner`).

**P1 findings NOT yet fixed (next tranche):** no sign-in link on landing; no post-signup confirmation that guest work carried over; late publish gate; `/q/[code]` + `/sequence/[id]` have no home/back affordance; bad-deep-link recovery; blocked-tab silence.

## What I can automate vs what needs you

- **I can drive** the signed-out funnel (build → save → refresh → signup) via Chrome DevTools MCP and report console/network evidence — needs a Claude Code restart first (the DevTools MCP is wedged this session).
- **You confirm** the subjective items (is the value prop clear, do dead-ends feel like dead-ends, does a gated tab feel broken).

---

## Correction: slice A (guided first build) is BUILT, switched OFF

The audit scouts and I wrongly reported the guided first build missing / a cold blank grid. It exists:

- `src/lib/shared/onboarding/components/create-tutorial/CreateTutorialWizard.svelte` — 4-step guided build: **pick-start → add-beat ×4 → play-sequence → ready**. Polished shell (progress bar, step dots, back/skip, auto-advance, reduced-motion, mobile, haptics).
- Steps embed the **real** constructor components (invariant #3 satisfied): `PickStartPositionStep` → real `StartPositionPicker`; `AddStepTutorialStep` → real `OptionPicker`. Both complete.
- Mounted in `MainApplication.svelte:566,578` as an opt-in `TutorialPrompt` → `CreateTutorialWizard`, fired by `app-entry-state.svelte.ts` after the first-run wizard.
- **Disabled by one flag:** `onboarding-flags.ts:12` `AUTO_TOURS_ENABLED = false`, documented as off because the three auto-tours (this create tutorial + fuse-tour + step-editor coach marks) were deemed "unfinished." Manual replay (help buttons, Settings "replay tutorial") is NOT gated and still works.

**Implication:** the spec's "build with guidance" is an **enable + verify** task, not a build and not a fresh brainstorm. The create-tutorial path reads as shippable; "unfinished" likely refers more to the fuse-tour / step-editor coach marks that share the flag. To turn on just the guided build: either verify all three tours and flip the global flag, or split the flag so the create-tutorial enables independently. Flipping it reverses an explicit owner "off for now" decision → needs owner sign-off.

Earlier note that I saw a first-run wizard with beta-ack + displayName: that is the separate `first-run/FirstRunWizard.svelte`. The guided BUILD is downstream of it and never showed in the drive because the flag short-circuits to `completeEntry()`.
