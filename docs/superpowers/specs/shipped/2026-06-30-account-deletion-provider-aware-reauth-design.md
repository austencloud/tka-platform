---
status: active
value: 4
effort: M
remaining: "Implementation is in main and focused tests pass (2 files, 3 tests on 2026-08-01). Remaining: destructive live proof on disposable Google, Facebook, Instagram, and password accounts, including cancellation, wrong-account guidance, deletion, and sign-out."
depends_on: "external: disposable test accounts plus authorization for destructive live deletion"
plan_path: ""
tags: []
last_triaged: 2026-08-01
---

# Provider-Aware Account-Deletion Reauthentication — Design

**Date:** 2026-06-30
**Status:** Implemented; destructive live verification blocked
**Author:** Claude (brainstormed with Austen)

## Reconciliation: 2026-08-01

The provider-aware path is present in `main`. The implementation now covers
Google, Facebook, Instagram, and password reauthentication, prevents in-app
self-deletion for admins, records an optional exit reason, and clears local auth
state after deletion. The latest Google-account targeting repair is covered by
`account-manager-delete-account.test.ts` and
`google-reauthentication.test.ts`; both files passed on 2026-08-01 (3 tests).

The remaining acceptance gate deletes real authentication records and cannot be
run against Austen's account. Keep this spec active until disposable accounts
and destructive-test authorization are available.

## Problem

`AccountManager.deleteAccount()` reauthenticates **only** via
`EmailAuthProvider.credential(email, password)` (`account-manager.ts:80-99`).
Accounts created/signed-in via **magic link or OAuth (Google/Facebook) have no
password**, so every reauthentication attempt fails with `auth/invalid-credential`
→ surfaced as "Incorrect password." These users **cannot delete their account
at all**. The `DangerZone.svelte` UI compounds it: it hardcodes a password field
and makes `deletePassword.length > 0` part of `isConfirmationValid`, so there is
no path that doesn't demand a password.

Verified live (Firebase Auth) that real users hit this: a secondary account with
`google.com` + email-link providers and no usable password could not be deleted.

## Goal

Let any user reauthenticate to delete their account using a method they actually
have — OAuth popup (Google/Facebook) when linked, password only when password is
the sole provider — while keeping the existing GitHub-style "type your username"
confirmation barrier.

## Non-Goals (flagged, not built)

- **Change/Set Password for passwordless accounts.** `changePassword()` has the
  same password-only flaw and can't let a passwordless user _set_ a first
  password (it demands a current one). `authenticator.ts` already exports
  `linkEmailPassword()` for exactly this. Tracked as a follow-up; not in this
  change.
- **Email-link-only accounts with no OAuth and no real password.** Firebase
  exposes both email/password and email-link under the `password` providerId, so
  they are indistinguishable from `providerData`. These rare accounts keep the
  password field; if it fails they get a clear message to sign in with an OAuth
  provider or set a password first. No fresh-link reauth flow in v1.

## Approach (chosen)

Provider-aware reauth in the existing delete flow. Rejected: forced re-login
(bad UX), server-side admin-SDK delete (extra infra, bypasses Firebase's
recent-login security gate which is the entire point of reauth).

## Design

### Reauth type (shared)

Defined in `account-manager.ts`, imported by UI + wiring:

```ts
export type DeleteReauth =
  | { method: "password"; password: string }
  | { method: "google" }
  | { method: "facebook" };
```

### `authenticator.ts` — new popup reauth (reuse existing patterns)

Mirror `signInWithGoogle` / `signInWithFacebook` exactly (`getAuthInstance()`
for HMR safety, `addScope`, `notePopupCoop()`), using `reauthenticateWithPopup`:

- `reauthenticateWithGoogle(): Promise<void>`
- `reauthenticateWithFacebook(): Promise<void>`

Both require `currentUser`; throw if absent. Popup auth lives in
`authenticator.ts` (single source) — `account-manager.ts` orchestrates delete and
calls these.

### `account-manager.ts` — `deleteAccount(reauth: DeleteReauth)`

- `password` → existing `reauthenticateWithCredential(user, EmailAuthProvider.credential(email, password))`.
- `google` / `facebook` → call the new `authenticator.ts` reauth functions.
- Then the existing tail unchanged: delete Firestore `users/{uid}` doc →
  `deleteUser(user)` → `signOut`.
- Error mapping: `auth/popup-closed-by-user` / `auth/cancelled-popup-request` →
  `Error("Reauthentication cancelled")`; `auth/wrong-password` /
  `auth/invalid-credential` → `Error("Incorrect password")`; else
  `Error("Authentication failed")`.

### `DangerZone.svelte` — provider-aware UI

- New prop `providerIds: string[]` (the account's linked providers).
- Derive `hasGoogle`, `hasFacebook`, `hasPassword`, `hasOAuth = hasGoogle || hasFacebook`.
- `onDeleteAccount` signature becomes `(reauth: DeleteReauth) => Promise<void>`.
- Keep the type-your-username barrier verbatim.
- Reauth control by provider:
  - `hasOAuth` → render "Confirm with Google" and/or "Confirm with Facebook"
    button(s); **no password field**. Click → `onDeleteAccount({ method })`.
    The popup is the identity proof.
  - else (password only) → existing password field + "Yes, Delete Forever" →
    `onDeleteAccount({ method: "password", password })`.
- `isConfirmationValid` = username matches (case-insensitive trim); the password
  method additionally requires `deletePassword.length > 0`. OAuth methods need
  only the username match (popup proves identity).
- All controls are real `<button>`s, 44px min target, design tokens — no
  checkboxes, no bare text links (project rules).

### `ProfileTab.svelte` — wiring

- `handleDeleteAccount(reauth: DeleteReauth)` → `accountManager.deleteAccount(reauth)`.
- Pass `providerIds={authState.user?.providerData.map((p) => p.providerId) ?? []}`
  to `DangerZone`.

## Files

| File                                                                      | Change                                                                            |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `src/lib/shared/auth/services/authenticator.ts`                           | Add `reauthenticateWithGoogle`, `reauthenticateWithFacebook`                      |
| `src/lib/shared/auth/services/account-manager.ts`                         | `DeleteReauth` type; `deleteAccount(reauth)` provider-aware; error mapping        |
| `src/lib/shared/navigation/components/profile-settings/DangerZone.svelte` | `providerIds` prop; OAuth buttons vs password field; updated validity + signature |
| `src/lib/shared/settings/components/tabs/ProfileTab.svelte`               | Pass `providerIds`; adapt `handleDeleteAccount` signature                         |

## Error Handling

- Popup cancelled → inline "Reauthentication cancelled" (no error styling panic).
- Wrong password → inline "Incorrect password".
- `deleteUser` requires-recent-login is satisfied by the reauth that immediately
  precedes it.
- Firestore doc delete stays best-effort (auth deletion is the real action).

## Testing

- **Manual (required):** on the Google-linked account, expand Danger Zone, type
  username, click "Confirm with Google", complete popup → account deletes and
  signs out. Capture as proof.
- **Optional component test (lean):** assert the correct reauth control renders
  for each `providerIds` set (OAuth → button, password-only → field). Per
  `component-test-discipline.md`, only if cheap; not required.
