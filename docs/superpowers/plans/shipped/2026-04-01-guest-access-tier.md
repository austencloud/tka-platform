# Guest Access Tier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the login wall and let unauthenticated visitors use Create and Browse immediately, with tiered beat caps and sign-up nudges at gate points.

**Architecture:** Single `MainInterface` rendered unconditionally. Guest restrictions enforced via `AccessTier` context (derived from auth state), module/tab visibility filtering in `ModuleRenderer`, and inline `AuthNudge` components at gate points. Auth flow happens in a drawer overlay so the component tree stays mounted.

**Tech Stack:** Svelte 5, TypeScript, Firebase Auth, PostHog analytics, ITI dependency injection

**Spec:** `docs/superpowers/specs/2026-04-01-guest-access-tier-design.md`

---

## File Map

### New Files

| File | Purpose |
|------|---------|
| `src/lib/shared/auth/domain/AccessTier.ts` | `AccessTier` type, `resolveAccessTier()`, `getMaxBeats()`, `ACCESS_TIER_LABELS` |
| `src/lib/shared/auth/domain/guest-access-config.ts` | Static map of which modules/tabs guests can access |
| `src/lib/shared/auth/domain/AuthNudgeTrigger.ts` | `AuthNudgeTrigger` type + `AUTH_NUDGE_TEXTS` map (shared by components and gate logic) |
| `src/lib/shared/auth/components/AuthNudge.svelte` | Two-step explanation card (trigger text + "Create Account" / "Not now") |
| `src/lib/shared/auth/components/AuthDrawer.svelte` | Drawer overlay wrapping existing auth components + tier progression display |
| `src/lib/shared/auth/state/auth-drawer-state.svelte.ts` | Shared singleton state for opening/closing the AuthDrawer from any component |
| `tests/unit/auth/access-tier.test.ts` | Tests for AccessTier resolution and beat cap logic |

### Modified Files

| File | Change |
|------|--------|
| `src/lib/shared/application/components/MainApplication.svelte` | Remove `!isAuthenticated → LandingPage` branch; render MainInterface unconditionally; overlay FirstRunWizard; guard guest-incompatible init |
| `src/lib/shared/modules/ModuleRenderer.svelte` | Add guest access filtering before module render |
| `src/lib/shared/subscription/services/contracts/IPremiumGateChecker.ts` | Add `nudgeType` field and `"auth_required"` reason |
| `src/lib/shared/subscription/services/implementations/PremiumGateChecker.ts` | Return auth nudge for unauthenticated users |
| `src/lib/features/create/generate/components/cards/LengthCard.svelte` | Replace hardcoded `MAX_LENGTH = 64` with tier-aware cap |
| `src/lib/features/create/generate/state/generate-actions.svelte.ts` | Post-generation truncation for beat cap |
| `src/lib/features/create/shared/components/CreateModule.svelte` | Add beat cap check in `handleOptionSelected` |
| `src/lib/features/create/assemble/components/AssembleToolPanel.svelte` | Add beat cap check for grid placement |
| `src/lib/shared/navigation/components/ModuleSwitcher.svelte` | Hide inbox for guests |
| `src/lib/shared/navigation/components/account/AccountRow.svelte` | Update unauthenticated state to show "Sign up" label |
| Keyboard shortcut handler (TBD — find via grep) | Gate module shortcuts for guests |
| Browse sequence detail edit/remix button (TBD — find via grep) | Gate edit action for guests |

---

## Task 1: AccessTier Domain Model

**Files:**
- Create: `src/lib/shared/auth/domain/AccessTier.ts`
- Create: `tests/unit/auth/access-tier.test.ts`

- [ ] **Step 1: Write failing tests for AccessTier resolution and beat caps**

```typescript
// tests/unit/auth/access-tier.test.ts
import { describe, it, expect } from "vitest";
import {
  resolveAccessTier,
  getMaxBeats,
  ACCESS_TIER_LABELS,
  type AccessTier,
} from "$lib/shared/auth/domain/AccessTier";

describe("resolveAccessTier", () => {
  it("returns guest when not authenticated", () => {
    expect(resolveAccessTier(false, false)).toBe("guest");
  });

  it("returns user when authenticated but not premium", () => {
    expect(resolveAccessTier(true, false)).toBe("user");
  });

  it("returns premium when authenticated and premium", () => {
    expect(resolveAccessTier(true, true)).toBe("premium");
  });
});

describe("getMaxBeats", () => {
  it("returns 8 for guest", () => {
    expect(getMaxBeats("guest")).toBe(8);
  });

  it("returns 16 for user", () => {
    expect(getMaxBeats("user")).toBe(16);
  });

  it("returns 64 for premium", () => {
    expect(getMaxBeats("premium")).toBe(64);
  });
});

describe("ACCESS_TIER_LABELS", () => {
  it("maps internal names to display names", () => {
    expect(ACCESS_TIER_LABELS.guest).toBe("Guest");
    expect(ACCESS_TIER_LABELS.user).toBe("Composer");
    expect(ACCESS_TIER_LABELS.premium).toBe("Scribe");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/auth/access-tier.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement AccessTier module**

```typescript
// src/lib/shared/auth/domain/AccessTier.ts

