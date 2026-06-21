# Slice B — Guest Continuity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give guests a lazily-created anonymous Firebase identity so their work persists to a real cloud library and carries into a permanent account in-place on signup, while closing the anonymous abuse surface on community write paths.

**Architecture:** A guest gets an anonymous Firebase user on the first persistable action (`signInAnonymously`). All existing persistence keys on `effectiveUserId` (the Firebase uid), so the anon user's library "just works." Signup branches to `linkWith*` so the uid — and every document under it — is preserved with zero migration. Anonymous users stay at the **guest** access tier (8-beat cap, signup carrots intact); they are blocked from community/social/publish writes by a new free `isFullUser()` Firestore helper. A daily scheduled function reaps anonymous accounts idle > 30 days.

**Tech Stack:** SvelteKit / Svelte 5 runes, Firebase Auth (`signInAnonymously`, `linkWithPopup`, `linkWithCredential`), Firestore security rules, Firebase Functions v1 (`firebase-functions ^5`, `firebase-admin ^12`), Vitest (app unit + emulator rules tests via `@firebase/rules-unit-testing`), Jest (functions).

**Source spec:** `docs/superpowers/specs/2026-06-16-onboarding-slice-b-guest-continuity-design.md`
**Umbrella:** `docs/superpowers/specs/2026-06-16-user-onboarding-overhaul-umbrella.md`

---

## Ground-truth anchors (verified 2026-06-16)

| Fact | Location |
|---|---|
| `resolveAccessTier(isAuthenticated, isPremium)` | `src/lib/shared/auth/domain/access-tier.ts:9` |
| 10 `resolveAccessTier(` call sites | see Task 2 table |
| `isAuthenticated` getter = `_state.user !== null` (anon counts) | `src/lib/shared/auth/state/auth-state.svelte.ts:751` |
| `effectiveUserId` = `_state.user?.uid` | `src/lib/shared/auth/state/auth-state.svelte.ts:112,756` |
| `auth` static export + HMR-safe `getAuthInstance()` | `src/lib/shared/auth/firebase.ts:216,125` |
| `signInAnonymously` not yet used anywhere | greenfield |
| Existing `linkWithPopup`/`linkWithCredential` template | `authenticator.ts:114,128,154` |
| Google signup branch | `SocialAuthCompact.svelte:65` (`signInWithPopup`) |
| Email signup branch | `EmailPasswordAuth.svelte:99` (`createUserWithEmailAndPassword`) |
| Facebook signup branch (only one through authenticator) | `authenticator.ts:63` `signInWithFacebook` |
| Magic-link completion surface | `EmailLinkAuth.svelte` (`signInWithEmailLink`) |
| `invokeGatedAction` | `auth-action-queue.svelte.ts:67` |
| `handleSave` + inner gate | `library-action-handler.svelte.ts:90,93` |
| `LibraryRepository.saveSequence` / `getUserSequences(userId)` | `library-repository.ts:242,739` |
| First persistable build action | `construct-tab-state.svelte.ts:151` `handleStartPositionSelected` (`source==="user"`) |
| `publish` is the only public-index write | `library-repository.ts:855` |
| Firestore helpers (`isAuthenticated`/`isOwner`) | `firestore.rules:10-18` |
| `sign_in_provider` unused in rules | greenfield |
| Functions dir + scheduled pattern | `firebase-functions/`, `cleanupStaleAgentSessions.ts:38`, exports via `src/index.ts` |
| ConfirmDialog primitive | `src/lib/shared/foundation/ui/ConfirmDialog.svelte` |

**Tier decision (locked):** anonymous users resolve to tier **`"guest"`** (keeps the 8-beat cap and the "sign up free for 16" carrot). Save un-gates not via tier but via `effectiveUserId` becoming non-null.

**Library module decision (locked default):** do **not** open the gated Library *module* to anon users. Their saved sequences are reachable via Browse → "my-library" (already unblocked for any authenticated user) and the viewer. Flipping the module open is a one-line `GUEST_MODULE_ACCESS` change if product later wants it; out of scope here.

---

## File structure

**New files**
- `src/lib/shared/auth/services/guest-identity.ts` — `ensureGuestIdentity()`
- `src/lib/shared/auth/services/anonymous-upgrade.ts` — `upgradeAnonymousWith*`, `captureAnonDrafts`, `importDrafts`, collision helpers
- `src/lib/shared/auth/domain/gated-action-policy.ts` — `requiresFullAccount()`
- `src/lib/shared/auth/state/anonymous-import-prompt.svelte.ts` — module-singleton state for the collision-import dialog
- `tests/unit/auth/access-tier.test.ts`
- `tests/unit/auth/gated-action-policy.test.ts`
- `tests/integration/firestore-rules/firestore.rules.test.ts`
- `tests/config/vitest.rules.config.ts`
- `firebase-functions/src/cleanupStaleAnonymousAccounts.ts` + `firebase-functions/src/cleanupStaleAnonymousAccounts.test.ts`

**Modified files**
- `src/lib/shared/auth/domain/access-tier.ts` — `isAnonymous` param
- `src/lib/shared/auth/state/auth-state.svelte.ts` — `isAnonymous` getter
- 10 `resolveAccessTier(` call sites (Task 2)
- `src/lib/features/create/generate/generate-config.svelte.ts:215` — guest-default via tier
- `src/lib/features/create/shared/state/construct-tab-state.svelte.ts:151` — hook `ensureGuestIdentity()`
- `src/lib/shared/sequence-viewer/components/auth-action-queue.svelte.ts:67` — gated-action policy
- `src/lib/shared/sequence-viewer/state/library-action-handler.svelte.ts:90` — ensure identity, drop hard gate
- `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte` — publish gate to full user
- `src/lib/shared/auth/components/SocialAuthCompact.svelte:65` — Google link branch
- `src/lib/shared/auth/components/EmailPasswordAuth.svelte:99` — Email link branch
- `src/lib/shared/auth/services/authenticator.ts:63` — Facebook link branch
- `src/lib/shared/auth/components/EmailLinkAuth.svelte` — magic-link link branch
- `src/lib/shared/application/components/MainApplication.svelte` — mount import-prompt dialog
- `firestore.rules` — `isFullUser()` + community-path swaps
- `firebase-functions/src/index.ts` — export new function
- `firebase.json` — `emulators.firestore` block
- root `package.json` — `@firebase/rules-unit-testing` devDep + `test:rules` script

---

## PHASE A — Tier model & guest detection

### Task 1: Add `isAnonymous` and extend `resolveAccessTier`

**Files:**
- Modify: `src/lib/shared/auth/domain/access-tier.ts:9-16`
- Modify: `src/lib/shared/auth/state/auth-state.svelte.ts` (interface ~702, impl ~751)
- Test: `tests/unit/auth/access-tier.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/auth/access-tier.test.ts
import { describe, it, expect } from "vitest";
import { resolveAccessTier, getMaxBeats } from "$lib/shared/auth/domain/access-tier";

describe("resolveAccessTier", () => {
  it("unauthenticated → guest", () => {
    expect(resolveAccessTier(false, false, false)).toBe("guest");
  });
  it("anonymous (authenticated but anon) → guest", () => {
    expect(resolveAccessTier(true, true, false)).toBe("guest");
  });
  it("anonymous never escalates to premium", () => {
    expect(resolveAccessTier(true, true, true)).toBe("guest");
  });
  it("full non-premium → user", () => {
    expect(resolveAccessTier(true, false, false)).toBe("user");
  });
  it("full premium → premium", () => {
    expect(resolveAccessTier(true, false, true)).toBe("premium");
  });
  it("guest cap stays 8 for anonymous", () => {
    expect(getMaxBeats(resolveAccessTier(true, true, false))).toBe(8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/auth/access-tier.test.ts`
