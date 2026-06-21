# Guest-First Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop treating anonymous guests as account holders — guests use the app uninterrupted, see a single clear "Sign in" entry (no more "SI" avatar, no premature name/auth wizard), get an opt-in guided build, and a gentle account nudge only at value moments.

**Architecture:** One pure identity predicate `isFullAccountUser(isAuthenticated, isAnonymous)` (anon → false) becomes the gate for every onboarding/account-UI surface that means "real account." The FirstRunWizard is re-gated to full accounts only and stripped to an optional name card. The beta notice moves from a wizard gate to a one-time toast. The existing CreateTutorialWizard/TutorialPrompt + appEntryState machine are reused to offer a skippable guided build to guests. Save/library gating is untouched — anonymous guests keep their cloud library.

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, Firebase Auth (anonymous + `linkWith*`), Dexie, Vitest, Chrome DevTools MCP for runtime verification.

**Spec:** `docs/superpowers/specs/2026-06-19-guest-first-onboarding-design.md`

---

## File Structure

**Create:**
- `src/lib/shared/onboarding/components/BetaNoticeToast.svelte` — self-contained one-time beta toast (mounts unconditionally, fires once per device via localStorage flag).
- `tests/unit/auth/is-full-account.test.ts` — truth table for the new predicate.

**Modify:**
- `src/lib/shared/auth/domain/access-tier.ts` — add pure `isFullAccountUser()`.
- `src/lib/shared/auth/state/auth-state.svelte.ts` — add `isFullAccount` getter (+ interface field) delegating to the helper.
- `src/lib/shared/navigation/components/account/AccountRow.svelte` — branch on `isFullAccount`; guest → single "Sign in" entry that opens the auth sheet, never `RobustAvatar`.
- `src/lib/shared/navigation/components/account/AccountPopover.svelte` — branch on `isFullAccount` so an anonymous guest gets the guest/sign-in treatment.
- `src/lib/shared/application/components/MainApplication.svelte` — gate FirstRunWizard mount on `isFullAccount`; drop the `isAuthenticated &&` prefix on the tutorial-prompt + create-tutorial overlays; mount `BetaNoticeToast`.
- `src/lib/shared/onboarding/components/first-run/FirstRunWizard.svelte` — rewrite to a name-only, no-op-if-named card (drop beta/welcome/auth steps + pronouns).
- `src/lib/shared/onboarding/domain/first-run-types.ts` — drop `betaDiscovery`/`auth` step ids + `pronouns` field.
- `src/lib/shared/onboarding/components/first-run/steps/DisplayNameStep.svelte` — remove the pronouns section; make `onBack` optional.
- `src/lib/shared/onboarding/domain/onboarding-flags.ts` — add `CREATE_TUTORIAL_ENABLED`.
- `src/lib/shared/onboarding/state/app-entry-state.svelte.ts` — add `offerCreateTutorial()`; allow guest entry into the prompt independent of the first-run wizard.
- `src/lib/features/create/shared/components/CreateModule.svelte` — offer the guided build on first empty Create mount.
- `src/lib/features/library/services/library-save-service.ts` — fire the value-moment nudge once per device for guests.

**Delete (after confirming no other importers):**
- `src/lib/shared/onboarding/components/first-run/steps/AuthStep.svelte`
- `src/lib/shared/onboarding/components/first-run/steps/BetaDiscoveryStep.svelte`

---

## Task 1: `isFullAccountUser` pure predicate

**Files:**
- Modify: `src/lib/shared/auth/domain/access-tier.ts`
- Test: `tests/unit/auth/is-full-account.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/auth/is-full-account.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { isFullAccountUser } from "$lib/shared/auth/domain/access-tier";

describe("isFullAccountUser", () => {
  it("no user (unauthenticated) → false", () => {
    expect(isFullAccountUser(false, false)).toBe(false);
  });
  it("anonymous (authenticated but anon) → false", () => {
    expect(isFullAccountUser(true, true)).toBe(false);
  });
  it("full account (authenticated, not anon) → true", () => {
    expect(isFullAccountUser(true, false)).toBe(true);
  });
  it("defensive: unauthenticated but anon flag set → false", () => {
    expect(isFullAccountUser(false, true)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/auth/is-full-account.test.ts`
Expected: FAIL — `isFullAccountUser is not a function` / import error.

- [ ] **Step 3: Add the helper**

In `src/lib/shared/auth/domain/access-tier.ts`, after `resolveAccessTier` (around line 17), add:

```typescript
/**
 * A "full account" is an authenticated, non-anonymous user. Anonymous guests
 * are authenticated (they have a Firebase uid for their cloud library) but are
 * NOT full accounts — onboarding and account UI must treat them as guests.
 * This is the same distinction resolveAccessTier draws (anon → "guest").
 */
export function isFullAccountUser(
  isAuthenticated: boolean,
  isAnonymous: boolean
): boolean {
  return isAuthenticated && !isAnonymous;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/auth/is-full-account.test.ts`
Expected: PASS (4 passing).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/auth/domain/access-tier.ts tests/unit/auth/is-full-account.test.ts
git commit -m "feat(auth): add isFullAccountUser predicate (anon != full account)" -- src/lib/shared/auth/domain/access-tier.ts tests/unit/auth/is-full-account.test.ts
```

---

## Task 2: Expose `isFullAccount` on authState

**Files:**
- Modify: `src/lib/shared/auth/state/auth-state.svelte.ts`

- [ ] **Step 1: Import the helper**

At the top of `auth-state.svelte.ts`, add to the existing imports (near line 35 where `UserRole` is imported):

```typescript
import { isFullAccountUser } from "../domain/access-tier";
```

- [ ] **Step 2: Add the getter to the handle**

In `auth-state.svelte.ts`, in the `authState` object literal, immediately after the `isAnonymous` getter (currently lines 755-757):

```typescript
  get isFullAccount() {
    return isFullAccountUser(this.isAuthenticated, this.isAnonymous);
  },
```

- [ ] **Step 3: Add the field to the interface**

In the `AuthStateHandle` interface, after `readonly isAnonymous: boolean;` (currently line 704):

```typescript
  readonly isFullAccount: boolean;
```

- [ ] **Step 4: Typecheck the file's consumers compile**

Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error 2>&1 | grep -iE "auth-state|isFullAccount" | head` (warm `check:watch` is fine instead.)
Expected: no errors referencing `isFullAccount` or `auth-state.svelte.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/auth/state/auth-state.svelte.ts
git commit -m "feat(auth): expose authState.isFullAccount getter" -- src/lib/shared/auth/state/auth-state.svelte.ts
```

---

## Task 3: AccountRow — guest "Sign in" entry (kills "SI")

**Files:**
- Modify: `src/lib/shared/navigation/components/account/AccountRow.svelte`

The current row renders `RobustAvatar` for any authenticated user (incl. anon) and falls back the label to "Sign In" → initials "SI". Branch on `isFullAccount`: guests get a person-plus icon + "Sign in" label that opens the auth sheet directly (not the popover); members keep avatar + menu.

- [ ] **Step 1: Swap the derived predicate**

In `AccountRow.svelte` `<script>`, replace the `isAuthenticated` derived (lines 14-19) with:

```typescript
  const user = $derived(authState.user);
  const isFullAccount = $derived(authState.isFullAccount);
  const displayName = $derived(
    user?.displayName || user?.email || "Account"
  );
  const photoURL = $derived(user?.photoURL ?? null);
```

(The `"Sign In"` fallback is gone — `displayName` is now only ever read on the member branch, so the worst case is "Account", never "SI".)

- [ ] **Step 2: Route guest clicks to the auth sheet**

In `AccountRow.svelte`, replace `handleClick` (lines 23-31) with:

```typescript
  function handleClick() {
    try {
      const hapticService = getHapticFeedback() as HapticFeedback;
      hapticService?.trigger("selection");
    } catch {
      // Ignore if not available
    }
    if (isFullAccount) {
      onclick?.();
    } else {
      // Guests get the auth sheet straight away (Sign up / Log in tabs),
      // not the account menu popover.
      authDrawerState.show("signup");
    }
  }
```

- [ ] **Step 3: Rewrite the drawer-variant markup**

Replace the `{#if variant === "drawer"}` block (lines 34-67) so it branches on `isFullAccount`:

```svelte
{#if variant === "drawer"}
  {#if isFullAccount && onclick}
    <button
      class="account-row drawer interactive"
      onclick={handleClick}
      aria-label="Edit profile"
    >
      <RobustAvatar src={photoURL} name={displayName} customSize={32} />
      <span class="account-label">{displayName}</span>
      <i class="fas fa-chevron-right drawer-chevron" aria-hidden="true"></i>
    </button>
  {:else if isFullAccount}
    <div class="account-row drawer">
      <RobustAvatar src={photoURL} name={displayName} customSize={32} />
      <span class="account-label">{displayName}</span>
    </div>
  {:else}
    <button
      class="account-row drawer interactive"
      onclick={() => {
        try { (getHapticFeedback() as HapticFeedback)?.trigger("selection"); } catch {}
        // Close the containing drawer (e.g. mobile nav) before the auth drawer
        // opens, so we never stack two full-height sheets on top of each other.
        onclick?.();
        authDrawerState.show("signup");
      }}
      aria-label="Sign in"
    >
      <div class="avatar-guest drawer-size">
        <i class="fas fa-user-plus" aria-hidden="true"></i>
      </div>
      <span class="account-label sign-up-label">Sign in</span>
    </button>
  {/if}
{:else}
```