export type AccessTier = "guest" | "user" | "premium";

export const ACCESS_TIER_LABELS: Record<AccessTier, string> = {
  guest: "Guest",
  user: "Composer",
  premium: "Scribe",
};

export function resolveAccessTier(
  isAuthenticated: boolean,
  isPremium: boolean
): AccessTier {
  if (!isAuthenticated) return "guest";
  if (isPremium) return "premium";
  return "user";
}

export function getMaxBeats(tier: AccessTier): number {
  switch (tier) {
    case "guest":
      return 8;
    case "user":
      return 16;
    case "premium":
      return 64;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/auth/access-tier.test.ts`
Expected: PASS — all 7 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/auth/domain/AccessTier.ts tests/unit/auth/access-tier.test.ts
git commit -m "feat(auth): add AccessTier domain model with resolution and beat caps"
```

---

## Task 2: Guest Access Config

**Files:**
- Create: `src/lib/shared/auth/domain/guest-access-config.ts`
- Create: `tests/unit/auth/guest-access-config.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/auth/guest-access-config.test.ts
import { describe, it, expect } from "vitest";
import {
  isModuleAccessible,
  isTabAccessible,
  getAccessibleTabs,
} from "$lib/shared/auth/domain/guest-access-config";

describe("isModuleAccessible", () => {
  it("allows create for guests", () => {
    expect(isModuleAccessible("create", "guest")).toBe(true);
  });

  it("allows browse for guests", () => {
    expect(isModuleAccessible("browse", "guest")).toBe(true);
  });

  it("blocks learn for guests", () => {
    expect(isModuleAccessible("learn", "guest")).toBe(false);
  });

  it("blocks social for guests", () => {
    expect(isModuleAccessible("social", "guest")).toBe(false);
  });

  it("allows all modules for authenticated users", () => {
    expect(isModuleAccessible("learn", "user")).toBe(true);
    expect(isModuleAccessible("social", "user")).toBe(true);
    expect(isModuleAccessible("settings", "user")).toBe(true);
  });
});

describe("isTabAccessible", () => {
  it("allows construct tab in create for guests", () => {
    expect(isTabAccessible("create", "construct", "guest")).toBe(true);
  });

  it("allows gallery tab in browse for guests", () => {
    expect(isTabAccessible("browse", "gallery", "guest")).toBe(true);
  });

  it("blocks collections tab in browse for guests", () => {
    expect(isTabAccessible("browse", "collections", "guest")).toBe(false);
  });

  it("blocks creators tab in browse for guests", () => {
    expect(isTabAccessible("browse", "creators", "guest")).toBe(false);
  });
});

describe("getAccessibleTabs", () => {
  it("returns allowed tabs for guests in create", () => {
    expect(getAccessibleTabs("create", "guest")).toEqual([
      "assemble",
      "construct",
      "generate",
    ]);
  });

  it("returns null for authenticated users (no filtering)", () => {
    expect(getAccessibleTabs("create", "user")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/auth/guest-access-config.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement guest access config**

```typescript
// src/lib/shared/auth/domain/guest-access-config.ts
import type { AccessTier } from "./AccessTier";

/**
 * Static map of which modules/tabs guests can access.
 * Authenticated users (tier "user" or "premium") bypass this entirely.
 *
 * Modules not listed are blocked for guests.
 * A string array means only those specific tabs are allowed.
 */
const GUEST_MODULE_ACCESS: Record<string, string[]> = {
  create: ["assemble", "construct", "generate"],
  browse: ["gallery"],
};

export function isModuleAccessible(
  moduleId: string,
  tier: AccessTier
): boolean {
  if (tier !== "guest") return true;
  return moduleId in GUEST_MODULE_ACCESS;
}

export function isTabAccessible(
  moduleId: string,
  tabId: string,
  tier: AccessTier
): boolean {
  if (tier !== "guest") return true;
  const allowedTabs = GUEST_MODULE_ACCESS[moduleId];
  if (!allowedTabs) return false;
  return allowedTabs.includes(tabId);
}

/**
 * Returns the list of accessible tabs for a module at the given tier,
 * or null if no filtering is needed (authenticated users).
 */
export function getAccessibleTabs(
  moduleId: string,
  tier: AccessTier
): string[] | null {
  if (tier !== "guest") return null;
  return GUEST_MODULE_ACCESS[moduleId] ?? [];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/auth/guest-access-config.test.ts`
Expected: PASS — all tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/auth/domain/guest-access-config.ts tests/unit/auth/guest-access-config.test.ts
git commit -m "feat(auth): add guest access config for module/tab visibility"
```

---

## Task 3: Extend PremiumGateChecker for Auth Nudges

**Files:**
- Modify: `src/lib/shared/subscription/services/contracts/IPremiumGateChecker.ts`
- Modify: `src/lib/shared/subscription/services/implementations/PremiumGateChecker.ts`

- [ ] **Step 1: Update the interface to include nudge type**

In `src/lib/shared/subscription/services/contracts/IPremiumGateChecker.ts`, add `"auth_required"` to the reason union and add `nudgeType`:

```typescript
export interface PremiumGateResult {
  allowed: boolean;
  reason?: "auth_required" | "premium_required" | "capability_disabled";
  nudge?: NudgeConfig;
  nudgeType?: "auth" | "premium";
}
```

- [ ] **Step 2: Update PremiumGateChecker implementation**

In `src/lib/shared/subscription/services/implementations/PremiumGateChecker.ts`, modify the unauthenticated check at line 14 to return auth-typed nudge:

```typescript
// Replace the existing !featureFlagService.userId check:
if (!featureFlagService.userId) {
  return this.authRequired(capability);
}
```

Add the new `authRequired` method:

```typescript
private authRequired(capability: CapabilityFeatureId): PremiumGateResult {
  return {
    allowed: false,
    reason: "auth_required",
    nudgeType: "auth",
    nudge: {
      capability,
      description: "Account required",
      premiumBenefit: "Create a free account to access this feature",
    },
  };
}
```

Update `notAllowed` to include `nudgeType: "premium"`:

```typescript
private notAllowed(capability: CapabilityFeatureId): PremiumGateResult {
  const nudge = CAPABILITY_NUDGES[capability];
  return {
    allowed: false,
    reason: "premium_required",
    nudgeType: "premium",
    nudge: nudge ?? {
      capability,
      description: "Premium feature",
      premiumBenefit: "Unlock this feature with Premium",
    },
  };
}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/subscription/services/contracts/IPremiumGateChecker.ts src/lib/shared/subscription/services/implementations/PremiumGateChecker.ts
git commit -m "feat(subscription): extend PremiumGateChecker to distinguish auth vs premium nudges"
```

---

## Task 4: AuthNudgeTrigger Type + AuthNudge Component

**Files:**
- Create: `src/lib/shared/auth/domain/AuthNudgeTrigger.ts`
- Create: `src/lib/shared/auth/components/AuthNudge.svelte`

Extract the trigger type to its own file so it can be imported by both components and gate logic without importing from a `.svelte` file.

- [ ] **Step 1: Create AuthNudgeTrigger domain type**

```typescript
// src/lib/shared/auth/domain/AuthNudgeTrigger.ts

export type AuthNudgeTrigger =
  | "save"
  | "beat-cap-guest"
  | "beat-cap-composer"
  | "export"
  | "module:learn"
  | "module:library"
  | "module:settings"
  | "edit-community"
  | "generate-cap";

export const AUTH_NUDGE_TEXTS: Record<AuthNudgeTrigger, string> = {
  save: "Create a free account to save your sequences. Takes about 10 seconds.",
  "beat-cap-guest":
    "Guests can create sequences up to 8 beats. Sign up free for up to 16.",
  "beat-cap-composer":
    "Composers can create up to 16 beats. Become a Scribe for up to 64.",
  export: "Create a free account to export your sequences.",
  "module:learn": "Sign up free to start learning TKA notation.",
  "module:library":
    "Your saved sequences live here. Create a free account to start your library.",
  "module:settings": "Create a free account to customize your settings.",
  "edit-community": "Create a free account to edit and remix sequences.",
  "generate-cap":
    "Guests can generate sequences up to 8 beats. Sign up free for up to 16.",
};
```

- [ ] **Step 2: Create AuthNudge component**

```svelte
<!-- src/lib/shared/auth/components/AuthNudge.svelte -->
<script lang="ts">
  import type { AuthNudgeTrigger } from "../domain/AuthNudgeTrigger";
  import { AUTH_NUDGE_TEXTS } from "../domain/AuthNudgeTrigger";

  interface Props {
    trigger: AuthNudgeTrigger;
    onCreateAccount: () => void;
    onDismiss: () => void;
  }

  let { trigger, onCreateAccount, onDismiss }: Props = $props();

  const text = $derived(AUTH_NUDGE_TEXTS[trigger]);
  const isScribeNudge = $derived(trigger === "beat-cap-composer");
  const buttonText = $derived(
    isScribeNudge ? "Become a Scribe" : "Create Account \u2014 free"
  );
</script>

<div class="auth-nudge" role="alert">
  <p class="auth-nudge-text">{text}</p>
  <div class="auth-nudge-actions">
    <button class="auth-nudge-primary" onclick={onCreateAccount}>
      {buttonText}
    </button>
    <button class="auth-nudge-dismiss" onclick={onDismiss}>Not now</button>
  </div>
</div>

<style>
  .auth-nudge {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-lg, 12px);
    padding: 20px;
    text-align: center;
    max-width: 360px;
    margin: 24px auto;
  }

  .auth-nudge-text {
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-min, 14px);
    line-height: 1.5;
    margin: 0 0 16px 0;
  }

  .auth-nudge-actions {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }

  .auth-nudge-primary {
    background: var(--theme-accent, #3b82f6);
    color: #ffffff;
    border: none;
    border-radius: var(--radius-md, 8px);
    padding: 10px 20px;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .auth-nudge-primary:hover {
    opacity: 0.9;
  }

  .auth-nudge-dismiss {
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    border: none;
    padding: 10px 12px;
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
  }

  .auth-nudge-dismiss:hover {
    color: var(--theme-text, #ffffff);
  }
</style>
```

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/auth/domain/AuthNudgeTrigger.ts src/lib/shared/auth/components/AuthNudge.svelte
git commit -m "feat(auth): add AuthNudgeTrigger type and AuthNudge component"
```

---

## Task 5: Auth Drawer State

**Files:**
- Create: `src/lib/shared/auth/state/auth-drawer-state.svelte.ts`

This must be created BEFORE Tasks 6-10 so all consumers use it from the start. No temporary `window.dispatchEvent` patterns.

**Note:** This is a module-level singleton, which deviates from the factory + context state management pattern. This is justified because the AuthDrawer is an application-level singleton consumed by deeply unrelated components (ModuleRenderer, AccountRow, beat cap cards). Factory + context would require awkward plumbing through MainApplication.

- [ ] **Step 1: Create auth drawer state**

```typescript
// src/lib/shared/auth/state/auth-drawer-state.svelte.ts

let _open = $state(false);

export const authDrawerState = {
  get open() { return _open; },
  show() { _open = true; },
  hide() { _open = false; },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/auth/state/auth-drawer-state.svelte.ts
git commit -m "feat(auth): add shared auth drawer state singleton"
```

---

## Task 6: AuthDrawer Component

**Files:**
- Create: `src/lib/shared/auth/components/AuthDrawer.svelte`

This drawer wraps existing auth components in a drawer overlay with a tier progression display.

- [ ] **Step 1: Read existing drawer and auth component patterns**

Read these files to understand the APIs:
- `src/lib/shared/auth/components/LandingPage.svelte` (lines 22-25 for imports, lines 141-157 for auth component usage)
- `src/lib/shared/auth/components/SocialAuthCompact.svelte` (props interface)
- `src/lib/shared/auth/components/EmailAuthTabs.svelte` (props interface)
- Search for `Drawer.Root` or `vaul-svelte` imports to find existing drawer usage patterns

- [ ] **Step 2: Create AuthDrawer component**

Match the exact `vaul-svelte` API used elsewhere in the codebase. The code below is a reference — adapt to match existing drawer patterns:

```svelte
<!-- src/lib/shared/auth/components/AuthDrawer.svelte -->
<script lang="ts">
  import { Drawer } from "vaul-svelte";
  import SocialAuthCompact from "./SocialAuthCompact.svelte";
  import EmailAuthTabs from "./EmailAuthTabs.svelte";
  import GoogleOneTap from "./GoogleOneTap.svelte";
  import { ACCESS_TIER_LABELS } from "../domain/AccessTier";

  interface Props {
    open: boolean;
    onClose: () => void;
  }

  let { open, onClose }: Props = $props();
  let authMode = $state<"signin" | "signup">("signup");
</script>

<!-- Drawer content with tier progression + reused auth components -->
<!-- See spec Section 4 (AuthDrawer) for layout reference -->
<!-- Mobile: drawer from bottom. Desktop: drawer from right. -->
```

The drawer must include:
1. Tier progression display (Guest → Composer → Scribe with "You're here" / "Free" / "Coming soon")
2. `GoogleOneTap`, `SocialAuthCompact`, and `EmailAuthTabs` components
3. Close button

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/auth/components/AuthDrawer.svelte
git commit -m "feat(auth): add AuthDrawer overlay with tier progression and existing auth components"
```

---

## Task 7: MainApplication Gate Rework

**Files:**
- Modify: `src/lib/shared/application/components/MainApplication.svelte` (lines 474-560)

This is the critical change. MainInterface renders unconditionally. LandingPage branch removed. FirstRunWizard becomes an overlay.

- [ ] **Step 1: Read the full MainApplication template**

Read `src/lib/shared/application/components/MainApplication.svelte` lines 440-600 to understand the complete template structure.

- [ ] **Step 2: Audit MainInterface children for unguarded Firestore calls**

Before restructuring, grep for direct Firestore calls in MainInterface's direct imports to verify they're all guarded by auth checks:

```bash
grep -r "getDoc\|setDoc\|updateDoc\|deleteDoc\|collection\|addDoc" src/lib/shared/MainInterface.svelte
```

Check that any Firestore calls in child components are either guarded by `authState.isAuthenticated` or wrapped in try/catch. If any are unguarded, they must be guarded before guests can reach MainInterface.

- [ ] **Step 3: Add imports**

```typescript
import AuthDrawer from "../../auth/components/AuthDrawer.svelte";
import { authDrawerState } from "../../auth/state/auth-drawer-state.svelte";
```

- [ ] **Step 4: Restructure the auth/wizard/main conditional**

Replace lines 480-519 (the `!isAuthenticated → LandingPage` branch through `MainInterface`) with unconditional MainInterface plus overlays. Key changes:

- Remove the `{:else if !isAuthenticated} <LandingPage />` branch
- Render `<MainInterface />` unconditionally in the final `{:else}` branch
- Convert FirstRunWizard, CreateTutorialWizard, and TutorialPrompt to overlays (wrapped in `.fullscreen-overlay` divs with `position: fixed; inset: 0; z-index: 900`)
- Gate all wizard overlays with `{#if isAuthenticated && ...}` so guests don't see them
- Add AuthDrawer at the end, gated with `{#if !isAuthenticated}`
- Add reassurance message "Your sequence will be here when you're done." in the wizard loading spinner and pass as prop to FirstRunWizard

- [ ] **Step 5: Add fullscreen-overlay CSS**

```css
.fullscreen-overlay {
  position: fixed;
  inset: 0;
  z-index: 900;
  background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
}
```

- [ ] **Step 6: Run typecheck and build**

Run: `npm run check && npm run build`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/application/components/MainApplication.svelte
git commit -m "feat(auth): render MainInterface unconditionally, overlay FirstRunWizard for authenticated users"
```

---

## Task 8: Guest Initialization Guards

**Files:**
- Modify: `src/lib/shared/application/components/MainApplication.svelte` (initialization logic in `onMount`)

The spec requires that certain services are skipped or use fallbacks for guests.

- [ ] **Step 1: Read MainApplication initialization**

Read `src/lib/shared/application/components/MainApplication.svelte` lines 100-300 to find where these services are initialized.

- [ ] **Step 2: Guard guest-incompatible initialization**

Wrap the following with `if (isAuthenticated)` checks in the initialization flow:

| Service | Guest behavior |
|---------|---------------|
| `settingsService.loadSettings()` | Must use localStorage-only fallback. Wrap in auth check; for guests, load from localStorage only (no Firestore). |
| Gamification initialization | Skip entirely for guests. |
| Presence tracking | Skip entirely for guests. |
| `firstRunState.syncFromCloud()` | Skip for guests. No cloud data exists. |

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/application/components/MainApplication.svelte
git commit -m "feat(auth): guard guest-incompatible initialization services"
```

---

## Task 9: ModuleRenderer Guest Filtering

**Files:**
- Modify: `src/lib/shared/modules/ModuleRenderer.svelte`

When a guest navigates to a blocked module, show AuthNudge instead of the module content. When a guest is in an allowed module with tab restrictions, filter the tabs.

- [ ] **Step 1: Read ModuleRenderer fully**

Read `src/lib/shared/modules/ModuleRenderer.svelte` (full file, ~200 lines).

- [ ] **Step 2: Add guest access filtering imports and state**

```typescript
import { authState } from "../auth/state/authState.svelte";
import { resolveAccessTier } from "../auth/domain/AccessTier";
import { isModuleAccessible } from "../auth/domain/guest-access-config";
import { isPremiumOrAbove } from "../auth/domain/models/UserRole";
import AuthNudge from "../auth/components/AuthNudge.svelte";
import type { AuthNudgeTrigger } from "../auth/domain/AuthNudgeTrigger";
import { authDrawerState } from "../auth/state/auth-drawer-state.svelte";
import { switchModule } from "../application/state/ui/module-state";

const accessTier = $derived(
  resolveAccessTier(authState.isAuthenticated, isPremiumOrAbove(authState.role))
);

const isModuleBlocked = $derived(
  activeModule ? !isModuleAccessible(activeModule, accessTier) : false
);

function getModuleNudgeTrigger(moduleId: string): AuthNudgeTrigger {
  const triggerMap: Record<string, AuthNudgeTrigger> = {
    learn: "module:learn",
    settings: "module:settings",
  };
  return triggerMap[moduleId] ?? "module:library";
}
```

- [ ] **Step 3: Add gate check in template**

Before the `{#await modulePromise}` block, wrap with:

```svelte
{#if isModuleBlocked}
  <div class="module-gate" style="display: flex; align-items: center; justify-content: center; height: 100%;">
    <AuthNudge
      trigger={getModuleNudgeTrigger(activeModule)}
      onCreateAccount={() => authDrawerState.show()}
      onDismiss={() => switchModule("create")}
    />
  </div>
{:else}
  <!-- existing module rendering (unchanged) -->
{/if}
```

- [ ] **Step 4: Add tab filtering for Browse**

Read `src/lib/features/browse/shared/components/BrowseModule.svelte` to find where tab definitions are consumed. The Browse module receives its tab list from `BROWSE_TABS` in tab-definitions. Find the component that renders the tab bar and filter it:

```typescript
import { getAccessibleTabs } from "$lib/shared/auth/domain/guest-access-config";

// Where tabs are consumed:
const filteredTabs = $derived(() => {
  const allowed = getAccessibleTabs("browse", accessTier);
  if (!allowed) return allTabs; // No filtering for authenticated users
  return allTabs.filter(tab => allowed.includes(tab.id));
});
```

The exact location depends on how BrowseModule renders its tabs. Read the component to determine the right injection point.

- [ ] **Step 5: Run typecheck**

Run: `npm run check`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/modules/ModuleRenderer.svelte src/lib/features/browse/
git commit -m "feat(auth): add guest access filtering to ModuleRenderer and Browse tabs"
```

---

## Task 10: Keyboard Shortcut Gating

**Files:**
- Modify: The file containing module-switching keyboard shortcuts (Ctrl+1 through Ctrl+6)

- [ ] **Step 1: Find keyboard shortcut handler**

Search for the keyboard shortcut handler that maps Ctrl+1-6 to module switching:

```bash
grep -r "Ctrl.*1\|keydown.*module\|keyboard.*module" src/lib/shared/ --include="*.svelte" --include="*.ts" -l
```

- [ ] **Step 2: Add access tier check**

In the keyboard shortcut handler, before switching modules, check `isModuleAccessible()`:

```typescript
import { isModuleAccessible } from "../auth/domain/guest-access-config";
import { resolveAccessTier } from "../auth/domain/AccessTier";
import { authState } from "../auth/state/authState.svelte";
import { isPremiumOrAbove } from "../auth/domain/models/UserRole";
import { authDrawerState } from "../auth/state/auth-drawer-state.svelte";

// In the shortcut handler:
const tier = resolveAccessTier(authState.isAuthenticated, isPremiumOrAbove(authState.role));
if (!isModuleAccessible(targetModule, tier)) {
  // Don't switch — module will show AuthNudge via ModuleRenderer
  // Or optionally: authDrawerState.show();
  return;
}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add <shortcut-handler-file>
git commit -m "feat(auth): gate keyboard module shortcuts for guests"
```

---

## Task 11: Beat Cap Enforcement — Generate

**Files:**
- Modify: `src/lib/features/create/generate/components/cards/LengthCard.svelte` (line 37)
- Modify: `src/lib/features/create/generate/state/generate-actions.svelte.ts`

Two enforcement points: (1) cap the length selector, (2) truncate-then-nudge after generation.

- [ ] **Step 1: Make LengthCard tier-aware**

In `LengthCard.svelte`, replace the hardcoded `const MAX_LENGTH = 64;` (line 37):

```typescript
import { authState } from "$lib/shared/auth/state/authState.svelte";
import { resolveAccessTier, getMaxBeats } from "$lib/shared/auth/domain/AccessTier";
import { isPremiumOrAbove } from "$lib/shared/auth/domain/models/UserRole";

const accessTier = $derived(
  resolveAccessTier(authState.isAuthenticated, isPremiumOrAbove(authState.role))
);
const MAX_LENGTH = $derived(getMaxBeats(accessTier));
```

- [ ] **Step 2: Add post-generation truncation in generate-actions**

Read `src/lib/features/create/generate/state/generate-actions.svelte.ts` to find where the generated sequence is received and committed. After the sequence is generated:

```typescript
import { resolveAccessTier, getMaxBeats } from "$lib/shared/auth/domain/AccessTier";

// After sequence is generated, before committing:
const tier = resolveAccessTier(authState.isAuthenticated, isPremiumOrAbove(authState.role));
const maxBeats = getMaxBeats(tier);

if (sequence.steps.length > maxBeats) {
  sequence.steps = sequence.steps.slice(0, maxBeats);
  // Set flag to show AuthNudge after render
  showPostGenerateNudge = true;
}
```

This ensures Generate "truncates then nudges" rather than blocking, per the spec.

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/create/generate/components/cards/LengthCard.svelte src/lib/features/create/generate/state/generate-actions.svelte.ts
git commit -m "feat(create): enforce tier-aware beat cap in Generate (selector + post-generation truncation)"
```

---

## Task 12: Beat Cap Enforcement — Construct & Assemble

**Files:**
- Modify: `src/lib/features/create/shared/components/CreateModule.svelte` (~line 442)
- Modify: `src/lib/features/create/assemble/components/AssembleToolPanel.svelte`

- [ ] **Step 1: Read CreateModule.svelte's handleOptionSelected**

Read `src/lib/features/create/shared/components/CreateModule.svelte` lines 430-460 to understand the beat-add handler.

- [ ] **Step 2: Add beat cap check in Construct**

```typescript
import { resolveAccessTier, getMaxBeats } from "$lib/shared/auth/domain/AccessTier";
import { isPremiumOrAbove } from "$lib/shared/auth/domain/models/UserRole";
import { authState } from "$lib/shared/auth/state/authState.svelte";
import { authDrawerState } from "$lib/shared/auth/state/auth-drawer-state.svelte";

const accessTier = $derived(
  resolveAccessTier(authState.isAuthenticated, isPremiumOrAbove(authState.role))
);

let showBeatCapNudge = $state(false);

// In handleOptionSelected, add this check before handlers.handleOptionSelected(option):
const currentBeats = sequenceState.getCurrentBeats().length;
const maxBeats = getMaxBeats(accessTier);
if (currentBeats >= maxBeats) {
  showBeatCapNudge = true;
  return;
}
```

Add AuthNudge to the template (e.g., as a positioned card above the option picker):

```svelte
{#if showBeatCapNudge}
  <AuthNudge
    trigger={accessTier === "guest" ? "beat-cap-guest" : "beat-cap-composer"}
    onCreateAccount={() => { showBeatCapNudge = false; authDrawerState.show(); }}
    onDismiss={() => (showBeatCapNudge = false)}
  />
{/if}
```

- [ ] **Step 3: Add beat cap check in Assemble**

Read `src/lib/features/create/assemble/components/AssembleToolPanel.svelte` and its state file `src/lib/features/create/shared/state/assemble-tab-state.svelte.ts` to find where grid clicks commit new beats. Apply the same cap check pattern:

```typescript
const currentBeats = /* however Assemble counts placed beats */;
const maxBeats = getMaxBeats(accessTier);
if (currentBeats >= maxBeats) {
  showBeatCapNudge = true;
  return;
}
```

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/create/shared/components/CreateModule.svelte src/lib/features/create/assemble/
git commit -m "feat(create): enforce tier-aware beat cap in Construct and Assemble"
```

---

## Task 13: Guest Nav Indicator

**Files:**
- Modify: `src/lib/shared/navigation/components/account/AccountRow.svelte`
- Modify: `src/lib/shared/navigation/components/ModuleSwitcher.svelte`

- [ ] **Step 1: Update AccountRow for guest state**

`AccountRow.svelte` already has an unauthenticated branch (lines 44-54). Update it to show a "Sign up" button:

```svelte
{:else}
  <button
    class="account-row drawer interactive"
    onclick={handleSignUp}
    aria-label="Create account"
  >
    <div class="avatar-guest">
      <i class="fas fa-user-plus" aria-hidden="true"></i>
    </div>
    <span class="account-label sign-up-label">Sign up</span>
  </button>
{/if}
```

Add handler:

```typescript
import { authDrawerState } from "$lib/shared/auth/state/auth-drawer-state.svelte";

function handleSignUp() {
  try {
    const hapticService = container.items.hapticFeedback as IHapticFeedback;
    hapticService?.trigger("selection");
  } catch {}
  authDrawerState.show();
}
```

- [ ] **Step 2: Style the guest nav indicator**

```css
.sign-up-label {
  color: var(--theme-accent, #3b82f6);
  font-weight: 600;
}

.avatar-guest {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  border: 1.5px solid var(--theme-accent, #3b82f6);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--theme-accent, #3b82f6);
  font-size: 14px;
}
```

- [ ] **Step 3: Hide inbox for guests in ModuleSwitcher**

In `src/lib/shared/navigation/components/ModuleSwitcher.svelte` (lines 200-210), wrap the inbox button:

```svelte
{#if authState.isAuthenticated}
  <button class="drawer-action inbox" onclick={handleInboxClick}>
    ...
  </button>
{/if}
```

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/navigation/components/account/AccountRow.svelte src/lib/shared/navigation/components/ModuleSwitcher.svelte
git commit -m "feat(nav): show Sign up indicator for guests, hide inbox"
```

---

## Task 14: Browse Gallery Edit Gate

**Files:**
- Modify: The sequence detail view component in Browse that has an Edit/Remix button

- [ ] **Step 1: Find the edit/remix trigger in Browse Gallery**

Search for edit/remix buttons in the sequence viewer or gallery detail:

```bash
grep -r "edit\|remix" src/lib/features/browse/ src/lib/shared/sequence-viewer/ --include="*.svelte" -l -i
```

- [ ] **Step 2: Gate the edit action for guests**

At the edit/remix button handler, add:

```typescript
import { authState } from "$lib/shared/auth/state/authState.svelte";
import { authDrawerState } from "$lib/shared/auth/state/auth-drawer-state.svelte";

if (!authState.isAuthenticated) {
  // Show AuthNudge with edit-community trigger, or directly open drawer
  authDrawerState.show();
  return;
}
```

Or render an AuthNudge with `trigger="edit-community"` when the guest clicks Edit.

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add <edit-component-file>
git commit -m "feat(browse): gate edit/remix action for guests"
```

---

## Task 15: Integration Testing & Verification

**Files:** None created — this is verification.

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass (existing + new from Tasks 1-2).

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Manual verification checklist**

Use Chrome DevTools MCP or ask the user to verify:

1. **Guest arrives at app** → sees Create → Construct tab (not login screen)
2. **Guest switches to Browse** → sees Gallery tab only (Collections/Creators hidden)
3. **Guest taps Learn** → sees AuthNudge with "Sign up free to start learning"
4. **Guest builds 8 beats in Construct** → beat 9 triggers AuthNudge
5. **Guest generates a sequence** → length capped at 8, longer words truncated + nudge
6. **Guest taps "Create Account"** → AuthDrawer slides in with tier progression
7. **Guest signs up** → AuthDrawer closes → FirstRunWizard with reassurance → Wizard completes → sequence still visible
8. **Nav indicator** → shows "Sign up" with user-plus icon for guests, profile picture for authenticated
9. **Keyboard shortcut Ctrl+3** (Learn) → doesn't switch module for guests
10. **Browse > Gallery > sequence detail > Edit** → AuthNudge or drawer for guests

- [ ] **Step 5: Commit any fixes from verification**

Stage specific files only (not `git add -A`):

```bash
git add <specific-files-that-were-fixed>
git commit -m "fix(auth): integration fixes from guest access verification"
```

---

## Dependency Order

```
Task 1 (AccessTier) ──────┐
Task 2 (GuestConfig) ─────┤
Task 3 (GateChecker) ─────┤── Foundation (parallelizable)
Task 4 (NudgeTrigger+Nudge)┤
Task 5 (DrawerState) ──────┘
                            │
Task 6 (AuthDrawer) ────────┤── Components (depends on 4, 5)
                            │
Task 7 (MainApp rework) ───┤── Core wiring (depends on 5, 6)
Task 8 (Init guards) ──────┤
                            │
Task 9 (ModuleRenderer) ───┤── Feature gates (depends on 1-5)
Task 10 (Keyboard shorts) ─┤
Task 11 (Beat cap Generate)┤
Task 12 (Beat cap Construct)┤
Task 13 (Guest Nav) ────────┤
Task 14 (Browse Edit gate) ─┘
                            │
Task 15 (Integration) ──────── Last (depends on all)
```

Tasks 1-5 can be parallelized. Tasks 6-8 depend on foundation. Tasks 9-14 depend on foundation + components. Task 15 is last.