Expected: FAIL — `resolveAccessTier` currently takes 2 args; the anonymous cases return `"premium"`/`"user"` instead of `"guest"`.

- [ ] **Step 3: Update `resolveAccessTier`**

Replace `src/lib/shared/auth/domain/access-tier.ts:9-16` with:

```ts
export function resolveAccessTier(
  isAuthenticated: boolean,
  isAnonymous: boolean,
  isPremium: boolean
): AccessTier {
  if (!isAuthenticated || isAnonymous) return "guest";
  if (isPremium) return "premium";
  return "user";
}
```

- [ ] **Step 4: Add `isAnonymous` to the auth-state handle**

In `src/lib/shared/auth/state/auth-state.svelte.ts`, add to the `AuthStateHandle` interface next to `isAuthenticated` (~line 702):

```ts
  readonly isAnonymous: boolean;
```

And add the getter next to the `isAuthenticated` getter (~line 751):

```ts
  get isAnonymous() {
    return _state.user?.isAnonymous ?? false;
  },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/auth/access-tier.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/auth/domain/access-tier.ts src/lib/shared/auth/state/auth-state.svelte.ts tests/unit/auth/access-tier.test.ts
git commit -m "feat(auth): anonymous-aware access tier resolution" -- src/lib/shared/auth/domain/access-tier.ts src/lib/shared/auth/state/auth-state.svelte.ts tests/unit/auth/access-tier.test.ts
```

---

### Task 2: Thread `isAnonymous` into all 10 `resolveAccessTier` call sites

**Files (each passes `authState.isAnonymous` as the new middle arg):**

| # | File:line |
|---|---|
| 1 | `src/lib/features/create/assemble/components/AssembleToolPanel.svelte:29` |
| 2 | `src/lib/features/create/generate/state/generate-actions.svelte.ts:136` |
| 3 | `src/lib/features/create/generate/state/generate-actions.svelte.ts:385` |
| 4 | `src/lib/features/create/generate/components/cards/LengthCard.svelte:43` |
| 5 | `src/lib/features/create/shared/components/CreateModule.svelte:144` |
| 6 | `src/lib/features/create/generate/components/CardBasedSettingsContainer.svelte:109` |
| 7 | `src/lib/shared/application/components/MainApplication.svelte:383` |
| 8 | `src/lib/shared/modules/ModuleRenderer.svelte:279` |
| 9 | `src/lib/shared/keyboard/utils/register-global-shortcuts.ts:124` |
| 10 | `src/lib/shared/navigation/components/desktop-sidebar/ModuleGroup.svelte:52` |

Each currently reads, verbatim:
```ts
resolveAccessTier(authState.isAuthenticated, isPremiumOrAbove(authState.role))
```

- [ ] **Step 1: Edit each call site** to:

```ts
resolveAccessTier(authState.isAuthenticated, authState.isAnonymous, isPremiumOrAbove(authState.role))
```

`authState` is already imported at every site; no new imports. For `register-global-shortcuts.ts:124` (a `.ts`, not `.svelte`), confirm it already imports `authState`; it does (it reads `authState.isAuthenticated` today).

- [ ] **Step 2: Grep-verify no two-arg call survives**

Run: `npx rg "resolveAccessTier\(" src --type ts --type svelte -n`
Expected: every match (except the definition) passes three arguments.

- [ ] **Step 3: Typecheck (warm)**

Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error 2>&1 | rg "access-tier|resolveAccessTier|Expected 3 arguments" | head`
Expected: no "Expected 3 arguments, but got 2" errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/create/assemble/components/AssembleToolPanel.svelte src/lib/features/create/generate/state/generate-actions.svelte.ts src/lib/features/create/generate/components/cards/LengthCard.svelte src/lib/features/create/shared/components/CreateModule.svelte src/lib/features/create/generate/components/CardBasedSettingsContainer.svelte src/lib/shared/application/components/MainApplication.svelte src/lib/shared/modules/ModuleRenderer.svelte src/lib/shared/keyboard/utils/register-global-shortcuts.ts src/lib/shared/navigation/components/desktop-sidebar/ModuleGroup.svelte
git commit -m "refactor(auth): pass isAnonymous to all access-tier call sites" -- src/lib/features/create/assemble/components/AssembleToolPanel.svelte src/lib/features/create/generate/state/generate-actions.svelte.ts src/lib/features/create/generate/components/cards/LengthCard.svelte src/lib/features/create/shared/components/CreateModule.svelte src/lib/features/create/generate/components/CardBasedSettingsContainer.svelte src/lib/shared/application/components/MainApplication.svelte src/lib/shared/modules/ModuleRenderer.svelte src/lib/shared/keyboard/utils/register-global-shortcuts.ts src/lib/shared/navigation/components/desktop-sidebar/ModuleGroup.svelte
```

---

### Task 3: Route the explicit guest-default config through tier, not raw auth

**Files:**
- Modify: `src/lib/features/create/generate/generate-config.svelte.ts:215`

Currently (verbatim):
```ts
!savedConfig && !authState.isAuthenticated ? GUEST_DEFAULT_OVERRIDES : {};
```
With anon auth, `isAuthenticated` is true for guests, so guest defaults would stop applying to anonymous guests. Switch the guest test to the tier.

- [ ] **Step 1: Add the tier import (if absent) and compute tier**

At the top of `generate-config.svelte.ts`, ensure:
```ts
import { resolveAccessTier } from "$lib/shared/auth/domain/access-tier";
import { isPremiumOrAbove } from "$lib/shared/auth/domain/role"; // match the existing role helper import used elsewhere
```
(Grep the file for how `authState.role` is already referenced; reuse the same `isPremiumOrAbove` import path the create module uses, e.g. as in `CreateModule.svelte`.)

- [ ] **Step 2: Replace line 215**

```ts
const isGuest =
  resolveAccessTier(authState.isAuthenticated, authState.isAnonymous, isPremiumOrAbove(authState.role)) ===
  "guest";
const overrides = !savedConfig && isGuest ? GUEST_DEFAULT_OVERRIDES : {};
```
(Adapt to the surrounding expression form; the net effect is: apply `GUEST_DEFAULT_OVERRIDES` when there is no saved config and the resolved tier is `"guest"`.)

- [ ] **Step 3: Verify**

Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error 2>&1 | rg "generate-config" | head`
Expected: no errors referencing `generate-config`.

> **Review note (no code change in this task):** `SequenceViewerOrchestrator.svelte:1056` `isLoggedIn: forceGuest ? false : authState.isAuthenticated` is a deliberate share/QR force-guest flag; leaving it reads anon users as "logged in" in that viewer only, which is correct (they do have an identity). No change. Documented here so a reviewer does not flag it as missed.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/create/generate/generate-config.svelte.ts
git commit -m "fix(generate): apply guest config defaults by tier, not raw auth" -- src/lib/features/create/generate/generate-config.svelte.ts
```

---

## PHASE B — Lazy guest identity

### Task 4: `ensureGuestIdentity()`

**Files:**
- Create: `src/lib/shared/auth/services/guest-identity.ts`

> Grep first to confirm no existing anon-session helper: `npx rg "signInAnonymously|ensureGuest|anonymousIdentity" src -n` — expected zero hits before this task.

- [ ] **Step 1: Write the service**

```ts
// src/lib/shared/auth/services/guest-identity.ts
import { signInAnonymously } from "firebase/auth";
import { getAuthInstance } from "$lib/shared/auth/firebase";

/**
 * Lazily provision an anonymous Firebase identity. Idempotent and
 * concurrency-safe: a single in-flight sign-in is shared across callers, and a
 * no-op once any user (anonymous or full) is present.
 *
 * Call from every "first persistable action" entry point — committing a first
 * beat, saving, favoriting. Uses getAuthInstance() (HMR-safe) rather than the
 * static `auth` export to avoid the dev-cycle app-rotation argument-error.
 */
let inFlight: Promise<void> | null = null;

export async function ensureGuestIdentity(): Promise<void> {
  const auth = await getAuthInstance();
  if (auth.currentUser) return;
  if (inFlight) return inFlight;
  inFlight = signInAnonymously(auth)
    .then(() => undefined)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
```

