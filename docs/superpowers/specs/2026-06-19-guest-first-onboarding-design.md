# Guest-First Onboarding — Design

**Date:** 2026-06-19
**Status:** Approved (design); ready for implementation plan
**Owner:** Austen
**Related:** `2026-06-18-first-time-user-audit.md`, `2026-06-16-user-onboarding-overhaul-umbrella.md` (this is the corrected, concrete form of slice A + the account-row/first-run fixes)

## Problem

Guest-continuity (anonymous Firebase auth) made `isAuthenticated` return **true for anonymous guests**. A cluster of onboarding/account UI still treats `isAuthenticated` as "has a real account," so guests are mistaken for members:

- **Premature wizard.** `MainApplication.svelte:542` mounts `FirstRunWizard` on `isAuthenticated && !firstRunState.isDone()`. The moment a guest's first action provisions an anonymous identity, the wizard auto-pops — asking name + pronouns and routing a not-yet-anon guest into a *required* auth step (`FirstRunWizard.svelte:117,159`). Skip sets a permanent flag (`isDone()`), with re-entry only via admin/Settings replay. Result: "it asks me to sign in / give my name before I said I wanted an account, and I can't get it back."
- **"SI" avatar.** `AccountRow.svelte` renders the member path (`RobustAvatar`) for an anonymous guest (because `isAuthenticated` is true), and the displayName fallback yields the literal "Sign in" → initials "SI".
- **No clear account affordance.** The sidebar has no unmistakable create-account/login entry for a guest.

These are one regression with three symptoms.

## Core fix — one identity predicate

Add `isFullAccount` and stop conflating it with `isAuthenticated`:

```
isFullAccount = isAuthenticated && !isAnonymous
```

Expose as a getter on `authState` (it already has `isAnonymous`). Three identity states:

| State | Definition | Treated as |
|---|---|---|
| **Guest** | no Firebase user, OR `isAnonymous` | guest |
| **Member** | `isAuthenticated && !isAnonymous` | full account |

Switch every **onboarding / account-UI** check that means "real account" from `isAuthenticated` to `isFullAccount`. This is the same distinction `resolveAccessTier` (anon → "guest"), the AdminNotifier fix, and presence already use. Do **not** change save/library gating — anonymous guests still satisfy `isOwner` and keep their cloud library; this is UI/onboarding only.

## The flow (first-time guest)

1. **Land → composer.** No wizard, no PII, no auth wall. Guest plays immediately (8-beat cap, existing gating unchanged).
2. **Optional guided-build offer.** The empty Create state shows a small, skippable card — *"New here? Build your first sequence →"* / *"Skip"*. Accept launches the **existing** `CreateTutorialWizard` (4 steps: pick start → add 4 beats → play → ready; embeds the real `StartPositionPicker` + `OptionPicker`). Skip → composer. The offer is **relaunchable** from a help/empty-state entry in Create (this is the "how to get it back").
3. **Value-moment nudge.** First **successful save** → one gentle, non-blocking prompt: *"Saved on this device. Create a free account to keep it anywhere."* Hard gates (export, publish, community) → the existing `AuthNudge`/sign-in sheet. No proactive nag before a value moment.
4. **Sidebar account row** (always visible): guest → a single **"Sign in" entry** (person-plus icon + "Sign in" label; tooltip when the sidebar is collapsed) that opens the auth sheet with **Sign up / Log in** tabs (signup default). Member → real avatar + name + menu.
5. **Signup in place** via the existing anonymous→`linkWith*` upgrade: work carries over (shipped), confirmation toast fires (shipped). **Then**, only if the provider returned no name (email signups), one **optional** *"What should we call you?"* card (name only). Pronouns are **not** collected in onboarding — they live in Settings/profile.
6. **Returning** guest on the same device: anonymous identity + local library persist (verified). Returning member: signs in via the sidebar entry.

## Component changes

**Identity predicate**
- `auth-state.svelte.ts` — add `get isFullAccount()` returning `isAuthenticated && !isAnonymous`.

