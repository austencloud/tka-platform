# First-Session Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert first-session users — one tap generates and keeps a real sequence (Leak A), and the first successful guest save raises one instrumented, actionable "create a free account" prompt through any save path (Leak B).

**Architecture:** A root-owned post-save activation coordinator (`postSaveActivation`) is fed by every save-completion site; it renders the existing `AuthNudge` primitive once per guest UID after the save surface closes. A headless `startFirstSequence` command reuses the existing `GenerationOrchestrator` + `LibrarySaveService`, writes into the real tab `SequenceState`, and hands off to the coordinator. A first-run starter card mounts on empty Create behind a three-state, account-aware eligibility gate, arbitrating with the existing `offerCreateTutorial()`. Both behaviors gate on `FIRST_SESSION_ACTIVATION_ENABLED`.

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, vitest (`--config tests/config/vitest.config.ts`, jsdom), Dexie, Firestore, PostHog.

**Spec:** `docs/superpowers/specs/active/2026-07-22-first-session-activation-design.md`

---

## File Structure

**New files (each single responsibility):**
- `src/lib/shared/onboarding/state/guest-first-save-guard.ts` — versioned, per-guest-UID localStorage guard (pure logic).
- `src/lib/shared/onboarding/state/post-save-activation-state.svelte.ts` — root coordinator: decides + drives the first-save prompt.
- `src/lib/shared/onboarding/services/start-first-sequence.ts` — headless generate → load → keep command (pure orchestration over injected deps).
- `src/lib/shared/onboarding/state/first-sequence-starter-state.svelte.ts` — dismissal flag (local + cloud + missing-doc reset) and async account-aware eligibility.
- `src/lib/features/onboarding/components/FirstSequenceStarter.svelte` — the CTA card.
- `src/lib/shared/onboarding/components/PostSaveActivationHost.svelte` — root host that mounts `AuthNudge` in a `BaseModal` off coordinator state.

**Modified files:**
- `src/lib/shared/auth/domain/auth-nudge-trigger.ts` — add `guest-first-save` trigger + copy.
- `tests/unit/auth/auth-nudge-trigger.test.ts` — bump the trigger-set assertion to include the new key.
- `src/lib/shared/onboarding/domain/onboarding-flags.ts` — add `FIRST_SESSION_ACTIVATION_ENABLED`.
- `src/lib/shared/analytics/services/onboarding-events.ts` — add starter + first-save-prompt events.
- `src/lib/shared/library/domain/library-contract-types.ts` — add `persisted` to `SaveResult`.
- `src/lib/features/library/services/library-save-service.ts` — set `persisted`; remove `maybeNudgeGuestToSignUp`.
- `src/lib/features/create/shared/state/save-panel-state.svelte.ts` — fire the coordinator after the panel closes.
- `src/lib/shared/sequence-viewer/state/library-action-handler.svelte.ts` — fire the coordinator after a viewer save.
- `src/lib/features/browse/collections/components/ScanCardSheet.svelte` — fire the coordinator after a printed-card import.
- `src/lib/shared/auth/services/auth-boot-orchestrator.ts` — hydrate the starter doc at boot.
- `src/lib/features/create/shared/components/CreateModule.svelte` — suppress `offerCreateTutorial()` while the starter is eligible + flag on.
- `src/lib/features/create/shared/components/StandardWorkspaceLayout.svelte` — mount `FirstSequenceStarter` on empty Construct.
- `src/lib/shared/browse/components/BrowsePanel.svelte` — add `emptyAction` prop to the non-filter empty state.
- `src/lib/features/browse/collections/components/AllLibraryView.svelte` — pass the "Make your first sequence" action.
- `src/lib/shared/application/components/MainApplication.svelte` — mount `PostSaveActivationHost`.

**Locked type/name contract (use verbatim across tasks):**
- `AuthNudgeTrigger` gains `"guest-first-save"`; copy: `"Create a free account to keep your sequences and find them on any device."`
- `SaveResult` gains `persisted: boolean`.
- Guard key: `` `tka-guest-first-save-prompt-v1:${uid}` ``.
- Coordinator: `postSaveActivation.onGuestSaveSucceeded(sequenceId: string): void`; getters `visible`, `sequenceId`; methods `accept()`, `dismissPrompt()`, `login()`.
- Command: `startFirstSequence(deps): Promise<StartFirstSequenceResult>` with result union `{ status: "generated-kept"; sequenceId } | { status: "generate-failed" } | { status: "persist-failed" }`.
- Starter state: `firstSequenceStarterState` with `dismissed`, `cloudSynced`, `sessionRearm`, `markDismissed()`, `rearmForSession()`, `syncFromCloud()`, `syncToCloud()`, `markCloudSyncComplete()`; free fn `resolveHasSavedAnything(): Promise<boolean>`.
- Flag: `FIRST_SESSION_ACTIVATION_ENABLED`.

---

## Task 1: Add the `guest-first-save` nudge trigger + copy

**Files:**
- Modify: `src/lib/shared/auth/domain/auth-nudge-trigger.ts`
- Test: `tests/unit/auth/auth-nudge-trigger.test.ts:26-41`

- [ ] **Step 1: Update the failing contract test to expect 12 triggers**

In `tests/unit/auth/auth-nudge-trigger.test.ts`, change the `it("has exactly the 11 live triggers...")` block's expected array to add the new key and rename the title:

```ts
  it("has exactly the 12 live triggers (guest-first-save added for the proactive first-save prompt)", () => {
    expect(Object.keys(AUTH_NUDGE_TEXTS).sort()).toEqual(
      [
        "beat-cap-guest",
        "edit-community",
        "export",
        "guest-first-save",
        "loop-locked-guest",
        "module:learn",
        "module:library",
        "module:settings",
        "save",
        "viewer-signin-account",
        "viewer-signin-download",
        "viewer-signin-publish",
      ].sort()
    );
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/auth/auth-nudge-trigger.test.ts --config tests/config/vitest.config.ts`
Expected: FAIL — the 12-key assertion fails (only 11 keys exist) and the canonical-phrase test fails once the key is added but before copy is present.

- [ ] **Step 3: Add the trigger to the union and the copy map**

In `src/lib/shared/auth/domain/auth-nudge-trigger.ts`, add to the union (after `"viewer-signin-account"`):

```ts
  | "viewer-signin-account"
  | "guest-first-save";
```

Add to `AUTH_NUDGE_TEXTS` (after the `"viewer-signin-account"` entry):