- [ ] **Step 2: Typecheck the new file**

Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error 2>&1 | rg "guest-identity" | head`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/auth/services/guest-identity.ts
git commit -m "feat(auth): ensureGuestIdentity lazy anonymous sign-in" -- src/lib/shared/auth/services/guest-identity.ts
```

---

### Task 5: Provision identity on the first build action

**Files:**
- Modify: `src/lib/features/create/shared/state/construct-tab-state.svelte.ts:151` (`handleStartPositionSelected`, `source === "user"` branch)

This is the earliest genuine "user is making something" moment (it mints the working sequence). Provisioning here means the anon uid exists well before the first save, so save never prompts.

- [ ] **Step 1: Import the helper**

At the top of `construct-tab-state.svelte.ts`:
```ts
import { ensureGuestIdentity } from "$lib/shared/auth/services/guest-identity";
```

- [ ] **Step 2: Fire-and-forget at the user branch**

Inside `handleStartPositionSelected`, in the `source === "user"` path (the branch guarded at lines 160/166/185, before `sequenceState.createSequence(...)` at line 191), add:
```ts
// Provision a guest identity the moment a user starts building, so their
// work persists and survives refresh. Non-blocking: never delays the UI.
void ensureGuestIdentity();
```

- [ ] **Step 3: Runtime verification (Chrome DevTools MCP — requires explicit user permission)**

With the dev server on :5173 and after asking the user for browser permission, in the create module pick a start position, then evaluate:
```js
// expect: true after picking a start position as a fresh guest
(await firebase?.auth?.currentUser) ? firebase.auth.currentUser.isAnonymous : "no global"
```
Because the app does not expose a `firebase` global, verify instead via the app's own state in the DevTools console of the running page:
```js
window.__TKA_DEBUG__ ?? "expose authState.user.uid via a temporary log"
```
If no debug hook exists, add a temporary `console.log("guest uid", auth.currentUser?.uid, auth.currentUser?.isAnonymous)` inside `ensureGuestIdentity` for the verification run, confirm a non-null uid with `isAnonymous === true` appears in `list_console_messages`, then remove the log before commit. Capture the console output as the proof artifact.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/create/shared/state/construct-tab-state.svelte.ts
git commit -m "feat(create): provision guest identity on first build action" -- src/lib/features/create/shared/state/construct-tab-state.svelte.ts
```

---

## PHASE C — Gated-action policy

### Task 6: `requiresFullAccount()` policy

**Files:**
- Create: `src/lib/shared/auth/domain/gated-action-policy.ts`
- Test: `tests/unit/auth/gated-action-policy.test.ts`

`PendingActionType = 'save' | 'favorite' | 'publish' | 'remix' | 'sendTo'` (`pending-action-queue.ts:1`). Only `publish` writes to the shared public index (`library-repository.ts:855`); the rest write only to the user's own subtree or perform no Firestore write. So `publish` requires a full account; everything else is anon-allowed.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/auth/gated-action-policy.test.ts
import { describe, it, expect } from "vitest";
import { requiresFullAccount } from "$lib/shared/auth/domain/gated-action-policy";

describe("requiresFullAccount", () => {
  it("publish requires a full account", () => {
    expect(requiresFullAccount("publish")).toBe(true);
  });
  it.each(["save", "favorite", "remix", "sendTo"] as const)(
    "%s is allowed for anonymous guests",
    (type) => {
      expect(requiresFullAccount(type)).toBe(false);
    }
  );
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/auth/gated-action-policy.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/shared/auth/domain/gated-action-policy.ts
import type { PendingActionType } from "$lib/shared/sequence-viewer/services/pending-action-queue";

/**
 * Actions that publish content to shared/public collections under a visible
 * identity require a permanent (non-anonymous) account. Own-subtree writes
 * (save, favorite) and no-write actions (remix navigates to Create; sendTo
 * shares a URL) are allowed for anonymous guests.
 */
const FULL_ACCOUNT_ACTIONS: ReadonlySet<PendingActionType> = new Set(["publish"]);

export function requiresFullAccount(type: PendingActionType): boolean {
  return FULL_ACCOUNT_ACTIONS.has(type);
}
```

Confirm the import path of `PendingActionType` resolves — the agent found it at `pending-action-queue.ts:1`; verify with `npx rg "export type PendingActionType" src -n` and adjust the import to the exact file if it differs.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/auth/gated-action-policy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/auth/domain/gated-action-policy.ts tests/unit/auth/gated-action-policy.test.ts
git commit -m "feat(auth): gated-action policy (publish requires full account)" -- src/lib/shared/auth/domain/gated-action-policy.ts tests/unit/auth/gated-action-policy.test.ts
```

---

### Task 7: Wire the policy into the gated-action and save paths

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/auth-action-queue.svelte.ts:67-86` (`invokeGatedAction`)
- Modify: `src/lib/shared/sequence-viewer/state/library-action-handler.svelte.ts:90-96` (`handleSave`)
- Modify: `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte` (publish button gate ~line 323)

- [ ] **Step 1: Update `invokeGatedAction`**

Current body (verbatim):
```ts
  function invokeGatedAction(
    type: PendingActionType,
    realHandler: (() => void) | (() => Promise<void>) | undefined,
    sequence: SequenceData | null,
  ) {
    if (authState.isAuthenticated) {
      void realHandler?.();
      return;
    }
    const sequenceId = sequence?.id ?? sequence?.word ?? "";
    if (!sequenceId) return;

    pendingActionQueue.enqueue({ type, sequenceId });
    if (browser) {
      const parsed = new URL(window.location.href);
      parsed.searchParams.set("pending", type);
      replaceState(parsed, {});
    }
    openSignInSheet(type);
  }
```

Replace with:
```ts
  function invokeGatedAction(
    type: PendingActionType,
    realHandler: (() => void) | (() => Promise<void>) | undefined,
    sequence: SequenceData | null,
  ) {
    const isFullUser = authState.isAuthenticated && !authState.isAnonymous;

    if (requiresFullAccount(type)) {
      // publish: must be a permanent account.
      if (isFullUser) {
        void realHandler?.();
        return;
      }
      // fall through to the sign-in sheet below
    } else {
      // save / favorite / remix / sendTo: provision a guest identity if
      // needed, then run. Never prompts.
      void ensureGuestIdentity().then(() => realHandler?.());
      return;
    }

    const sequenceId = sequence?.id ?? sequence?.word ?? "";
    if (!sequenceId) return;

    pendingActionQueue.enqueue({ type, sequenceId });
    if (browser) {
      const parsed = new URL(window.location.href);
      parsed.searchParams.set("pending", type);
      replaceState(parsed, {});
    }
    openSignInSheet(type);
  }
```

Add imports at the top of `auth-action-queue.svelte.ts`:
```ts
import { requiresFullAccount } from "$lib/shared/auth/domain/gated-action-policy";
import { ensureGuestIdentity } from "$lib/shared/auth/services/guest-identity";
```

- [ ] **Step 2: Update `handleSave` to provision instead of block**

