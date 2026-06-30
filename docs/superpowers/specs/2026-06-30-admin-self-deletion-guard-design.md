# Admin Self-Deletion Guard — Design

Date: 2026-06-30
Status: approved

## Problem

`AccountManager.deleteAccount()` (`src/lib/shared/auth/services/account-manager.ts`)
has no admin check. It reauthenticates, deletes the Firestore `users/{uid}` doc,
then deletes the Firebase Auth account. Both stores hold admin authority:

- Firebase Auth **custom claim** `claims.admin` / `claims.role` — what the client
  reads to gate admin routes (`auth-state.svelte.ts:353-354`).
- Firestore **user doc** `role == 'admin' || isAdmin == true` — enforced by
  `firestore.rules:34-37` and the `adminPurgeOneCount` cloud function.

Deleting the sole admin's account nukes both, leaving **zero admins** with no
in-app recovery path (no promote-admin UI exists). Recovery requires manually
re-setting the custom claim + Firestore role via the Firebase console / Admin SDK.

## Decision

Block self-deletion for **any** admin account, in-app, always. Non-admins
delete normally. No admin-count query, no successor/transfer flow.

## Design

Two independent enforcement layers — neither depends on the other, and they read
different sources so no single point of failure unguards deletion.

### 1. Logic guard (the real lock) — `account-manager.ts`

At the top of `deleteAccount()`, before any reauth or deletion, read the
authoritative Auth token claim and bail:

```ts
const token = await user.getIdTokenResult();
if (token.claims.admin === true) {
  throw new Error("Admin accounts can't be deleted from the app.");
}
```

Self-contained — `user` (`auth.currentUser`) is already in scope. Checks the same
claim the admin routes trust. Survives a bypassed or stale UI and direct
programmatic calls.

### 2. UI treatment — `DangerZone.svelte` + `ProfileTab.svelte`

- `ProfileTab.svelte` passes `isAdmin={authState.isAdmin}` (reactive getter,
  already imported) to `DangerZone`.
- `DangerZone.svelte` takes a new `isAdmin` prop. When true, the expanded section
  renders a warning note **in place of** the entire Delete-button + confirmation
  flow:

  > ⚠ Admin accounts can't be deleted in-app. Manage account removal through the
  > Firebase console.

  Reuses the existing `.warning-text` style — no new primitive.

## Files

- `src/lib/shared/auth/services/account-manager.ts` — logic guard
- `src/lib/shared/navigation/components/profile-settings/DangerZone.svelte` — note + `isAdmin` prop
- `src/lib/shared/settings/components/tabs/ProfileTab.svelte` — pass `isAdmin`

## Out of scope

- Promote-admin / admin-transfer UI (block-always was chosen; no successor flow).
- Server-side block of the Auth `deleteUser` call — Firestore rules can't govern
  Auth account deletion; the client guard covers the sole-admin lockout concern.

## Verification

- `npm run check` green.
- Profile tab as admin → warning note shows, no Delete button.
- Logic guard throws on a direct `deleteAccount()` call by an admin.
