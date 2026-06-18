# Snappy Boot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kill the three-loader relay on warm reload — render the app from already-cached state immediately, reconcile auth in the background, and replace the module spinner with real-layout skeletons.

**Architecture:** Three workstreams over existing infrastructure (no new caching). (W1) A localStorage boot marker lets MainApplication skip the "Warming up" auth spinner on any non-first load; settings/theme are already primed synchronously from localStorage, so MainInterface renders instantly while Firebase auth reconciles in the background. (W2) The boot splash dismisses the moment the optimistic shell paints. (W3) ModuleRenderer shows a per-module layout skeleton (selected by the persisted module key) instead of the generic "Loading {Module}" bar.

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, Vitest, Firebase Auth, service worker (`static/sw.js`, already caches bytes).

**Spec:** `docs/superpowers/specs/2026-06-18-snappy-boot-design.md`

**Ground truth established during planning:**
- Settings already prime synchronously from `tka-modern-web-settings` (`src/lib/shared/settings/state/settings-state.svelte.ts:74-86`; `getSettings()` returns the preloaded cache pre-init at `src/lib/shared/application/state/app-state.svelte.ts:104-124`).
- The only gate hiding MainInterface on warm reload is `showAuthLoadingSpinner = authLoading && !_mainInterfaceShown` (`src/lib/shared/application/components/MainApplication.svelte:111`); MainInterface does **not** wait on settings/gamification.
- `AccessTier = "guest" | "user" | "premium"` (`src/lib/shared/auth/domain/access-tier.ts:1`). Tier derives reactively via `resolveAccessTier(isAuthenticated, isAnonymous, isPremium)`; ModuleRenderer already consumes it in a `$derived` (`src/lib/shared/modules/ModuleRenderer.svelte:278-280`), so premium gating self-corrects on reconcile.
- Default landing module is `create` (`src/lib/shared/modules/ModuleRenderer.svelte:135`).
- Active module is persisted at `CURRENT_MODULE_KEY = "tka-current-module"` (`src/lib/shared/navigation/config/storage-keys.ts:9`).
- `authState.isAuthenticated` = `_state.user !== null` (`src/lib/shared/auth/state/auth-state.svelte.ts:752`).
- Tests live under `tests/unit/...`, run with Vitest (`tests/unit/shared/modules/keep-alive-controller.test.ts` is a peer example).

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/shared/application/services/boot-snapshot.ts` | Pure read/write/clear of the localStorage boot marker (`uid`, `role`, `activeModule`, `version`) |
| Create | `tests/unit/shared/application/boot-snapshot.test.ts` | Unit tests for the boot-snapshot store |
| Modify | `src/lib/shared/application/components/MainApplication.svelte` | Write marker on successful boot; skip auth spinner when marker present; dismiss splash on optimistic paint |
| Modify | `src/lib/shared/auth/domain/access-tier.ts` | Add `resolveOptimisticAccessTier` for the W1b polish (optimistic tier during auth-load window) |
| Create | `src/lib/shared/modules/skeletons/index.ts` | Module-key → skeleton component registry + `SharedShellSkeleton` fallback resolver |
| Create | `tests/unit/shared/modules/skeleton-registry.test.ts` | Unit tests for the registry resolver |
| Create | `src/lib/shared/modules/skeletons/SharedShellSkeleton.svelte` | Generic header-bar + content-shimmer fallback skeleton |
| Create | `src/lib/shared/modules/skeletons/CreateSkeleton.svelte` | Create-module workspace-frame skeleton |
| Create | `src/lib/shared/modules/skeletons/BrowseSkeleton.svelte` | Browse-module sidebar + card-grid shimmer skeleton |
| Create | `src/lib/shared/modules/skeletons/ModuleSkeleton.svelte` | Thin dispatcher: takes a module key, renders the right skeleton via the registry |
| Modify | `src/lib/shared/modules/ModuleRenderer.svelte` | Replace generic `.module-loading` bar with `<ModuleSkeleton moduleKey={activeModule} />` in both loading branches (keep museum special-case) |

---

## Workstream 1 — Optimistic boot (kills "Warming up" spinner)

### Task 1: Boot-snapshot store (pure, TDD)

**Files:**
- Create: `src/lib/shared/application/services/boot-snapshot.ts`
- Test: `tests/unit/shared/application/boot-snapshot.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/shared/application/boot-snapshot.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  readBootSnapshot,
  writeBootSnapshot,
  clearBootSnapshot,
  BOOT_SNAPSHOT_KEY,
  BOOT_SNAPSHOT_VERSION,
} from "$lib/shared/application/services/boot-snapshot";

