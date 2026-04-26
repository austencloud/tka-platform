# Remove WebAuthn, Client-Side Account Ops — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the dead WebAuthn/passkey system and simplify account operations (change password, delete account) to use Firebase client SDK directly, fixing the 405 error users hit in production.

**Architecture:** Delete all SvelteKit server routes and server-side libraries (dead code with adapter-static). Rewrite AccountManager to call Firebase client SDK (`reauthenticateWithCredential`, `updatePassword`, `user.delete()`) instead of routing through dead API endpoints. Remove all passkey UI components and the step-up auth coordinator.

**Tech Stack:** Firebase Auth client SDK, Firestore client SDK, Svelte 5, ITI DI

**Spec:** `docs/superpowers/specs/2026-04-07-remove-webauthn-client-side-account-ops-design.md`

---

### Task 1: Delete server-side WebAuthn and account API routes

**Files:**
- Delete: `src/routes/api/webauthn/registration/options/+server.ts`
- Delete: `src/routes/api/webauthn/registration/verify/+server.ts`
- Delete: `src/routes/api/webauthn/authentication/options/+server.ts`
- Delete: `src/routes/api/webauthn/authentication/verify/+server.ts`
- Delete: `src/routes/api/webauthn/credentials/+server.ts`
- Delete: `src/routes/api/account/delete/+server.ts`
- Delete: `src/routes/api/account/update-email/+server.ts`
- Delete: `src/routes/api/account/update-password/+server.ts`

- [ ] **Step 1: Delete all WebAuthn API routes**

```bash
rm -rf src/routes/api/webauthn
```

- [ ] **Step 2: Delete all account API routes**

```bash
rm -rf src/routes/api/account
```

- [ ] **Step 3: Verify no other routes import from deleted files**

```bash
grep -r "api/webauthn\|api/account" src/routes/ --include="*.ts" --include="*.svelte"
```

Expected: No matches.

- [ ] **Step 4: Commit**

```bash
git add -A src/routes/api/webauthn src/routes/api/account
git commit -m "chore: delete dead WebAuthn and account API routes

These SvelteKit server routes never worked in production (adapter-static).
Users hit 405 errors when the app tried to call them."
```

---

### Task 2: Delete server-side libraries

**Files:**
- Delete: `src/lib/server/webauthn/passkeysStore.ts`
- Delete: `src/lib/server/webauthn/webauthnConfig.ts`
- Delete: `src/lib/server/webauthn/base64url.ts`
- Delete: `src/lib/server/security/requireStepUp.ts`
- Delete: `src/lib/server/security/stepUpSession.ts`

- [ ] **Step 1: Delete WebAuthn server libraries**

```bash
rm -rf src/lib/server/webauthn
```

- [ ] **Step 2: Delete step-up auth server libraries**

```bash
rm src/lib/server/security/requireStepUp.ts src/lib/server/security/stepUpSession.ts
```

- [ ] **Step 3: Verify no remaining imports of deleted files**

```bash
grep -r "requireStepUp\|stepUpSession\|passkeysStore\|webauthnConfig\|base64url" src/ --include="*.ts" --include="*.svelte"
```

Expected: No matches (the only consumers were the deleted API routes).

- [ ] **Step 4: Commit**

```bash
git add -A src/lib/server/webauthn src/lib/server/security/requireStepUp.ts src/lib/server/security/stepUpSession.ts
git commit -m "chore: delete dead server-side WebAuthn and step-up auth libraries"
```

---

### Task 3: Delete client-side passkey services and step-up coordinator

**Files:**
- Delete: `src/lib/shared/auth/webauthn/passkeysClient.ts`
- Delete: `src/lib/shared/auth/services/implementations/StepUpAuthCoordinator.svelte.ts`
- Delete: `src/lib/shared/auth/services/contracts/IStepUpAuthCoordinator.ts`
- Delete: `src/lib/shared/auth/services/implementations/ProfileApiClient.ts`
- Delete: `src/lib/shared/auth/services/contracts/IProfileApiClient.ts`

- [ ] **Step 1: Delete passkeys client**

```bash
rm -rf src/lib/shared/auth/webauthn
```

- [ ] **Step 2: Delete step-up coordinator and profile API client (contract + implementation)**