Replace `library-action-handler.svelte.ts:93-96` (verbatim):
```ts
    if (!authState.isAuthenticated) {
      showToast("Sign in to save sequences", "info");
      return;
    }
```
with:
```ts
    await ensureGuestIdentity();
```
Add the import at the top of `library-action-handler.svelte.ts`:
```ts
import { ensureGuestIdentity } from "$lib/shared/auth/services/guest-identity";
```
`handleSave` is already `async` (it `await`s `saveSequence`). After `ensureGuestIdentity()`, `effectiveUserId` is non-null and `libraryRepo.saveSequence` works.

- [ ] **Step 3: Gate the publish action to full accounts in the drawer**

In `SequenceViewerDrawerHost.svelte`, find the publish trigger (the `handlePublishAction` / publish button near line 323). Wrap its handler so anonymous users are routed to sign-in rather than publishing. If the button calls `ctx.invokeGatedAction("publish", ctx.handlePublish, seq)`, no further change is needed — Step 1 already enforces full-account for `publish`. If it calls the publish handler directly, change it to:
```ts
onclick={() => ctx.invokeGatedAction("publish", ctx.handlePublish, ctx.getSequence())}
```
Grep the file first (`npx rg "publish" src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte -n`) and route every publish entry point through `invokeGatedAction("publish", …)`.

- [ ] **Step 4: Runtime verification (DevTools MCP, with permission)**

As an anonymous guest: save → succeeds (toast "Saved to library", no sign-in sheet); refresh → the sequence is still listed in Browse "my-library"; attempt publish → the sign-in sheet opens. Capture console/network proof (a `setDoc` to `users/{uid}/sequences/...` for save; no `publicSequences` write on the publish attempt). Record the artifacts.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/auth-action-queue.svelte.ts src/lib/shared/sequence-viewer/state/library-action-handler.svelte.ts src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte
git commit -m "feat(viewer): anon guests save/favorite freely, publish stays full-account" -- src/lib/shared/sequence-viewer/components/auth-action-queue.svelte.ts src/lib/shared/sequence-viewer/state/library-action-handler.svelte.ts src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte
```

---

## PHASE D — Signup as in-place link

### Task 8: `anonymous-upgrade.ts` service

**Files:**
- Create: `src/lib/shared/auth/services/anonymous-upgrade.ts`

Pattern mirrors `authenticator.ts` `linkGoogleAccount`/`linkFacebookAccount`/`linkEmailPassword` (read `currentUser`, build provider/credential, call `linkWith*`). The new twist: capture the anon's drafts *before* linking (so the collision path can offer importing them into the existing account), and handle the credential-collision branch.

- [ ] **Step 1: Write the service**

```ts
// src/lib/shared/auth/services/anonymous-upgrade.ts
import {
  EmailAuthProvider,
  FacebookAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  signInWithCredential,
  signInWithEmailAndPassword,
  type AuthError,
} from "firebase/auth";
import { getAuthInstance } from "$lib/shared/auth/firebase";
import { getLibraryRepository } from "$lib/shared/library/get-library-repository";
import type { LibrarySequence } from "$lib/shared/library/services/library-repository";

export type UpgradeStatus = "linked" | "collision-signed-in";

export interface UpgradeResult {
  status: UpgradeStatus;
  /** Drafts captured from the anon session, present only on collision. */
  importable?: LibrarySequence[];
}

const CREDENTIAL_COLLISION = new Set([
  "auth/credential-already-in-use",
  "auth/email-already-in-use",
]);

function isCollision(error: unknown): error is AuthError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    CREDENTIAL_COLLISION.has((error as AuthError).code)
  );
}

/** Read the anon user's saved sequences before we risk losing the session. */
async function captureAnonDrafts(anonUid: string): Promise<LibrarySequence[]> {
  try {
    return await getLibraryRepository().getUserSequences(anonUid);
  } catch {
    return [];
  }
}

export async function upgradeAnonymousWithGoogle(): Promise<UpgradeResult> {
  const auth = await getAuthInstance();
  const anon = auth.currentUser;
  if (!anon?.isAnonymous) throw new Error("No anonymous session to upgrade");
  const drafts = await captureAnonDrafts(anon.uid);
  const provider = new GoogleAuthProvider();
  provider.addScope("email");
  provider.addScope("profile");
  try {
    await linkWithPopup(anon, provider);
    return { status: "linked" };
  } catch (error) {
    if (isCollision(error)) {
      const cred = GoogleAuthProvider.credentialFromError(error as AuthError);
      if (cred) await signInWithCredential(auth, cred);
      else throw error;
      return { status: "collision-signed-in", importable: drafts };
    }
    throw error;
  }
}

export async function upgradeAnonymousWithFacebook(): Promise<UpgradeResult> {
  const auth = await getAuthInstance();
  const anon = auth.currentUser;
  if (!anon?.isAnonymous) throw new Error("No anonymous session to upgrade");
  const drafts = await captureAnonDrafts(anon.uid);
  const provider = new FacebookAuthProvider();
  provider.addScope("email");
  provider.addScope("public_profile");
  try {
    await linkWithPopup(anon, provider);
    return { status: "linked" };
  } catch (error) {
    if (isCollision(error)) {
      const cred = FacebookAuthProvider.credentialFromError(error as AuthError);
      if (cred) await signInWithCredential(auth, cred);
      else throw error;
      return { status: "collision-signed-in", importable: drafts };
    }
    throw error;
  }
}

export async function upgradeAnonymousWithEmail(
  email: string,
  password: string
): Promise<UpgradeResult> {
  const auth = await getAuthInstance();
  const anon = auth.currentUser;
  if (!anon?.isAnonymous) throw new Error("No anonymous session to upgrade");
  const drafts = await captureAnonDrafts(anon.uid);
  const credential = EmailAuthProvider.credential(email.trim(), password);
  try {
    await linkWithCredential(anon, credential);
    return { status: "linked" };
  } catch (error) {
    if (isCollision(error)) {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      return { status: "collision-signed-in", importable: drafts };
    }
    throw error;
  }
}

/**
 * Copy captured anon drafts into the currently-signed-in account's library.
 * Swallows ALREADY_EXISTS (duplicate-content guard); rethrows anything else.
 * Returns the count actually imported.
 */
export async function importDrafts(drafts: LibrarySequence[]): Promise<number> {
  const repo = getLibraryRepository();
  let imported = 0;
  for (const draft of drafts) {
    try {
      await repo.saveSequence(draft);
      imported += 1;
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code !== "ALREADY_EXISTS") throw error;
    }
  }
  return imported;
}
```

Verify the `LibrarySequence` export name and that `getUserSequences(userId)` and `saveSequence(sequence)` accept these shapes — confirmed at `library-repository.ts:739,242`. If `LibrarySequence` is not exported, export it (single-line `export` on its declaration) as part of this task; do not duplicate the type.

- [ ] **Step 2: Typecheck**

Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error 2>&1 | rg "anonymous-upgrade" | head`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/auth/services/anonymous-upgrade.ts src/lib/shared/library/services/library-repository.ts
git commit -m "feat(auth): anonymous-upgrade service (link + collision import)" -- src/lib/shared/auth/services/anonymous-upgrade.ts src/lib/shared/library/services/library-repository.ts
```

---

### Task 9: Collision-import prompt (state + mounted dialog)

**Files:**
- Create: `src/lib/shared/auth/state/anonymous-import-prompt.svelte.ts`
- Modify: `src/lib/shared/application/components/MainApplication.svelte` (mount one `ConfirmDialog`)

A single module-singleton state holds the pending import; one `ConfirmDialog` mounted at the app root renders the offer. Handlers (Tasks 10–13) call `promptAnonymousImport(drafts)` after a `collision-signed-in` result. This avoids duplicating dialog wiring across four signup surfaces.

- [ ] **Step 1: Write the state module**

```ts
// src/lib/shared/auth/state/anonymous-import-prompt.svelte.ts
import type { LibrarySequence } from "$lib/shared/library/services/library-repository";
import { importDrafts } from "$lib/shared/auth/services/anonymous-upgrade";
import { showToast } from "$lib/shared/application/services/toast"; // match the existing toast import used by library-action-handler