describe("boot-snapshot", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("returns null when nothing is stored", () => {
    expect(readBootSnapshot()).toBeNull();
  });

  it("round-trips a written snapshot", () => {
    writeBootSnapshot({ uid: "abc", role: "premium", activeModule: "browse" });
    expect(readBootSnapshot()).toEqual({
      uid: "abc",
      role: "premium",
      activeModule: "browse",
      version: BOOT_SNAPSHOT_VERSION,
    });
  });

  it("ignores a snapshot written under a different version", () => {
    localStorage.setItem(
      BOOT_SNAPSHOT_KEY,
      JSON.stringify({ uid: "x", role: "user", activeModule: "create", version: -1 })
    );
    expect(readBootSnapshot()).toBeNull();
  });

  it("returns null on malformed JSON instead of throwing", () => {
    localStorage.setItem(BOOT_SNAPSHOT_KEY, "{not json");
    expect(readBootSnapshot()).toBeNull();
  });

  it("clear() removes the snapshot", () => {
    writeBootSnapshot({ uid: null, role: "guest", activeModule: "create" });
    clearBootSnapshot();
    expect(readBootSnapshot()).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/shared/application/boot-snapshot.test.ts`
Expected: FAIL — cannot resolve module `boot-snapshot`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/shared/application/services/boot-snapshot.ts`:

```ts
/**
 * Boot snapshot — a tiny, synchronously-readable record of the last successful
 * boot. Lets the app skip the auth "Warming up" spinner on warm reloads and
 * (optionally) seed the last-known tier so a signed-in user renders as their
 * real tier instantly instead of flashing guest while Firebase auth reconciles.
 *
 * Pure module: no reactive state, no class. Reads/writes localStorage only.
 */
import { browser } from "$app/environment";
import type { UserRole } from "$lib/shared/auth/domain/models/user-role";

export const BOOT_SNAPSHOT_KEY = "tka-boot-snapshot";
export const BOOT_SNAPSHOT_VERSION = 1;

export interface BootSnapshot {
  /** Last-known authenticated uid, or null for guest. */
  uid: string | null;
  /** Last-known role — used to seed optimistic tier (W1b). */
  role: UserRole;
  /** Last-active module id — used to pick the right skeleton on reload. */
  activeModule: string;
  /** Schema version; a mismatch means "treat as no snapshot". */
  version: number;
}

export function readBootSnapshot(): BootSnapshot | null {
  if (!browser) return null;
  try {
    const raw = localStorage.getItem(BOOT_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BootSnapshot;
    if (parsed?.version !== BOOT_SNAPSHOT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeBootSnapshot(
  snapshot: Omit<BootSnapshot, "version">
): void {
  if (!browser) return;
  try {
    localStorage.setItem(
      BOOT_SNAPSHOT_KEY,
      JSON.stringify({ ...snapshot, version: BOOT_SNAPSHOT_VERSION })
    );
  } catch {
    /* storage full / unavailable — non-fatal, boot proceeds without optimism */
  }
}

export function clearBootSnapshot(): void {
  if (!browser) return;
  try {
    localStorage.removeItem(BOOT_SNAPSHOT_KEY);
  } catch {
    /* non-fatal */
  }
}
```

Before writing, confirm the `UserRole` import path: run `grep -rn "export type UserRole\|export enum UserRole" src/lib/shared/auth/domain/`. If it is not at `models/user-role`, update the import to the real path (the test does not depend on the type, so it stays green either way).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/shared/application/boot-snapshot.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/application/services/boot-snapshot.ts tests/unit/shared/application/boot-snapshot.test.ts
git commit -m "feat(boot): add boot-snapshot store for optimistic warm reload" -- src/lib/shared/application/services/boot-snapshot.ts tests/unit/shared/application/boot-snapshot.test.ts
```

---

### Task 2: Write the snapshot on successful boot

**Files:**
- Modify: `src/lib/shared/application/components/MainApplication.svelte` (import + the success block near line 334-337)

- [ ] **Step 1: Add the import**

At the top of the `<script>` block in `MainApplication.svelte`, with the other imports, add:

```ts
import { writeBootSnapshot } from "$lib/shared/application/services/boot-snapshot";
import { CURRENT_MODULE_KEY } from "$lib/shared/navigation/config/storage-keys";
```

- [ ] **Step 2: Write the snapshot right after the app marks itself initialized**

In `MainApplication.svelte`, find this block (currently around lines 334-337):

```ts
        setInitializationState(true, false, null, 0);

        // Progress: Fully ready - triggers loading screen fade out with random ready message
        window.__tkaLoadProgress?.(100, "Ready");
```

Insert immediately after the `window.__tkaLoadProgress?.(100, "Ready");` line:

```ts
        // Persist a boot snapshot so the NEXT load can skip the auth spinner and
        // render optimistically. role/uid seed the optimistic tier (W1b); the
        // active module picks the right skeleton.
        writeBootSnapshot({
          uid: authState.getEffectiveUserId(),
          role: authState.role,
          activeModule:
            (typeof localStorage !== "undefined" &&
              localStorage.getItem(CURRENT_MODULE_KEY)) ||
            "create",
        });
```

- [ ] **Step 3: Verify it typechecks**

Run: `npm run check:fast`
Expected: 0 new errors in `MainApplication.svelte`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/application/components/MainApplication.svelte
git commit -m "feat(boot): write boot snapshot once the app is fully initialized" -- src/lib/shared/application/components/MainApplication.svelte
```

---

### Task 3: Skip the "Warming up" spinner on warm reload (W1 core)

**Files:**
- Modify: `src/lib/shared/application/components/MainApplication.svelte` (the `_mainInterfaceShown` init + `showAuthLoadingSpinner` derivation around lines 105-118)

**Why this works:** Settings/theme/background already prime synchronously from localStorage, so MainInterface renders correctly without waiting on the auth chain. The spinner is the only thing holding it back. On any load where a boot snapshot exists (i.e. not the first-ever visit), we treat MainInterface as already-shown so the spinner never gates. Auth still resolves in the background and `isAuthenticated`/`role`/tier update reactively when it does.

- [ ] **Step 1: Add the import**

With the other imports in `MainApplication.svelte`, add (or extend the existing boot-snapshot import from Task 2):

```ts
import { readBootSnapshot } from "$lib/shared/application/services/boot-snapshot";
```

- [ ] **Step 2: Seed `_mainInterfaceShown` from the snapshot**

Find the declaration of `_mainInterfaceShown`. It is a module-level `let` outside the component instance (referenced at `MainApplication.svelte:111,116`). Locate its declaration (grep within the file: `grep -n "_mainInterfaceShown" src/lib/shared/application/components/MainApplication.svelte`). It is currently initialized to `false`, e.g.:

```ts
let _mainInterfaceShown = false;
```

Replace that initializer with a snapshot-seeded one:

```ts
// Seed from the boot snapshot: if the app has successfully booted before,
// settings/theme are already primed from localStorage, so we render
// MainInterface immediately and let auth reconcile in the background instead
// of showing the "Warming up" spinner. First-ever load (no snapshot) keeps
// the spinner.
let _mainInterfaceShown = readBootSnapshot() !== null;
```

- [ ] **Step 3: Verify the derivation is unchanged and still correct**

Confirm `showAuthLoadingSpinner` (line ~111) still reads:

```ts
const showAuthLoadingSpinner = $derived(authLoading && !_mainInterfaceShown);
```

No change needed — with `_mainInterfaceShown` seeded `true` on warm reload, this is always `false`, so the spinner branch (`MainApplication.svelte:483-488`) never renders and the `{:else}` branch with `<MainInterface />` renders on first paint.

- [ ] **Step 4: Typecheck**

Run: `npm run check:fast`
Expected: 0 new errors.

- [ ] **Step 5: Runtime smoke check (manual, recorded in commit)**

Build and serve, then load `/app` twice (first to write the snapshot, second to read it):

```bash
npm run build:fast
```

Per the project Dev Server rule, do not start a competing dev server — use the existing one on :5173 or `vite --port 5174`. This step is verified for real in Task 10 via Chrome DevTools MCP; here just confirm the build compiles.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/application/components/MainApplication.svelte
git commit -m "feat(boot): skip auth spinner on warm reload, render MainInterface optimistically" -- src/lib/shared/application/components/MainApplication.svelte
```

---

### Task 4: Dismiss the splash on optimistic paint (W2)

**Files:**
- Modify: `src/lib/shared/application/components/MainApplication.svelte` (onMount, near the HMR-skip early-return around lines 201-224)

**Why:** The `app.html` splash (`#app-loading`) is dismissed by `window.__tkaLoadProgress(100)`, which today fires only at the end of the full boot chain (`MainApplication.svelte:337`). On a warm reload the optimistic MainInterface paints long before that. Fire a `100` progress as soon as the optimistic component mounts so the splash doesn't linger over an already-rendered app. The later `100` call at line 337 is idempotent (the splash is already gone).

- [ ] **Step 1: Add an onMount splash-dismiss for the optimistic path**

In `MainApplication.svelte`, inside `onMount(() => { ... })`, immediately before the `(async () => {` IIFE (around line 205), add:

```ts
    // Optimistic warm-reload: settings/theme are primed and MainInterface is
    // already rendering, so retire the boot splash now instead of waiting for
    // the full async boot chain. Idempotent with the final __tkaLoadProgress(100).
    if (readBootSnapshot() !== null) {
      window.__tkaLoadProgress?.(100, "Ready");
    }
```

- [ ] **Step 2: Typecheck**

Run: `npm run check:fast`
Expected: 0 new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/application/components/MainApplication.svelte
git commit -m "perf(boot): dismiss boot splash on optimistic warm-reload paint" -- src/lib/shared/application/components/MainApplication.svelte
```

---

### Task 5: Optimistic tier seeding — remove the guest flash (W1b, flagged risk)

**Files:**
- Modify: `src/lib/shared/auth/domain/access-tier.ts` (add a helper)
- Modify: `src/lib/shared/modules/ModuleRenderer.svelte` (use the optimistic helper while auth is loading)

**Risk / why staged separately:** Without this, a signed-in user on warm reload sees the app render as **guest** for the ~100ms until `onAuthStateChanged` fires, then it snaps to their real tier. The user chose "optimistic, reconcile silently" — this task removes that flash by seeding the last-known tier from the snapshot **only while `authState.loading` is true**, without faking a Firebase `User` object (which would break token-consuming code in the reconcile window). If during execution this proves to interact badly with any gating path, ship Tasks 1-4 (the spinner kill) and defer this; the core win still lands.

- [ ] **Step 1: Add `resolveOptimisticAccessTier` to access-tier.ts**

In `src/lib/shared/auth/domain/access-tier.ts`, after `resolveAccessTier` (line 17), add:

```ts
/**
 * Tier to show during the brief auth-loading window on a warm reload. If auth
 * has resolved, use the real tier. While it is still loading, fall back to the
 * last-known tier from the boot snapshot so a signed-in user does not flash as
 * guest. Once auth resolves, callers switch back to resolveAccessTier and the
 * value reconciles in place.
 */
export function resolveOptimisticAccessTier(
  authLoading: boolean,
  realTier: AccessTier,
  snapshotTier: AccessTier | null
): AccessTier {
  if (!authLoading) return realTier;
  return snapshotTier ?? realTier;
}

/** Map a persisted UserRole-ish tier seed onto an AccessTier. */
export function accessTierFromRole(
  role: string | null | undefined,
  isAuthenticated: boolean
): AccessTier {
  if (!isAuthenticated || !role || role === "anonymous" || role === "guest") {
    return "guest";
  }
  if (role === "premium" || role === "admin") return "premium";
  return "user";
}
```

Before writing `accessTierFromRole`, confirm the `UserRole` string values: run `grep -rn "UserRole" src/lib/shared/auth/domain/models/user-role.ts` (or wherever Task 1's grep located it) and adjust the `role ===` comparisons to the actual enum/string values (e.g. if roles are `"user" | "premium" | "admin" | "anonymous"`). Keep the mapping: anything authenticated-and-premium/admin → `premium`; authenticated otherwise → `user`; else → `guest`.

- [ ] **Step 2: Add a unit test for the helpers**

Append to `tests/unit/shared/application/boot-snapshot.test.ts` is wrong scope — create `tests/unit/shared/auth/access-tier.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  resolveOptimisticAccessTier,
  accessTierFromRole,
} from "$lib/shared/auth/domain/access-tier";

describe("resolveOptimisticAccessTier", () => {
  it("uses the real tier once auth has resolved", () => {
    expect(resolveOptimisticAccessTier(false, "user", "premium")).toBe("user");
  });
  it("falls back to the snapshot tier while auth is loading", () => {
    expect(resolveOptimisticAccessTier(true, "guest", "premium")).toBe("premium");
  });
  it("uses real tier while loading when there is no snapshot", () => {
    expect(resolveOptimisticAccessTier(true, "guest", null)).toBe("guest");
  });
});

describe("accessTierFromRole", () => {
  it("returns guest when unauthenticated", () => {
    expect(accessTierFromRole("premium", false)).toBe("guest");
  });
  it("maps premium role to premium", () => {
    expect(accessTierFromRole("premium", true)).toBe("premium");
  });
  it("maps a plain user role to user", () => {
    expect(accessTierFromRole("user", true)).toBe("user");
  });
});
```

Run: `npx vitest run tests/unit/shared/auth/access-tier.test.ts`
Expected: PASS (after Step 1; adjust role strings if the grep showed different values).

- [ ] **Step 3: Use the optimistic tier in ModuleRenderer**

In `src/lib/shared/modules/ModuleRenderer.svelte`, add the imports alongside the existing access-tier imports:

```ts
import {
  resolveOptimisticAccessTier,
  accessTierFromRole,
} from "$lib/shared/auth/domain/access-tier";
import { readBootSnapshot } from "$lib/shared/application/services/boot-snapshot";
```

Replace the `accessTier` derivation (currently lines 278-280):

```ts
  const accessTier = $derived(
    resolveAccessTier(authState.isAuthenticated, authState.isAnonymous, isPremiumOrAbove(authState.role))
  );
```

with:

```ts
  const _bootSnapshot = readBootSnapshot();
  const _snapshotTier = _bootSnapshot
    ? accessTierFromRole(_bootSnapshot.role, _bootSnapshot.uid !== null)
    : null;
  const _realTier = $derived(
    resolveAccessTier(authState.isAuthenticated, authState.isAnonymous, isPremiumOrAbove(authState.role))
  );
  const accessTier = $derived(
    resolveOptimisticAccessTier(authState.loading, _realTier, _snapshotTier)
  );
```

This keeps `isModuleBlocked` (line 282-284) deriving from `accessTier`, so a snapshot-premium user is not wrongly gated out of a premium module during the auth-load window, and a real-guest who had a stale premium snapshot reconciles to gated the instant `authState.loading` flips false.

- [ ] **Step 4: Typecheck + tests**

Run: `npm run check:fast && npx vitest run tests/unit/shared/auth/access-tier.test.ts`
Expected: 0 new type errors; tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/auth/domain/access-tier.ts tests/unit/shared/auth/access-tier.test.ts src/lib/shared/modules/ModuleRenderer.svelte
git commit -m "feat(boot): seed optimistic tier during auth-load window to kill guest flash" -- src/lib/shared/auth/domain/access-tier.ts tests/unit/shared/auth/access-tier.test.ts src/lib/shared/modules/ModuleRenderer.svelte
```

---

## Workstream 3 — Per-module layout skeletons (kills "Loading {Module}" flash)

### Task 6: Skeleton registry + shared fallback (TDD for the resolver)

**Files:**
- Create: `src/lib/shared/modules/skeletons/SharedShellSkeleton.svelte`
- Create: `src/lib/shared/modules/skeletons/index.ts`
- Create: `src/lib/shared/modules/skeletons/ModuleSkeleton.svelte`
- Test: `tests/unit/shared/modules/skeleton-registry.test.ts`

- [ ] **Step 1: Write the failing resolver test**

Create `tests/unit/shared/modules/skeleton-registry.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveSkeleton, SHARED_SHELL } from "$lib/shared/modules/skeletons";
import CreateSkeleton from "$lib/shared/modules/skeletons/CreateSkeleton.svelte";
import BrowseSkeleton from "$lib/shared/modules/skeletons/BrowseSkeleton.svelte";
import SharedShellSkeleton from "$lib/shared/modules/skeletons/SharedShellSkeleton.svelte";

describe("resolveSkeleton", () => {
  it("returns the Create skeleton for create", () => {
    expect(resolveSkeleton("create")).toBe(CreateSkeleton);
  });
  it("returns the Browse skeleton for browse", () => {
    expect(resolveSkeleton("browse")).toBe(BrowseSkeleton);
  });
  it("falls back to the shared shell for an unknown module", () => {
    expect(resolveSkeleton("settings")).toBe(SharedShellSkeleton);
  });
  it("falls back to the shared shell for null", () => {
    expect(resolveSkeleton(null)).toBe(SharedShellSkeleton);
  });
  it("SHARED_SHELL is the shared shell component", () => {
    expect(SHARED_SHELL).toBe(SharedShellSkeleton);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/shared/modules/skeleton-registry.test.ts`
Expected: FAIL — modules not found (CreateSkeleton/BrowseSkeleton/index do not exist yet). They are created in this task (Step 4) and Tasks 7-8. Create stub `.svelte` files now so the resolver test can run; the real layouts land in Tasks 7-8.

- [ ] **Step 3: Create the shared shell skeleton**

Create `src/lib/shared/modules/skeletons/SharedShellSkeleton.svelte`:

```svelte
<!--
  Generic module loading skeleton: a header bar plus a content shimmer. Used as
  the fallback for any module without a bespoke skeleton. Reserves the full
  content box so the real module fills in without layout shift.
-->
<div class="skeleton-shell" role="status" aria-live="polite" aria-busy="true">
  <div class="skeleton-bar skeleton-header"></div>
  <div class="skeleton-body">
    <div class="skeleton-block"></div>
    <div class="skeleton-block"></div>
    <div class="skeleton-block"></div>
  </div>
  <span class="sr-only">Loading…</span>
</div>

<style>
  .skeleton-shell {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md, 1rem);
    width: 100%;
    height: 100%;
    padding: var(--spacing-md, 1rem);
    box-sizing: border-box;
  }
  .skeleton-bar,
  .skeleton-block {
    border-radius: var(--radius-md, 0.5rem);
    background: linear-gradient(
      90deg,
      var(--surface-2, rgba(255, 255, 255, 0.06)) 25%,
      var(--surface-3, rgba(255, 255, 255, 0.12)) 37%,
      var(--surface-2, rgba(255, 255, 255, 0.06)) 63%
    );
    background-size: 400% 100%;
    animation: skeleton-shimmer 1.4s ease-in-out infinite;
  }
  .skeleton-header {
    height: 2.5rem;
    width: 40%;
  }
  .skeleton-body {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm, 0.5rem);
    flex: 1 1 auto;
  }
  .skeleton-block {
    flex: 1 1 0;
    min-height: 4rem;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  @keyframes skeleton-shimmer {
    0% { background-position: 100% 50%; }
    100% { background-position: 0 50%; }
  }
  @media (prefers-reduced-motion: reduce) {
    .skeleton-bar,
    .skeleton-block { animation: none; }
  }
</style>
```

- [ ] **Step 4: Create the registry resolver and dispatcher**

Create temporary stub files so the resolver compiles (real layouts in Tasks 7-8). Create `src/lib/shared/modules/skeletons/CreateSkeleton.svelte`:

```svelte
<!-- Placeholder — real workspace-frame layout added in Task 7. -->
<script lang="ts">
  import SharedShellSkeleton from "./SharedShellSkeleton.svelte";
</script>
<SharedShellSkeleton />
```

Create `src/lib/shared/modules/skeletons/BrowseSkeleton.svelte`:

```svelte
<!-- Placeholder — real card-grid layout added in Task 8. -->
<script lang="ts">
  import SharedShellSkeleton from "./SharedShellSkeleton.svelte";
</script>
<SharedShellSkeleton />
```

Create `src/lib/shared/modules/skeletons/index.ts`:

```ts
import type { Component } from "svelte";
import SharedShellSkeleton from "./SharedShellSkeleton.svelte";
import CreateSkeleton from "./CreateSkeleton.svelte";
import BrowseSkeleton from "./BrowseSkeleton.svelte";

export const SHARED_SHELL: Component = SharedShellSkeleton;

/** Bespoke skeletons keyed by module id. Everything else uses SHARED_SHELL. */
const REGISTRY: Record<string, Component> = {
  create: CreateSkeleton,
  browse: BrowseSkeleton,
  // backwards-compat aliases that resolve to the same modules in ModuleRenderer
  library: BrowseSkeleton,
};

export function resolveSkeleton(moduleKey: string | null): Component {
  if (!moduleKey) return SHARED_SHELL;
  return REGISTRY[moduleKey] ?? SHARED_SHELL;
}
```

Create `src/lib/shared/modules/skeletons/ModuleSkeleton.svelte`:

```svelte
<!--
  Dispatcher: given the active module key, render its bespoke layout skeleton
  (or the shared shell fallback). Selection is synchronous from the key so the
  correct skeleton shows on the first frame of a reload.
-->
<script lang="ts">
  import { resolveSkeleton } from "./index";
  let { moduleKey }: { moduleKey: string | null } = $props();
  const Skeleton = $derived(resolveSkeleton(moduleKey));
</script>

<Skeleton />
```

- [ ] **Step 5: Run the resolver test to verify it passes**

Run: `npx vitest run tests/unit/shared/modules/skeleton-registry.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/modules/skeletons/ tests/unit/shared/modules/skeleton-registry.test.ts
git commit -m "feat(skeletons): add module skeleton registry, dispatcher, and shared shell" -- src/lib/shared/modules/skeletons/ tests/unit/shared/modules/skeleton-registry.test.ts
```

---

### Task 7: Create-module workspace-frame skeleton

**Files:**
- Modify: `src/lib/shared/modules/skeletons/CreateSkeleton.svelte` (replace the placeholder)

**Reference the real layout first:** Run `grep -rn "class=" src/lib/features/create/shared/components/CreateModule.svelte | head -40` and open `StandardWorkspaceLayout` (grep: `grep -rln "StandardWorkspaceLayout" src/lib/features/create`) to read the real frame — a top action/toolbar strip above a beat-grid workspace region. Match its outer structure (toolbar height, grid area) so the skeleton box equals the real box (no layout shift per `no-layout-shift.md`).

- [ ] **Step 1: Replace the placeholder with the workspace frame**

Replace the entire contents of `src/lib/shared/modules/skeletons/CreateSkeleton.svelte`:

```svelte
<!--
  Create-module loading skeleton. Mirrors StandardWorkspaceLayout: a top toolbar
  strip over a beat-grid workspace. Reserves the same boxes the real module fills
  so content swaps in without reflow.
-->
<div class="create-skeleton" role="status" aria-live="polite" aria-busy="true">
  <div class="cs-toolbar">
    <div class="cs-chip"></div>
    <div class="cs-chip"></div>
    <div class="cs-chip"></div>
    <div class="cs-spacer"></div>
    <div class="cs-chip cs-chip-wide"></div>
  </div>
  <div class="cs-workspace">
    {#each Array(8) as _, i (i)}
      <div class="cs-cell"></div>
    {/each}
  </div>
  <span class="sr-only">Loading Create…</span>
</div>

<style>
  .create-skeleton {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    gap: var(--spacing-md, 1rem);
    padding: var(--spacing-md, 1rem);
    box-sizing: border-box;
  }
  .cs-toolbar {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 0.5rem);
    height: 3rem;
    flex: 0 0 auto;
  }
  .cs-spacer { flex: 1 1 auto; }
  .cs-workspace {
    flex: 1 1 auto;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    grid-auto-rows: 1fr;
    gap: var(--spacing-sm, 0.5rem);
    min-height: 0;
  }
  .cs-chip,
  .cs-chip-wide,
  .cs-cell {
    border-radius: var(--radius-md, 0.5rem);
    background: linear-gradient(
      90deg,
      var(--surface-2, rgba(255, 255, 255, 0.06)) 25%,
      var(--surface-3, rgba(255, 255, 255, 0.12)) 37%,
      var(--surface-2, rgba(255, 255, 255, 0.06)) 63%
    );
    background-size: 400% 100%;
    animation: skeleton-shimmer 1.4s ease-in-out infinite;
  }
  .cs-chip { width: 4.5rem; height: 2rem; }
  .cs-chip-wide { width: 8rem; height: 2rem; }
  .cs-cell { min-height: 0; }
  .sr-only {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
  }
  @keyframes skeleton-shimmer {
    0% { background-position: 100% 50%; }
    100% { background-position: 0 50%; }
  }
  @media (prefers-reduced-motion: reduce) {
    .cs-chip, .cs-chip-wide, .cs-cell { animation: none; }
  }
</style>
```

- [ ] **Step 2: Verify the resolver test still passes (CreateSkeleton is still the create mapping)**

Run: `npx vitest run tests/unit/shared/modules/skeleton-registry.test.ts`
Expected: PASS — `resolveSkeleton("create")` still returns this component.

- [ ] **Step 3: Typecheck**

Run: `npm run check:fast`
Expected: 0 new errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/modules/skeletons/CreateSkeleton.svelte
git commit -m "feat(skeletons): real workspace-frame skeleton for Create" -- src/lib/shared/modules/skeletons/CreateSkeleton.svelte
```

---

### Task 8: Browse-module card-grid skeleton

**Files:**
- Modify: `src/lib/shared/modules/skeletons/BrowseSkeleton.svelte` (replace the placeholder)

**Reference the real layout first:** Run `grep -rn "class=" src/lib/features/browse/shared/components/BrowseModule.svelte | head -40` and look at `SectionIndexSidebar` (it is in the modified-files set) — Browse is a left section-index sidebar beside a card grid. Match that two-pane structure.

- [ ] **Step 1: Replace the placeholder with the sidebar + card grid**

Replace the entire contents of `src/lib/shared/modules/skeletons/BrowseSkeleton.svelte`:

```svelte
<!--
  Browse-module loading skeleton. Mirrors BrowseModule: a left section-index rail
  beside a responsive card grid. Reserves both panes so the real grid fills in
  without shifting the rail.
-->
<div class="browse-skeleton" role="status" aria-live="polite" aria-busy="true">
  <div class="bs-rail">
    {#each Array(6) as _, i (i)}
      <div class="bs-rail-item"></div>
    {/each}
  </div>
  <div class="bs-grid">
    {#each Array(12) as _, i (i)}
      <div class="bs-card"></div>
    {/each}
  </div>
  <span class="sr-only">Loading Browse…</span>
</div>

<style>
  .browse-skeleton {
    display: grid;
    grid-template-columns: minmax(7rem, 12%) 1fr;
    gap: var(--spacing-md, 1rem);
    width: 100%;
    height: 100%;
    padding: var(--spacing-md, 1rem);
    box-sizing: border-box;
  }
  .bs-rail {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm, 0.5rem);
  }
  .bs-rail-item { height: 1.75rem; }
  .bs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
    grid-auto-rows: 10rem;
    gap: var(--spacing-sm, 0.5rem);
    align-content: start;
    overflow: hidden;
  }
  .bs-rail-item,
  .bs-card {
    border-radius: var(--radius-md, 0.5rem);
    background: linear-gradient(
      90deg,
      var(--surface-2, rgba(255, 255, 255, 0.06)) 25%,
      var(--surface-3, rgba(255, 255, 255, 0.12)) 37%,
      var(--surface-2, rgba(255, 255, 255, 0.06)) 63%
    );
    background-size: 400% 100%;
    animation: skeleton-shimmer 1.4s ease-in-out infinite;
  }
  .sr-only {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
  }
  @keyframes skeleton-shimmer {
    0% { background-position: 100% 50%; }
    100% { background-position: 0 50%; }
  }
  @media (prefers-reduced-motion: reduce) {
    .bs-rail-item, .bs-card { animation: none; }
  }
</style>
```

- [ ] **Step 2: Resolver test still passes**

Run: `npx vitest run tests/unit/shared/modules/skeleton-registry.test.ts`
Expected: PASS.

- [ ] **Step 3: Typecheck**

Run: `npm run check:fast`
Expected: 0 new errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/modules/skeletons/BrowseSkeleton.svelte
git commit -m "feat(skeletons): real sidebar + card-grid skeleton for Browse" -- src/lib/shared/modules/skeletons/BrowseSkeleton.svelte
```

---

### Task 9: Wire skeletons into ModuleRenderer

**Files:**
- Modify: `src/lib/shared/modules/ModuleRenderer.svelte` (the two non-museum `.module-loading` blocks at lines 307-312 and 344-354; add import)

**Keep museum as-is:** The museum branches (`:297-306` and `:334-343`) keep their bespoke `.museum-skeleton`. Only the generic `.module-loading` bar in the `{:else}` branches is replaced.

- [ ] **Step 1: Add the import**

With the other imports in `ModuleRenderer.svelte`, add:

```ts
import ModuleSkeleton from "$lib/shared/modules/skeletons/ModuleSkeleton.svelte";
```

- [ ] **Step 2: Replace the first generic loading block (the `isModuleLoading` branch, lines 307-312)**

Find:

```svelte
  {:else}
    <div class="module-loading" role="status" aria-live="polite" aria-busy="true">
      <IndeterminateBar height={3} position="top" />
      <p class="module-loading-label">Loading {MODULE_DEFINITIONS.find((m) => m.id === activeModule)?.label ?? activeModule}...</p>
    </div>
  {/if}
```

Replace the inner `<div class="module-loading">…</div>` with the skeleton (leaving the `{:else}`/`{/if}` structure intact):

```svelte
  {:else}
    <ModuleSkeleton moduleKey={activeModule} />
  {/if}
```

- [ ] **Step 3: Replace the second generic loading block (the `{#await modulePromise}` pending branch, lines 344-354)**

Find:

```svelte
            {:else}
              <div
                class="module-loading"
                role="status"
                aria-live="polite"
                aria-busy="true"
              >
                <IndeterminateBar height={3} position="top" />
                <p class="module-loading-label">Loading {MODULE_DEFINITIONS.find((m) => m.id === activeModule)?.label ?? activeModule}...</p>
              </div>
            {/if}
```

Replace the inner `<div class="module-loading">…</div>` with:

```svelte
            {:else}
              <ModuleSkeleton moduleKey={activeModule} />
            {/if}
```

- [ ] **Step 4: Remove the now-unused IndeterminateBar import if nothing else uses it**

Run: `grep -n "IndeterminateBar" src/lib/shared/modules/ModuleRenderer.svelte`. If the only remaining matches are the import line, remove the import. If `IndeterminateBar` is still used elsewhere in the file, leave it. (The `.module-loading` / `.module-loading-label` CSS rules in the `<style>` block also become dead — remove them only if `grep -n "module-loading" src/lib/shared/modules/ModuleRenderer.svelte` shows no remaining markup references.)

- [ ] **Step 5: Typecheck**

Run: `npm run check:fast`
Expected: 0 new errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/modules/ModuleRenderer.svelte
git commit -m "feat(skeletons): ModuleRenderer shows per-module skeleton instead of generic bar" -- src/lib/shared/modules/ModuleRenderer.svelte
```

---

## Verification

### Task 10: Runtime verification via Chrome DevTools MCP

**Files:** none (verification only). Requires explicit verbal permission before any interactive DevTools command, per project rules. Read-only snapshot/trace is fine on request.

- [ ] **Step 1: Full gate check**

Run the heavy gates once (per `fast-iteration-loop.md`, this is the commit/ship boundary):

```bash
npm run check > /tmp/check.log 2>&1; grep -niE "error" /tmp/check.log
npx vitest run tests/unit/shared/application/boot-snapshot.test.ts tests/unit/shared/auth/access-tier.test.ts tests/unit/shared/modules/skeleton-registry.test.ts
npm run build:fast
```

Expected: 0 type errors; all unit tests PASS; build succeeds.

- [ ] **Step 2: Warm-reload — no spinner, skeleton not spinner**

Ask the user for permission to drive the browser. With Chrome DevTools MCP on the running app:
1. Load `/app` once (writes the snapshot), then reload (warm).
2. Capture a Performance trace across the reload.
3. Assert: no `.auth-loading` element ("Warming up") is ever rendered (DOM query during the reload window); the content region shows a `[role=status][aria-busy=true]` skeleton (`.create-skeleton` / `.browse-skeleton` / `.skeleton-shell`), NOT `.module-loading` with `IndeterminateBar`.
4. Assert via the network waterfall + paint markers: MainInterface's first contentful paint precedes resolution of the background Firebase auth request.

- [ ] **Step 3: Optimistic tier — no guest flash, safe reconcile**

1. Signed in as a premium user, reload `/app`. Assert no guest→premium tier flash in the first frames (tier badge / premium affordances render as premium immediately).
2. Stale-snapshot safety: seed a `premium` snapshot, then force the real session to guest (sign out in another tab / clear the Firebase auth IndexedDB). Reload. Assert: the UI corrects to guest the instant `authState.loading` flips false, and no premium-gated **action** is invocable during the optimistic window (`isModuleBlocked` re-derives to block premium modules). Capture the DOM/console proof.

- [ ] **Step 4: No layout shift on skeleton→content swap**

For Create and Browse, capture the CLS metric (or before/after bounding boxes of the content region) as the skeleton swaps to the real module. Assert ≈0 shift (skeleton box matches real layout box, per `no-layout-shift.md`).

- [ ] **Step 5: Cold path intact**

Clear the boot snapshot (`localStorage.removeItem("tka-boot-snapshot")`) and the Firebase auth state, reload. Assert the `app.html` splash + progress bar still cover the genuine first-load download and the app boots correctly (this is the first-ever-visit path, deliberately unchanged).

- [ ] **Step 6: Record evidence**

Paste the trace summary / DOM-query output / CLS numbers into the final report. Per `verification-protocol.md`, "done" requires this evidence in the same message. If any assertion fails, fix the responsible task and re-verify before claiming completion.

---

## Self-review notes

- **Spec coverage:** W1 optimistic boot → Tasks 1-5; W2 splash handoff → Task 4; W3 per-module skeletons → Tasks 6-9; verification plan → Task 10. The spec's `access-tier.ts` read requirement is satisfied in planning (ground-truth section) and the reactive-gating guard is Task 5 + verified in Task 10 Step 3.
- **First-ever cold load unchanged:** seeded only when a snapshot exists (Task 3, Task 4); cold path verified in Task 10 Step 5.
- **Terminology corrected from spec:** tiers are `guest`/`user`/`premium` (not free/scribe); reflected throughout.
- **Risk staging:** Task 5 (optimistic tier) is isolated and skippable — Tasks 1-4 alone kill the visible spinner.