```ts
  "viewer-signin-account":
    "Create a free account to save your scans and build your library.",
  // Proactive value-moment prompt fired after a guest's first successful save
  // (post-save-activation-state). Names the concrete benefit, not a deadline —
  // anonymous cleanup is 30-day-inactivity and the local copy may persist.
  "guest-first-save":
    "Create a free account to keep your sequences and find them on any device.",
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/auth/auth-nudge-trigger.test.ts --config tests/config/vitest.config.ts`
Expected: PASS (12 keys; contains "create a free account"; no em dash; no banned phrase).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/auth/domain/auth-nudge-trigger.ts tests/unit/auth/auth-nudge-trigger.test.ts
git commit -m "feat(auth): add guest-first-save nudge trigger + copy" -- src/lib/shared/auth/domain/auth-nudge-trigger.ts tests/unit/auth/auth-nudge-trigger.test.ts
```

---

## Task 2: Add the `FIRST_SESSION_ACTIVATION_ENABLED` flag

**Files:**
- Modify: `src/lib/shared/onboarding/domain/onboarding-flags.ts`

- [ ] **Step 1: Add the flag**

Append to `src/lib/shared/onboarding/domain/onboarding-flags.ts`:

```ts
/**
 * First-Session Activation (spec 2026-07-22): the one-tap "generate my first
 * sequence" starter on empty Create, plus the proactive prompt after a guest's
 * first successful save. A compile-time deploy switch — flip to false for an
 * instant rollback. For percentage rollout, back this with the PostHog
 * kill-switch path (post-hog-feature-flag-service.svelte.ts) instead.
 */
export const FIRST_SESSION_ACTIVATION_ENABLED = true;
```

- [ ] **Step 2: Verify it type-checks (no dedicated test; consumed by later tasks)**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep onboarding-flags || echo "clean"`
Expected: `clean`

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/onboarding/domain/onboarding-flags.ts
git commit -m "feat(onboarding): add FIRST_SESSION_ACTIVATION_ENABLED flag" -- src/lib/shared/onboarding/domain/onboarding-flags.ts
```

---

## Task 3: Add activation analytics events

**Files:**
- Modify: `src/lib/shared/analytics/services/onboarding-events.ts`
- Test: `tests/unit/onboarding-activation-events.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/onboarding-activation-events.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const captureEvent = vi.fn();
vi.mock("$lib/shared/analytics/services/posthog", () => ({ captureEvent }));

import {
  logFirstSequenceStarterShown,
  logFirstSequenceStarterKept,
  logGuestFirstSavePromptShown,
  logGuestFirstSavePromptAccepted,
} from "$lib/shared/analytics/services/onboarding-events";