interface ImportPromptState {
  isOpen: boolean;
  drafts: LibrarySequence[];
}

const state = $state<ImportPromptState>({ isOpen: false, drafts: [] });

export const anonymousImportPrompt = {
  get isOpen() {
    return state.isOpen;
  },
  set isOpen(v: boolean) {
    state.isOpen = v;
  },
  get count() {
    return state.drafts.length;
  },
};

/** Open the import offer if there is anything worth importing. */
export function promptAnonymousImport(drafts: LibrarySequence[]): void {
  if (!drafts.length) return;
  state.drafts = drafts;
  state.isOpen = true;
}

export async function confirmAnonymousImport(): Promise<void> {
  const drafts = state.drafts;
  state.isOpen = false;
  state.drafts = [];
  const n = await importDrafts(drafts);
  if (n > 0) showToast(`Imported ${n} sequence${n === 1 ? "" : "s"} you just made.`, "success");
}

export function cancelAnonymousImport(): void {
  state.isOpen = false;
  state.drafts = [];
}
```

Confirm the `showToast` import path against `library-action-handler.svelte.ts` (it already imports `showToast`); reuse the exact same module specifier.

- [ ] **Step 2: Mount the dialog at the app root**

In `MainApplication.svelte`, import and render once (near other always-present overlays):
```svelte
<script lang="ts">
  import ConfirmDialog from "$lib/shared/foundation/ui/ConfirmDialog.svelte";
  import {
    anonymousImportPrompt,
    confirmAnonymousImport,
    cancelAnonymousImport,
  } from "$lib/shared/auth/state/anonymous-import-prompt.svelte";
  // ...existing script...
</script>

<!-- ...existing markup... -->
<ConfirmDialog
  bind:isOpen={anonymousImportPrompt.isOpen}
  variant="info"
  title="Keep what you just made?"
  message={`Add the ${anonymousImportPrompt.count} sequence${anonymousImportPrompt.count === 1 ? "" : "s"} you created as a guest to this account?`}
  confirmText="Import"
  cancelText="Not now"
  onConfirm={confirmAnonymousImport}
  onCancel={cancelAnonymousImport}
/>
```

- [ ] **Step 3: Typecheck**

Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error 2>&1 | rg "anonymous-import-prompt|MainApplication" | head`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/auth/state/anonymous-import-prompt.svelte.ts src/lib/shared/application/components/MainApplication.svelte
git commit -m "feat(auth): collision-import prompt via shared ConfirmDialog" -- src/lib/shared/auth/state/anonymous-import-prompt.svelte.ts src/lib/shared/application/components/MainApplication.svelte
```

---

### Task 10: Branch the Google signup handler to link-when-anonymous

**Files:**
- Modify: `src/lib/shared/auth/components/SocialAuthCompact.svelte` (`handleGoogleClick`, `signInWithPopup` at line 65)

- [ ] **Step 1: Import the upgrade + prompt helpers**

```ts
import {
  upgradeAnonymousWithGoogle,
} from "$lib/shared/auth/services/anonymous-upgrade";
import { promptAnonymousImport } from "$lib/shared/auth/state/anonymous-import-prompt.svelte";
```

- [ ] **Step 2: Branch at the sign-in call**

Replace line 65 (`await signInWithPopup(auth, provider);`) with:
```ts
      if (auth.currentUser?.isAnonymous) {
        const result = await upgradeAnonymousWithGoogle();
        if (result.status === "collision-signed-in") {
          promptAnonymousImport(result.importable ?? []);
        }
      } else {
        await signInWithPopup(auth, provider);
      }
```
The surrounding `try/catch` (existing `auth/account-exists-with-different-credential` handling at line 86) stays. On the happy `"linked"` path, `onAuthStateChanged` fires with the same uid now non-anonymous, so the rest of the app updates automatically.

- [ ] **Step 3: Runtime verification (DevTools MCP, with permission)**

As an anon guest with ≥1 saved sequence, click "Continue with Google" and complete the popup with a *new* Google account → `auth.currentUser.isAnonymous === false`, uid unchanged, library intact (proof: same uid before/after in console). Separately, with an account that already exists → the import dialog appears offering N sequences. Capture both.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/auth/components/SocialAuthCompact.svelte
git commit -m "feat(auth): Google signup links anonymous identity in place" -- src/lib/shared/auth/components/SocialAuthCompact.svelte
```

---

### Task 11: Branch the Email signup handler to link-when-anonymous

**Files:**
- Modify: `src/lib/shared/auth/components/EmailPasswordAuth.svelte` (`handleSubmit`, signup branch at lines 98-109)

- [ ] **Step 1: Import helpers**

```ts
import { upgradeAnonymousWithEmail } from "$lib/shared/auth/services/anonymous-upgrade";
import { promptAnonymousImport } from "$lib/shared/auth/state/anonymous-import-prompt.svelte";
```

- [ ] **Step 2: Branch the `mode === "signup"` path**

Current (verbatim, lines 98-109):
```ts
      if (mode === "signup") {
        const result = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

        if (name.trim()) {
          await updateProfile(result.user, { displayName: name.trim() });
        }

        await sendEmailVerification(result.user);
```
Replace the `createUserWithEmailAndPassword(...)` call with an anonymous-aware branch, keeping the profile/verification side-effects for the non-anon path:
```ts
      if (mode === "signup") {
        if (auth.currentUser?.isAnonymous) {
          const upgrade = await upgradeAnonymousWithEmail(email, password);
          if (name.trim() && auth.currentUser) {
            await updateProfile(auth.currentUser, { displayName: name.trim() });
          }
          if (auth.currentUser && !auth.currentUser.emailVerified) {
            await sendEmailVerification(auth.currentUser);
          }
          if (upgrade.status === "collision-signed-in") {
            promptAnonymousImport(upgrade.importable ?? []);
          }
        } else {
          const result = await createUserWithEmailAndPassword(auth, email, password);
          if (name.trim()) {
            await updateProfile(result.user, { displayName: name.trim() });
          }
          await sendEmailVerification(result.user);
        }
```
Keep the existing `else` (signin) branch and the closing braces unchanged. `updateProfile`/`sendEmailVerification` are already imported in this file.

- [ ] **Step 3: Runtime verification (DevTools MCP, with permission)**

Anon guest with a saved sequence → sign up with a fresh email/password → `isAnonymous === false`, same uid, library intact. Then with an already-registered email → collision sign-in + import dialog. Capture.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/auth/components/EmailPasswordAuth.svelte
git commit -m "feat(auth): email signup links anonymous identity in place" -- src/lib/shared/auth/components/EmailPasswordAuth.svelte
```

---

### Task 12: Branch the Facebook signup handler to link-when-anonymous

**Files:**
- Modify: `src/lib/shared/auth/services/authenticator.ts:63-69` (`signInWithFacebook`)

Facebook is the only provider routed through `authenticator.ts`, used by both `AuthSheet` and `AuthStep`. Branching the function covers both surfaces.

- [ ] **Step 1: Import the upgrade helper + prompt into authenticator.ts**

```ts
import { upgradeAnonymousWithFacebook } from "./anonymous-upgrade";
import { promptAnonymousImport } from "../state/anonymous-import-prompt.svelte";
```

- [ ] **Step 2: Branch inside `signInWithFacebook`**

Current (verbatim):
```ts
export async function signInWithFacebook(): Promise<void> {
  const provider = new FacebookAuthProvider();
  provider.addScope("email");
  provider.addScope("public_profile");
  notePopupCoop();
  await signInWithPopup(auth, provider);
}
```
Replace with:
```ts
export async function signInWithFacebook(): Promise<void> {
  if (auth.currentUser?.isAnonymous) {
    const result = await upgradeAnonymousWithFacebook();
    if (result.status === "collision-signed-in") {
      promptAnonymousImport(result.importable ?? []);
    }
    return;
  }
  const provider = new FacebookAuthProvider();
  provider.addScope("email");
  provider.addScope("public_profile");
  notePopupCoop();
  await signInWithPopup(auth, provider);
}
```

> Note: `authenticator.ts` imports the static `auth`. The link itself happens inside `upgradeAnonymousWithFacebook`, which uses `getAuthInstance()` (HMR-safe). The `auth.currentUser?.isAnonymous` read here is a cheap state check; if HMR staleness ever makes `auth.currentUser` unexpectedly null in dev, the branch simply falls through to normal sign-in — no correctness risk in production.

- [ ] **Step 3: Runtime verification (DevTools MCP, with permission)** — same shape as Tasks 10–11 for Facebook. Capture.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/auth/services/authenticator.ts
git commit -m "feat(auth): Facebook signup links anonymous identity in place" -- src/lib/shared/auth/services/authenticator.ts
```