```bash
rm src/lib/shared/auth/services/implementations/StepUpAuthCoordinator.svelte.ts
rm src/lib/shared/auth/services/contracts/IStepUpAuthCoordinator.ts
rm src/lib/shared/auth/services/implementations/ProfileApiClient.ts
rm src/lib/shared/auth/services/contracts/IProfileApiClient.ts
```

- [ ] **Step 3: Commit**

```bash
git add -A src/lib/shared/auth/webauthn src/lib/shared/auth/services/
git commit -m "chore: delete client-side passkey, step-up, and profile API client services"
```

---

### Task 4: Delete passkey UI components

**Files:**
- Delete: `src/lib/shared/auth/components/PasskeysSection.svelte`
- Delete: `src/lib/shared/auth/components/PasskeyStepUpModal.svelte`
- Delete: `src/lib/shared/auth/components/AccountSecuritySection.svelte`
- Delete: `src/lib/shared/auth/components/SecurityPreview.svelte`

- [ ] **Step 1: Delete all four passkey/security UI components**

```bash
rm src/lib/shared/auth/components/PasskeysSection.svelte
rm src/lib/shared/auth/components/PasskeyStepUpModal.svelte
rm src/lib/shared/auth/components/AccountSecuritySection.svelte
rm src/lib/shared/auth/components/SecurityPreview.svelte
```

- [ ] **Step 2: Commit**

```bash
git add -A src/lib/shared/auth/components/
git commit -m "chore: delete passkey/biometric UI components"
```

---

### Task 5: Rewrite AccountManager to use Firebase client SDK

**Files:**
- Modify: `src/lib/shared/auth/services/implementations/AccountManager.ts`
- Modify: `src/lib/shared/auth/services/contracts/IAccountManager.ts`

- [ ] **Step 1: Update IAccountManager interface**

Replace the contents of `src/lib/shared/auth/services/contracts/IAccountManager.ts` with:

```typescript
/**
 * Manages user account operations (password changes, deletion, cache clearing)
 */
export interface IAccountManager {
  /**
   * Changes the user's password.
   * Re-authenticates with current password, then updates to new password.
   * @param currentPassword - Current password for re-authentication
   * @param newPassword - New password (min 8 characters)
   */
  changePassword(currentPassword: string, newPassword: string): Promise<void>;

  /**
   * Deletes the user's account permanently.
   * Re-authenticates with password, cleans up Firestore user doc, then deletes Firebase auth account.
   * @param currentPassword - Current password for re-authentication
   */
  deleteAccount(currentPassword: string): Promise<void>;

  /**
   * Clears all cached data (IndexedDB, localStorage, cookies) and reloads the page
   */
  clearCache(): Promise<void>;
}
```

- [ ] **Step 2: Rewrite AccountManager implementation**

Replace the contents of `src/lib/shared/auth/services/implementations/AccountManager.ts` with:

```typescript
import {
  updatePassword,
  signOut,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
} from "firebase/auth";
import { doc, deleteDoc } from "firebase/firestore";
import { auth, getFirestoreInstance } from "../../firebase";
import { nuclearCacheClear } from "../../utils/nuclearCacheClear";
import type { IAccountManager } from "../contracts/IAccountManager";
import type { IHapticFeedback } from "../../../application/services/contracts/IHapticFeedback";

/**
 * Manages user account operations using Firebase client SDK directly.
 * No server routes needed — all operations go through Firebase Auth
 * and Firestore client libraries, which work with adapter-static.
 */
export class AccountManager implements IAccountManager {
  constructor(private haptics: IHapticFeedback) {}

  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    this.haptics.trigger("selection");

    if (newPassword.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    if (!currentPassword) {
      throw new Error("Current password is required");
    }

    const user = auth.currentUser;
    if (!user?.email) {
      throw new Error("No authenticated user found");
    }

    // Re-authenticate to prove identity
    const credential = EmailAuthProvider.credential(
      user.email,
      currentPassword
    );

    try {
      await reauthenticateWithCredential(user, credential);
    } catch (e: unknown) {
      const code =
        typeof e === "object" && e && "code" in e
          ? (e as { code: string }).code
          : "";
      if (
        code === "auth/wrong-password" ||
        code === "auth/invalid-credential"
      ) {
        throw new Error("WRONG_PASSWORD");
      }
      throw new Error("WRONG_PASSWORD");
    }

    // Update password via Firebase client SDK
    await updatePassword(user, newPassword);
    this.haptics.trigger("success");
  }

  async deleteAccount(currentPassword: string): Promise<void> {
    this.haptics.trigger("warning");

    const user = auth.currentUser;
    if (!user?.email) {
      throw new Error("No authenticated user found");
    }

    if (!currentPassword) {
      throw new Error("Password is required to delete your account");
    }

    // Re-authenticate to prove identity
    const credential = EmailAuthProvider.credential(
      user.email,
      currentPassword
    );

    try {
      await reauthenticateWithCredential(user, credential);
    } catch (e: unknown) {
      const code =
        typeof e === "object" && e && "code" in e
          ? (e as { code: string }).code
          : "";
      if (
        code === "auth/wrong-password" ||
        code === "auth/invalid-credential"
      ) {
        throw new Error("Incorrect password");
      }
      throw new Error("Authentication failed");
    }

    // Best-effort cleanup: delete the user's Firestore document
    try {
      const firestore = await getFirestoreInstance();
      const userDocRef = doc(firestore, "users", user.uid);
      await deleteDoc(userDocRef);
    } catch {
      // Non-fatal — the auth account is the important deletion
      console.warn("Could not delete user Firestore document");
    }

    // Delete the Firebase Auth account
    await deleteUser(user);

    // Sign out locally (belt-and-suspenders — deleteUser should invalidate session)
    await signOut(auth).catch(() => {});

    this.haptics.trigger("success");
  }

  async clearCache(): Promise<void> {
    this.haptics.trigger("selection");

    try {
      await nuclearCacheClear();
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error("Failed to clear cache:", error);
      this.haptics.trigger("error");
      throw new Error("Failed to clear cache. Please try again.");
    }
  }
}
```

- [ ] **Step 3: Verify the file compiles**

```bash
npx tsc --noEmit src/lib/shared/auth/services/implementations/AccountManager.ts 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/auth/services/contracts/IAccountManager.ts src/lib/shared/auth/services/implementations/AccountManager.ts
git commit -m "refactor(auth): rewrite AccountManager to use Firebase client SDK

Removes server API round-trips. changePassword and deleteAccount now call
Firebase Auth client SDK directly. deleteAccount also cleans up the user's
Firestore document before deleting the auth account."
```

---

### Task 6: Update DI container wiring

**Files:**
- Modify: `src/lib/shared/di/containers/core-container.ts`

- [ ] **Step 1: Remove StepUpAuthCoordinator and ProfileApiClient imports and singletons**

In `src/lib/shared/di/containers/core-container.ts`, remove these two import lines:

```typescript
import { ProfileApiClient } from "../../auth/services/implementations/ProfileApiClient";
import { StepUpAuthCoordinator } from "../../auth/services/implementations/StepUpAuthCoordinator.svelte";
```

Remove these two singleton declarations:

```typescript
const profileApiClient = new ProfileApiClient();
const stepUpAuthCoordinator = new StepUpAuthCoordinator();
```

Remove these two lines from the `.add()` block in the AUTH SERVICES section:

```typescript
    profileApiClient: () => profileApiClient,
    stepUpAuthCoordinator: () => stepUpAuthCoordinator,
```

- [ ] **Step 2: Simplify AccountManager wiring**

Replace the ACCOUNT MANAGER `.add()` block:

```typescript
  // === ACCOUNT MANAGER (depends on auth services above) ===
  .add((deps) => ({
    accountManager: () =>
      new AccountManager(
        deps.profileApiClient,
        deps.stepUpAuthCoordinator,
        deps.hapticFeedback
      ),
  }))
```

With:

```typescript
  // === ACCOUNT MANAGER ===
  .add((deps) => ({
    accountManager: () => new AccountManager(deps.hapticFeedback),
  }))
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/di/containers/core-container.ts
git commit -m "refactor(di): remove StepUpAuthCoordinator and ProfileApiClient from container"
```

---

### Task 7: Update ProfileTab to remove passkey/step-up references

**Files:**
- Modify: `src/lib/shared/settings/components/tabs/ProfileTab.svelte`

- [ ] **Step 1: Remove imports of deleted components and services**

Remove these import lines from the `<script>` block:

```typescript
  import type { IStepUpAuthCoordinator } from "../../../auth/services/contracts/IStepUpAuthCoordinator";
  import AccountSecuritySection from "../../../auth/components/AccountSecuritySection.svelte";
  import SecurityPreview from "../../../auth/components/SecurityPreview.svelte";
  import PasskeyStepUpModal from "../../../auth/components/PasskeyStepUpModal.svelte";
```

- [ ] **Step 2: Remove stepUpCoordinator state variable**

Remove this line:

```typescript
  let stepUpCoordinator = $state<IStepUpAuthCoordinator | null>(null);
```

- [ ] **Step 3: Remove stepUpCoordinator assignment in onMount**

In the `onMount` callback, remove:

```typescript
    stepUpCoordinator = container.items.stepUpAuthCoordinator;
```

- [ ] **Step 4: Remove the Security GlassCard section**

Remove this block from the template (around lines 450-461):

```svelte
        <!-- Row 2: Complex cards (expand to 50% each) -->
        <!-- Security -->
        {#if authService}
          <GlassCard
            icon="fas fa-shield-alt"
            title="Security"
            subtitle="Secure your account"
          >
            {#snippet children()}
              <AccountSecuritySection {hapticService} />
            {/snippet}
          </GlassCard>
        {/if}
```

- [ ] **Step 5: Remove the PasskeyStepUpModal rendering**

Remove this block from the end of the template (around lines 500-507):

```svelte
{#if stepUpCoordinator}
  <PasskeyStepUpModal
    isOpen={stepUpCoordinator.showStepUpModal}
    allowPassword={profileState.hasPasswordProvider(authState.user)}
    onSuccess={() => stepUpCoordinator?.handleSuccess()}
    onCancel={() => stepUpCoordinator?.handleCancel()}
  />
{/if}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/settings/components/tabs/ProfileTab.svelte
git commit -m "refactor(profile): remove passkey/step-up UI from ProfileTab"
```

---

### Task 8: Update DangerZone to require password for account deletion

**Files:**
- Modify: `src/lib/shared/navigation/components/profile-settings/DangerZone.svelte`
- Modify: `src/lib/shared/settings/components/tabs/ProfileTab.svelte`

- [ ] **Step 1: Add password field to DangerZone confirmation**

In `DangerZone.svelte`, update the props interface to accept a password-requiring callback:

Change the `onDeleteAccount` prop type and add password state:

```typescript
  let { onDeleteAccount, hapticService, userIdentifier } = $props<{
    onDeleteAccount: (password: string) => Promise<void>;
    hapticService: IHapticFeedback | null;
    userIdentifier: string;
  }>();

  let isExpanded = $state(false);
  let confirmationText = $state("");
  let deletePassword = $state("");
  let deleteError = $state("");
  let isDeleting = $state(false);
```

- [ ] **Step 2: Update the confirmation validation**

Add password to the validation derived:

```typescript
  let isConfirmationValid = $derived(
    confirmationText.toLowerCase().trim() ===
      userIdentifier.toLowerCase().trim() &&
    deletePassword.length > 0
  );
```

- [ ] **Step 3: Update toggleExpanded and handleCancel to reset new state**

Update `toggleExpanded` to also clear new fields when collapsing:

```typescript
  function toggleExpanded() {
    hapticService?.trigger("selection");
    isExpanded = !isExpanded;
    if (!isExpanded) {
      ctx.ui.showDeleteConfirmation = false;
      confirmationText = "";
      deletePassword = "";
      deleteError = "";
    }
  }
```

Update `handleCancel`:

```typescript
  function handleCancel() {
    hapticService?.trigger("selection");
    ctx.ui.showDeleteConfirmation = false;
    confirmationText = "";
    deletePassword = "";
    deleteError = "";
  }
```

- [ ] **Step 4: Update handleConfirmDelete to pass password and handle errors**

```typescript
  async function handleConfirmDelete() {
    if (!isConfirmationValid || isDeleting) return;
    hapticService?.trigger("warning");
    isDeleting = true;
    deleteError = "";
    try {
      await onDeleteAccount(deletePassword);
    } catch (e: unknown) {
      deleteError = e instanceof Error ? e.message : "Failed to delete account";
      hapticService?.trigger("error");
    } finally {
      isDeleting = false;
    }
  }
```

- [ ] **Step 5: Add password input and error display to the confirmation box template**

In the `{:else}` branch (the confirmation box), add a password input field after the existing confirmation input section and before the button row. Also add error display:

After the closing `</div>` of `.confirmation-input-section`, add:

```svelte
          <div class="confirmation-input-section">
            <label for="delete-password" class="confirmation-label">
              Enter your <strong>password</strong> to confirm:
            </label>
            <input
              id="delete-password"
              type="password"
              class="confirmation-input"
              class:valid={deletePassword.length > 0}
              placeholder="Your current password"
              bind:value={deletePassword}
              autocomplete="current-password"
              disabled={isDeleting}
            />
          </div>

          {#if deleteError}
            <p class="error-message" role="alert">
              <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
              {deleteError}
            </p>
          {/if}
```

- [ ] **Step 6: Add disabled state to the confirm button**

Update the confirm button to show loading state:

```svelte
            <button
              class="button button--danger-confirm"
              onclick={handleConfirmDelete}
              disabled={!isConfirmationValid || isDeleting}
            >
              <i class="fas fa-trash-alt" aria-hidden="true"></i>
              {isDeleting ? "Deleting..." : "Yes, Delete Forever"}
            </button>
```

- [ ] **Step 7: Add error-message style to DangerZone**

Add this to the `<style>` block:

```css
  .error-message {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 12px 0;
    padding: 10px 14px;
    border-radius: 8px;
    background: rgba(239, 68, 68, 0.12);
    color: var(--semantic-error);
    font-size: var(--font-size-compact);
  }

  .error-message i {
    flex-shrink: 0;
  }
```

- [ ] **Step 8: Update ProfileTab handleDeleteAccount to pass password**

In `ProfileTab.svelte`, update `handleDeleteAccount`:

```typescript
  async function handleDeleteAccount(password: string) {
    if (!accountManager) return;

    await accountManager.deleteAccount(password);
  }
```

Remove the try/catch — errors are now handled inline in DangerZone.

- [ ] **Step 9: Commit**

```bash
git add src/lib/shared/navigation/components/profile-settings/DangerZone.svelte src/lib/shared/settings/components/tabs/ProfileTab.svelte
git commit -m "feat(auth): add password confirmation to account deletion

Since we removed the broken server-side step-up auth, account deletion
now requires the user to re-enter their password inline in the DangerZone
confirmation dialog."
```

---

### Task 9: Remove @simplewebauthn npm packages

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Uninstall the three WebAuthn packages**

```bash
npm uninstall @simplewebauthn/browser @simplewebauthn/server @simplewebauthn/types
```

- [ ] **Step 2: Verify no remaining imports**

```bash
grep -r "simplewebauthn" src/ --include="*.ts" --include="*.svelte"
```

Expected: No matches.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove @simplewebauthn packages (no longer needed)"
```

---

### Task 10: Clean up translation key and verify build

**Files:**
- Modify: `messages/en.json` (and all other locale files)

- [ ] **Step 1: Remove the passkey translation key from all locale files**

Remove `"auth_verify_with_passkey"` from every file in `messages/`:

```bash
for f in messages/*.json; do
  sed -i '/"auth_verify_with_passkey"/d' "$f"
done
```

- [ ] **Step 2: Run full build to verify everything compiles**

```bash
npm run build
```

Expected: Build succeeds with no errors related to missing imports or references.

- [ ] **Step 3: Run TypeScript check**

```bash
npm run check
```

Expected: No new TypeScript errors introduced.

- [ ] **Step 4: Commit**

```bash
git add messages/ 
git commit -m "chore: remove passkey translation key from all locales"
```

---

### Task 11: Final verification

- [ ] **Step 1: Grep for any remaining references to deleted code**

```bash
grep -r "passkey\|PassKey\|webauthn\|WebAuthn\|stepUp\|StepUp\|step_up\|ProfileApiClient\|biometric" src/ --include="*.ts" --include="*.svelte" | grep -v "node_modules\|\.d\.ts"
```

Expected: No matches (or only harmless references like comments in unrelated files).

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: All existing tests pass.

- [ ] **Step 3: Verify the profile tab loads without errors**

Open `http://localhost:5173` in browser, navigate to Profile tab. Verify:
- No console errors about missing components or services
- Security GlassCard is gone
- Account settings (password change) still shows
- Danger Zone (delete account) shows and includes password field in confirmation

- [ ] **Step 4: Final commit if any cleanup was needed**

If any issues were found and fixed in steps 1-3, commit them.