- [ ] **Step 4: Rewrite the expanded/collapsed markup**

Replace the `{:else}` block body (lines 69-92, the second `<button class="account-row">`) with:

```svelte
  <button
    class="account-row"
    class:collapsed={variant === "collapsed"}
    onclick={handleClick}
    aria-label={isFullAccount ? "Account menu" : "Sign in"}
    title={variant === "collapsed" && !isFullAccount ? "Sign in" : undefined}
    aria-haspopup={isFullAccount ? "menu" : undefined}
  >
    {#if isFullAccount}
      <RobustAvatar
        src={photoURL}
        name={displayName}
        customSize={avatarSize}
      />
    {:else}
      <div class="avatar-guest" class:collapsed={variant === "collapsed"}>
        <i class="fas fa-user-plus" aria-hidden="true"></i>
      </div>
    {/if}

    {#if variant !== "collapsed"}
      <span class="account-label">{isFullAccount ? displayName : "Sign in"}</span>
      {#if isFullAccount}
        <i class="fas fa-chevron-up chevron" aria-hidden="true"></i>
      {/if}
    {/if}
  </button>
{/if}
```

- [ ] **Step 5: Grep the diff for the regression source**

Run: `git diff src/lib/shared/navigation/components/account/AccountRow.svelte | grep -iE '"Sign In"|isAuthenticated'`
Expected: no matches (no `isAuthenticated` references, no `"Sign In"` displayName fallback remain).

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/navigation/components/account/AccountRow.svelte
git commit -m "fix(account): guest account row shows Sign in entry, not SI avatar" -- src/lib/shared/navigation/components/account/AccountRow.svelte
```

---

## Task 4: AccountPopover — guest treatment for anon users

**Files:**
- Modify: `src/lib/shared/navigation/components/account/AccountPopover.svelte`

The popover currently uses `isAuthenticated`, so an anonymous guest sees a member identity header + "Sign Out". Switch to `isFullAccount` so anon guests get the guest header + "Sign In". (Members reach this via AccountRow; guests now bypass it via the sheet, but a guest could still reach it on platforms that open the popover — it must read correctly.)

- [ ] **Step 1: Swap the derived predicate**

In `AccountPopover.svelte` `<script>`, replace line 26:

```typescript
  const isAuthenticated = $derived(authState.isAuthenticated);
```

with:

```typescript
  const isFullAccount = $derived(authState.isFullAccount);
```

- [ ] **Step 2: Replace every `isAuthenticated` usage**

In `AccountPopover.svelte`, replace all remaining `isAuthenticated` references with `isFullAccount`. These are at: the identity header branch (line 155), the redundant inner guard (line 177 — leave its `{:else}` guest avatar intact), the nudges guard (line 134 `needsPhoto`), the `needsProp` guard (line 136), and the actions branch (line 237).

Run this to confirm none remain:

Run: `git diff src/lib/shared/navigation/components/account/AccountPopover.svelte | grep -c 'isAuthenticated'`
Expected: only deletions (the `-` lines); `grep '^+' ... | grep isAuthenticated` returns nothing.

- [ ] **Step 3: Typecheck**

Run: warm `check:watch`, or `npx svelte-check --tsconfig ./tsconfig.json --threshold error 2>&1 | grep -i "AccountPopover" | head`
Expected: no errors for `AccountPopover.svelte`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/navigation/components/account/AccountPopover.svelte
git commit -m "fix(account): anonymous guests get guest treatment in account popover" -- src/lib/shared/navigation/components/account/AccountPopover.svelte
```

---

## Task 5: Re-gate the wizard + tutorial overlays in MainApplication

**Files:**
- Modify: `src/lib/shared/application/components/MainApplication.svelte`

Guests must never see the FirstRunWizard. The tutorial-prompt + create-tutorial overlays must be available to guests (the guided-build offer), so they stop being gated on `isAuthenticated`.

- [ ] **Step 1: Add an `isFullAccount` derived**

`MainApplication.svelte` already has (line 115):

```typescript
  const isGuest = $derived(!authState.isAuthenticated || authState.isAnonymous);
```

Immediately after it, add:

```typescript
  const isFullAccount = $derived(authState.isFullAccount);
```

- [ ] **Step 2: Gate the "Loading preferences..." + wizard blocks on `isFullAccount`**

In `MainApplication.svelte`, line 535, change:

```svelte
    {#if isAuthenticated && !firstRunState.isDone() && (firstRunState.syncInProgress || !firstRunState.cloudSynced)}
```

to:

```svelte
    {#if isFullAccount && !firstRunState.isDone() && (firstRunState.syncInProgress || !firstRunState.cloudSynced)}
```

And line 542, change:

```svelte
    {:else if isAuthenticated && (!firstRunState.isDone() || firstRunState.shouldShow)}
```

to:

```svelte
    {:else if isFullAccount && (!firstRunState.isDone() || firstRunState.shouldShow)}
```

- [ ] **Step 3: Open the tutorial overlays to guests**

In `MainApplication.svelte`, line 566, change:

```svelte
    {:else if isAuthenticated && appEntryState.isCreateTutorial()}
```

to:

```svelte
    {:else if appEntryState.isCreateTutorial()}
```

And line 578, change:

```svelte
    {#if isAuthenticated && appEntryState.isTutorialPrompt()}
```

to:

```svelte
    {#if appEntryState.isTutorialPrompt()}
```

- [ ] **Step 4: Mount BetaNoticeToast**

In `MainApplication.svelte`, find the always-mounted toasts (lines 612-613):

```svelte
    <AchievementNotificationToast />
    <XPToast />
```

Add directly after `<XPToast />`:

```svelte

    <!-- One-time beta notice (guest + member, once per device) -->
    {#await import("../../onboarding/components/BetaNoticeToast.svelte") then mod}
      <mod.default />
    {/await}
```

(BetaNoticeToast is created in Task 6 — this step compiles only after that file exists. Implement Task 6 before running the build gate.)

- [ ] **Step 5: Commit (with Task 6)**

Commit this together with Task 6 so the dynamic import resolves. See Task 6 Step 4.

---

## Task 6: BetaNoticeToast component

**Files:**
- Create: `src/lib/shared/onboarding/components/BetaNoticeToast.svelte`

Replaces the wizard's `BetaDiscoveryStep` gate with a non-blocking, one-time toast shown to everyone (guest included) on first visit, tracked by a localStorage flag.

- [ ] **Step 1: Create the component**

Create `src/lib/shared/onboarding/components/BetaNoticeToast.svelte`:

```svelte
<!--
  BetaNoticeToast - One-time, non-blocking beta notice.

  Replaces the old BetaDiscoveryStep wizard gate. Shown once per device to
  everyone (guests included) on first visit, then never again. Renders nothing;
  it just fires a toast on mount when the flag is unset.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";

  const BETA_NOTICE_SEEN_KEY = "tka-beta-notice-seen";

  onMount(() => {
    if (typeof window === "undefined") return;
    try {
      if (localStorage.getItem(BETA_NOTICE_SEEN_KEY) === "true") return;
      localStorage.setItem(BETA_NOTICE_SEEN_KEY, "true");
    } catch {
      // Private browsing / quota — show the notice this session anyway.
    }
    toast.info("TKA Composer is in beta. Features may still change.", 8000);
  });
</script>
```

- [ ] **Step 2: Run the build gate (covers Task 5 + 6)**

Run: `npm run build:fast > /tmp/build.log 2>&1; tail -20 /tmp/build.log`
Expected: build succeeds; no unresolved import for `BetaNoticeToast.svelte`.

- [ ] **Step 3: Verify the toast fires once (runtime)**

This is a visual/runtime change — verify with evidence (DevTools MCP) in the final verification task (Task 11). Do not claim it works here without proof.

- [ ] **Step 4: Commit Tasks 5 + 6 together**

```bash
git add src/lib/shared/onboarding/components/BetaNoticeToast.svelte src/lib/shared/application/components/MainApplication.svelte
git commit -m "feat(onboarding): one-time beta toast; re-gate wizard to full accounts, open guided-build overlays to guests" -- src/lib/shared/onboarding/components/BetaNoticeToast.svelte src/lib/shared/application/components/MainApplication.svelte
```

---

## Task 7: Strip the first-run types

**Files:**
- Modify: `src/lib/shared/onboarding/domain/first-run-types.ts`

The wizard no longer collects pronouns and no longer has beta/auth steps.

- [ ] **Step 1: Reduce `FirstRunData`**

In `first-run-types.ts`, replace the `FirstRunData` interface (lines 16-19):

```typescript
export interface FirstRunData {
  displayName: string;
}
```

- [ ] **Step 2: Reduce `FirstRunStep`**

Replace the `FirstRunStep` union (lines 24-28):

```typescript
export type FirstRunStep = "displayName";
```

- [ ] **Step 3: Reduce `FIRST_RUN_STEPS`**

Replace `FIRST_RUN_STEPS` (lines 43-68) with only the name step:

```typescript
export const FIRST_RUN_STEPS: FirstRunStepConfig[] = [
  {
    id: "displayName",
    title: "What should we call you?",
    subtitle: "This is how you'll appear in the community",
    canSkip: true,
  },
];
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/onboarding/domain/first-run-types.ts
git commit -m "refactor(onboarding): first-run types reduced to optional name step" -- src/lib/shared/onboarding/domain/first-run-types.ts
```

---

## Task 8: Strip pronouns from DisplayNameStep; make Back optional

**Files:**
- Modify: `src/lib/shared/onboarding/components/first-run/steps/DisplayNameStep.svelte`

- [ ] **Step 1: Drop pronouns from props + signature**

In `DisplayNameStep.svelte`, replace the `Props` interface + destructure (lines 11-19):

```typescript
  interface Props {
    initialValue?: string;
    onNext: (displayName: string) => void;
    onBack?: () => void;
    onSkip: () => void;
  }

  const { initialValue = "", onNext, onBack, onSkip }: Props = $props();
```

- [ ] **Step 2: Remove pronouns state + presets + effects**

Delete the `pronouns` state, the `PRONOUN_PRESETS` derived, the pronouns sync `$effect`, and the `selectPronounPreset` function (currently lines 26, 30-35, 48-53, 84-90). Keep `displayName`, `isEditing`, `inputElement`, the auth-name sync effect, and the focus effect.

- [ ] **Step 3: Update the submit handlers (drop pronoun arg)**

Replace `handleSubmit` and `handleKeydown` (lines 66-82):

```typescript
  function handleSubmit(e: Event) {
    e.preventDefault();
    if (currentName) {
      onNext(currentName);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && currentName) {
      e.preventDefault();
      onNext(currentName);
    }
    if (e.key === "Escape") {
      isEditing = false;
      displayName = authDisplayName;
    }
  }
```

- [ ] **Step 4: Remove the pronouns markup**

Delete the entire `<!-- Pronouns (optional) -->` `<div class="pronouns-section">` block (lines 148-174) from the template.

- [ ] **Step 5: Make the Back button conditional**

In the `.button-row` (lines 178-191), wrap the back button so it only renders when `onBack` is provided:

```svelte
    <div class="button-row">
      {#if onBack}
        <button
          type="button"
          class="back-button"
          onclick={onBack}
          aria-label="Go back"
        >
          <i class="fas fa-arrow-left" aria-hidden="true"></i>
        </button>
      {/if}

      <button type="submit" class="next-button" disabled={!currentName}>
        Continue <i class="fas fa-arrow-right" aria-hidden="true"></i>
      </button>
    </div>
```

- [ ] **Step 6: Remove now-dead pronoun CSS + i18n usage**

Delete the pronoun-related style blocks (`.pronouns-section`, `.pronouns-label`, `.optional-tag`, `.pronoun-chips`, `.pronoun-chip`, `.pronoun-chip:hover`, `.pronoun-chip.selected`, `.pronouns-input`, `.pronouns-input::placeholder`, `.pronouns-input:focus`) and remove `pronoun-chip`, `pronouns-input` from the `prefers-reduced-motion` selector list (line ~548). The `t` import (line 9) is now only used by deleted pronoun presets — remove the import if no other `t(...)` call remains in the file (grep to confirm).