describe("activation events", () => {
  beforeEach(() => captureEvent.mockClear());

  it("starter shown emits the namespaced event", () => {
    logFirstSequenceStarterShown();
    expect(captureEvent).toHaveBeenCalledWith(
      "onboarding_first_sequence_starter_shown",
      {}
    );
  });

  it("starter kept carries the sequence id", () => {
    logFirstSequenceStarterKept({ sequenceId: "abc" });
    expect(captureEvent).toHaveBeenCalledWith(
      "onboarding_first_sequence_starter_kept",
      { sequenceId: "abc" }
    );
  });

  it("guest first-save prompt shown/accepted emit namespaced events", () => {
    logGuestFirstSavePromptShown();
    logGuestFirstSavePromptAccepted();
    expect(captureEvent).toHaveBeenCalledWith(
      "onboarding_guest_first_save_prompt_shown",
      {}
    );
    expect(captureEvent).toHaveBeenCalledWith(
      "onboarding_guest_first_save_prompt_accepted",
      {}
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/onboarding-activation-events.test.ts --config tests/config/vitest.config.ts`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Add the event functions**

Append to `src/lib/shared/analytics/services/onboarding-events.ts`:

```ts
/** First-run starter card became visible on empty Create. */
export function logFirstSequenceStarterShown(
  props: OnboardingEventProps = {}
): void {
  captureEvent("onboarding_first_sequence_starter_shown", props);
}

/** Starter generated a sequence into the workspace. */
export function logFirstSequenceStarterGenerated(
  props: OnboardingEventProps = {}
): void {
  captureEvent("onboarding_first_sequence_starter_generated", props);
}

/** Starter's generated sequence was persisted (kept). */
export function logFirstSequenceStarterKept(
  props: OnboardingEventProps = {}
): void {
  captureEvent("onboarding_first_sequence_starter_kept", props);
}

/** User chose "I'll build my own" (starter dismissed). */
export function logFirstSequenceStarterDismissed(
  props: OnboardingEventProps = {}
): void {
  captureEvent("onboarding_first_sequence_starter_dismissed", props);
}

/** Proactive first-save prompt became visible. */
export function logGuestFirstSavePromptShown(
  props: OnboardingEventProps = {}
): void {
  captureEvent("onboarding_guest_first_save_prompt_shown", props);
}

/** User tapped "Create account" on the first-save prompt. */
export function logGuestFirstSavePromptAccepted(
  props: OnboardingEventProps = {}
): void {
  captureEvent("onboarding_guest_first_save_prompt_accepted", props);
}

/** User dismissed the first-save prompt ("Not now"). */
export function logGuestFirstSavePromptDeclined(
  props: OnboardingEventProps = {}
): void {
  captureEvent("onboarding_guest_first_save_prompt_declined", props);
}

/** User tapped "Log in" on the first-save prompt. */
export function logGuestFirstSavePromptLogin(
  props: OnboardingEventProps = {}
): void {
  captureEvent("onboarding_guest_first_save_prompt_login", props);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/unit/onboarding-activation-events.test.ts --config tests/config/vitest.config.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/analytics/services/onboarding-events.ts tests/unit/onboarding-activation-events.test.ts
git commit -m "feat(analytics): add first-session activation events" -- src/lib/shared/analytics/services/onboarding-events.ts tests/unit/onboarding-activation-events.test.ts
```

---

## Task 4: Add `persisted` to `SaveResult`; set it in the service

**Files:**
- Modify: `src/lib/shared/library/domain/library-contract-types.ts:72-77`
- Modify: `src/lib/features/library/services/library-save-service.ts:178-202,241-252,258-275`
- Test: `tests/unit/library-save-persisted-flag.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/library-save-persisted-flag.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { SaveResult } from "$lib/shared/library/domain/library-contract-types";

describe("SaveResult", () => {
  it("carries a persisted flag", () => {
    const r: SaveResult = { sequenceId: "x", persisted: true };
    expect(r.persisted).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/library-save-persisted-flag.test.ts --config tests/config/vitest.config.ts`
Expected: FAIL — `persisted` not on `SaveResult`.

- [ ] **Step 3: Add the field**

In `src/lib/shared/library/domain/library-contract-types.ts`, extend `SaveResult`:

```ts
export interface SaveResult {
  /** The saved sequence ID */
  sequenceId: string;
  /** URL of the uploaded thumbnail (if successful) */
  thumbnailUrl?: string;
  /** True when the local (Dexie) write succeeded — the durability guarantee.
   *  Post-save activation only fires when this is true. */
  persisted: boolean;
}
```

- [ ] **Step 4: Set `persisted` in the service and delete the legacy toast**

In `src/lib/features/library/services/library-save-service.ts`:

(a) Track the Dexie outcome. Replace the `try { ... } catch (dexieError) { ... }` block at `:178-200` so the catch records failure — add `let persisted = true;` immediately before the `try` (i.e. before line 178), and set `persisted = false;` as the first line inside the `catch (dexieError)` block.

(b) At the return site `:241-252`, delete the `this.maybeNudgeGuestToSignUp();` call and its two-line comment (`:244-246`), and change the return to:

```ts
    // Brief pause to show success state
    await new Promise((resolve) => setTimeout(resolve, SUCCESS_STATE_LINGER_MS));

    return { sequenceId, thumbnailUrl, persisted };
```

(c) Delete the entire `private maybeNudgeGuestToSignUp(): void { ... }` method (`:258-275`) and the now-unused `GUEST_SAVE_NUDGE_SEEN_KEY` const (`:46`).

- [ ] **Step 5: Run to verify the type test passes and no dangling refs remain**

Run: `npx vitest run tests/unit/library-save-persisted-flag.test.ts --config tests/config/vitest.config.ts`
Expected: PASS.
Run: `grep -rn "maybeNudgeGuestToSignUp\|GUEST_SAVE_NUDGE_SEEN_KEY" src/`
Expected: no matches.

- [ ] **Step 6: Fix any other `SaveResult` literal that now lacks `persisted`**

Run: `grep -rn "SaveResult" src/ | grep -i "return {" ; grep -rln "sequenceId:" src/lib/shared/library src/lib/features/library`
For each place that constructs a `SaveResult` object literal (the `LibraryRepository.saveSequence` returns a different `{ id }` shape and is NOT a `SaveResult` — leave it), add `persisted: true`. Then:
Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "saveresult\|persisted" || echo clean`
Expected: `clean`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/library/domain/library-contract-types.ts src/lib/features/library/services/library-save-service.ts tests/unit/library-save-persisted-flag.test.ts
git commit -m "feat(library): SaveResult.persisted; remove passive guest toast" -- src/lib/shared/library/domain/library-contract-types.ts src/lib/features/library/services/library-save-service.ts tests/unit/library-save-persisted-flag.test.ts
```

---

## Task 5: Per-guest-UID first-save guard (pure logic)

**Files:**
- Create: `src/lib/shared/onboarding/state/guest-first-save-guard.ts`
- Test: `tests/unit/guest-first-save-guard.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/guest-first-save-guard.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  hasSeenGuestFirstSavePrompt,
  markGuestFirstSavePromptSeen,
} from "$lib/shared/onboarding/state/guest-first-save-guard";

beforeEach(() => localStorage.clear());

describe("guest-first-save guard", () => {
  it("is unseen for a fresh guest uid", () => {
    expect(hasSeenGuestFirstSavePrompt("uid-1")).toBe(false);
  });

  it("marks per-uid, not globally", () => {
    markGuestFirstSavePromptSeen("uid-1");
    expect(hasSeenGuestFirstSavePrompt("uid-1")).toBe(true);
    expect(hasSeenGuestFirstSavePrompt("uid-2")).toBe(false);
  });

  it("does not throw when storage is unavailable (returns false / no-op)", () => {
    expect(hasSeenGuestFirstSavePrompt("")).toBe(false);
    expect(() => markGuestFirstSavePromptSeen("")).not.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/guest-first-save-guard.test.ts --config tests/config/vitest.config.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the guard**

Create `src/lib/shared/onboarding/state/guest-first-save-guard.ts`:

```ts
/**
 * Once-per-guest-UID guard for the proactive first-save prompt.
 *
 * Versioned + uid-scoped on purpose: the old passive toast used the unscoped
 * key "tka-guest-save-nudge-seen"; reusing it would silently exclude every
 * guest who only ever saw that weak toast. A new versioned key re-reaches them.
 */
const KEY_PREFIX = "tka-guest-first-save-prompt-v1:";

export function hasSeenGuestFirstSavePrompt(uid: string): boolean {
  if (!uid || typeof window === "undefined") return false;
  try {
    return localStorage.getItem(KEY_PREFIX + uid) === "true";
  } catch {
    return false;
  }
}

export function markGuestFirstSavePromptSeen(uid: string): void {
  if (!uid || typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY_PREFIX + uid, "true");
  } catch {
    // Private browsing — skip rather than nag on every save.
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/unit/guest-first-save-guard.test.ts --config tests/config/vitest.config.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/onboarding/state/guest-first-save-guard.ts tests/unit/guest-first-save-guard.test.ts
git commit -m "feat(onboarding): per-guest-uid first-save prompt guard" -- src/lib/shared/onboarding/state/guest-first-save-guard.ts tests/unit/guest-first-save-guard.test.ts
```

---

## Task 6: Post-save activation coordinator

**Files:**
- Create: `src/lib/shared/onboarding/state/post-save-activation-state.svelte.ts`
- Test: `tests/unit/post-save-activation-state.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/post-save-activation-state.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const authState = { isFullAccount: false, effectiveUserId: "guest-1" };
vi.mock("$lib/shared/auth/state/auth-state.svelte", () => ({ authState }));

const show = vi.fn();
vi.mock("$lib/shared/auth/state/auth-drawer-state.svelte", () => ({
  authDrawerState: { show },
}));

vi.mock("$lib/shared/analytics/services/onboarding-events", () => ({
  logGuestFirstSavePromptShown: vi.fn(),
  logGuestFirstSavePromptAccepted: vi.fn(),
  logGuestFirstSavePromptDeclined: vi.fn(),
  logGuestFirstSavePromptLogin: vi.fn(),
}));

import { postSaveActivation } from "$lib/shared/onboarding/state/post-save-activation-state.svelte";
import { FIRST_SESSION_ACTIVATION_ENABLED } from "$lib/shared/onboarding/domain/onboarding-flags";

beforeEach(() => {
  localStorage.clear();
  show.mockClear();
  authState.isFullAccount = false;
  authState.effectiveUserId = "guest-1";
  postSaveActivation.dismissPrompt();
});

describe("postSaveActivation", () => {
  it("shows once for a guest, then never again for the same uid", () => {
    if (!FIRST_SESSION_ACTIVATION_ENABLED) return;
    postSaveActivation.onGuestSaveSucceeded("seq-1");
    expect(postSaveActivation.visible).toBe(true);
    postSaveActivation.dismissPrompt();
    postSaveActivation.onGuestSaveSucceeded("seq-2");
    expect(postSaveActivation.visible).toBe(false);
  });

  it("never shows for a full account", () => {
    authState.isFullAccount = true;
    postSaveActivation.onGuestSaveSucceeded("seq-1");
    expect(postSaveActivation.visible).toBe(false);
  });

  it("accept opens the signup drawer with the guest-first-save reason", () => {
    postSaveActivation.onGuestSaveSucceeded("seq-1");
    postSaveActivation.accept();
    expect(show).toHaveBeenCalledWith("signup", "guest-first-save");
    expect(postSaveActivation.visible).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/post-save-activation-state.test.ts --config tests/config/vitest.config.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the coordinator**

Create `src/lib/shared/onboarding/state/post-save-activation-state.svelte.ts`:

```ts
import { authState } from "$lib/shared/auth/state/auth-state.svelte";
import { authDrawerState } from "$lib/shared/auth/state/auth-drawer-state.svelte";
import { FIRST_SESSION_ACTIVATION_ENABLED } from "$lib/shared/onboarding/domain/onboarding-flags";
import {
  hasSeenGuestFirstSavePrompt,
  markGuestFirstSavePromptSeen,
} from "./guest-first-save-guard";
import {
  logGuestFirstSavePromptShown,
  logGuestFirstSavePromptAccepted,
  logGuestFirstSavePromptDeclined,
  logGuestFirstSavePromptLogin,
} from "$lib/shared/analytics/services/onboarding-events";

let _visible = $state(false);
let _sequenceId = $state<string | null>(null);

/**
 * Root-owned coordinator for the proactive first-save prompt. Every save-
 * completion site (create save panel, viewer save, printed-card import, the
 * first-sequence starter's auto-save) calls onGuestSaveSucceeded AFTER it knows
 * the save persisted. The coordinator gates to still-guest + once-per-uid and
 * drives PostSaveActivationHost. A service never renders the nudge itself.
 */
export const postSaveActivation = {
  get visible() {
    return _visible;
  },
  get sequenceId() {
    return _sequenceId;
  },

  onGuestSaveSucceeded(sequenceId: string): void {
    if (!FIRST_SESSION_ACTIVATION_ENABLED) return;
    if (typeof window === "undefined") return;
    if (authState.isFullAccount) return;
    const uid = authState.effectiveUserId;
    if (!uid || hasSeenGuestFirstSavePrompt(uid)) return;

    markGuestFirstSavePromptSeen(uid);
    _sequenceId = sequenceId;
    _visible = true;
    logGuestFirstSavePromptShown();
  },

  accept(): void {
    _visible = false;
    logGuestFirstSavePromptAccepted();
    authDrawerState.show("signup", "guest-first-save");
  },

  login(): void {
    _visible = false;
    logGuestFirstSavePromptLogin();
    authDrawerState.show("signin");
  },

  dismissPrompt(): void {
    if (_visible) logGuestFirstSavePromptDeclined();
    _visible = false;
    _sequenceId = null;
  },
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/unit/post-save-activation-state.test.ts --config tests/config/vitest.config.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/onboarding/state/post-save-activation-state.svelte.ts tests/unit/post-save-activation-state.test.ts
git commit -m "feat(onboarding): post-save activation coordinator" -- src/lib/shared/onboarding/state/post-save-activation-state.svelte.ts tests/unit/post-save-activation-state.test.ts
```

---

## Task 7: Root host — mount `AuthNudge` off the coordinator

**Files:**
- Create: `src/lib/shared/onboarding/components/PostSaveActivationHost.svelte`
- Modify: `src/lib/shared/application/components/MainApplication.svelte:590` (add sibling in the root overlay region)

- [ ] **Step 1: Create the host**

Create `src/lib/shared/onboarding/components/PostSaveActivationHost.svelte` (follows the `CreateModule.svelte:811-826` BaseModal+AuthNudge pattern):

```svelte
<script lang="ts">
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import AuthNudge from "$lib/shared/auth/components/AuthNudge.svelte";
  import { postSaveActivation } from "$lib/shared/onboarding/state/post-save-activation-state.svelte";
</script>

<BaseModal
  open={postSaveActivation.visible}
  size="fit"
  class="chromeless"
  onclose={() => postSaveActivation.dismissPrompt()}
>
  <AuthNudge
    trigger="guest-first-save"
    onCreateAccount={() => postSaveActivation.accept()}
    onLogin={() => postSaveActivation.login()}
    onDismiss={() => postSaveActivation.dismissPrompt()}
  />
</BaseModal>
```

- [ ] **Step 2: Mount it at the app root**

In `src/lib/shared/application/components/MainApplication.svelte`, add the import near the other overlay-host imports, and mount it as a sibling right after the `<!-- Support modal -->` `<SupportModal />` line (`:596`):

```svelte
    <!-- Support modal — in-app "buy me a coffee" (self-driven via supportModalState) -->
    <SupportModal />

    <!-- Proactive first-save activation prompt (self-driven via postSaveActivation) -->
    <PostSaveActivationHost />
```

Add the import alongside the existing static overlay imports (e.g. near the `AuthSheet`/`SupportModal` imports):

```ts
  import PostSaveActivationHost from "$lib/shared/onboarding/components/PostSaveActivationHost.svelte";
```

- [ ] **Step 3: Verify it type-checks**

Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error 2>&1 | grep -i "PostSaveActivation\|MainApplication" || echo clean`
Expected: `clean`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/onboarding/components/PostSaveActivationHost.svelte src/lib/shared/application/components/MainApplication.svelte
git commit -m "feat(onboarding): root host for first-save activation prompt" -- src/lib/shared/onboarding/components/PostSaveActivationHost.svelte src/lib/shared/application/components/MainApplication.svelte
```

---

## Task 8: Fire the coordinator from all three save paths

**Files:**
- Modify: `src/lib/features/create/shared/state/save-panel-state.svelte.ts:308-323`
- Modify: `src/lib/shared/sequence-viewer/state/library-action-handler.svelte.ts:126-131`
- Modify: `src/lib/features/browse/collections/components/ScanCardSheet.svelte:190-201`

- [ ] **Step 1: Create-panel path — fire AFTER the panel closes**

In `save-panel-state.svelte.ts`, add the import at the top:

```ts
import { postSaveActivation } from "$lib/shared/onboarding/state/post-save-activation-state.svelte";
```

In `handleSave`, after `handleClose();` (`:323`), add (guarded by the service's `persisted` flag):

```ts
      handleClose();

      // Proactive convert-on-first-save (spec 2026-07-22): only after the save
      // surface has closed, and only if the local write actually landed.
      if (result.persisted) {
        postSaveActivation.onGuestSaveSucceeded(result.sequenceId);
      }
```

- [ ] **Step 2: Viewer save path**

In `library-action-handler.svelte.ts`, add the import:

```ts
import { postSaveActivation } from "$lib/shared/onboarding/state/post-save-activation-state.svelte";
```

Replace the success tail (`await libraryRepo.saveSequence(sequenceWithIntent); showToast("Saved to library", "success");`) so it captures the id and fires the coordinator:

```ts
      const saved = await libraryRepo.saveSequence(sequenceWithIntent);
      showToast("Saved to library", "success");
      postSaveActivation.onGuestSaveSucceeded(saved.id);
```

(The `LibraryRepository.saveSequence` throws on failure, so reaching this line means it persisted.)

- [ ] **Step 3: Printed-card import path**

In `ScanCardSheet.svelte`, add the import in the `<script>`:

```ts
import { postSaveActivation } from "$lib/shared/onboarding/state/post-save-activation-state.svelte";
```

In the `!resolution.docBacked` block, right after `createdLibraryId = saved.id;` (`:200`):

```ts
					targetId = saved.id;
					createdLibraryId = saved.id;
					postSaveActivation.onGuestSaveSucceeded(saved.id);
```

- [ ] **Step 4: Verify type-check across the three edits**

Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error 2>&1 | grep -iE "save-panel-state|library-action-handler|ScanCardSheet" || echo clean`
Expected: `clean`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/create/shared/state/save-panel-state.svelte.ts src/lib/shared/sequence-viewer/state/library-action-handler.svelte.ts src/lib/features/browse/collections/components/ScanCardSheet.svelte
git commit -m "feat(onboarding): wire all guest save paths to activation coordinator" -- src/lib/features/create/shared/state/save-panel-state.svelte.ts src/lib/shared/sequence-viewer/state/library-action-handler.svelte.ts src/lib/features/browse/collections/components/ScanCardSheet.svelte
```

---

## Task 9: Headless `startFirstSequence` command

**Files:**
- Create: `src/lib/shared/onboarding/services/start-first-sequence.ts`
- Test: `tests/unit/start-first-sequence.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/start-first-sequence.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { startFirstSequence } from "$lib/shared/onboarding/services/start-first-sequence";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

const seq = { id: "s1", word: "AB", steps: [{}, {}] } as unknown as SequenceData;

function deps(over: Partial<Parameters<typeof startFirstSequence>[0]> = {}) {
  return {
    generate: vi.fn(async () => seq),
    loadIntoWorkspace: vi.fn(),
    save: vi.fn(async () => ({ sequenceId: "s1", persisted: true })),
    isGuest: () => true,
    onKept: vi.fn(),
    ...over,
  };
}

describe("startFirstSequence", () => {
  it("generates, loads, keeps, and hands off on success", async () => {
    const d = deps();
    const r = await startFirstSequence(d);
    expect(r).toEqual({ status: "generated-kept", sequenceId: "s1" });
    expect(d.loadIntoWorkspace).toHaveBeenCalledWith(seq);
    expect(d.onKept).toHaveBeenCalledWith("s1");
  });

  it("generation failure keeps the starter visible, no load, no keep", async () => {
    const d = deps({ generate: vi.fn(async () => { throw new Error("boom"); }) });
    const r = await startFirstSequence(d);
    expect(r).toEqual({ status: "generate-failed" });
    expect(d.loadIntoWorkspace).not.toHaveBeenCalled();
    expect(d.onKept).not.toHaveBeenCalled();
  });

  it("persist failure reports persist-failed and does not hand off", async () => {
    const d = deps({ save: vi.fn(async () => ({ sequenceId: "s1", persisted: false })) });
    const r = await startFirstSequence(d);
    expect(r).toEqual({ status: "persist-failed" });
    expect(d.onKept).not.toHaveBeenCalled();
  });

  it("does not hand off for a full account even on success", async () => {
    const d = deps({ isGuest: () => false });
    const r = await startFirstSequence(d);
    expect(r.status).toBe("generated-kept");
    expect(d.onKept).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/start-first-sequence.test.ts --config tests/config/vitest.config.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the command**

Create `src/lib/shared/onboarding/services/start-first-sequence.ts`:

```ts
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { SaveResult } from "$lib/shared/library/domain/library-contract-types";

export interface StartFirstSequenceDeps {
  /** Generate a real sequence (wraps GenerationOrchestrator.generateSequence). */
  generate: () => Promise<SequenceData>;
  /** Write it into the active tab's real SequenceState. */
  loadIntoWorkspace: (seq: SequenceData) => void;
  /** Persist it (wraps LibrarySaveService.saveSequence). */
  save: (seq: SequenceData) => Promise<SaveResult>;
  /** Is the current user a guest (anon / unauthenticated)? */
  isGuest: () => boolean;
  /** Hand-off after a persisted guest keep (→ postSaveActivation). */
  onKept: (sequenceId: string) => void;
}

export type StartFirstSequenceResult =
  | { status: "generated-kept"; sequenceId: string }
  | { status: "generate-failed" }
  | { status: "persist-failed" };

/**
 * One-tap "generate my first sequence" (spec 2026-07-22, Part A). Pure
 * orchestration: generate → load into the real workspace → keep. Failure is
 * explicit so the starter can stay visible and emit truthful analytics. The
 * generated sequence is loaded BEFORE the save so the user sees it even if the
 * keep later fails.
 */
export async function startFirstSequence(
  deps: StartFirstSequenceDeps
): Promise<StartFirstSequenceResult> {
  let seq: SequenceData;
  try {
    seq = await deps.generate();
  } catch {
    return { status: "generate-failed" };
  }
  if (!seq || !seq.steps || seq.steps.length === 0) {
    return { status: "generate-failed" };
  }

  deps.loadIntoWorkspace(seq);

  let result: SaveResult;
  try {
    result = await deps.save(seq);
  } catch {
    return { status: "persist-failed" };
  }
  if (!result.persisted) {
    return { status: "persist-failed" };
  }

  if (deps.isGuest()) {
    deps.onKept(result.sequenceId);
  }
  return { status: "generated-kept", sequenceId: result.sequenceId };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/unit/start-first-sequence.test.ts --config tests/config/vitest.config.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/onboarding/services/start-first-sequence.ts tests/unit/start-first-sequence.test.ts
git commit -m "feat(onboarding): headless generate-then-keep first-sequence command" -- src/lib/shared/onboarding/services/start-first-sequence.ts tests/unit/start-first-sequence.test.ts
```

---

## Task 10: First-sequence starter state (dismissal flag + account-aware eligibility)

**Files:**
- Create: `src/lib/shared/onboarding/state/first-sequence-starter-state.svelte.ts`
- Test: `tests/unit/first-sequence-starter-state.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/first-sequence-starter-state.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const authState = { isFullAccount: false, effectiveUserId: "guest-1" };
vi.mock("$lib/shared/auth/state/auth-state.svelte", () => ({ authState }));

const count = vi.fn(async () => 0);
vi.mock("$lib/shared/persistence/database/tka-database", () => ({
  db: { sequences: { count } },
}));

import {
  firstSequenceStarterState,
  resolveHasSavedAnything,
} from "$lib/shared/onboarding/state/first-sequence-starter-state.svelte";

beforeEach(() => {
  localStorage.clear();
  authState.isFullAccount = false;
  authState.effectiveUserId = "guest-1";
  count.mockResolvedValue(0);
  firstSequenceStarterState.reset();
});

describe("firstSequenceStarterState", () => {
  it("starts undismissed", () => {
    expect(firstSequenceStarterState.dismissed).toBe(false);
  });

  it("markDismissed persists locally", () => {
    firstSequenceStarterState.markDismissed();
    expect(firstSequenceStarterState.dismissed).toBe(true);
    expect(localStorage.getItem("tka-first-sequence-starter-dismissed")).toBe("true");
  });

  it("session re-arm is volatile and does not clear the persistent dismissal", () => {
    firstSequenceStarterState.markDismissed();
    firstSequenceStarterState.rearmForSession();
    expect(firstSequenceStarterState.sessionRearm).toBe(true);
    expect(localStorage.getItem("tka-first-sequence-starter-dismissed")).toBe("true");
  });

  it("guest has-saved reads Dexie", async () => {
    count.mockResolvedValue(0);
    expect(await resolveHasSavedAnything()).toBe(false);
    count.mockResolvedValue(2);
    expect(await resolveHasSavedAnything()).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/first-sequence-starter-state.test.ts --config tests/config/vitest.config.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the state (mirrors first-run-state.svelte.ts sync pattern)**

Create `src/lib/shared/onboarding/state/first-sequence-starter-state.svelte.ts`:

```ts
import { authState } from "$lib/shared/auth/state/auth-state.svelte";

const DISMISSED_KEY = "tka-first-sequence-starter-dismissed";
const isBrowser = typeof window !== "undefined";

function readLocalDismissed(): boolean {
  if (!isBrowser) return false;
  try {
    return localStorage.getItem(DISMISSED_KEY) === "true";
  } catch {
    return false;
  }
}

const state = $state({
  dismissed: readLocalDismissed(),
  cloudSynced: false,
  /** Volatile: the library "Make your first sequence" CTA re-shows the starter
   *  for THIS session without clearing the persistent cloud dismissal. */
  sessionRearm: false,
});

export const firstSequenceStarterState = {
  get dismissed() {
    return state.dismissed;
  },
  get cloudSynced() {
    return state.cloudSynced;
  },
  get sessionRearm() {
    return state.sessionRearm;
  },

  markDismissed(): void {
    state.dismissed = true;
    if (isBrowser) {
      try {
        localStorage.setItem(DISMISSED_KEY, "true");
      } catch {
        /* private browsing — cloud sync still records it */
      }
    }
    void this.syncToCloud();
  },

  rearmForSession(): void {
    state.sessionRearm = true;
  },

  markCloudSyncComplete(): void {
    state.cloudSynced = true;
  },

  reset(): void {
    state.dismissed = readLocalDismissed();
    state.cloudSynced = false;
    state.sessionRearm = false;
  },

  async syncFromCloud(): Promise<void> {
    if (!isBrowser || state.cloudSynced) return;
    try {
      const { getFirestoreInstance } = await import("$lib/shared/auth/firebase");
      const { doc, getDoc } = await import("firebase/firestore");
      const userId = authState.effectiveUserId;
      if (!userId) {
        state.cloudSynced = true;
        return;
      }
      const firestore = await getFirestoreInstance();
      const ref = doc(firestore, `users/${userId}/onboarding/firstSequenceStarter`);
      const snap = await getDoc(ref);
      if (snap.exists() && snap.data().dismissed === true) {
        state.dismissed = true;
        try {
          localStorage.setItem(DISMISSED_KEY, "true");
        } catch {
          /* ignore */
        }
      } else {
        // Missing doc = fresh account on this browser: never inherit a prior
        // account's dismissal (mirrors first-run-state's missing-doc reset).
        state.dismissed = false;
        try {
          localStorage.removeItem(DISMISSED_KEY);
        } catch {
          /* ignore */
        }
      }
      state.cloudSynced = true;
    } catch (error) {
      console.warn("[firstSequenceStarterState] cloud sync failed:", error);
      state.cloudSynced = true;
    }
  },

  async syncToCloud(): Promise<void> {
    if (!isBrowser) return;
    try {
      const { getFirestoreInstance } = await import("$lib/shared/auth/firebase");
      const { doc, setDoc, serverTimestamp } = await import("firebase/firestore");
      const userId = authState.effectiveUserId;
      if (!userId) return;
      const firestore = await getFirestoreInstance();
      const ref = doc(firestore, `users/${userId}/onboarding/firstSequenceStarter`);
      await setDoc(
        ref,
        { dismissed: state.dismissed, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (error) {
      console.warn("[firstSequenceStarterState] cloud write failed:", error);
    }
  },
};

/**
 * "Has this user ever kept a sequence?" — account-aware. Guests read Dexie
 * (their library is local); full accounts must NOT read Dexie (not uid-scoped,
 * per create-browse-engine.svelte.ts:467-474) — read Firestore, limit 1.
 */
export async function resolveHasSavedAnything(): Promise<boolean> {
  if (!isBrowser) return false;
  if (!authState.isFullAccount) {
    try {
      const { db } = await import("$lib/shared/persistence/database/tka-database");
      return (await db.sequences.count()) > 0;
    } catch {
      return false;
    }
  }
  try {
    const { getFirestoreInstance } = await import("$lib/shared/auth/firebase");
    const { collection, query, limit, getDocs } = await import("firebase/firestore");
    const userId = authState.effectiveUserId;
    if (!userId) return false;
    const firestore = await getFirestoreInstance();
    const q = query(collection(firestore, `users/${userId}/sequences`), limit(1));
    const snap = await getDocs(q);
    return !snap.empty;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/unit/first-sequence-starter-state.test.ts --config tests/config/vitest.config.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Verify the Firestore sequences path**

Run: `grep -rn "users/\${.*}/sequences\|/sequences\`" src/lib/shared/library src/lib/shared/persistence | head`
Expected: confirms the per-user sequences subcollection path used by the repository. If the repository uses a different collection path (e.g. a top-level `sequences` with an `ownerId` field), update `resolveHasSavedAnything`'s query to match it before committing.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/onboarding/state/first-sequence-starter-state.svelte.ts tests/unit/first-sequence-starter-state.test.ts
git commit -m "feat(onboarding): first-sequence starter state + account-aware eligibility" -- src/lib/shared/onboarding/state/first-sequence-starter-state.svelte.ts tests/unit/first-sequence-starter-state.test.ts
```

---

## Task 11: Hydrate the starter doc at auth boot

**Files:**
- Modify: `src/lib/shared/auth/services/auth-boot-orchestrator.ts:139-156`

- [ ] **Step 1: Add the hydration block**

In `auth-boot-orchestrator.ts`, immediately after the app-entry sync block (ends `:156`), add a sibling block matching the established pattern:

```ts
  // Sync first-sequence-starter dismissal FROM cloud (a device where the user
  // already dismissed or completed the starter shouldn't re-show it).
  import("$lib/shared/onboarding/state/first-sequence-starter-state.svelte")
    .then(async ({ firstSequenceStarterState }) => {
      const { getFirestoreInstance } = await import("$lib/shared/auth/firebase");
      await getFirestoreInstance();
      await firstSequenceStarterState.syncFromCloud();
    })
    .catch(async (error) => {
      console.warn("⚠️ [authState] First-sequence-starter sync failed:", error);
      try {
        const { firstSequenceStarterState } = await import("$lib/shared/onboarding/state/first-sequence-starter-state.svelte");
        firstSequenceStarterState.markCloudSyncComplete();
      } catch {
        // Non-fatal; localStorage carries the flag.
      }
    });
```

- [ ] **Step 2: Verify type-check**

Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error 2>&1 | grep -i "auth-boot-orchestrator" || echo clean`
Expected: `clean`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/auth/services/auth-boot-orchestrator.ts
git commit -m "feat(onboarding): hydrate first-sequence-starter doc at boot" -- src/lib/shared/auth/services/auth-boot-orchestrator.ts
```

---

## Task 12: `FirstSequenceStarter.svelte` card

**Files:**
- Create: `src/lib/features/onboarding/components/FirstSequenceStarter.svelte`

- [ ] **Step 1: Create the card (styling mirrors GenerateEmptyState.svelte's `.offer-btn`)**

Create `src/lib/features/onboarding/components/FirstSequenceStarter.svelte`:

```svelte
<script lang="ts">
  interface Props {
    busy?: boolean;
    onGenerate: () => void;
    onBuildOwn: () => void;
  }
  let { busy = false, onGenerate, onBuildOwn }: Props = $props();
</script>

<div class="first-sequence-starter" role="group" aria-label="Start your first sequence">
  <p class="starter-title">Make your first sequence</p>
  <p class="starter-sub">One tap generates a real sequence and keeps it in your library.</p>
  <div class="starter-actions">
    <button class="starter-btn primary" onclick={onGenerate} disabled={busy}>
      {busy ? "Generating…" : "Generate my first sequence"}
    </button>
    <button class="starter-btn secondary" onclick={onBuildOwn} disabled={busy}>
      I'll build my own
    </button>
  </div>
</div>

<style>
  .first-sequence-starter {
    display: grid;
    justify-items: center;
    gap: 0.75rem;
    text-align: center;
    margin-top: clamp(2.5rem, 11vmin, 6.5rem);
    padding: 0 1rem;
  }
  .starter-title {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--theme-text, #fff);
  }
  .starter-sub {
    margin: 0;
    max-width: 34ch;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.65));
    text-wrap: balance;
  }
  .starter-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: center;
    margin-top: 0.25rem;
  }
  .starter-btn {
    min-height: var(--min-touch-target, 44px);
    padding: 0 18px;
    border-radius: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .starter-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .starter-btn.primary {
    color: #1a1205;
    border: none;
    background: linear-gradient(
      135deg,
      var(--semantic-warning, #f59e0b),
      color-mix(in srgb, var(--semantic-warning, #f59e0b) 80%, #fff)
    );
  }
  .starter-btn.secondary {
    color: var(--theme-text, #fff);
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.2));
  }
</style>
```

- [ ] **Step 2: Verify type-check**

Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error 2>&1 | grep -i "FirstSequenceStarter" || echo clean`
Expected: `clean`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/onboarding/components/FirstSequenceStarter.svelte
git commit -m "feat(onboarding): FirstSequenceStarter card" -- src/lib/features/onboarding/components/FirstSequenceStarter.svelte
```

---

## Task 13: Mount the starter on empty Construct + arbitrate the tutorial

**Files:**
- Modify: `src/lib/features/create/shared/components/StandardWorkspaceLayout.svelte:222-236`
- Modify: `src/lib/features/create/shared/components/CreateModule.svelte:433-435`

This task wires the real deps into `startFirstSequence` and gates the card. It has no unit test (Svelte mount + orchestrator); Task 15 covers it with manual verification evidence.

- [ ] **Step 1: Add a starter controller to `StandardWorkspaceLayout.svelte`**

In the `<script>`, add imports:

```ts
  import FirstSequenceStarter from "$lib/features/onboarding/components/FirstSequenceStarter.svelte";
  import { startFirstSequence } from "$lib/shared/onboarding/services/start-first-sequence";
  import {
    firstSequenceStarterState,
    resolveHasSavedAnything,
  } from "$lib/shared/onboarding/state/first-sequence-starter-state.svelte";
  import { postSaveActivation } from "$lib/shared/onboarding/state/post-save-activation-state.svelte";
  import { FIRST_SESSION_ACTIVATION_ENABLED } from "$lib/shared/onboarding/domain/onboarding-flags";
  import { generationOrchestrator } from "$lib/shared/create/services/generation-orchestrator";
  import { createGenerationConfigState } from "$lib/features/create/generate/state/generate-config.svelte";
  import { uiConfigToGenerationOptions } from "$lib/shared/create/utils/config-mapper";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import {
    logFirstSequenceStarterShown,
    logFirstSequenceStarterGenerated,
    logFirstSequenceStarterKept,
    logFirstSequenceStarterDismissed,
  } from "$lib/shared/analytics/services/onboarding-events";
```

Add the eligibility + controller logic (place after `hasWorkspaceContent`):

```ts
  let starterBusy = $state(false);
  let hasSaved = $state<boolean | null>(null); // null = unknown until resolved

  const starterEligible = $derived(
    FIRST_SESSION_ACTIVATION_ENABLED &&
      !hasWorkspaceContent &&
      hasSaved === false &&
      (!firstSequenceStarterState.dismissed || firstSequenceStarterState.sessionRearm)
  );

  // Resolve "has this user ever kept a sequence?" once the workspace is empty.
  $effect(() => {
    if (!FIRST_SESSION_ACTIVATION_ENABLED || hasWorkspaceContent) return;
    if (!firstSequenceStarterState.cloudSynced) return;
    hasSaved = null;
    void resolveHasSavedAnything().then((v) => (hasSaved = v));
  });

  // Analytics: fire "shown" once when the card first becomes eligible.
  let starterShownLogged = false;
  $effect(() => {
    if (starterEligible && !starterShownLogged) {
      starterShownLogged = true;
      logFirstSequenceStarterShown();
    }
  });

  async function handleStartFirstSequence() {
    if (starterBusy) return;
    starterBusy = true;
    try {
      const result = await startFirstSequence({
        generate: async () => {
          const config = createGenerationConfigState().config;
          const options = uiConfigToGenerationOptions(config, PropType.STAFF, null);
          const seq = await generationOrchestrator.generateSequence(options);
          logFirstSequenceStarterGenerated();
          return seq;
        },
        loadIntoWorkspace: (seq) =>
          CreateModuleState.getActiveTabSequenceState().setCurrentSequence(seq),
        save: async (seq) => {
          const svc = CreateModuleState.getLibrarySaveService();
          return svc.saveSequence(seq, {
            name: simplifyRepeatedWord(seq.word ?? seq.name ?? "Sequence"),
            visibility: "private",
            tags: [],
            notes: "",
          });
        },
        isGuest: () => !authState.isFullAccount,
        onKept: (id) => postSaveActivation.onGuestSaveSucceeded(id),
      });
      if (result.status === "generated-kept") {
        logFirstSequenceStarterKept({ sequenceId: result.sequenceId });
        firstSequenceStarterState.markDismissed();
      }
      // generate-failed / persist-failed: leave the starter visible.
    } finally {
      starterBusy = false;
    }
  }

  function handleBuildOwn() {
    logFirstSequenceStarterDismissed();
    firstSequenceStarterState.markDismissed();
  }
```

> **Dep note:** `CreateModuleState.getLibrarySaveService()` — confirm the accessor name. The service is constructed in the Create module init; grep `LibrarySaveService` in `create-module-*` to find the existing getter and use it verbatim. If none is exposed, add a `getLibrarySaveService()` passthrough to `create-module-state.svelte.ts` returning the already-constructed instance (do NOT construct a second one).

- [ ] **Step 2: Render the card in the tool-panel container**

In the markup at `:223-236`, add the starter branch above the generator empty state so it also covers Construct:

```svelte
  <!-- Tool Panel -->
  <div class="tool-panel-container" bind:this={toolPanelElement}>
    {#if starterEligible}
      <FirstSequenceStarter
        busy={starterBusy}
        onGenerate={handleStartFirstSequence}
        onBuildOwn={handleBuildOwn}
      />
    {:else if !hasWorkspaceContent && isGeneratorTab}
      <GenerateEmptyState />
    {/if}
    <CreationToolPanelSlot
      bind:toolPanelRef
      {onOptionSelected}
      onPracticeStepIndexChange={(index) => {
        panelState.setPracticeStepIndex(index);
      }}
      {onOpenFilters}
      {onCloseFilters}
    />
  </div>
```

- [ ] **Step 3: Suppress the legacy tutorial offer while the starter is eligible**

In `CreateModule.svelte`, add the import:

```ts
  import { FIRST_SESSION_ACTIVATION_ENABLED } from "$lib/shared/onboarding/domain/onboarding-flags";
  import { firstSequenceStarterState } from "$lib/shared/onboarding/state/first-sequence-starter-state.svelte";
```

Replace the offer call (`:433-435`) with an arbitration guard:

```svelte
        // First-time guided-build offer. Suppressed while the one-tap starter
        // is the active first-run surface (spec 2026-07-22) so the two don't
        // stack; the wizard stays reachable via Settings replay.
        const starterOwnsFirstRun =
          FIRST_SESSION_ACTIVATION_ENABLED &&
          !firstSequenceStarterState.dismissed;
        if (!hasDeepLink && CreateModuleState.isWorkspaceEmpty() && !starterOwnsFirstRun) {
          appEntryState.offerCreateTutorial();
        }
```

- [ ] **Step 4: Verify type-check**

Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error 2>&1 | grep -iE "StandardWorkspaceLayout|CreateModule" || echo clean`
Expected: `clean` (resolve any accessor-name mismatch from the Step 1 dep note first).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/create/shared/components/StandardWorkspaceLayout.svelte src/lib/features/create/shared/components/CreateModule.svelte
git commit -m "feat(onboarding): mount first-sequence starter + arbitrate tutorial" -- src/lib/features/create/shared/components/StandardWorkspaceLayout.svelte src/lib/features/create/shared/components/CreateModule.svelte
```

---

## Task 14: Library empty-state "Make your first sequence" CTA

**Files:**
- Modify: `src/lib/shared/browse/components/BrowsePanel.svelte:18-64,258-268`
- Modify: `src/lib/features/browse/collections/components/AllLibraryView.svelte:86-97`

- [ ] **Step 1: Add an `emptyAction` prop to `BrowsePanel`**

In `BrowsePanel.svelte`, add to the `Props` interface (after `onSaveSmart?`):

```ts
    /** Host-supplied CTA for a genuinely empty (unfiltered) library — e.g.
     *  "Make your first sequence". Not shown when filters produced the zero. */
    emptyAction?: { label: string; onClick: () => void };
```

Add to the destructure (after `onSaveSmart`):

```ts
    onSaveSmart,
    emptyAction,
```

In the empty-state block (`:262-267`), add a non-filter branch:

```svelte
        {#if engine.hasActiveFilters}
          <button class="clear-filters-btn" onclick={() => engine.clearUserFilters()}>
            <i class="fas fa-times" aria-hidden="true"></i>
            Clear all filters
          </button>
        {:else if emptyAction}
          <button class="empty-action-btn" onclick={emptyAction.onClick}>
            <i class="fas fa-plus" aria-hidden="true"></i>
            {emptyAction.label}
          </button>
        {/if}
```

Add the button style near `.clear-filters-btn` (`:407`):

```css
  .empty-action-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs, 4px);
    margin-top: var(--spacing-sm, 8px);
    min-height: var(--min-touch-target, 44px);
    padding: var(--spacing-sm, 8px) var(--spacing-lg, 16px);
    background: linear-gradient(135deg, var(--theme-accent, #6366f1), var(--theme-accent-strong, #4f46e5));
    border: none;
    border-radius: 10px;
    color: #fff;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    cursor: pointer;
  }
```

- [ ] **Step 2: Pass the action from `AllLibraryView`**

In `AllLibraryView.svelte`, add imports:

```ts
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import { firstSequenceStarterState } from "$lib/shared/onboarding/state/first-sequence-starter-state.svelte";
```

Pass the prop on `<BrowsePanel>`:

```svelte
	<BrowsePanel
		{engine}
		layout="fullpage"
		onSelect={handleSelect}
		{onBack}
		backLabel="Library"
		hideToolbarSearch
		onOpenFilters={() => (isFilterSheetOpen = true)}
		onSaveSmart={() => (smartSaveOpen = true)}
		emptyAction={{
			label: "Make your first sequence",
			onClick: () => {
				firstSequenceStarterState.rearmForSession();
				navigationState.setCurrentModule("create");
			},
		}}
	/>
```

> Confirm the `navigationState` import path + `setCurrentModule` signature against `save-panel-state.svelte.ts:319` (`navigationState.setCurrentModule("browse", "library")`) — reuse the same accessor.

- [ ] **Step 3: Verify type-check**

Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error 2>&1 | grep -iE "BrowsePanel|AllLibraryView" || echo clean`
Expected: `clean`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/browse/components/BrowsePanel.svelte src/lib/features/browse/collections/components/AllLibraryView.svelte
git commit -m "feat(library): empty-library CTA to start a first sequence" -- src/lib/shared/browse/components/BrowsePanel.svelte src/lib/features/browse/collections/components/AllLibraryView.svelte
```

---

## Task 15: Full check + manual verification

**Files:** none (verification gate).

- [ ] **Step 1: One full type-check**

Run: `npm run check > /tmp/fsa-check.log 2>&1; grep -niE "error" /tmp/fsa-check.log | head`
Expected: no errors. Fix any that trace to the new files, then re-run once.

- [ ] **Step 2: Run the full new-test set**

Run:
```bash
npx vitest run \
  tests/unit/auth/auth-nudge-trigger.test.ts \
  tests/unit/onboarding-activation-events.test.ts \
  tests/unit/library-save-persisted-flag.test.ts \
  tests/unit/guest-first-save-guard.test.ts \
  tests/unit/post-save-activation-state.test.ts \
  tests/unit/start-first-sequence.test.ts \
  tests/unit/first-sequence-starter-state.test.ts \
  --config tests/config/vitest.config.ts
```
Expected: all PASS.

- [ ] **Step 3: Manual verification (record evidence per verification-protocol)**

On a **fresh anonymous guest** (clear site data), via `https://localhost:5173/`:
1. Open Create → the starter card shows on empty Construct. Capture the frame (no flash before it resolves).
2. Tap "Generate my first sequence" → a real sequence appears in the workspace and is kept. After the save surface settles, the "Create a free account…" prompt appears exactly once.
3. "Not now" → save a 2nd sequence → prompt does NOT reappear.
4. Convert via "Create account" → the saved sequence(s) survive (uid preserved).
5. Empty **My Library** (before any save) shows "Make your first sequence"; tapping it returns to Create with the starter re-armed.
6. On a **fresh full account**, the first-save prompt never appears.

Record: screenshots or a runtime query of `postSaveActivation.visible` transitions. If any step fails, state which and stop — do not claim done.

- [ ] **Step 4: Final push**

```bash
git push origin main
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** Every ledger item in the spec maps to a task — starter command (T9), starter state/eligibility (T10), starter card (T12), mount + tutorial arbitration (T13), dismissal flag + boot sync (T10/T11), library CTA (T14), nudge key (T1), first-save detection + once-only (T5/T6), coordinator + AuthNudge host (T6/T7), all three save paths (T8), remove legacy toast (T4), analytics (T3), flag (T2), tests (each task + T15).
- **Placeholders:** Two explicit "confirm the accessor" notes (T13 `getLibrarySaveService`, T14 `navigationState`/sequences path) are verification steps with a named fallback, not deferred work — the implementer resolves them from grep before committing that task.
- **Type consistency:** `SaveResult.persisted` (T4) is consumed in T8/T9; `postSaveActivation.onGuestSaveSucceeded` (T6) is called in T8/T13; `firstSequenceStarterState` members (T10) are used in T11/T13/T14; `startFirstSequence` result union (T9) is handled in T13. Names match across tasks.
