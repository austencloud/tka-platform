# AnimationScope — Phase 0 + Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a per-surface `AnimationScope` (composition facade over the three existing animation stores) with a pluggable persistence-adapter boundary, then route the render-path readers through it so the landing spinner's settings are structurally isolated.

**Architecture:** Strangler-fig. Phase 0 stands up `AnimationScope` as a thin facade holding the existing `AnimationVisibilityStateManager`, `AnimationSettingsState`, and `EffectsConfigState`, constructed per persistence mode; the global singletons remain as the default app scope. Phase 1 de-globalizes the render readers (`svg-generator`, `playback-controller` speed-sync) the same way the interpolator/precomputer/orchestrator were already threaded, and makes the landing construct its own ephemeral scope. No store internals are absorbed yet (that is Phase 2), so the blast radius stays small and the app stays green at every commit.

**Tech Stack:** Svelte 5 runes, TypeScript, Vitest. Spec: `docs/superpowers/specs/2026-06-17-animation-scope-redesign-design.md`.

---

## File Structure

**Create:**
- `src/lib/shared/animation-engine/state/persistence-adapter.ts` — `PersistenceAdapter` interface, `PersistenceMode`, and the three adapters (ephemeral, local, account-stub).
- `src/lib/shared/animation-engine/state/animation-scope.svelte.ts` — `AnimationScope` facade + `createAnimationScope()`.
- `src/lib/shared/animation-engine/state/animation-scope-context.ts` — `setAnimationScopeContext` / `getAnimationScopeContext`.
- `tests/unit/animation-engine/animation-scope.test.ts` — scope construction + isolation tests.

**Modify:**
- `src/lib/shared/animation-engine/state/animation-settings-state.svelte.ts` — add `{ ephemeral }` option to `createAnimationSettingsState`.
- `src/lib/shared/animation-engine/services/svg-generator.ts:29` — accept a visibility manager param.
- `src/lib/shared/animation-engine/services/animation-playback-controller.ts:449` — route the speed sync through the orchestrator's active visibility manager.
- `src/routes/landing/components/PlayWithItInner.svelte` — construct an ephemeral scope; drop the global `animationSettings` mutations and global trail read.

**Note on already-applied work:** the `vm`-threading in `prop-interpolator.ts`, `sequence-animation-orchestrator.ts` (incl. `getActiveVisibilityManager()`), and `animation-precomputer.svelte.ts` is uncommitted in the working tree and is the Phase-1 beachhead for those readers. Task 1 commits it first so the plan starts from a clean base.

---

## Phase 0 — Scope + adapter scaffold

### Task 1: Commit the existing render-reader threading

**Files:**
- Modify (already edited, uncommitted): `src/lib/shared/animation-engine/services/prop-interpolator.ts`, `src/lib/shared/animation-engine/services/sequence-animation-orchestrator.ts`, `src/lib/shared/animation-engine/services/animation-precomputer.svelte.ts`

- [ ] **Step 1: Verify the three files typecheck**

Run: `npm run check:fast > /tmp/p0.log 2>&1; grep -iE "prop-interpolator|sequence-animation-orchestrator|animation-precomputer" /tmp/p0.log`
Expected: no error lines for those files.

- [ ] **Step 2: Commit with explicit pathspec**

```bash
git commit -m "refactor(animation): thread visibility manager into path-shape readers" -- \
  src/lib/shared/animation-engine/services/prop-interpolator.ts \
  src/lib/shared/animation-engine/services/sequence-animation-orchestrator.ts \
  src/lib/shared/animation-engine/services/animation-precomputer.svelte.ts
```

---

### Task 2: Persistence adapter contract + three adapters

**Files:**
- Create: `src/lib/shared/animation-engine/state/persistence-adapter.ts`
- Test: `tests/unit/animation-engine/animation-scope.test.ts` (created here, extended later)

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/animation-engine/animation-scope.test.ts
import { describe, it, expect } from "vitest";
import {
  ephemeralAdapter,
  createMemoryAdapter,
} from "$lib/shared/animation-engine/state/persistence-adapter";