Run: `grep -c 't(' src/lib/shared/onboarding/components/first-run/steps/DisplayNameStep.svelte`
Expected: `0` → then remove the `import { t } ...` line. If `> 0`, keep the import.

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/onboarding/components/first-run/steps/DisplayNameStep.svelte
git commit -m "refactor(onboarding): drop pronouns from DisplayNameStep; optional back button" -- src/lib/shared/onboarding/components/first-run/steps/DisplayNameStep.svelte
```

---

## Task 9: Rewrite FirstRunWizard to a name-only, no-op-if-named card

**Files:**
- Modify: `src/lib/shared/onboarding/components/first-run/FirstRunWizard.svelte`
- Delete: `src/lib/shared/onboarding/components/first-run/steps/AuthStep.svelte`, `src/lib/shared/onboarding/components/first-run/steps/BetaDiscoveryStep.svelte`

By the time this mounts, the user is a full account (gated in Task 5). Signup already happened, so no auth step. Beta moved to the toast. If the provider already gave a display name, complete immediately with zero UI; otherwise show the single name card.

- [ ] **Step 1: Confirm no other importers of the dead steps**

Run: `grep -rEl "AuthStep|BetaDiscoveryStep" src/ | grep -v "first-run/steps/"`
Expected: only `FirstRunWizard.svelte` (which we're rewriting). If anything else appears, STOP and reconcile before deleting.

- [ ] **Step 2: Replace FirstRunWizard.svelte**

Overwrite `src/lib/shared/onboarding/components/first-run/FirstRunWizard.svelte` with:

```svelte
<!--
  FirstRunWizard - Post-signup optional name card.

  Only ever mounts for full accounts (gated in MainApplication on isFullAccount),
  after the user has already signed up via the auth sheet. If the provider gave
  us a display name (Google/Facebook/most email signups), this completes with
  zero UI. Otherwise it shows a single skippable "What should we call you?" card.
  Pronouns and theme/prop choices live in Settings; the beta notice is a one-time
  toast (BetaNoticeToast).
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { onMount } from "svelte";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";

  import DisplayNameStep from "./steps/DisplayNameStep.svelte";

  interface Props {
    onComplete: () => void;
    onSkip: () => void;
  }

  const { onComplete, onSkip }: Props = $props();
  // onSkip is part of the wizard contract (MainApplication wires it to
  // markSkipped) but this flow always completes via onComplete.
  void onSkip;

  let hapticService: HapticFeedback | null = null;
  let animateIn = $state(false);

  // If the provider already supplied a name, there's nothing to ask — complete
  // immediately and render nothing.
  const hasProviderName = $derived(!!authState.user?.displayName?.trim());

  onMount(() => {
    try {
      hapticService = getHapticFeedback();
    } catch {
      // Haptics optional
    }

    if (hasProviderName) {
      onComplete();
      return;
    }

    requestAnimationFrame(() => {
      animateIn = true;
    });
  });

  async function completeWith(displayName: string) {
    hapticService?.trigger("success");
    try {
      if (displayName.trim()) {
        await settingsService.updateSetting("userName", displayName.trim());
      }
    } catch (error) {
      console.error("Failed to apply first-run name:", error);
      // Completion is intentional: the name has a safe default and stays
      // editable in Settings, so a save failure should never trap a new user.
      toast.warning("Couldn't save your name. You can set it later in Settings.");
    }
    onComplete();
  }

  function handleNameComplete(name: string) {
    void completeWith(name);
  }

  function handleSkip() {
    hapticService?.trigger("selection");
    onComplete();
  }
</script>

{#if !hasProviderName}
  <div class="first-run-wizard" class:animate-in={animateIn}>
    <div class="step-container">
      <DisplayNameStep onNext={handleNameComplete} onSkip={handleSkip} />
    </div>
  </div>
{/if}

<style>
  .first-run-wizard {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--theme-panel-bg, rgba(0, 0, 0, 0.4));
    z-index: var(--z-priority);
    overflow-y: auto;
  }

  .step-container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    max-width: 600px;
    padding: 0 16px;
  }

  /* Entrance animation (matches DisplayNameStep's container fade) */
  .first-run-wizard :global(.display-name-step) {
    opacity: 0;
    transform: translateY(20px);
    transition:
      opacity 0.4s ease,
      transform 0.4s ease;
  }

  .first-run-wizard.animate-in :global(.display-name-step) {
    opacity: 1;
    transform: translateY(0);
  }

  @media (prefers-reduced-motion: reduce) {
    .first-run-wizard :global(.display-name-step) {
      transition: none;
      opacity: 1;
      transform: none;
    }
  }
</style>
```

- [ ] **Step 3: Delete the dead step components**

```bash
git rm src/lib/shared/onboarding/components/first-run/steps/AuthStep.svelte src/lib/shared/onboarding/components/first-run/steps/BetaDiscoveryStep.svelte
```

- [ ] **Step 4: Build to confirm nothing references the deleted files**

Run: `npm run build:fast > /tmp/build.log 2>&1; tail -20 /tmp/build.log`
Expected: build succeeds; no unresolved imports for `AuthStep` / `BetaDiscoveryStep`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/onboarding/components/first-run/FirstRunWizard.svelte src/lib/shared/onboarding/components/first-run/steps/AuthStep.svelte src/lib/shared/onboarding/components/first-run/steps/BetaDiscoveryStep.svelte
git commit -m "refactor(onboarding): FirstRunWizard is a name-only optional card; retire AuthStep + BetaDiscoveryStep" -- src/lib/shared/onboarding/components/first-run/FirstRunWizard.svelte src/lib/shared/onboarding/components/first-run/steps/AuthStep.svelte src/lib/shared/onboarding/components/first-run/steps/BetaDiscoveryStep.svelte
```

---

## Task 10: Offer the guided build to guests in Create

**Files:**
- Modify: `src/lib/shared/onboarding/domain/onboarding-flags.ts`
- Modify: `src/lib/shared/onboarding/state/app-entry-state.svelte.ts`
- Modify: `src/lib/features/create/shared/components/CreateModule.svelte`