---

### Task 13: Branch the magic-link completion to link-when-anonymous

**Files:**
- Modify: `src/lib/shared/auth/components/EmailLinkAuth.svelte` (sign-in completion path using `signInWithEmailLink`)

> Read first: open `EmailLinkAuth.svelte` and locate the completion handler (where `isSignInWithEmailLink` is true and `signInWithEmailLink(auth, email, link)` is called — the agent located the imports at lines 9-15 and the `onMount` completion at ~line 31). The anonymous session survives the email round-trip in Firebase persistence, so `auth.currentUser` is still the anon user on return.

- [ ] **Step 1: Branch the completion call**

Where the component currently calls `await signInWithEmailLink(auth, email, window.location.href)`, replace with:
```ts
      const link = window.location.href;
      if (auth.currentUser?.isAnonymous) {
        const { EmailAuthProvider, linkWithCredential, signInWithEmailLink } = await import("firebase/auth");
        const credential = EmailAuthProvider.credentialWithLink(email, link);
        try {
          await linkWithCredential(auth.currentUser, credential);
        } catch (error) {
          const code = (error as { code?: string })?.code;
          if (code === "auth/credential-already-in-use" || code === "auth/email-already-in-use") {
            // capture drafts before the session flips, then sign in to the existing account
            const { upgradeMagicLinkCollision } = await import("$lib/shared/auth/services/anonymous-upgrade");
            const drafts = await upgradeMagicLinkCollision(auth.currentUser.uid, email, link);
            const { promptAnonymousImport } = await import("$lib/shared/auth/state/anonymous-import-prompt.svelte");
            promptAnonymousImport(drafts);
          } else {
            throw error;
          }
        }
      } else {
        await signInWithEmailLink(auth, email, link);
      }
```

- [ ] **Step 2: Add the magic-link collision helper to `anonymous-upgrade.ts`**

```ts
// append to src/lib/shared/auth/services/anonymous-upgrade.ts
import { signInWithEmailLink } from "firebase/auth";

/**
 * Magic-link collision: capture anon drafts, then sign into the existing
 * account via the email link. Returns the captured drafts to offer importing.
 */
export async function upgradeMagicLinkCollision(
  anonUid: string,
  email: string,
  link: string
): Promise<LibrarySequence[]> {
  const auth = await getAuthInstance();
  const drafts = await captureAnonDrafts(anonUid);
  await signInWithEmailLink(auth, email, link);
  return drafts;
}
```

- [ ] **Step 3: Typecheck + runtime verification (DevTools MCP, with permission)**

Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error 2>&1 | rg "EmailLinkAuth|anonymous-upgrade" | head` → no errors. Runtime: anon guest requests a magic link, completes it, lands non-anonymous with the same uid and library intact. Capture.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/auth/components/EmailLinkAuth.svelte src/lib/shared/auth/services/anonymous-upgrade.ts
git commit -m "feat(auth): magic-link signup links anonymous identity in place" -- src/lib/shared/auth/components/EmailLinkAuth.svelte src/lib/shared/auth/services/anonymous-upgrade.ts
```

---

## PHASE E — Security: close the anon abuse surface

### Task 14: Emulator + rules-test infrastructure

**Files:**
- Modify: `firebase.json` (add `emulators.firestore`)
- Modify: root `package.json` (devDep + `test:rules` script)
- Create: `tests/config/vitest.rules.config.ts`

- [ ] **Step 1: Add the devDependency**

Run: `npm install --save-dev @firebase/rules-unit-testing`
Expected: it appears under `devDependencies`. (`firebase-tools` is already available for `firebase emulators:exec`; confirm with `npx firebase --version`.)

- [ ] **Step 2: Add an emulators block to `firebase.json`**

Insert alongside the existing `firestore`/`functions` keys:
```json
  "emulators": {
    "firestore": { "port": 8080 },
    "ui": { "enabled": false },
    "singleProjectMode": true
  }
```

- [ ] **Step 3: Create a Node-environment vitest config for rules tests**

```ts
// tests/config/vitest.rules.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/integration/firestore-rules/**/*.{test,spec}.ts"],
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
```
(Separate from the shared jsdom config because `@firebase/rules-unit-testing` needs the Node stack, not the browser resolve conditions.)

- [ ] **Step 4: Add the `test:rules` script to root `package.json`**

```json
"test:rules": "firebase emulators:exec --only firestore --project the-kinetic-alphabet \"vitest run --config tests/config/vitest.rules.config.ts\""
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json firebase.json tests/config/vitest.rules.config.ts
git commit -m "test(rules): firestore emulator + rules-unit-testing harness" -- package.json package-lock.json firebase.json tests/config/vitest.rules.config.ts
```

---

### Task 15: Write the failing rules test suite

**Files:**
- Create: `tests/integration/firestore-rules/firestore.rules.test.ts`

- [ ] **Step 1: Write the suite**

```ts
// tests/integration/firestore-rules/firestore.rules.test.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";

let testEnv: RulesTestEnvironment;

const ANON_UID = "anon-user-1";
const FULL_UID = "full-user-1";

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "the-kinetic-alphabet",
    firestore: {
      rules: readFileSync(resolve(__dirname, "../../../firestore.rules"), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

// A guest = anonymous provider; a full user = a real provider (e.g. password).
function anonCtx() {
  return testEnv.authenticatedContext(ANON_UID, {
    firebase: { sign_in_provider: "anonymous" },
  });
}
function fullCtx() {
  return testEnv.authenticatedContext(FULL_UID, {
    firebase: { sign_in_provider: "password" },
  });
}

describe("anonymous guests: own data", () => {
  it("can write their own sequence", async () => {
    const db = anonCtx().firestore();
    await assertSucceeds(
      setDoc(doc(db, `users/${ANON_UID}/sequences/s1`), { userId: ANON_UID, steps: [] })
    );
  });
  it("can write their own learning progress", async () => {
    const db = anonCtx().firestore();
    await assertSucceeds(
      setDoc(doc(db, `users/${ANON_UID}/learningProgress/p1`), { userId: ANON_UID, value: 1 })
    );
  });
});

describe("anonymous guests: community write paths are denied", () => {
  it("cannot create feedback", async () => {
    const db = anonCtx().firestore();
    await assertFails(
      setDoc(doc(db, `feedback/f1`), { userId: ANON_UID, text: "x" })
    );
  });
  it("cannot publish to publicSequences", async () => {
    const db = anonCtx().firestore();
    await assertFails(
      setDoc(doc(db, `publicSequences/seq1`), { ownerId: ANON_UID, steps: [] })
    );
  });
  it("cannot claim a username", async () => {
    const db = anonCtx().firestore();
    await assertFails(
      setDoc(doc(db, `usernames/cooldude`), { userId: ANON_UID })
    );
  });
  it("cannot create a userLocation (community map)", async () => {
    const db = anonCtx().firestore();
    await assertFails(
      setDoc(doc(db, `userLocations/${ANON_UID}`), { userId: ANON_UID, lat: 0, lng: 0 })
    );
  });
});

describe("full users: community write paths succeed", () => {
  it("can create feedback", async () => {
    const db = fullCtx().firestore();
    await assertSucceeds(
      setDoc(doc(db, `feedback/f1`), { userId: FULL_UID, text: "x" })
    );
  });
  it("can publish to publicSequences", async () => {
    const db = fullCtx().firestore();
    await assertSucceeds(
      setDoc(doc(db, `publicSequences/seq1`), { ownerId: FULL_UID, steps: [] })
    );
  });
  it("can claim a username", async () => {
    const db = fullCtx().firestore();
    await assertSucceeds(
      setDoc(doc(db, `usernames/cooldude`), { userId: FULL_UID })
    );
  });
});
```

