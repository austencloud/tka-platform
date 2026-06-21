# Museum Keep-Alive Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make returning to the museum module near-instant by keeping it mounted-and-hidden across module switches, pausing its render loop and sim while hidden, and evicting it (full teardown) after an idle timeout to respect mobile WebGL context caps.

**Architecture:** A standalone, framework-agnostic keep-alive controller tracks which modules stay mounted, which is visible, and per-module idle-eviction timers. `ModuleRenderer` renders keep-alive modules in a persistent container *outside* its `{#key activeModule}` block and toggles their visibility + a `visible` prop. The museum component tree gates its manual render driver and village sim on `visible`, and handles WebGL context loss gracefully.

**Tech Stack:** Svelte 5 runes, Threlte 8 (`@threlte/core`), Three.js, vitest 4 (with `vi.useFakeTimers`).

---

## Background facts (verified against codebase)

- `ModuleRenderer.svelte:276` renders module content inside `{#key activeModule}` — destroys/recreates the whole subtree on every switch.
- `ModuleRenderer.svelte:51` `moduleCache` caches the component class; `ModuleRenderer.svelte:66-75` idle-loads the museum chunk 3s after mount.
- `MuseumModule.svelte:74-93` `onMount` cleanup calls `destroyMuseumVillage()` on every unmount.
- `MuseumModule.svelte:330` keeps the 3D scene alive across internal *mode* switches via `class:hidden-mode` — the pattern this plan lifts to the module boundary.
- `MuseumModule.svelte:27-67` owns the loading overlay state (`showOverlay`, `displayedPercent`, `handleAllLoaded`).
- `museum-village-manager.ts:116` `setMuseumVillageVisible(visible)` already pauses/resumes the sim tick loop. `:129` `destroyMuseumVillage()` does full teardown.
- `MuseumPostProcessing.svelte:88-97` runs a `useTask` and sets `autoRender=false` — this is the component that owns the final render. The render gate must live here.
- `Museum3DScene.svelte:428` has a `useTask((delta) => ...)` driving scene updates.
- `DimensionFlipProof.svelte:467` mounts the `<Canvas>` (no `renderMode` prop → Threlte default `on-demand`).
- Threlte caveat (research): the Canvas `renderMode` prop is read once at init; do NOT flip it reactively. Gate the manual `useTask`/`advance()` instead.

## File Structure

- **Create** `src/lib/shared/modules/keep-alive-controller.ts` — pure logic: mounted set, visible module, per-module evict timers. No runes (fully unit-testable). Notifies via `onChange`.
- **Create** `tests/shared/modules/keep-alive-controller.test.ts` — vitest unit tests with fake timers.
- **Modify** `src/lib/shared/modules/ModuleRenderer.svelte` — instantiate controller, render persistent keep-alive container outside `{#key}`, pass `visible` prop.
- **Modify** `src/lib/features/museum/MuseumModule.svelte` — accept `visible` prop; pause/resume; keep overlay from re-arming on resume; thread `visible` down.
- **Modify** `src/lib/features/museum/components/game/DimensionFlipProof.svelte` — accept + forward `visible`; add `webglcontextlost`/`webglcontextrestored` handlers.
- **Modify** `src/lib/features/museum/components/game/Museum3DScene.svelte` — accept `visible`; gate its `useTask` on `visible`; `invalidate()` on resume.
- **Modify** `src/lib/features/museum/components/game/MuseumPostProcessing.svelte` — accept `visible`; gate the final-render `useTask` on `visible`.

---

## Task 1: Keep-alive controller (pure logic, TDD)