The CreateTutorialWizard + TutorialPrompt already exist but are reachable only after the (now full-account-only) first-run wizard, behind `AUTO_TOURS_ENABLED`. Split the flag so the create-tutorial can run independently of the two unfinished tours (fuse + step-editor), and offer it to a first-time guest on an empty Create. Relaunch stays available via Settings → "Replay create tutorial" (`appEntryState.replay()`), which the overlays now render for guests too (Task 5).

- [ ] **Step 1: Add the split flag**

In `src/lib/shared/onboarding/domain/onboarding-flags.ts`, after the `AUTO_TOURS_ENABLED` export, add:

```typescript
/**
 * The guided-build "Create tutorial" is finished and ship-ready, unlike the
 * fuse-tour and step-editor coach marks still gated by AUTO_TOURS_ENABLED.
 * This flag enables ONLY the create-tutorial offer (guest first-touch in Create
 * + Settings replay), independent of the other two tours.
 */
export const CREATE_TUTORIAL_ENABLED = true;
```

- [ ] **Step 2: Add `offerCreateTutorial()` to appEntryState**

In `src/lib/shared/onboarding/state/app-entry-state.svelte.ts`, import the new flag (the file already imports `AUTO_TOURS_ENABLED` on line 15):

```typescript
import { AUTO_TOURS_ENABLED, CREATE_TUTORIAL_ENABLED } from "../domain/onboarding-flags";
```

Then add this method to the returned object (e.g. right after `isTutorialPrompt()`, around line 120):

```typescript
    /**
     * Offer the guided build (opt-in) the first time a user lands on an empty
     * Create. No-op if already completed, already mid-tutorial/prompt, or the
     * flag is off. Declining (declineTutorial) marks entry complete, so it
     * never re-pops across reloads.
     */
    offerCreateTutorial() {
      if (!CREATE_TUTORIAL_ENABLED) return;
      if (state.hasCompleted) return;
      if (state.phase === "create-tutorial" || state.phase === "tutorial-prompt") {
        return;
      }
      state.phase = "tutorial-prompt";
    },
```

- [ ] **Step 3: Trigger the offer from CreateModule**

In `src/lib/features/create/shared/components/CreateModule.svelte`, import appEntryState near the other onboarding/auth imports (e.g. after line 80 `authDrawerState` import):

```typescript
  import { appEntryState } from "$lib/shared/onboarding/state/app-entry-state.svelte";
```

In `onMount`, after the panel-restore block and before the mobile detection (i.e. right after the `if (!hasDeepLink && CreateModuleState.canAccessEditTab) { ... }` block closes, around line 417), add:

```typescript
        // First-time guided-build offer: only when the user landed on an empty
        // Create (no deep-linked sequence, no restored work). Skippable and
        // self-suppressing after the first decision (appEntryState persists it).
        const hasSequence =
          !!CreateModuleState?.sequenceState.currentSequence?.steps?.length;
        if (!hasDeepLink && !hasSequence) {
          appEntryState.offerCreateTutorial();
        }
```

- [ ] **Step 4: Build**

Run: `npm run build:fast > /tmp/build.log 2>&1; tail -20 /tmp/build.log`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/onboarding/domain/onboarding-flags.ts src/lib/shared/onboarding/state/app-entry-state.svelte.ts src/lib/features/create/shared/components/CreateModule.svelte
git commit -m "feat(onboarding): offer guided build to first-time guests in Create" -- src/lib/shared/onboarding/domain/onboarding-flags.ts src/lib/shared/onboarding/state/app-entry-state.svelte.ts src/lib/features/create/shared/components/CreateModule.svelte
```

---

## Task 11: Value-moment nudge on first guest save

**Files:**
- Modify: `src/lib/features/library/services/library-save-service.ts`

After a guest's first successful save, fire one non-blocking toast nudging account creation. Once per device, guests only (members never see it). The sidebar "Sign in" entry is the always-visible call to action, so a toast reminder is sufficient and non-blocking.

- [ ] **Step 1: Import the identity helper**

`library-save-service.ts` already imports `toast` (line 28) and `authState` (line 30). Add:

```typescript
import { isFullAccountUser } from "$lib/shared/auth/domain/access-tier";
```

- [ ] **Step 2: Add the once-per-device flag constant**

Near the top of the file, beside `SUCCESS_STATE_LINGER_MS` (line 37):

```typescript
/** localStorage flag so the guest "save → create an account" nudge fires once. */
const GUEST_SAVE_NUDGE_SEEN_KEY = "tka-guest-save-nudge-seen";
```

- [ ] **Step 3: Fire the nudge in the save success path**

In `saveSequence`, after `emitProgress(6);` and before the `SUCCESS_STATE_LINGER_MS` pause (currently between lines 141 and 144), add:

```typescript
    // Value-moment nudge: a guest just saved successfully. Encourage account
    // creation once per device. Members (full accounts) never see this.
    this.maybeNudgeGuestToSignUp();
