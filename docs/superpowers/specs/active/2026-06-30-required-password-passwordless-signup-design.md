# Required Password for Passwordless (Magic-Link) Accounts — Design

**Date:** 2026-06-30
**Status:** Active
**Author:** Claude (brainstormed with Austen)

## Problem

Magic-link signup creates an account with **no password**. Those users can only
ever get back in via another magic link, and (until the provider-aware delete
fix) couldn't reauthenticate for sensitive operations. Austen's requirement: a
magic-link/email account must **set a password at signup** so it has a real,
reliable login + reauth credential.

OAuth accounts (Google/Facebook) are out of scope — they already have a working
login. This targets **email-only accounts with no password**.

## Decisions (locked)

- **Required**, not optional — non-skippable for the targeted accounts.
- **Magic-link / email-only** accounts only. Any account with a `google.com` or
  `facebook.com` provider is exempt.
- Prompted **at signup / next sign-in**, as a full-screen onboarding gate.

## Why not `fetchSignInMethodsForEmail`

It's deprecated and returns an **empty array** under email-enumeration protection
(default-on for projects created after Sept 2023). So "does this account have a
password?" cannot be answered from the client SDK. We **track it ourselves**.

## Approach (chosen)

Required `SetPasswordStep` shown by an **independent** onboarding gate in
`MainApplication`, driven by a tracked `hasPassword` flag. Client-side
`updatePassword` — recent-login is satisfied because the user just completed the
magic link. (Rejected: Cloud Function + Admin SDK — overkill; Settings-only —
contradicts "at signup".)

## Design

### State — `password-onboarding-state.svelte.ts` (new)

Mirrors `first-run-state.svelte.ts` (localStorage + Firestore
`users/{uid}/onboarding/password`, cloud-synced so it doesn't re-prompt across
devices):

- `hasPassword: boolean` — the source of truth.
- `required: boolean` — derived: account needs a password and doesn't have one.
- `shouldShow`, `cloudSynced`, `syncInProgress` — same gating shape as first-run.
- `markHasPassword()` — sets `hasPassword=true`, `required=false`, syncs to cloud.
- `markRequired()` — sets `required=true` (only if `hasPassword` isn't already true).
- `syncFromCloud()` / `syncToCloud()` — read/write the onboarding doc.
- `resetCloudSync()` — called on signout (wired into `auth-state.signOut`, beside
  the existing `firstRunState.resetCloudSync()`).

### Triggers — who sets the flag

- **`email-link-completion.ts`** (after a successful email-link sign-in): if the
  signed-in user is **email-only** (no `google.com`/`facebook.com` in
  `providerData`) and there's **no existing `hasPassword===true` record**, call
  `passwordOnboarding.markRequired()`. This catches both brand-new and existing
  magic-link users on their next link sign-in. Never clobbers an existing `true`.
- **`authenticator.ts` `signUpWithEmail`** (real email/password signup): call
  `passwordOnboarding.markHasPassword()` — those users already have a password and
  must never be prompted.
- Real password users sign in via password (never hit the email-link path), so
  they're never flagged.

### UI — `SetPasswordStep.svelte` + `SetPasswordWizard.svelte` (new)

- `SetPasswordStep.svelte` mirrors `DisplayNameStep.svelte` styling (icon, title,
  card, accent button). Two fields: password + confirm. Validation: min 8 chars,
  the two must match. **No skip button** (required). Submit →
  `updatePassword(auth.currentUser, password)` → on success
  `passwordOnboarding.markHasPassword()` → wizard completes.
- `SetPasswordWizard.svelte` is the overlay wrapper (mirrors `FirstRunWizard`)
  mounting `SetPasswordStep` and reporting completion. Kept separate from
  `FirstRunWizard` because the password gate is independent of the name gate.

### Gate — `MainApplication.svelte`

Insert an independent gate **after** the first-run gate, before the create
tutorial:

```svelte
{:else if isFullAccount && passwordOnboarding.shouldShow && (passwordOnboarding.syncInProgress || !passwordOnboarding.cloudSynced)}
  <!-- loading shim, same pattern as first-run -->
{:else if isFullAccount && passwordOnboarding.required}
  <div class="fullscreen-overlay">
    {#await import(".../SetPasswordWizard.svelte") then mod}
      <mod.default onComplete={() => passwordOnboarding.markHasPassword()} />
    {/await}
  </div>
```

Ordering: name card (first-run) → set-password → create tutorial. For a brand-new
magic-link user all three run in sequence; for an existing magic-link user (first
run already done) only the password gate fires.

### `updatePassword` mechanics

A magic-link user is an `EmailAuthProvider` user with no password;
`updatePassword(user, pw)` sets it (they can then sign in with email + password).
If `auth/requires-recent-login` is thrown (token aged past the session), surface a
clear message and offer a fresh magic link rather than trapping them.

## Files

| File | Change |
|---|---|
| `src/lib/shared/onboarding/state/password-onboarding-state.svelte.ts` | **new** — flag + cloud sync |
| `src/lib/shared/onboarding/components/first-run/steps/SetPasswordStep.svelte` | **new** — password + confirm, `updatePassword` |
| `src/lib/shared/onboarding/components/first-run/SetPasswordWizard.svelte` | **new** — overlay wrapper |
| `src/lib/shared/auth/services/email-link-completion.ts` | mark required for email-only no-password sign-ins |
| `src/lib/shared/auth/services/authenticator.ts` | `signUpWithEmail` marks `hasPassword` |
| `src/lib/shared/application/components/MainApplication.svelte` | independent password gate |
| `src/lib/shared/auth/state/auth-state.svelte.ts` | reset password-onboarding cloud sync on signout |

## Error Handling

- Mismatch / too-short password → inline validation, submit disabled.
- `auth/requires-recent-login` → message + "send me a fresh link" path; don't trap.
- `updatePassword` network failure → inline error, stay on step, retry.
- Firestore sync failure → non-fatal (localStorage carries it), never blocks.

## Testing

- **Manual (required):** sign in via magic link on an email-only account → the
  Set-Password gate appears (non-skippable) → set a password → completes → sign
  out → sign in with email + password → works. Capture.
- Google account → no gate (exempt). Confirm.
- **Optional component test (lean):** `SetPasswordStep` validation (mismatch /
  short disables submit). Per `component-test-discipline.md`, only if cheap.

## Out of scope (flagged)

- Settings "Set Password" for already-signed-in passwordless users who never hit
  the link path again — the signup/sign-in gate covers the real cases; a Settings
  entry is a small follow-up, not built here.
