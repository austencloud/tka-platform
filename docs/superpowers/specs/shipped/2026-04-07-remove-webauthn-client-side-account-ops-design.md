# Remove WebAuthn, Move Account Operations to Firebase Client SDK

**Date:** 2026-04-07
**Status:** Approved
**Feedback:** Szb4ULjiCXGeZMaRavXs (Biometric 405 error)

## Problem

The app uses `adapter-static` (no server in production). All SvelteKit server routes (`+server.ts`) are dead code — they work in dev but return 405 in production. This breaks:

- WebAuthn/passkey registration and authentication (5 API routes)
- Account deletion and password changes (3 API routes)
- The entire step-up authentication flow

A real user (Nina Salem) hit the 405 when the PasskeysSection tried to list passkeys on page load.

## Decision

Remove the WebAuthn/passkey system entirely and move account operations to Firebase client SDK calls. Biometric step-up auth solves a problem this app doesn't have — it protects sensitive actions in high-stakes applications (banking, healthcare). For a flow arts notation tool, Firebase's built-in `reauthenticateWithCredential` (re-enter password) is the right security level.

## What Gets Deleted

### API Routes (8 files)

All under `src/routes/api/` — dead code in production:

- `webauthn/registration/options/+server.ts` — WebAuthn registration challenge
- `webauthn/registration/verify/+server.ts` — Verify and store new passkey
- `webauthn/authentication/options/+server.ts` — WebAuthn authentication challenge
- `webauthn/authentication/verify/+server.ts` — Verify passkey, set step-up cookie
- `webauthn/credentials/+server.ts` — List user's passkeys
- `account/delete/+server.ts` — Server-side account deletion
- `account/update-email/+server.ts` — Server-side email update
- `account/update-password/+server.ts` — Server-side password update

### Server Libraries (7 files)

All under `src/lib/server/` — dead code in production:

- `webauthn/passkeysStore.ts` — Firestore CRUD for passkeys
- `webauthn/webauthnConfig.ts` — RP ID and origin extraction
- `webauthn/base64url.ts` — Base64url encoding for WebAuthn
- `security/requireStepUp.ts` — Step-up cookie/recent-auth enforcement
- `security/stepUpSession.ts` — HMAC-signed step-up tokens
Note: `security/rate-limiter.ts` and `security/withRateLimit.ts` are also used by other API routes (admin, tika, feedback) which are equally dead in production but out of scope for this task. Keep them.

### Client Components (4 files)

- `src/lib/shared/auth/components/PasskeysSection.svelte` — "Set up biometrics" UI
- `src/lib/shared/auth/components/PasskeyStepUpModal.svelte` — Step-up verification modal
- `src/lib/shared/auth/components/AccountSecuritySection.svelte` — Wrapper for PasskeysSection
- `src/lib/shared/auth/components/SecurityPreview.svelte` — Admin preview of passkeys

### Client Services (3 files)

- `src/lib/shared/auth/webauthn/passkeysClient.ts` — Browser calls to dead API routes
- `src/lib/shared/auth/services/implementations/StepUpAuthCoordinator.svelte.ts` — Step-up orchestration
- `src/lib/shared/auth/services/contracts/IStepUpAuthCoordinator.ts` — Step-up interface

### Total: 20 files deleted

## What Gets Modified

### AccountManager.ts

Remove `IProfileApiClient` and `IStepUpAuthCoordinator` dependencies. Simplify to:

**`changePassword(currentPassword, newPassword)`:**
1. Validate new password length
2. `reauthenticateWithCredential(user, credential)` with current password
3. `updatePassword(user, newPassword)` — Firebase client SDK
4. Haptic feedback

**`deleteAccount(currentPassword)`:**
1. `reauthenticateWithCredential(user, credential)` with current password
2. Delete `users/{uid}` Firestore doc from client (best-effort cleanup)
3. `user.delete()` — Firebase client SDK
4. Sign out and redirect

**`clearCache()`:** Unchanged.

**Constructor:** `constructor(haptics: IHapticFeedback)` — no more API client or step-up coordinator.

### IAccountManager.ts

Update interface to match simplified AccountManager:
- `changePassword(currentPassword: string, newPassword: string): Promise<void>`
- `deleteAccount(currentPassword: string): Promise<void>` — now requires password param
- `clearCache(): Promise<void>`

### ProfileTab.svelte

- Remove imports: PasskeyStepUpModal, AccountSecuritySection, SecurityPreview, IStepUpAuthCoordinator
- Remove the "Security" GlassCard section that rendered AccountSecuritySection
- Remove PasskeyStepUpModal rendering
- Update `deleteAccount` call to pass current password (prompt user for it)

### core-container.ts

- Remove StepUpAuthCoordinator registration
- Remove ProfileApiClient dependency from AccountManager wiring
- Simplify AccountManager creation to `new AccountManager(haptics)`

## What Stays Unchanged

- `changeEmail` in `authState.svelte.ts` — already uses Firebase client SDK directly
- `EmailChangeSection.svelte` — already works correctly
- `src/lib/server/auth/requireFirebaseUser.ts` — may be used by other routes
- `src/lib/server/auth/requireAdmin.ts` — may be used by other routes
- `src/lib/server/security/audit-logger.ts` — independent utility
- `src/lib/server/firebaseAdmin.ts` — keep for any remaining server needs

## Security Model After

| Operation | Protection | Implementation |
|-----------|-----------|----------------|
| Change email | Re-enter password | `reauthenticateWithCredential` + `updateEmail` (already done) |
| Change password | Re-enter current password | `reauthenticateWithCredential` + `updatePassword` |
| Delete account | Re-enter password + client Firestore cleanup | `reauthenticateWithCredential` + doc delete + `user.delete()` |
| Clear cache | None needed | Local operation only |

## NPM Dependencies to Remove

- `@simplewebauthn/browser` — WebAuthn browser API
- `@simplewebauthn/server` — WebAuthn server verification
- `@simplewebauthn/types` — WebAuthn TypeScript types

## Firestore

- The `users/{uid}/passkeys` subcollection becomes orphaned. No migration needed — it's harmless data that will naturally age out. Can be cleaned up with a one-time script if desired.

## Delete Account UX Change

Currently, delete account goes through the step-up flow (which is broken in production anyway). After this change, the DangerZone component's delete flow needs to prompt for password confirmation. This should be a simple password input in the existing confirmation dialog before proceeding with deletion.