> These cover the representative gates (own-data allow, feedback/publicSequences/usernames/userLocations deny-for-anon / allow-for-full). After Task 16 lands, extend with the remaining paths from the Task 16 table using the identical `assertFails(anon)/assertSucceeds(full)` pattern — each is a 3-line copy. Document any path intentionally left untested (e.g. hallOfShame, already age-gated).

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:rules`
Expected: the **community-deny** cases FAIL (anon writes currently succeed because the rules still gate on `isAuthenticated()`), proving the suite exercises the real gap. The own-data and full-user cases should already pass.

- [ ] **Step 3: Commit (red)**

```bash
git add tests/integration/firestore-rules/firestore.rules.test.ts
git commit -m "test(rules): anon abuse-surface suite (red)" -- tests/integration/firestore-rules/firestore.rules.test.ts
```

---

### Task 16: Add `isFullUser()` and swap it onto community write paths

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Add the helper**

After the `isAuthenticated()` block (`firestore.rules:13`), add:
```
    // A "full" user has a permanent credential (not an anonymous session).
    // Free check — no document read, unlike the role helpers.
    function isFullUser() {
      return request.auth != null
        && request.auth.token.firebase.sign_in_provider != 'anonymous';
    }
```

- [ ] **Step 2: Swap `isFullUser()` onto each community/abuse write path**

Apply each edit exactly (left = current condition, right = replacement). Keep all `&&` sub-clauses intact; only the leading `isAuthenticated()` (or, for publish indexes, the whole `isAuthenticated() && ownerId==...` condition) changes.

| Path | Line | Change |
|---|---|---|
| feedback create | 822 | `isAuthenticated()` → `isFullUser()` |
| shortcodes create | 888 | `isAuthenticated()` → `isFullUser()` |
| conversations create | 651 | `isAuthenticated()` → `isFullUser()` |
| conversations update | 669 | `isAuthenticated()` → `isFullUser()` |
| messages create | 696 | prepend `isFullUser() &&` before `isConversationParticipant(conversationId)` |
| following create/update | 427 | `isOwner(userId)` → `isOwner(userId) && isFullUser()` |
| followers create | 437 | `isAuthenticated()` → `isFullUser()` |
| userLocations create/update | 1051 | `isOwner(userId)` → `isOwner(userId) && isFullUser()` |
| festivalSubmissions create | 1324 | `isAuthenticated()` → `isFullUser()` |
| videos create | 859 | `isAuthenticated()` → `isFullUser()` |
| userReports create | 1088 | `isAuthenticated()` → `isFullUser()` |
| usernames create | 228 | `isAuthenticated()` → `isFullUser()` |
| usernames update | 233 | `isAuthenticated()` → `isFullUser()` |
| publicSequences create/update | 937 | `isAuthenticated()` → `isFullUser()` |
| publicHandPaths create/update | 950 | `isAuthenticated()` → `isFullUser()` |
| publicSoloProps create/update | 959 | `isAuthenticated()` → `isFullUser()` |

Example (feedback, lines 822-823):
```
      allow create: if isFullUser()
        && request.resource.data.userId == request.auth.uid;
```
Example (publicSequences, lines 937-938):
```
      allow create, update: if isFullUser()
        && request.resource.data.ownerId == request.auth.uid;
```
Example (userLocations, line 1051):
```
      allow create, update: if isOwner(userId) && isFullUser();
```

> **Leave as-is** (anon keeps own data): every `users/{uid}/…` path owned via `isOwner` (sequences, drafts, learningProgress, quizHistory, xp, achievements, streak, sessions, onboarding, tikaConversations, mandala-collection, handPaths, soloProps), the root `/sequences` (614) and `/collections` (625) own-writes, and all public reads. **hallOfShame** paths (1140/1165/1188) already require `isAgeVerified()` (a `users/{uid}.ageVerifiedAt` doc field an anon user won't have) — optionally add `&& isFullUser()` for defense-in-depth; low priority, note the decision. **presence** (764) — leave (low risk, ephemeral).

- [ ] **Step 3: Validate rules syntax**

Run: `npx firebase deploy --only firestore:rules --dry-run --project the-kinetic-alphabet` (or the MCP `firebase_validate_security_rules` tool) to confirm the rules compile.
Expected: no syntax errors.

- [ ] **Step 4: Run the rules suite to green**

Run: `npm run test:rules`
Expected: all cases PASS — anon community writes now fail, full-user writes succeed, own-data writes still succeed.

- [ ] **Step 5: Extend the suite to the remaining paths** (shortcodes, conversations, messages, following, followers, festivalSubmissions, videos, userReports, publicHandPaths, publicSoloProps) using the same `assertFails(anon)/assertSucceeds(full)` pattern, then re-run `npm run test:rules` to green.

- [ ] **Step 6: Commit**

```bash
git add firestore.rules tests/integration/firestore-rules/firestore.rules.test.ts
git commit -m "feat(rules): isFullUser() closes anon access to community write paths" -- firestore.rules tests/integration/firestore-rules/firestore.rules.test.ts
```

---

## PHASE F — Stale anonymous-account cleanup

### Task 17: `isStaleAnonymousAccount` predicate (pure, TDD)

**Files:**
- Create: `firebase-functions/src/cleanupStaleAnonymousAccounts.ts` (predicate first)
- Test: `firebase-functions/src/cleanupStaleAnonymousAccounts.test.ts`

- [ ] **Step 1: Write the failing test (Jest, run from `firebase-functions/`)**

```ts
// firebase-functions/src/cleanupStaleAnonymousAccounts.test.ts
import { isStaleAnonymousAccount } from "./cleanupStaleAnonymousAccounts";
import type { UserRecord } from "firebase-admin/auth";

const THIRTY_ONE_DAYS_AGO = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toUTCString();
const ONE_DAY_AGO = new Date(Date.now() - 24 * 60 * 60 * 1000).toUTCString();

function user(partial: Partial<UserRecord>): UserRecord {
  return {
    uid: "u",
    providerData: [],
    metadata: { creationTime: ONE_DAY_AGO, lastSignInTime: ONE_DAY_AGO },
    ...partial,
  } as UserRecord;
}