**First-run wizard (de-scope + re-gate)**
- `MainApplication.svelte:542` — change mount gate from `isAuthenticated` to `isFullAccount`. Guests never see it.
- `FirstRunWizard.svelte` — remove the `auth` step entirely (signup already happened before this fires) and the `betaDiscovery` step (moved out, below). Reduce `ALL_STEPS` to the optional name card. Skip `welcome` if it adds nothing post-signup (keep only if it earns its place). Drop `pronouns` from collected data; keep `displayName` only.
- Name card shows **only when** the member has no `displayName` from their provider; otherwise the wizard is a no-op and `completeEntry()` runs immediately.
- `DisplayNameStep.svelte` — remove the pronouns field (pronouns → Settings). Keep name, skippable.

**Beta notice (drop the gate → one-time toast)**
- Remove `BetaDiscoveryStep.svelte` from the wizard flow. Replace with a **one-time, dismissible** "Beta — things may change, report bugs" toast/banner shown on first visit to **everyone** (guest included), tracked by a localStorage flag. No checkbox, no acknowledgment gate, non-blocking. (The earlier checkbox→toggle fix is then moot for this surface; the component can be retired.)

**Account row + popover (the "SI" fix)**
- `AccountRow.svelte` — branch on `isFullAccount`, not `isAuthenticated`:
  - `!isFullAccount` → single **"Sign in"** entry (person-plus icon, "Sign in" label expanded, `title`/tooltip when `variant === "collapsed"`), `aria-label="Sign in"`, opens the auth sheet (Sign up / Log in tabs). Never renders `RobustAvatar`.
  - `isFullAccount` → `RobustAvatar` + name + "Account menu".
  - Consolidate the current dual guest/`isAuthenticated` branches into this single `isFullAccount` split. Confirm and remove the displayName fallback that produced "Sign in" → "SI".
- `AccountPopover.svelte` — apply the same `isFullAccount` distinction (it already has a guest-avatar branch); ensure an anonymous guest sees the guest/sign-in treatment, not a member identity.

**Guided-build offer (enable the existing tutorial for guests)**
- Surface `CreateTutorialWizard` via `TutorialPrompt` as the **opt-in empty-state offer** in Create for guests. Today it's gated by `AUTO_TOURS_ENABLED = false` (`onboarding-flags.ts:12`), which also gates the fuse-tour and step-editor coach marks (those are the "unfinished" ones). **Split the flag** so the create-tutorial can be enabled independently of the other two tours; enable just the create-tutorial. Keep the offer skippable and relaunchable (help/empty-state entry).

**Value-moment nudge**
- On the first successful guest save (the `LibrarySaveService.saveSequence` success path), fire one non-blocking prompt (reuse `toast`/`AuthNudge`), once per device (localStorage flag). Do not fire for members.

## Identity-state UI matrix

| Surface | Guest (incl. anon) | Member |
|---|---|---|
| First-run wizard | never shows | optional name card (only if no provider name) |
| Account row | "Sign in" entry → auth sheet | avatar + name + menu |
| Guided-build offer | optional empty-state card | not shown (or "replay" in help) |
| Save | works (Dexie + cloud), value-moment nudge once | works, no nudge |
| Beta toast | once, first visit | once, first visit |

## Already shipped (do NOT redo)

Anonymous→`linkWith*` upgrade + draft carry-over; post-signup confirmation toast (`3e42e3e9c5`); truncation toast; AdminNotifier skip-anon; presence undefined-field fix; What's-New rules; landing "Sign in" link; viewer home/back + recovery; browse-tab guest leak. Rules + cleanup function are deployed.

## Out of scope

- **Slice D — export gating policy** (watermarked guest export): separate brainstorm.
- **Fuse-tour / step-editor coach-mark polish**: the other two tours behind the (now split) flag; finish separately before enabling them.

## Edge cases

- Guest skips the guided-build offer → relaunchable from the Create help/empty-state entry; never auto-re-pops.
- Member skips the name card → keeps provider/default name; editable in Settings.
- Email-already-exists on upgrade → existing collision import dialog (unchanged).
- Sign-out → returns to guest state; sidebar shows "Sign in"; same-device anonymous session may restore with local library.
- Returning anonymous guest → no wizard, no nudge re-fire (localStorage flags).

## Testing / verification

- Unit: `isFullAccount` truth table (no user / anon / member); `AccountRow` renders the "Sign in" entry for guest+anon and the avatar for member.
- Runtime (DevTools, clean isolated guest): land → no wizard; play → no wizard; account row shows "Sign in" (no "SI"); first save → one value-moment nudge; sign up → name card only for email-no-name; member reload → avatar + name. Confirm the premature wizard no longer fires for an anonymous guest.