describe("persistence adapters", () => {
  it("ephemeral adapter never loads or persists", () => {
    expect(ephemeralAdapter.load()).toBeNull();
    ephemeralAdapter.save({ bpm: 120 });
    expect(ephemeralAdapter.load()).toBeNull();
  });

  it("memory adapter round-trips a delta", () => {
    const store: Record<string, unknown> = {};
    const adapter = createMemoryAdapter(store);
    adapter.save({ bpm: 90 });
    expect(adapter.load()).toEqual({ bpm: 90 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/animation-engine/animation-scope.test.ts`
Expected: FAIL — module `persistence-adapter` not found.

- [ ] **Step 3: Write the adapter module**

```ts
// src/lib/shared/animation-engine/state/persistence-adapter.ts

/** Where a scope's settings live. */
export type PersistenceMode = "ephemeral" | "local" | "account";

/**
 * A scope holds state and emits debounced deltas; the adapter decides what is
 * persisted. This is the seam that makes "landing = ephemeral, app = local,
 * user = account" a one-line construction choice rather than scattered behavior.
 */
export interface PersistenceAdapter {
  /** Seed values on scope construction (incl. any migration). Null = use defaults. */
  load(): Record<string, unknown> | null;
  /** Persist a partial change. Implementations debounce as needed. */
  save(delta: Record<string, unknown>): void;
}

/** Nothing persists. Landing, thumbnails, embedded previews. */
export const ephemeralAdapter: PersistenceAdapter = {
  load: () => null,
  save: () => {},
};

/** Backing-store adapter used by tests and as the base for localStorage. */
export function createMemoryAdapter(
  store: Record<string, unknown>,
): PersistenceAdapter {
  return {
    load: () => ({ ...store }),
    save: (delta) => Object.assign(store, delta),
  };
}

/** Persists to a localStorage key. App default. */
export function createLocalStorageAdapter(key: string): PersistenceAdapter {
  return {
    load: () => {
      try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
      } catch {
        return null;
      }
    },
    save: (delta) => {
      try {
        const raw = localStorage.getItem(key);
        const current = raw ? JSON.parse(raw) : {};
        localStorage.setItem(key, JSON.stringify({ ...current, ...delta }));
      } catch {
        /* ignore quota / serialization errors */
      }
    },
  };
}

/**
 * Account (Firestore-synced) adapter. CONTRACT ONLY for this build — see the
 * follow-up account-sync spec. Falls back to no persistence so it is safe to
 * construct before the implementation exists.
 */
export function createAccountAdapter(_userId: string): PersistenceAdapter {
  // TODO(account-sync spec): Firestore load/save with conflict policy.
  return ephemeralAdapter;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/animation-engine/animation-scope.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/animation-engine/state/persistence-adapter.ts tests/unit/animation-engine/animation-scope.test.ts
git commit -m "feat(animation): persistence adapter contract + ephemeral/local/account adapters"
```

---

### Task 3: Ephemeral option on the animation-settings factory

**Files:**
- Modify: `src/lib/shared/animation-engine/state/animation-settings-state.svelte.ts:163-188`

- [ ] **Step 1: Write the failing test (append to the same test file)**

```ts
// tests/unit/animation-engine/animation-scope.test.ts — add this block
import { createAnimationSettingsState, DEFAULT_ANIMATION_SETTINGS }
  from "$lib/shared/animation-engine/state/animation-settings-state.svelte";

describe("ephemeral animation settings", () => {
  it("seeds from defaults and does not write localStorage", () => {
    let wrote = false;
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { wrote = true; });
    const settings = createAnimationSettingsState({ ephemeral: true });
    settings.setBpm(99);
    expect(settings.bpm).toBe(99);
    expect(wrote).toBe(false);
    spy.mockRestore();
  });
});
```
(Add `import { vi } from "vitest";` to the file header.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/animation-engine/animation-scope.test.ts`
Expected: FAIL — `createAnimationSettingsState` ignores options / autosave writes.

- [ ] **Step 3: Add the ephemeral option**

In `animation-settings-state.svelte.ts`, change the factory signature and guard the autosave:

```ts
export function createAnimationSettingsState(
  options?: { ephemeral?: boolean },
): AnimationSettingsState {
  const ephemeral = options?.ephemeral ?? false;
  let settings = $state<AnimationSettings>(
    ephemeral ? { ...DEFAULT_ANIMATION_SETTINGS, trail: { ...DEFAULT_TRAIL_SETTINGS } } : loadSettings(),
  );
  let propType = $state("staff");

  if (!ephemeral) {
    $effect.root(() => {
      $effect(() => {
        void settings.bpm;
        void settings.shouldLoop;
        void settings.trail.mode;
        void settings.trail.effect;
        void settings.trail.trackingMode;
        void settings.trail.lineWidth;
        void settings.trail.maxOpacity;
        void settings.trail.minOpacity;
        void settings.trail.glowBlur;
        void settings.trail.blueColor;
        void settings.trail.redColor;
        void settings.trail.fadeDurationMs;
        void settings.trail.tailLength;
        void settings.trail.hideProps;
        settingsPersistence.setupAutoSave(settings);
      });
    });
  }
  // ... unchanged return block ...
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/animation-engine/animation-scope.test.ts`
Expected: PASS (3 describe blocks).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/animation-engine/state/animation-settings-state.svelte.ts tests/unit/animation-engine/animation-scope.test.ts
git commit -m "feat(animation): ephemeral option on createAnimationSettingsState"
```

---

### Task 4: `AnimationScope` facade + context

**Files:**
- Create: `src/lib/shared/animation-engine/state/animation-scope.svelte.ts`
- Create: `src/lib/shared/animation-engine/state/animation-scope-context.ts`
- Test: `tests/unit/animation-engine/animation-scope.test.ts` (extend)

- [ ] **Step 1: Write the failing test (append)**

```ts
import { createAnimationScope } from "$lib/shared/animation-engine/state/animation-scope.svelte";

describe("AnimationScope", () => {
  it("ephemeral scope isolates path shape from a second scope", () => {
    const a = createAnimationScope({ persistence: "ephemeral" });
    const b = createAnimationScope({ persistence: "ephemeral" });
    a.visibility.setPathShape("concave");
    expect(a.visibility.getPathShape()).toBe("concave");
    expect(b.visibility.getPathShape()).toBe("arc"); // default, unaffected
  });

  it("derives speed from bpm", () => {
    const s = createAnimationScope({ persistence: "ephemeral" });
    s.settings.setBpm(120);
    expect(s.speed).toBe(2); // 120 / 60
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/animation-engine/animation-scope.test.ts`
Expected: FAIL — `createAnimationScope` not found.

- [ ] **Step 3: Write the scope facade**

```ts
// src/lib/shared/animation-engine/state/animation-scope.svelte.ts
import { AnimationVisibilityStateManager } from "./animation-visibility-state.svelte";
import { createAnimationSettingsState, type AnimationSettingsState } from "./animation-settings-state.svelte";
import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
import type { PersistenceMode } from "./persistence-adapter";

export interface AnimationScopeOptions {
  /** Persistence tier. "ephemeral" → nothing persists; "local"/"account" → persists. */
  persistence: PersistenceMode;
  /** Required when persistence === "account". */
  userId?: string;
}

/**
 * Per-surface animation state. Phase 0: a composition facade over the three
 * existing stores, constructed in the chosen persistence mode. Phase 2 collapses
 * those stores into owned slices; consumers that read `scope.visibility` /
 * `scope.settings` / `scope.effects` keep working across that change.
 */
export class AnimationScope {
  readonly visibility: AnimationVisibilityStateManager;
  readonly settings: AnimationSettingsState;
  readonly effects: ReturnType<typeof createEffectsConfigState>;

  constructor(options: AnimationScopeOptions) {
    const ephemeral = options.persistence === "ephemeral";
    this.visibility = new AnimationVisibilityStateManager({ ephemeral });
    this.settings = createAnimationSettingsState({ ephemeral });
    // Effects config is per-instance by construction; presets persistence is
    // handled by the local adapter in Phase 2 (EffectsPanel localStorage moves there).
    this.effects = createEffectsConfigState();
  }

  /** Single source of truth for playback speed. 1.0 == 60 BPM. */
  get speed(): number {
    return this.settings.bpm / 60;
  }
}

export function createAnimationScope(options: AnimationScopeOptions): AnimationScope {
  return new AnimationScope(options);
}
```

```ts
// src/lib/shared/animation-engine/state/animation-scope-context.ts
import { getContext, setContext } from "svelte";
import type { AnimationScope } from "./animation-scope.svelte";

const ANIMATION_SCOPE_CONTEXT_KEY = Symbol("animation-scope");

export function setAnimationScopeContext(scope: AnimationScope): AnimationScope {
  setContext(ANIMATION_SCOPE_CONTEXT_KEY, scope);
  return scope;
}

export function getAnimationScopeContext(): AnimationScope | null {
  return getContext<AnimationScope | null>(ANIMATION_SCOPE_CONTEXT_KEY) ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/animation-engine/animation-scope.test.ts`
Expected: PASS (all blocks).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/animation-engine/state/animation-scope.svelte.ts src/lib/shared/animation-engine/state/animation-scope-context.ts tests/unit/animation-engine/animation-scope.test.ts
git commit -m "feat(animation): AnimationScope facade + context (ephemeral/local/account)"
```

---

## Phase 1 — De-globalize the remaining render readers + adopt on the landing

### Task 5: `svg-generator` takes the visibility manager explicitly

**Files:**
- Modify: `src/lib/shared/animation-engine/services/svg-generator.ts:12,29`

- [ ] **Step 1: Read the function around line 29 to capture its current signature**

Run: `sed -n '20,45p' src/lib/shared/animation-engine/services/svg-generator.ts` (or Read the file).

- [ ] **Step 2: Add an optional `vm` parameter, default to the global**

Change the generator function signature to accept `vm?: AnimationVisibilityStateManager` and replace the body's `const manager = getAnimationVisibilityManager();` with `const manager = vm ?? getAnimationVisibilityManager();`. Import the type:

```ts
import {
  getAnimationVisibilityManager,
  type AnimationVisibilityStateManager,
} from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
```

Then thread `vm` from its caller — the same orchestrator/engine path that already holds `getActiveVisibilityManager()`. (Identify the caller via `grep -rn "svg-generator" src/lib` and pass the active manager; if the caller has no scope reference yet, leaving the default keeps current behavior — acceptable for this task since the landing does not show glyphs by default.)

- [ ] **Step 3: Typecheck**

Run: `npm run check:fast > /tmp/p1.log 2>&1; grep -i "svg-generator" /tmp/p1.log`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(animation): svg-generator accepts explicit visibility manager" -- src/lib/shared/animation-engine/services/svg-generator.ts
```

---

### Task 6: Route the playback-controller speed sync through the active manager

**Files:**
- Modify: `src/lib/shared/animation-engine/services/animation-playback-controller.ts:441-453`

- [ ] **Step 1: Read the `setSpeed` method (lines 441-453)**

Run: `sed -n '441,455p' src/lib/shared/animation-engine/services/animation-playback-controller.ts`

- [ ] **Step 2: Replace the hardcoded global with the orchestrator's active manager**

The controller holds the orchestrator. Replace `getAnimationVisibilityManager().setSpeed(speed)` with `this.orchestrator.getActiveVisibilityManager().setSpeed(speed)` (the getter added in the orchestrator beachhead). Confirm the controller has an `orchestrator` reference (it is constructed with one in `animation-playback-controller-factory.ts:22-26`); if the field name differs, use the actual field.

- [ ] **Step 3: Typecheck**

Run: `npm run check:fast > /tmp/p1b.log 2>&1; grep -i "playback-controller" /tmp/p1b.log`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(animation): speed sync targets the active visibility manager, not the global" -- src/lib/shared/animation-engine/services/animation-playback-controller.ts
```

---

### Task 7: Landing constructs its own ephemeral scope

**Files:**
- Modify: `src/routes/landing/components/PlayWithItInner.svelte`

- [ ] **Step 1: Replace the three ad-hoc instances with one scope**

At the top of the script, replace the separate `setAnimationVisibilityContext(new AnimationVisibilityStateManager({ ephemeral: true }))`, `createEffectsConfigState()`, and global `animationSettings` usage with:

```ts
import { createAnimationScope } from "$lib/shared/animation-engine/state/animation-scope.svelte";
import { setAnimationScopeContext } from "$lib/shared/animation-engine/state/animation-scope-context";
import { setAnimationVisibilityContext } from "$lib/shared/animation-engine/state/animation-visibility-context";
import { setEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";

const scope = setAnimationScopeContext(createAnimationScope({ persistence: "ephemeral" }));
// Keep the existing sub-contexts pointed at the scope's instances so the
// AnimationPanel sections (which read those contexts today) drive THIS scope.
const visibilityManager = setAnimationVisibilityContext(scope.visibility);
const effectsConfigState = setEffectsConfigContext(scope.effects);
visibilityManager.effectsConfigState = effectsConfigState;
```

- [ ] **Step 2: Remove the global mutations in `onMount`**

Delete `animationSettings.setTrackingMode(TrackingMode.BOTH_ENDS)` and `animationSettings.setBpm(bpm)`. Replace with `scope.settings.setTrackingMode(TrackingMode.BOTH_ENDS); scope.settings.setBpm(bpm);` (now ephemeral). Keep `visibilityManager.setDarkMode(true)` and `effectsConfigState.setActiveEffect("trails")`.

- [ ] **Step 3: Read trail + bpm from the scope, not the global**

Change `trailSettings={animationSettings.trail}` → `trailSettings={scope.settings.trail}`. Change `handleBpmChange` to call `scope.settings.setBpm(newBpm)` instead of `animationSettings.setBpm(newBpm)`. Remove the now-unused `import { animationSettings } from ...`.

- [ ] **Step 4: Verify in the browser (dev server already on :5173)**

Reload `http://localhost:5173`, open the Infinite Spinner, set Display → Path shape to Arc with Hybrid off. Confirm anti-spin renders as an arc (not concave) regardless of the signed-in user's account setting. Change BPM and confirm the user's app BPM in another tab is unaffected.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(landing): Infinite Spinner uses an isolated ephemeral AnimationScope" -- src/routes/landing/components/PlayWithItInner.svelte
```

---

### Task 8: Isolation regression test

**Files:**
- Test: `tests/unit/animation-engine/animation-scope.test.ts` (extend)

- [ ] **Step 1: Write the test**

```ts
describe("scope isolation regression (the reported bug)", () => {
  it("one scope's motion-aware paths do not leak into another", () => {
    const userScope = createAnimationScope({ persistence: "ephemeral" });
    const landingScope = createAnimationScope({ persistence: "ephemeral" });
    userScope.visibility.toggleMotionAwarePaths(); // user turns Hybrid ON
    expect(userScope.visibility.getMotionAwarePaths()).toBe(true);
    expect(landingScope.visibility.getMotionAwarePaths()).toBe(false); // landing stays OFF
  });
});
```

- [ ] **Step 2: Run + verify pass**

Run: `npx vitest run tests/unit/animation-engine/animation-scope.test.ts`
Expected: PASS.

- [ ] **Step 3: Full typecheck before closing the phase**

Run: `npm run check > /tmp/p1-final.log 2>&1; grep -ciE "error" /tmp/p1-final.log` then inspect any new errors in touched files.
Expected: no new errors attributable to this plan's files.

- [ ] **Step 4: Commit**

```bash
git add tests/unit/animation-engine/animation-scope.test.ts
git commit -m "test(animation): scope isolation regression guard for path-shape leak"
```

---

## Out of scope (follow-on plans)

- **Phase 2 — store consolidation:** fold visibility/settings/effects internals into owned `AnimationScope` slices; migrate the ~32 `animationSettings` consumers; move `EffectsPanel` localStorage into the local adapter; remove the `?? global` fallbacks.
- **Phase 3 — speed unification:** make `scope.speed` the only source; remove the duplicate in playback state and the visibility-manager sync.
- **Phase 4 — broader surface adoption:** viewer, compose, export, thumbnails each construct their own scope.
- **Account-sync adapter spec:** Firestore implementation of `createAccountAdapter`.

## Self-review notes

- **Spec coverage:** Phase 0 (scope + adapter) and Phase 1 (de-globalize readers + landing adoption) map to the spec's Phases 0–1 and the `ephemeral`/`local` adapters + stubbed `account`. Spec Phases 2–4 are explicitly deferred above.
- **Type consistency:** `createAnimationScope({ persistence })` and `scope.visibility/settings/effects/speed` are used identically across Tasks 4, 7, 8. `getActiveVisibilityManager()` (orchestrator) is reused in Tasks 1 and 6.
- **Account stub:** `createAccountAdapter` returns `ephemeralAdapter` with a `TODO(account-sync spec)` — intentional, matches the non-goal.