**Files:**
- Create: `src/lib/shared/modules/keep-alive-controller.ts`
- Test: `tests/shared/modules/keep-alive-controller.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/shared/modules/keep-alive-controller.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createKeepAliveController } from "$lib/shared/modules/keep-alive-controller";

describe("keep-alive-controller", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("does not mount non-keep-alive modules", () => {
    const c = createKeepAliveController(["museum"], { evictMs: 1000 });
    c.setActiveModule("create");
    expect(c.isMounted("create")).toBe(false);
    expect(c.isVisible("create")).toBe(false);
  });

  it("mounts and shows a keep-alive module when activated", () => {
    const c = createKeepAliveController(["museum"], { evictMs: 1000 });
    c.setActiveModule("museum");
    expect(c.isMounted("museum")).toBe(true);
    expect(c.isVisible("museum")).toBe(true);
  });

  it("keeps a keep-alive module mounted but hidden after switching away", () => {
    const c = createKeepAliveController(["museum"], { evictMs: 1000 });
    c.setActiveModule("museum");
    c.setActiveModule("create");
    expect(c.isMounted("museum")).toBe(true);
    expect(c.isVisible("museum")).toBe(false);
  });

  it("cancels eviction when returning before the timeout", () => {
    const c = createKeepAliveController(["museum"], { evictMs: 1000 });
    c.setActiveModule("museum");
    c.setActiveModule("create");
    vi.advanceTimersByTime(500);
    c.setActiveModule("museum");
    vi.advanceTimersByTime(1000);
    expect(c.isMounted("museum")).toBe(true);
    expect(c.isVisible("museum")).toBe(true);
  });

  it("evicts a keep-alive module after the idle timeout", () => {
    const c = createKeepAliveController(["museum"], { evictMs: 1000 });
    c.setActiveModule("museum");
    c.setActiveModule("create");
    vi.advanceTimersByTime(1000);
    expect(c.isMounted("museum")).toBe(false);
    expect(c.isVisible("museum")).toBe(false);
  });

  it("is idempotent under rapid re-activation (no duplicate timers)", () => {
    const onChange = vi.fn();
    const c = createKeepAliveController(["museum"], { evictMs: 1000, onChange });
    c.setActiveModule("museum");
    c.setActiveModule("museum");
    c.setActiveModule("museum");
    expect(c.isVisible("museum")).toBe(true);
    // Re-activating the already-visible module is a no-op (no extra onChange).
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("fires onChange on mount, hide, and eviction", () => {
    const onChange = vi.fn();
    const c = createKeepAliveController(["museum"], { evictMs: 1000, onChange });
    c.setActiveModule("museum"); // mount+show
    c.setActiveModule("create"); // hide + start evict
    vi.advanceTimersByTime(1000); // evict
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it("dispose clears pending evict timers", () => {
    const onChange = vi.fn();
    const c = createKeepAliveController(["museum"], { evictMs: 1000, onChange });
    c.setActiveModule("museum");
    c.setActiveModule("create");
    c.dispose();
    onChange.mockClear();
    vi.advanceTimersByTime(5000);
    expect(onChange).not.toHaveBeenCalled();
    expect(c.isMounted("museum")).toBe(true); // dispose does not unmount, just stops timers
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- keep-alive-controller`
Expected: FAIL — `Cannot find module '$lib/shared/modules/keep-alive-controller'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/shared/modules/keep-alive-controller.ts
/**
 * Keep-Alive Controller
 *
 * Tracks which modules stay mounted across module switches, which one is
 * currently visible, and per-module idle-eviction timers. Pure logic — no
 * Svelte runes — so it is fully unit-testable with fake timers. Consumers
 * subscribe via `onChange` and read state through the getters.
 *
 * A "keep-alive" module is mounted on first activation and stays mounted
 * (hidden) when the user navigates away, until an idle timeout evicts it.
 */

export interface KeepAliveControllerOptions {
  /** Idle time (ms) a hidden keep-alive module survives before eviction. */
  evictMs?: number;
  /** Called after any state transition (mount, show, hide, evict). */
  onChange?: () => void;
}

export interface KeepAliveController {
  isKeepAlive(moduleId: string): boolean;
  isMounted(moduleId: string): boolean;
  isVisible(moduleId: string): boolean;
  /** List of currently-mounted keep-alive module ids. */
  mountedModules(): string[];
  /** Notify the controller which module is now active (null = none). */
  setActiveModule(moduleId: string | null): void;
  /** Stop all pending evict timers. Does not unmount anything. */
  dispose(): void;
}

const DEFAULT_EVICT_MS = 150_000;

export function createKeepAliveController(
  keepAliveIds: Iterable<string>,
  options: KeepAliveControllerOptions = {},
): KeepAliveController {
  const keepAlive = new Set(keepAliveIds);
  const evictMs = options.evictMs ?? DEFAULT_EVICT_MS;
  const onChange = options.onChange;

  const mounted = new Set<string>();
  const evictTimers = new Map<string, ReturnType<typeof setTimeout>>();
  let visibleModule: string | null = null;

  function cancelEvict(id: string): void {
    const t = evictTimers.get(id);
    if (t !== undefined) {
      clearTimeout(t);
      evictTimers.delete(id);
    }
  }

  function startEvict(id: string): void {
    cancelEvict(id);
    evictTimers.set(
      id,
      setTimeout(() => {
        evictTimers.delete(id);
        mounted.delete(id);
        onChange?.();
      }, evictMs),
    );
  }

  function setActiveModule(id: string | null): void {
    if (id === visibleModule) return; // no-op, no churn

    const previous = visibleModule;
    visibleModule = id;

    if (previous && keepAlive.has(previous) && mounted.has(previous)) {
      startEvict(previous);
    }
    if (id && keepAlive.has(id)) {
      mounted.add(id);
      cancelEvict(id);
    }
    onChange?.();
  }

  return {
    isKeepAlive: (id) => keepAlive.has(id),
    isMounted: (id) => mounted.has(id),
    isVisible: (id) => visibleModule === id,
    mountedModules: () => [...mounted],
    setActiveModule,
    dispose: () => {
      for (const t of evictTimers.values()) clearTimeout(t);
      evictTimers.clear();
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- keep-alive-controller`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/modules/keep-alive-controller.ts tests/shared/modules/keep-alive-controller.test.ts
git commit -m "feat(modules): keep-alive controller with idle eviction"
```

---

## Task 2: Wire keep-alive container into ModuleRenderer

**Files:**
- Modify: `src/lib/shared/modules/ModuleRenderer.svelte`

This renders museum in a persistent container outside `{#key activeModule}`. The keyed block still handles every non-keep-alive module unchanged. The museum container mounts only after museum has been activated at least once (lazy), and toggles `display` + a `visible` prop.

- [ ] **Step 1: Add the controller + reactive mirror to the `<script>`**

Add after the existing `moduleCache` declaration (around `ModuleRenderer.svelte:51`):

```ts
import {
  createKeepAliveController,
  type KeepAliveController,
} from "./keep-alive-controller";

const KEEP_ALIVE_MODULES = ["museum"];

// Reactive tick: bumped by the controller's onChange so derived reads re-run.
let keepAliveVersion = $state(0);
const keepAlive: KeepAliveController = createKeepAliveController(
  KEEP_ALIVE_MODULES,
  { onChange: () => (keepAliveVersion += 1) },
);

// Drive the controller from activeModule.
$effect(() => {
  keepAlive.setActiveModule(activeModule);
});

// Mounted keep-alive module ids (re-derived whenever the controller changes).
const mountedKeepAlive = $derived.by(() => {
  keepAliveVersion; // dependency
  return keepAlive.mountedModules();
});
```

Add `keepAlive.dispose();` inside the existing `onDestroy` (around `ModuleRenderer.svelte:79-82`):

```ts
onDestroy(() => {
  deregisterCacheClear?.();
  clearTimeout(preloadTimer);
  keepAlive.dispose();
});
```

- [ ] **Step 2: Skip keep-alive modules in the keyed render path**

The keyed `{#key activeModule}` block must NOT also render the museum (it would double-mount). Guard the keyed content so keep-alive modules render only via the persistent container.

Change the keyed block condition (around `ModuleRenderer.svelte:273-276`) from:

```svelte
  {:else}
    <!-- Transition container for overlaying content -->
    <div class="transition-container">
      {#key activeModule}
```

to:

```svelte
  {:else if activeModule && keepAlive.isKeepAlive(activeModule)}
    <!-- Keep-alive modules render in the persistent container below; the keyed
         path is bypassed so they are never destroyed on switch. The persistent
         container shows the loading overlay itself, so nothing renders here. -->
    <div class="transition-container"></div>
  {:else}
    <!-- Transition container for overlaying content -->
    <div class="transition-container">
      {#key activeModule}
```

(The existing `{/key}`, `</div>`, `</div>` closing the keyed block stay as-is.)

- [ ] **Step 3: Render the persistent keep-alive container**

Immediately AFTER the entire `{#if isModuleLoading} ... {/if}` outer block (after `ModuleRenderer.svelte:340` `{/if}`), add:

```svelte
<!-- Persistent keep-alive modules: mounted once, hidden via display, never
     destroyed by {#key activeModule}. Each receives a `visible` prop so it can
     pause heavy work (render loop, sim) while hidden. -->
{#each mountedKeepAlive as moduleId (moduleId)}
  {@const Loaded = moduleCache.get(moduleId)}
  {#if Loaded}
    <div
      class="keep-alive-host"
      style:display={keepAlive.isVisible(moduleId) ? "flex" : "none"}
      aria-hidden={!keepAlive.isVisible(moduleId)}
    >
      <Loaded visible={keepAlive.isVisible(moduleId)} />
    </div>
  {/if}
{/each}
```

Note: `moduleCache.get(moduleId)` is populated by the existing `loadModule`/idle-preload path. If a user navigates to museum before the chunk resolves, `loadModule(activeModule)` (the existing `modulePromise` derived) still runs and populates the cache; once cached, `mountedKeepAlive` re-derivation (via `keepAliveVersion`) plus the `{#await}`-free `{#each}` picks it up on the next tick. To guarantee the cache is filled, also trigger a load when a keep-alive module mounts: add to the `$effect` that drives the controller:

```ts
$effect(() => {
  keepAlive.setActiveModule(activeModule);
  for (const id of keepAlive.mountedModules()) {
    if (!moduleCache.has(id)) {
      loadModule(id).then(() => (keepAliveVersion += 1)).catch(() => {});
    }
  }
});
```

- [ ] **Step 4: Add the host style**

Add to the `<style>` block:

```css
.keep-alive-host {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  flex-direction: column;
  overflow: hidden;
}
```

- [ ] **Step 5: Type-check (warm)**

Run: `npm run check:fast`
Expected: No NEW errors referencing `ModuleRenderer.svelte` or `keep-alive-controller`. (Pre-existing project errors from the in-flight kebab rename are unrelated — confirm none mention these two files.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/modules/ModuleRenderer.svelte
git commit -m "feat(modules): persistent keep-alive host for museum module"
```

---

## Task 3: MuseumModule accepts `visible`, pauses/resumes, overlay no-rearm

**Files:**
- Modify: `src/lib/features/museum/MuseumModule.svelte`

- [ ] **Step 1: Add the `visible` prop**

At the top of the `<script>` (the module has no `$props()` today — it is rendered with no props by the keyed path, but the keep-alive host now passes `visible`). Add after the imports (around `MuseumModule.svelte:19`):

```ts
interface Props {
  /** False when the module is mounted-but-hidden (keep-alive). Default true
   *  so the module behaves normally when rendered standalone or in tests. */
  visible?: boolean;
}
let { visible = true }: Props = $props();
```

- [ ] **Step 2: Pause/resume render + sim on visibility change**

Add a new `$effect` after the soundscape setup (around `MuseumModule.svelte:259`). Import `setMuseumVillageVisible`:

Change the existing import at `MuseumModule.svelte:10`:

```ts
import { destroyMuseumVillage, setMuseumVillageVisible } from "./services/museum-village-manager";
```

Add the effect:

```ts
// Keep-alive: when hidden, pause the sim. The 3D render loop is paused by
// threading `visible` into DimensionFlipProof (see template). When shown
// again, resume the sim. destroyMuseumVillage is NOT called here — full
// teardown only happens on real unmount (idle eviction), via onMount cleanup.
$effect(() => {
  setMuseumVillageVisible(visible);
});
```

- [ ] **Step 3: Prevent the loading overlay from re-arming on resume**

`showOverlay` starts true and is set false once by `handleAllLoaded` (`MuseumModule.svelte:62-67`). Because the component is no longer destroyed/recreated on each visit, `showOverlay` naturally stays false after the first load — no code change needed for the common path. Add a guard so a late/duplicate `onAllLoaded` after the first reveal is a no-op:

Change `handleAllLoaded` (`MuseumModule.svelte:62-67`) to:

```ts
function handleAllLoaded() {
  if (!showOverlay) return; // already revealed — ignore duplicate/late signals
  displayedPercent = 100;
  stageLabel = "Welcome";
  overlayFading = true;
  setTimeout(() => { showOverlay = false; }, 600);
}
```

- [ ] **Step 4: Thread `visible` into DimensionFlipProof**

In the template, change the `<DimensionFlipProof .../>` invocation (`MuseumModule.svelte:333-340`) to add the prop:

```svelte
<DimensionFlipProof
  grid={liveGrid}
  {visible}
  onAllLoaded={handleAllLoaded}
  onLoadProgress={handleLoadProgress}
  onBuildStage={handleBuildStage}
  startInFps={selectedRoom !== null}
  onWingChange={(id) => soundscapePlayer.setCurrentWing(id)}
/>
```

- [ ] **Step 5: Type-check (warm)**

Run: `npm run check:fast`
Expected: No NEW errors referencing `MuseumModule.svelte`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/museum/MuseumModule.svelte
git commit -m "feat(museum): visible prop pauses sim + guards overlay on keep-alive"
```

---

## Task 4: Gate the render loop on `visible`

**Files:**
- Modify: `src/lib/features/museum/components/game/MuseumPostProcessing.svelte`
- Modify: `src/lib/features/museum/components/game/Museum3DScene.svelte`

The final render is owned by `MuseumPostProcessing` (it sets `autoRender=false`). Gating its `useTask` stops all rendering while hidden. `Museum3DScene`'s `useTask` drives per-frame scene updates — gate it too so no CPU work runs while hidden. One `invalidate()` on resume guarantees an immediate repaint.

- [ ] **Step 1: Add `visible` prop to MuseumPostProcessing and gate its render task**

In `MuseumPostProcessing.svelte`, add to its `$props()` (read the existing props block first; add `visible` with default true):

```ts
let { visible = true, /* ...existing props... */ } = $props();
```

Wrap the body of its `useTask` (around `MuseumPostProcessing.svelte:88`) so it returns early when hidden:

```ts
useTask(() => {
  if (!visible) return; // keep-alive: no render while hidden
  // ...existing render/compose body unchanged...
});
```

- [ ] **Step 2: Add `visible` prop to Museum3DScene and gate its task**

In `Museum3DScene.svelte`, add `visible` to its `$props()` (default true). Import `useThrelte` is already present (`Museum3DScene.svelte:3`). Capture `invalidate`:

```ts
const { invalidate } = useThrelte();
```

Gate the `useTask` (`Museum3DScene.svelte:428`):

```ts
useTask((delta) => {
  if (!visible) return; // keep-alive: skip per-frame work while hidden
  // ...existing body unchanged...
});
```

Add a resume effect that requests one frame when becoming visible:

```ts
$effect(() => {
  if (visible) invalidate(); // paint immediately on resume
});
```

- [ ] **Step 3: Pass `visible` from Museum3DScene to MuseumPostProcessing**

Find where `Museum3DScene.svelte` renders `<MuseumPostProcessing .../>` (grep within the file) and add `{visible}` to that invocation. If MuseumPostProcessing is rendered elsewhere in the tree, pass `visible` from whichever parent has it. (Grep: `MuseumPostProcessing` in `src/lib/features/museum/components/game/`.)

- [ ] **Step 4: Type-check (warm)**

Run: `npm run check:fast`
Expected: No NEW errors referencing `Museum3DScene.svelte` or `MuseumPostProcessing.svelte`. (The pre-existing `@austencloud/camera-3d` / `@austencloud/scene-3d` import errors in `Museum3DScene.svelte` are unrelated to this change — confirm the only errors are those known import lines.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/museum/components/game/MuseumPostProcessing.svelte src/lib/features/museum/components/game/Museum3DScene.svelte
git commit -m "feat(museum): gate render + scene tasks on visible for keep-alive"
```

---

## Task 5: DimensionFlipProof forwards `visible` + context-loss resilience

**Files:**
- Modify: `src/lib/features/museum/components/game/DimensionFlipProof.svelte`

- [ ] **Step 1: Add + forward the `visible` prop**

Add `visible` to the component's `$props()` (default true). Forward it to the scene where `DimensionFlipProof` renders `Museum3DScene` (grep `Museum3DScene` within the file; add `{visible}` to that invocation).

- [ ] **Step 2: Add WebGL context-loss handlers**

In `onMount` (the component already has lifecycle code with a watchdog), attach handlers to the canvas. The canvas is queried as `document.querySelector<HTMLCanvasElement>("canvas")` elsewhere in this file (`DimensionFlipProof.svelte:326,356`). Add:

```ts
let canvasEl: HTMLCanvasElement | null = null;
function handleContextLost(e: Event) {
  e.preventDefault(); // required so 'restored' can fire
  console.warn("[DimensionFlipProof] WebGL context lost");
  sceneReady = false; // re-gate; overlay/rebuild affordance can react
}
function handleContextRestored() {
  console.warn("[DimensionFlipProof] WebGL context restored — rebuilding");
  // Re-run the readiness gate; geometry rebuilds from the warm grid cache via
  // the existing streamer path on the next scene init.
  texturesReady = false;
  meshesReady = false;
  checkFullyReady();
}
```

In `onMount`, after the scene has mounted (alongside the existing watchdog setup), wire them with a short delay so the canvas exists:

```ts
const canvasHookTimer = setTimeout(() => {
  canvasEl = document.querySelector<HTMLCanvasElement>("canvas");
  canvasEl?.addEventListener("webglcontextlost", handleContextLost, false);
  canvasEl?.addEventListener("webglcontextrestored", handleContextRestored, false);
}, 0);
```

In the `onMount` cleanup (where `clearTimeout(watchdog)` already lives), add:

```ts
clearTimeout(canvasHookTimer);
canvasEl?.removeEventListener("webglcontextlost", handleContextLost);
canvasEl?.removeEventListener("webglcontextrestored", handleContextRestored);
```

- [ ] **Step 3: Type-check (warm)**

Run: `npm run check:fast`
Expected: No NEW errors referencing `DimensionFlipProof.svelte`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/museum/components/game/DimensionFlipProof.svelte
git commit -m "feat(museum): forward visible + WebGL context-loss resilience"
```

---

## Task 6: Integration verification

**Files:** none (verification only)

This task proves the feature works at runtime. Browser steps require explicit user permission per project rules — if not granted, report the gate and ask the user to run the manual checks.

- [ ] **Step 1: Full type-check (cold, once)**

Run: `npm run check > /tmp/ka-check.log 2>&1; echo "exit=$?"`
Then filter: `grep -niE "keep-alive|ModuleRenderer|MuseumModule|DimensionFlipProof|Museum3DScene|MuseumPostProcessing" /tmp/ka-check.log`
Expected: only the known pre-existing `@austencloud/camera-3d` / `@austencloud/scene-3d` import errors in `Museum3DScene.svelte`; nothing new from this feature.

- [ ] **Step 2: Unit tests green**

Run: `npm run test -- keep-alive-controller`
Expected: PASS (8 tests).

- [ ] **Step 3: Runtime — instant return (requires browser permission)**

With dev server on :5173, using Chrome DevTools MCP:
1. Navigate to museum, wait for overlay to clear.
2. Switch to Create, then back to museum within ~10s.
3. Assert: no loading overlay on return; console shows NO new `runInitialLoad` / "Building lobby" sequence; scene visible immediately.
   - Evidence: `take_screenshot` on return + `list_console_messages` filtered for `runInitialLoad`/`Building`.

- [ ] **Step 4: Runtime — hidden-state has no render drain**

While in Create (museum mounted-hidden), evaluate via DevTools:
```js
// Confirm the museum canvas is not advancing frames while hidden.
// Sample twice 1s apart; a paused loop shows no draw-call growth.
performance.now();
```
Assert via the render-task gate (add a temporary counter if needed during verification, then remove). Acceptable lighter proof: confirm `display:none` on `.keep-alive-host` and that `setMuseumVillageVisible(false)` was called (console).

- [ ] **Step 5: Runtime — eviction frees the context**

Temporarily set `evictMs` small (e.g. 5000) via the `KEEP_ALIVE_MODULES` controller options for this test, switch away, wait >5s, confirm:
- `.keep-alive-host` for museum removed from DOM.
- Returning triggers a fresh cold load (overlay reappears, builds from warm grid cache, no hang).
Restore `evictMs` to default (150_000) after.

- [ ] **Step 6: Runtime — context-loss recovery**

In DevTools console:
```js
const gl = document.querySelector("canvas").getContext("webgl2");
gl.getExtension("WEBGL_lose_context").loseContext();
```
Assert: console logs "WebGL context lost" then a rebuild path (not a permanent black canvas). Restore with `.restoreContext()`.

- [ ] **Step 7: Final commit (if any verification-only tweaks were made)**

```bash
# Stage only files actually changed during verification (list them explicitly).
git add src/lib/shared/modules/ModuleRenderer.svelte
git commit -m "test(museum): keep-alive integration verification"
```

---

## Self-Review (completed)

**Spec coverage:**
- Keep-alive host outside `{#key}` → Task 2. ✔
- `mounted`/`visible`/evict-timer state → Task 1 (controller) + Task 2 (wiring). ✔
- Idle eviction (150s, named constant) → Task 1 (`DEFAULT_EVICT_MS`). ✔
- Render-loop pause via manual driver gate (not prop flip) → Task 4. ✔
- Sim pause via `setMuseumVillageVisible` → Task 3. ✔
- Overlay no-rearm on resume → Task 3 Step 3. ✔
- `destroyMuseumVillage` trigger unchanged, fires on eviction unmount → Task 3 note + Task 1 eviction. ✔
- Context-loss resilience → Task 5. ✔
- Verification (instant return, no drain, eviction, context-loss) → Task 6. ✔

**Placeholder scan:** Task 4 Steps 1-2 reference "existing props block" / "existing body" rather than reproducing unread component internals — these are precise edit instructions (add prop, add early-return guard) and name the exact file:line of the `useTask` to wrap. Task 4 Step 3 / Task 5 Steps 1-2 require a grep to locate the child invocation because the exact render line was not read; the grep target and the edit (add `{visible}`) are fully specified.

**Type consistency:** Controller API (`isKeepAlive`, `isMounted`, `isVisible`, `mountedModules`, `setActiveModule`, `dispose`) is used identically in Task 2. `visible` prop name is consistent across MuseumModule → DimensionFlipProof → Museum3DScene → MuseumPostProcessing.