describe("isStaleAnonymousAccount", () => {
  const now = Date.now();
  it("anonymous + idle > 30 days → stale", () => {
    expect(
      isStaleAnonymousAccount(
        user({ providerData: [], metadata: { creationTime: THIRTY_ONE_DAYS_AGO, lastSignInTime: THIRTY_ONE_DAYS_AGO } as UserRecord["metadata"] }),
        now
      )
    ).toBe(true);
  });
  it("anonymous + active < 30 days → keep", () => {
    expect(isStaleAnonymousAccount(user({ providerData: [] }), now)).toBe(false);
  });
  it("linked (has providerData) → never stale, even if old", () => {
    expect(
      isStaleAnonymousAccount(
        user({
          providerData: [{ providerId: "google.com" } as UserRecord["providerData"][number]],
          metadata: { creationTime: THIRTY_ONE_DAYS_AGO, lastSignInTime: THIRTY_ONE_DAYS_AGO } as UserRecord["metadata"],
        }),
        now
      )
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run (from `firebase-functions/`): `npm test -- cleanupStaleAnonymousAccounts`
Expected: FAIL — module/function not found.

- [ ] **Step 3: Implement the predicate**

```ts
// firebase-functions/src/cleanupStaleAnonymousAccounts.ts
import type { UserRecord } from "firebase-admin/auth";

const STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * An anonymous account is stale when it has NO linked provider credential and
 * its last sign-in (or creation) was more than 30 days before `nowMs`.
 */
export function isStaleAnonymousAccount(user: UserRecord, nowMs: number): boolean {
  const isAnonymous = !user.providerData || user.providerData.length === 0;
  if (!isAnonymous) return false;
  const lastActive = Date.parse(
    user.metadata.lastSignInTime || user.metadata.creationTime
  );
  if (Number.isNaN(lastActive)) return false;
  return nowMs - lastActive > STALE_AFTER_MS;
}
```

- [ ] **Step 4: Run to verify it passes**

Run (from `firebase-functions/`): `npm test -- cleanupStaleAnonymousAccounts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add firebase-functions/src/cleanupStaleAnonymousAccounts.ts firebase-functions/src/cleanupStaleAnonymousAccounts.test.ts
git commit -m "feat(functions): isStaleAnonymousAccount predicate" -- firebase-functions/src/cleanupStaleAnonymousAccounts.ts firebase-functions/src/cleanupStaleAnonymousAccounts.test.ts
```

---

### Task 18: Scheduled cleanup function + export

**Files:**
- Modify: `firebase-functions/src/cleanupStaleAnonymousAccounts.ts` (add the scheduled function)
- Modify: `firebase-functions/src/index.ts` (export it)

Pattern matches `cleanupStaleAgentSessions.ts` (v1 `functions.pubsub.schedule(...).onRun(...)`, `admin` already initialized in `index.ts`).

- [ ] **Step 1: Append the scheduled function**

```ts
// append to firebase-functions/src/cleanupStaleAnonymousAccounts.ts
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

/**
 * Daily sweep: delete anonymous accounts idle > 30 days with no linked
 * credential, cascading their /users/{uid} subtree. Logged, not silent.
 */
export const cleanupStaleAnonymousAccounts = functions.pubsub
  .schedule("every 24 hours")
  .timeZone("UTC")
  .onRun(async () => {
    const auth = admin.auth();
    const db = admin.firestore();
    const now = Date.now();

    let sweptCount = 0;
    let pageToken: string | undefined;

    do {
      const page = await auth.listUsers(1000, pageToken);
      const staleUids = page.users
        .filter((u) => isStaleAnonymousAccount(u, now))
        .map((u) => u.uid);

      for (const uid of staleUids) {
        // Cascade-delete the user's Firestore subtree, then the auth account.
        await db.recursiveDelete(db.doc(`users/${uid}`));
        await auth.deleteUser(uid);
        sweptCount += 1;
      }

      pageToken = page.pageToken;
    } while (pageToken);

    functions.logger.info("cleanupStaleAnonymousAccounts swept accounts", {
      sweptCount,
    });
    return null;
  });
```

> `db.recursiveDelete` is available on `@google-cloud/firestore ^7` (present in deps). If the installed admin SDK does not expose it on the `Firestore` instance, fall back to `admin.firestore().recursiveDelete(ref)` via `getFirestore()` from `firebase-admin/firestore`; confirm at implementation time with a one-line check.

- [ ] **Step 2: Export from the functions barrel**

Add to `firebase-functions/src/index.ts` (mirroring the existing `export { … } from "./…"` lines):
```ts
export { cleanupStaleAnonymousAccounts } from "./cleanupStaleAnonymousAccounts";
```

- [ ] **Step 3: Build the functions package**

Run (from `firebase-functions/`): `npm run build`
Expected: `tsc` succeeds, `lib/cleanupStaleAnonymousAccounts.js` emitted, no type errors.

- [ ] **Step 4: Commit**

```bash
git add firebase-functions/src/cleanupStaleAnonymousAccounts.ts firebase-functions/src/index.ts
git commit -m "feat(functions): daily scheduled stale-anonymous-account cleanup" -- firebase-functions/src/cleanupStaleAnonymousAccounts.ts firebase-functions/src/index.ts
```

> **Deploy is out of scope for this plan** (no `firebase deploy` here). Deploying the new scheduled function + updated rules is an explicit, user-authorized release step after slice B is verified.

---

## PHASE G — Full verification gate

### Task 19: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Unit tests green**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/auth`
Expected: `access-tier` + `gated-action-policy` suites PASS.

- [ ] **Step 2: Rules tests green**

Run: `npm run test:rules`
Expected: all anon-deny / full-allow / own-allow cases PASS.

- [ ] **Step 3: Functions tests green**

Run (from `firebase-functions/`): `npm test`
Expected: `cleanupStaleAnonymousAccounts` predicate suite PASS (plus existing suites unbroken).

- [ ] **Step 4: Full app typecheck (commit gate)**

Run: `npm run check`
Expected: no new errors. Fix any that trace to this slice and re-run until clean.

- [ ] **Step 5: Runtime end-to-end proof (Chrome DevTools MCP — requires explicit user permission)**

Drive the canonical funnel and capture each as console/network output (not asserted blind):
1. Fresh guest opens Create, picks a start position → `auth.currentUser.isAnonymous === true`, uid `U`.
2. Builds a few beats, saves → "Saved to library", a `setDoc` to `users/U/sequences/...`.
3. Refresh → library still lists the sequence (anon session restored from persistence).
4. Attempts publish → sign-in sheet (no `publicSequences` write).
5. Signs up with Google (new account) → `auth.currentUser.isAnonymous === false`, uid still `U`, library intact.
6. (Collision path) Repeat 1–3 in a fresh session, then sign up with an *existing* account → import dialog offers the N sequences; confirming imports them (toast), declining leaves them.

Record the artifacts in the task notes. If browser permission is not granted, state explicitly: "I cannot verify the runtime funnel without browser permission — please run steps 1–6 and report what you see."

- [ ] **Step 6: Final commit (if any verification-only fixes were needed)**

```bash
git status --short   # confirm only slice-B files are yours
# commit any fixes with an explicit pathspec, e.g.:
# git commit -m "fix(auth): <what> from verification" -- <exact files>
```

---

## Spec coverage check

| Spec section | Task(s) |
|---|---|
| B1 lazy anon identity | 4, 5 |
| B2 reuse persistence (save un-gates) | 7 (+ ground truth: no repo edits needed) |
| B3 tier refactor + caller audit | 1, 2, 3 |
| B4 signup-as-link + collision import | 8, 9, 10, 11, 12, 13 |
| B5 isFullUser() security closure | 14, 15, 16 |
| B6 30-day stale-anon cleanup | 17, 18 |
| B7 edge cases + verification gate | 7/10–13 runtime, 19 |

**Open items carried from the spec (decided here):** Library *module* stays a signup carrot (default), reachable data via Browse my-library; `presence` rule left as-is; functions live in `firebase-functions/` (not `functions/`). Magic-link upgrade is **in** scope (Task 13) to honor the no-silent-loss invariant.

**Deferred to deploy (user-authorized, not in this plan):** `firebase deploy --only firestore:rules,functions`.