```

Then add this private method to the class (e.g. after `saveSequence`, before `getStepLabel`):

```typescript
  /**
   * One gentle, non-blocking account nudge after a guest's first successful
   * save. Guarded to guests (anon / unauthenticated) and once per device.
   */
  private maybeNudgeGuestToSignUp(): void {
    if (typeof window === "undefined") return;
    const isFullAccount = isFullAccountUser(
      authState.isAuthenticated,
      authState.isAnonymous
    );
    if (isFullAccount) return;
    try {
      if (localStorage.getItem(GUEST_SAVE_NUDGE_SEEN_KEY) === "true") return;
      localStorage.setItem(GUEST_SAVE_NUDGE_SEEN_KEY, "true");
    } catch {
      return; // Private browsing — skip rather than nag every save.
    }
    toast.info(
      "Saved on this device. Create a free account to keep it anywhere.",
      6000
    );
  }
```

- [ ] **Step 4: Build**

Run: `npm run build:fast > /tmp/build.log 2>&1; tail -20 /tmp/build.log`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/library/services/library-save-service.ts
git commit -m "feat(onboarding): one-time value-moment account nudge after first guest save" -- src/lib/features/library/services/library-save-service.ts
```

---

## Task 12: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck (capture once, grep many)**

Run: `npm run check > /tmp/check.log 2>&1; grep -niE "error" /tmp/check.log | head -40`
Expected: no errors introduced in any touched file (`auth-state`, `access-tier`, `AccountRow`, `AccountPopover`, `MainApplication`, `FirstRunWizard`, `DisplayNameStep`, `first-run-types`, `onboarding-flags`, `app-entry-state`, `CreateModule`, `library-save-service`, `BetaNoticeToast`). Fix any and re-capture.

- [ ] **Step 2: Unit tests**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/auth/is-full-account.test.ts tests/unit/auth/access-tier.test.ts`
Expected: all pass.

- [ ] **Step 3: Full build**

Run: `npm run build > /tmp/build.log 2>&1; tail -25 /tmp/build.log`
Expected: build succeeds end to end.

- [ ] **Step 4: Runtime verification — clean isolated guest (DevTools MCP)**

Ask Austen for permission to drive the browser, then in an isolated (clean-guest) context against the dev server, capture evidence for each:

1. Land on the app → **no FirstRunWizard overlay** (query: no element from FirstRunWizard; no "What should we call you?" / "Create your account" text).
2. Beta toast appears **once**; reload → does **not** reappear (localStorage `tka-beta-notice-seen` set).
3. Sidebar account row shows a **"Sign in"** entry with a person-plus icon — **not** an "SI" avatar (screenshot + DOM text assertion: label text is "Sign in").
4. Open Create on an empty workspace → the **guided-build prompt** ("Quick tour?") appears; Skip → app usable; it does not re-pop on reload.
5. Build + save a sequence → the **value-moment toast** ("Saved on this device. Create a free account to keep it anywhere.") fires once.
6. Click the account row → the **auth sheet** opens with Sign up / Log in (signup default).
7. Sign up via email-without-name → the **name card** appears once; sign up via Google (provider name) → **no** name card; reload as member → **avatar + name**, no "Sign in", no wizard.

Record each as a screenshot or `evaluate_script` DOM/localStorage assertion. If the dev server or network blocks a step, state exactly which step is unverified and what evidence is missing — do not claim it works.

- [ ] **Step 5: Final summary**

Report: predicate test output, check result, build result, and the runtime evidence (or the explicit list of what could not be verified and why).

---

## Notes for the executor

- **Commit scope:** every commit uses an explicit pathspec (`git commit -m "..." -- <paths>`). The shared index may hold other agents' work — never bare-commit.
- **No branches.** Work on `main`.
- **Save/library gating is out of scope.** Anonymous guests still satisfy `isOwner` and keep their cloud library. Only onboarding/account UI switches to `isFullAccount`.
- **Out of scope (do not touch):** slice D export-gating policy; the fuse-tour and step-editor coach marks (still behind `AUTO_TOURS_ENABLED`). Already-shipped items in the spec's "Already shipped" list must not be redone.
- **Fast loop:** use warm `check:watch` while iterating; reserve the full `npm run check` / `npm run build` for the gates above. Never run `npm run dev` (port 5173 is Austen's).
```
