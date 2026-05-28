# Animation Engine Re-Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the TKA animation engine from a 1510-line `AnimationEngine` god class + 1147-line `AnimatorCanvas` to a per-instance reactive store + single-responsibility managers + thin façade, with an effect-plugin registry, offscreen export, and the line-53 self-import (HMR regression) eliminated.

**Architecture:** tldraw/PixiJS grain — one `AnimationStore` (`$state`) per canvas instance is the single source of truth; SRP managers (`LifecycleManager`, `PropSystem`, `EffectSystem`, `FrameSystem`, `PlaybackSync`) read/write the store directly with **no per-tick mirroring**; `AnimationEngine` becomes a ~150-line façade. Effects self-register on one `EFFECT_PLUGINS` array over an `OverlayRenderer` base. Export renders into a main-thread offscreen `RenderContext` at native resolution. Incremental strangler — every phase ships green.

**Tech Stack:** SvelteKit 2.61, Svelte 5 runes (`$state`/`$derived`/`$effect`), TypeScript, Vitest, Canvas2D + WebGL (fire/charcoal/LED shaders), WebCodecs/WASM export, Vite dev server.

**Spec:** `docs/superpowers/specs/active/2026-05-28-animation-engine-rearchitecture-design.md`

---

## Conventions for the executor

- **Verification gate per phase (run after the last task of each phase):**
  - `npm run check` → 0 errors (29 warnings in 1 file is the known baseline — no new warnings).
  - `npm run build` → succeeds.
  - Manual exercise (ask the user; do not claim visually-verified without it): live playback in sequence viewer, disassemble (3 canvases), split (2 canvases), an inline player, the effects lab, and a video export.
- **Never** run `npm run dev` or touch port 5173 (the user's dev server). Use `vite --port 5174` for your own, or `curl localhost:5173/...`.
- **No checkboxes in UI** (project rule). **No new `<svelte:self>`** (deprecated; and it reintroduces the cycle).
- Commit after every task with the message shown. Atomic commits.
- The store API defined in **P0 Task 2** is the contract every later phase codes against. If you change a store field name, grep-update all managers.

---

## File Structure

### Created

| File | Responsibility |
|------|----------------|
| `src/config/vite-plugin-animator-hmr-bridge.ts` | **B0, throwaway.** Dev-only full-reload guard for `AnimatorCanvas.svelte`. Deleted in P4. |
| `src/lib/shared/animation-engine/state/animation-store.svelte.ts` | **P0.** Per-instance `AnimationStore` — single source of truth (`$state` + getters). |
| `src/lib/shared/animation-engine/state/animation-store.svelte.test.ts` | **P0.** Store unit tests. |
| `src/lib/shared/animation-engine/services/implementations/managers/LifecycleManager.ts` | **P1.** Canvas create/mount/resize-observe/teardown. Absorbs `AnimatorCanvasInitializer`. |
| `src/lib/shared/animation-engine/services/implementations/managers/PropSystem.ts` | **P1.** Prop resolve + texture + SVG. Absorbs `PropPipeline`/`PropTypeManager`/`PropTypeChanger`. |
| `src/lib/shared/animation-engine/services/implementations/managers/EffectSystem.ts` | **P1.** Effect registry + tipMap sync + config→renderer. Absorbs `EffectRendererManager`/`EffectController`. |
| `src/lib/shared/animation-engine/services/implementations/managers/FrameSystem.ts` | **P1.** Per-frame params + glyph-label calc. Absorbs `FrameParameterBuilder`; folds in `FrameBuilderService`. |
| `src/lib/shared/animation-engine/services/implementations/managers/PlaybackSync.ts` | **P1.** Playback controller → render loop. |
| `src/lib/shared/animation-engine/services/effects/EffectPlugin.ts` | **P2.** `EffectPlugin` interface + `EFFECT_PLUGINS` registry. |
| `src/lib/shared/animation-engine/services/effects/OverlayRenderer.ts` | **P2.** Abstract base for the shared ~40-line canvas boilerplate. |
| `src/lib/shared/animation-engine/services/effects/EffectPlugin.test.ts` | **P2.** Registry + base unit tests. |
| `src/lib/shared/animation-engine/components/CanvasSurface.svelte` | **P4.** Non-recursive leaf canvas (the thin shell's render body). Imported by AnimatorCanvas, DisassembleCanvasView, and a new SplitCanvasView — **imports nothing that imports it back.** Breaks the cycle. |
| `src/lib/shared/animation-engine/components/SplitCanvasView.svelte` | **P4.** 2-canvas split orchestration extracted out of AnimatorCanvas. |
| `src/lib/shared/animation-engine/debug/animator-diagnostics.ts` | **P4.** The 167-line LED/fire diagnostic harness, moved out of the component. |

### Modified

| File | Phase | Change |
|------|-------|--------|
| `vite.config.ts` | B0 / P4 | Register HMR bridge plugin (B0); remove it (P4). |
| `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts` | P0–P1 | Write store instead of own `$state`; delegate `update()`/`handleVisibilityChange()`/`syncServiceState()` to managers; shrink to ~150-line façade. |
| `src/lib/shared/animation-engine/services/implementations/EffectRendererManager.ts` | P2 | Drop 16 named renderer fields + `prevHas*` getters/setters; back with `Map<EffectType, OverlayRenderer>` over `EFFECT_PLUGINS`. |
| `src/lib/shared/animation-engine/services/contracts/IAnimationRenderLoop.ts` | P2 | Generate renderer/config slots from registry; remove 32 hand-typed fields. |
| `src/lib/shared/animation-engine/services/implementations/AnimationRenderLoop.ts` | P2 | Drive per-frame dispatch off the registry; remove the 3 parallel full lists + `*Active` block. |
| `src/lib/shared/effects/state/effects-config-state.svelte.ts` | P2 | Replace 16 typed `updateXxx`/getters with generic `updateEffect(id, patch)` + indexed access. |
| `src/lib/features/compose/services/implementations/VideoExportOrchestrator.ts` | P3 | Use `createOffscreenContext`; delete live-resize hack (`:402-661`) + callbacks. |
| `src/lib/shared/animation-engine/services/implementations/RenderContextFactory.ts` | P3 / P5 | Wire `createOffscreenContext` into export (P3); implement `createLiveContext` stub (`:13`) (P5). |
| `src/lib/shared/animation-engine/domain/types/.../video-export-types.ts` | P3 | Remove `onResizeForExport` / `onRestoreFromExport`. |
| `src/lib/shared/animation-engine/components/AnimatorCanvas.svelte` | P4 | Strip to thin shell (~120 script lines); render `CanvasSurface`; **remove line-53 self-import**; move split/disassemble orchestration out. |
| `src/lib/shared/animation-engine/components/DisassembleCanvasView.svelte` | P4 | Render `CanvasSurface` (leaf) instead of `AnimatorCanvas`. |
| `src/lib/shared/animation-engine/components/DisassembleTransition.svelte` | P4 | Render `CanvasSurface` (leaf) instead of `AnimatorCanvas`; reconcile overlap with DisassembleCanvasView. |

---

## Phase B0 — Interim HMR bridge (do first)

**Why:** Until P4 removes the self-import, editing `AnimatorCanvas.svelte` crashes HMR (`Cannot read properties of undefined (reading 'default')`). A dev-only full-reload guard restores a usable edit loop. Throwaway — deleted in P4.

### Task B0.1: Create the dev-only HMR bridge plugin

**Files:**
- Create: `src/config/vite-plugin-animator-hmr-bridge.ts`

- [ ] **Step 1: Write the plugin**

```typescript
import type { HmrContext, Plugin } from "vite";

/**
 * THROWAWAY (delete in P4). Works around a @sveltejs/kit 2.48→2.61 svelte-HMR
 * regression: AnimatorCanvas.svelte self-imports (line 53), forming a circular
 * module that the newer vite-plugin-svelte fails to partial-accept, crashing
 * the HMR client. Until the self-import is removed in P4, force a clean
 * full-reload when this one file changes instead of the broken partial-accept.
 */
export function animatorCanvasHmrBridge(): Plugin {
  const TARGET = "/animation-engine/components/AnimatorCanvas.svelte";
  return {
    name: "animator-canvas-hmr-bridge",
    apply: "serve",
    handleHotUpdate(ctx: HmrContext) {
      if (ctx.file.replace(/\\/g, "/").endsWith(TARGET)) {
        ctx.server.ws.send({ type: "full-reload" });
        return [];
      }
      return undefined;
    },
  };
}
```

- [ ] **Step 2: Register it in `vite.config.ts`**

Add the import near the other plugin imports (top of file, after line 3):

```typescript
import { animatorCanvasHmrBridge } from "./src/config/vite-plugin-animator-hmr-bridge";
```

Add to the `plugins` array immediately after the `sveltekit({...})` entry (after line 641), so it runs after the svelte plugin registers the module graph:

```typescript
    animatorCanvasHmrBridge(), // THROWAWAY (delete in P4): full-reload guard for AnimatorCanvas self-import HMR crash
```

- [ ] **Step 3: Verify config still type-checks and builds**

Run: `npm run check`
Expected: 0 errors (baseline warnings unchanged).

Run: `npm run build`
Expected: succeeds. (Plugin is `apply: "serve"`, so it's a no-op in build — this confirms no import/type error.)

- [ ] **Step 4: Manual HMR sanity (ask user)**

Ask the user to: with their dev server running, edit a trivial line in `AnimatorCanvas.svelte` (e.g. a comment) and confirm the page does a **full reload** instead of throwing `Cannot read properties of undefined (reading 'default')`. This is the interim relief; the permanent fix is P4.

- [ ] **Step 5: Commit**

```bash
git add src/config/vite-plugin-animator-hmr-bridge.ts vite.config.ts
git commit -m "$(cat <<'EOF'
build(animation): add throwaway HMR full-reload bridge for AnimatorCanvas

Interim guard for the kit 2.48->2.61 svelte-HMR regression on the
AnimatorCanvas self-import. Deleted in P4 once the self-import is gone.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase P0 — `AnimationStore` + kill per-tick mirroring

**Why:** The per-tick `syncServiceState()` mirroring (`AnimationEngine.svelte.ts:1373`, called `:551`) is the Svelte-5 anti-pattern that forced a `StateSynchronizer`. Introduce a single per-instance store; the engine writes it, the UI reads it via getters; delete the mirroring incrementally. This is the foundation P1 manager signatures code against.

### Task P0.1: Define the store shape test (failing)

**Files:**
- Create: `src/lib/shared/animation-engine/state/animation-store.svelte.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { createAnimationStore } from "./animation-store.svelte";

describe("AnimationStore", () => {
  it("exposes defaults and is independent per instance", () => {
    const a = createAnimationStore();
    const b = createAnimationStore();

    expect(a.isInitialized).toBe(false);
    expect(a.currentBluePropType).toBe("staff");
    expect(a.displayedTurnsTuple).toBe("(s, 0, 0)");

    a.setInitialized(true);
    a.setBluePropType("fan");

    expect(a.isInitialized).toBe(true);
    expect(a.currentBluePropType).toBe("fan");
    // Per-instance isolation — b must be untouched.
    expect(b.isInitialized).toBe(false);
    expect(b.currentBluePropType).toBe("staff");
  });

  it("only mutates on real changes (referential no-op guard)", () => {
    const s = createAnimationStore();
    const before = s.bluePropDimensions;
    s.setBluePropDimensions(before); // same ref
    expect(s.bluePropDimensions).toBe(before);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npm run test -- animation-store`
Expected: FAIL — `createAnimationStore` not found.

### Task P0.2: Implement `AnimationStore`

**Files:**
- Create: `src/lib/shared/animation-engine/state/animation-store.svelte.ts`

This is the **canonical store contract** for all later phases. Mirror the exact fields currently in `AnimationEngine.state` (`AnimationEngine.svelte.ts:215-251`) plus the change-detection `prev*` fields that managers will read (`:303-327`). Read those two ranges before writing, and reproduce every field. The store owns state; setters apply the referential no-op guard already used in `syncServiceState`.

- [ ] **Step 1: Write the store**

```typescript
import type { AnimationVisibilityState } from "../services/implementations/AnimationVisibilitySynchronizer";
import type { PreRenderProgress } from "../services/implementations/SequenceFramePreRenderer";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { TrailSettings } from "../domain/types/TrailTypes";
import { loadTrailSettings } from "../utils/animation-panel-persistence";
import {
  DEFAULT_PROP_DIMENSIONS,
  type PropDimensions,
} from "../services/contracts/IPropTextureLoader";
import type { EffectType, TipEffectMap } from "../domain/types/TipEffectTypes";

export interface AnimationStore {
  // Read surface (getters)
  readonly isInitialized: boolean;
  readonly rendererLoading: boolean;
  readonly rendererError: string | null;
  readonly servicesReady: boolean;
  readonly visibilityState: AnimationVisibilityState;
  readonly isPreRendering: boolean;
  readonly preRenderProgress: PreRenderProgress | null;
  readonly preRenderedFramesReady: boolean;
  readonly displayedLetter: Letter | null;
  readonly displayedTurnsTuple: string;
  readonly displayedStepNumber: number | null;
  readonly displayedMusicalPosition: string | null;
  readonly fadingOutLetter: Letter | null;
  readonly fadingOutTurnsTuple: string | null;
  readonly fadingOutStepNumber: number | null;
  readonly isNewLetter: boolean;
  readonly trailSettings: TrailSettings;
  readonly bluePropDimensions: PropDimensions;
  readonly redPropDimensions: PropDimensions;
  readonly currentBluePropType: string;
  readonly currentRedPropType: string;
  readonly currentPropType: string;
  readonly suppress2DOverlays: boolean;
  readonly blueMotionVisible: boolean;
  readonly redMotionVisible: boolean;

  // Write surface (no-op guarded where a stale write would retrigger reactivity)
  setInitialized(v: boolean): void;
  setRendererLoading(v: boolean): void;
  setRendererError(v: string | null): void;
  setServicesReady(v: boolean): void;
  setVisibilityState(v: AnimationVisibilityState): void;
  setPreRendering(v: boolean): void;
  setPreRenderProgress(v: PreRenderProgress | null): void;
  setPreRenderedFramesReady(v: boolean): void;
  setGlyphState(v: {
    displayedLetter: Letter | null;
    displayedTurnsTuple: string;
    displayedStepNumber: number | null;
    displayedMusicalPosition: string | null;
    fadingOutLetter: Letter | null;
    fadingOutTurnsTuple: string | null;
    fadingOutStepNumber: number | null;
    isNewLetter: boolean;
  }): void;
  setTrailSettings(v: TrailSettings): void;
  setBluePropDimensions(v: PropDimensions): void;
  setRedPropDimensions(v: PropDimensions): void;
  setBluePropType(v: string): void;
  setRedPropType(v: string): void;
  setLegacyPropType(v: string): void;
  setSuppress2DOverlays(v: boolean): void;
  setMotionVisibility(blue: boolean, red: boolean): void;
}

export function createAnimationStore(): AnimationStore {
  const state = $state({
    isInitialized: false,
    rendererLoading: false,
    rendererError: null as string | null,
    servicesReady: false,
    visibilityState: {
      grid: true,
      stepNumbers: true,
      props: true,
      trails: true,
      tkaGlyph: true,
      darkMode: false,
      wordHeader: true,
      activeEffect: "trails" as EffectType,
      tipEffectMap: {} as TipEffectMap,
    } as AnimationVisibilityState,
    isPreRendering: false,
    preRenderProgress: null as PreRenderProgress | null,
    preRenderedFramesReady: false,
    displayedLetter: null as Letter | null,
    displayedTurnsTuple: "(s, 0, 0)",
    displayedStepNumber: null as number | null,
    displayedMusicalPosition: null as string | null,
    fadingOutLetter: null as Letter | null,
    fadingOutTurnsTuple: null as string | null,
    fadingOutStepNumber: null as number | null,
    isNewLetter: false,
    trailSettings: loadTrailSettings(),
    bluePropDimensions: DEFAULT_PROP_DIMENSIONS,
    redPropDimensions: DEFAULT_PROP_DIMENSIONS,
    currentBluePropType: "staff",
    currentRedPropType: "staff",
    currentPropType: "staff",
    suppress2DOverlays: false,
    blueMotionVisible: true,
    redMotionVisible: true,
  });

  return {
    get isInitialized() { return state.isInitialized; },
    get rendererLoading() { return state.rendererLoading; },
    get rendererError() { return state.rendererError; },
    get servicesReady() { return state.servicesReady; },
    get visibilityState() { return state.visibilityState; },
    get isPreRendering() { return state.isPreRendering; },
    get preRenderProgress() { return state.preRenderProgress; },
    get preRenderedFramesReady() { return state.preRenderedFramesReady; },
    get displayedLetter() { return state.displayedLetter; },
    get displayedTurnsTuple() { return state.displayedTurnsTuple; },
    get displayedStepNumber() { return state.displayedStepNumber; },
    get displayedMusicalPosition() { return state.displayedMusicalPosition; },
    get fadingOutLetter() { return state.fadingOutLetter; },
    get fadingOutTurnsTuple() { return state.fadingOutTurnsTuple; },
    get fadingOutStepNumber() { return state.fadingOutStepNumber; },
    get isNewLetter() { return state.isNewLetter; },
    get trailSettings() { return state.trailSettings; },
    get bluePropDimensions() { return state.bluePropDimensions; },
    get redPropDimensions() { return state.redPropDimensions; },
    get currentBluePropType() { return state.currentBluePropType; },
    get currentRedPropType() { return state.currentRedPropType; },
    get currentPropType() { return state.currentPropType; },
    get suppress2DOverlays() { return state.suppress2DOverlays; },
    get blueMotionVisible() { return state.blueMotionVisible; },
    get redMotionVisible() { return state.redMotionVisible; },

    setInitialized(v) { if (state.isInitialized !== v) state.isInitialized = v; },
    setRendererLoading(v) { if (state.rendererLoading !== v) state.rendererLoading = v; },
    setRendererError(v) { if (state.rendererError !== v) state.rendererError = v; },
    setServicesReady(v) { if (state.servicesReady !== v) state.servicesReady = v; },
    setVisibilityState(v) { state.visibilityState = v; },
    setPreRendering(v) { if (state.isPreRendering !== v) state.isPreRendering = v; },
    setPreRenderProgress(v) { if (state.preRenderProgress !== v) state.preRenderProgress = v; },
    setPreRenderedFramesReady(v) { if (state.preRenderedFramesReady !== v) state.preRenderedFramesReady = v; },
    setGlyphState(v) {
      if (state.displayedLetter !== v.displayedLetter) state.displayedLetter = v.displayedLetter;
      if (state.displayedTurnsTuple !== v.displayedTurnsTuple) state.displayedTurnsTuple = v.displayedTurnsTuple;
      if (state.displayedStepNumber !== v.displayedStepNumber) state.displayedStepNumber = v.displayedStepNumber;
      if (state.displayedMusicalPosition !== v.displayedMusicalPosition) state.displayedMusicalPosition = v.displayedMusicalPosition;
      if (state.fadingOutLetter !== v.fadingOutLetter) state.fadingOutLetter = v.fadingOutLetter;
      if (state.fadingOutTurnsTuple !== v.fadingOutTurnsTuple) state.fadingOutTurnsTuple = v.fadingOutTurnsTuple;
      if (state.fadingOutStepNumber !== v.fadingOutStepNumber) state.fadingOutStepNumber = v.fadingOutStepNumber;
      if (state.isNewLetter !== v.isNewLetter) state.isNewLetter = v.isNewLetter;
    },
    setTrailSettings(v) { state.trailSettings = v; },
    setBluePropDimensions(v) {
      if (state.bluePropDimensions.width !== v.width || state.bluePropDimensions.height !== v.height) {
        state.bluePropDimensions = v;
      }
    },
    setRedPropDimensions(v) {
      if (state.redPropDimensions.width !== v.width || state.redPropDimensions.height !== v.height) {
        state.redPropDimensions = v;
      }
    },
    setBluePropType(v) { if (state.currentBluePropType !== v) state.currentBluePropType = v; },
    setRedPropType(v) { if (state.currentRedPropType !== v) state.currentRedPropType = v; },
    setLegacyPropType(v) { if (state.currentPropType !== v) state.currentPropType = v; },
    setSuppress2DOverlays(v) { if (state.suppress2DOverlays !== v) state.suppress2DOverlays = v; },
    setMotionVisibility(blue, red) {
      if (state.blueMotionVisible !== blue) state.blueMotionVisible = blue;
      if (state.redMotionVisible !== red) state.redMotionVisible = red;
    },
  };
}
```

- [ ] **Step 2: Run the test, verify it passes**

Run: `npm run test -- animation-store`
Expected: PASS (both cases).

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/animation-engine/state/animation-store.svelte.ts src/lib/shared/animation-engine/state/animation-store.svelte.test.ts
git commit -m "$(cat <<'EOF'
feat(animation): add per-instance AnimationStore as single source of truth

Single $state-backed store with getter read surface and no-op-guarded
setters. Foundation for removing per-tick syncServiceState mirroring.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task P0.3: Engine constructs the store and writes through it

**Files:**
- Modify: `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts`

Replace the engine's own `state = $state<AnimationEngineState>({...})` (`:215-251`) with a store instance, and route all reads/writes through it. Keep the public `state` accessor shape so the component compiles unchanged this task (next task moves the component to the store directly).

- [ ] **Step 1:** Add `private readonly store = createAnimationStore();` to the engine (import from `../../state/animation-store.svelte`). Replace the `state = $state<...>({...})` block with a `get state()` shim that returns an object reading the store getters — OR (preferred) replace each `this.state.X` write with `this.store.setX(...)` and each `this.state.X` read with `this.store.X`. Do the mechanical replacement across the file. There are ~60 sites; grep `this.state.` to enumerate.

- [ ] **Step 2:** In `syncServiceState()` (`:1373-1447`), replace each `this.state.X = src` assignment with `this.store.setX(src)` (the no-op guard now lives in the setter, so the surrounding `if (this.state.X !== src)` wrappers can be deleted). Leave the resize-sync delegation (`:1441`) intact for now.

- [ ] **Step 3:** Run `npm run check` → 0 errors. Run `npm run test -- animation-engine` if engine tests exist; otherwise `npm run build`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts
git commit -m "$(cat <<'EOF'
refactor(animation): route AnimationEngine state through AnimationStore

Engine writes the per-instance store via guarded setters instead of
owning a local $state object. No behavior change.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task P0.4: Component reads the store via `$derived`; delete the local mirror

**Files:**
- Modify: `src/lib/shared/animation-engine/components/AnimatorCanvas.svelte`

- [ ] **Step 1:** Expose the store from the engine: add `get store(): AnimationStore { return this.store; }` (rename the private field to `#store` or `_store` to avoid the getter/field clash). In the component, replace the 8-flag local visibility mirror (`:325-343`) and the engine-state-derived locals with `$derived` reads off `engine.store`. Grep the component for `engine.state.` and repoint to `engine.store.`.

- [ ] **Step 2:** Delete the now-dead `$effect.pre` at `:333` that copied visibility flags into local `$state` (the store getter + `$derived` replaces it).

- [ ] **Step 3:** Run `npm run check` → 0 errors. `npm run build` → succeeds.

- [ ] **Step 4: Phase P0 verification** — run the full per-phase gate (check + build + manual exercise of viewer/disassemble/split/inline/lab/export). Confirm no visual regression.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/animation-engine/components/AnimatorCanvas.svelte src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts
git commit -m "$(cat <<'EOF'
refactor(animation): component reads AnimationStore via $derived, drop mirror

Removes the 8-flag local visibility mirror and the copy-in $effect.
UI now reads through to the store; no per-tick duplication.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase P1 — Extract SRP managers; engine → façade

**Why:** `update()` (`:540-770`), `handleVisibilityChange()` (`:1186-1371`), and the init code (`:957-1143`) are the god class's bulk. Move each responsibility into a manager that takes `(store, services)` and reads/writes the store directly. No `StateSynchronizer` — it is not created.

**Manager constructor contract (all five):** `constructor(store: AnimationStore, deps: <named service refs>)`. Managers import the store **type** only; they never import the façade. Keep the dependency graph acyclic (spec §3.3).

Each manager is one task group: write a focused unit test, extract the verified code block from the engine into the manager method, repoint the engine to delegate, verify green, commit. Extract in this order (later managers depend on earlier extractions being stable):

### Task P1.1: `LifecycleManager`
- **Extract from engine:** `initializeCanvas()` (`:957-1008`), `loadAnimatorServices()` (`:1010-1043`), `initialize*Service()` group (`:1045-1143`), `dispose()` (`:913-924`), `pauseResize`/`resumeResize` (`:926-927`). Absorb `AnimatorCanvasInitializer` (its `initialize`/`destroy`).
- **Test:** `LifecycleManager.test.ts` — init populates renderer + sets `store.setInitialized(true)` after the loop starts (not before — this kills the double-`rAF` race); dispose tears down all services and clears the container.
- **Delegate:** engine `initialize()`/`dispose()` call the manager. Remove the 13 hand-fed `lifecycleManager.setX()` calls — the manager now owns the service references it creates.
- **Verify + commit** (`refactor(animation): extract LifecycleManager from AnimationEngine`).

### Task P1.2: `PropSystem`
- **Extract:** prop-type-change handling in `update()` (`:568-570` + the PropPipeline delegation), `initializePropTextureLoader()` (`:1060-1073`), texture loads, and the prop-sync block in `syncServiceState()` (`:1406-1438`). Absorb `PropPipeline` + `PropTypeManager` + `PropTypeChanger`.
- **Test:** `PropSystem.test.ts` — prop-type change triggers texture reload + writes `store.setBluePropType/RedPropType/BluePropDimensions`.
- **Delegate + verify + commit** (`refactor(animation): extract PropSystem from AnimationEngine`).

### Task P1.3: `FrameSystem`
- **Extract:** `buildFrameParams()` (`:1497`) wiring, `calculateBeatNumber/TurnsTuple/MusicalPosition` (`:1449-1469`), glyph-target update + glyph-state write (`:737-764`). Absorb `FrameParameterBuilder`; fold `FrameBuilderService` in and **rename** the glyph-label helpers to a clearly-named unit (`GlyphLabelCalculator`) inside `FrameSystem`.
- **Test:** `FrameSystem.test.ts` — given props + store, `build()` returns correct `FrameParameters`; glyph labels computed correctly (pure).
- **Delegate + verify + commit** (`refactor(animation): extract FrameSystem from AnimationEngine`).

### Task P1.4: `EffectSystem`
- **Extract:** all of `handleVisibilityChange()` (`:1186-1371`) except the pure store-write of `visibilityState`; the fire/charcoal/LED slider→physics sync; effect-flag sync; `EffectController` passthroughs (`:929-951`). Absorb `EffectRendererManager` ownership + `EffectController`.
- **Test:** `EffectSystem.test.ts` — visibility change with trails-off clears + hides the trail overlay; fire slider change calls `setFireConfig`; effort-preset change resets the fire tip tracker.
- **Delegate + verify + commit** (`refactor(animation): extract EffectSystem from AnimationEngine`).

### Task P1.5: `PlaybackSync` + engine becomes façade
- **Extract:** the render-trigger plumbing (`renderLoopService.triggerRender(...)` call sites), sequence-change re-init + path-cache precompute (`:611-701`), cache-clear-signal handling (`:656-681`).
- **Test:** `PlaybackSync.test.ts` — sequence content change re-initializes the orchestrator + clears stale buffers.
- **Final delegate:** engine `update()` becomes: `this.store`-fed prop refresh, then fan to `propSystem.update()`, `frameSystem.update()`, `effectSystem.update()`, `playbackSync.update()`. Engine target ≤ 250 lines.
- [ ] **Phase P1 verification:** full gate. Confirm engine line count: `grep -c "" src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts` ≤ 250.
- **Commit** (`refactor(animation): extract PlaybackSync; AnimationEngine is now a thin facade`).

---

## Phase P2 — Effect plugin registry + `OverlayRenderer` base

**Why:** Adding an effect touches ~20 sites across ~12 files. Collapse to one `EFFECT_PLUGINS` entry + one renderer.

### Task P2.1: `OverlayRenderer` base + `EffectPlugin` interface (TDD)
- **Create** `OverlayRenderer.ts` (abstract base: the shared canvas boilerplate each overlay copy-pastes — read `WaterOverlayRenderer.ts` + `EchoOverlayRenderer.ts` to extract the common `initialize/resize/clear/setVisible/setCanvasZIndex/dispose/isInitialized/getCanvas`; leave `renderFrame` abstract).
- **Create** `EffectPlugin.ts` (interface from spec §2 + `EFFECT_PLUGINS: EffectPlugin[]`).
- **Test** `EffectPlugin.test.ts` — registry has one entry per `EffectType` in the union (`TipEffectTypes.ts:16-33`); each plugin's `createRenderer()` returns an `OverlayRenderer`.
- **Commit** (`feat(animation): add EffectPlugin registry + OverlayRenderer base`).

### Task P2.2: Migrate overlays onto the base
- Convert each of the 14 Canvas2D overlays to extend `OverlayRenderer` (delete the copy-pasted boilerplate). One commit per ~4 overlays, each verified with `npm run check`. WebGL fire/charcoal/LED implement the same contract but keep their shader internals.

### Task P2.3: Back `EffectRendererManager` with the registry
- Replace the 16 named renderer fields + the 28-line `prevHas*` getter/setter block (`EffectRendererManager.ts:182-244`) with `private renderers = new Map<EffectType, OverlayRenderer>()` populated from `EFFECT_PLUGINS`. Update `syncEffectFlagsFromEffectiveMap` (`:492-506`) to iterate the map. Keep external callers working by providing a `getRenderer(id)` accessor.
- **Verify + commit.**

### Task P2.4: Generate render-loop slots + collapse config-state
- In `IAnimationRenderLoop.ts` + `AnimationRenderLoop.ts`, drive the per-frame dispatch off the registry (each plugin's `buildFrameInput`/`render`/`needsDt`); remove the 3 parallel full lists + the `*Active` block (`:790-833`).
- In `effects-config-state.svelte.ts`, remove the 16 typed `updateXxx`/getters in favor of the existing generic `updateEffect(id, patch)` + indexed access. Repoint callers (grep `updateFire`, `updateLed`, etc.).
- [ ] **Phase P2 verification:** full gate + author a scratch 17th plugin in a test to prove "1 plugin + 1 renderer + 1 registration line" lights up the selector and render loop, then delete the scratch.
- **Commit** (`refactor(animation): drive render loop + config state off EFFECT_PLUGINS`).

---

## Phase P3 — Offscreen export; delete the resize hack

**Why:** `VideoExportOrchestrator` resizes the **live** canvas up/down (`:402-661`) — the anti-pattern (and `a6d7558bd` proved it doesn't fix fidelity). `createOffscreenContext` (`RenderContextFactory.ts:22`) already builds a full native-res pipeline with zero callers.

### Task P3.1: Route export through the offscreen context (TDD)
- **Test** (integration): `createOffscreenContext(1080)` → render a frame with trails → capture → assert 1080×1080 output, no live-canvas mutation.
- **Modify** `VideoExportOrchestrator.executeExport`: create offscreen context at `outputCanvasSize`; per frame `playbackController.calculateStateForStep(position)` → `exportCtx.triggerRender()` → capture from `exportCtx.canvas`; `finally { exportCtx.dispose(); }`.
- **Delete** the live-context lookup + `resize`/`pauseObservation`/`restoreSize`/`resumeObservation` hack (`:402-408`, `:659-661`).

### Task P3.2: Remove dead callbacks
- Remove `onResizeForExport` / `onRestoreFromExport` from the video-export types and any wiring in `AnimatorCanvas`/orchestrator options.
- [ ] **Phase P3 verification:** full gate + export a trail sequence at 1080p; confirm with the user that exported trail glow matches the live preview and the live canvas does not flicker/resize during export.
- **Commit** (`feat(animation): render export frames into offscreen context, delete live-resize hack`).

---

## Phase P4 — AnimatorCanvas → thin shell; **kill the self-import** (permanent HMR fix)

**Why:** AnimatorCanvas is 1147 lines with an embedded diagnostic harness, race workarounds, and the line-53 self-import that crashes HMR. The structural fix is to make AnimatorCanvas a **non-recursive leaf** and move split/disassemble orchestration into view components that render that leaf.

> **Cycle-breaking principle (verified):** `DisassembleCanvasView`/`DisassembleTransition` import `AnimatorCanvas` — that is acyclic **only if AnimatorCanvas does not (transitively) render them**. So the leaf that the split/disassemble views render must NOT be a component that imports them back. Solution: extract the single-canvas render body into `CanvasSurface.svelte` (imports nothing in this subtree that imports it). AnimatorCanvas, DisassembleCanvasView, DisassembleTransition, and SplitCanvasView all render `CanvasSurface`. No A→A, no A→B→A.

### Task P4.1: Extract `CanvasSurface.svelte` (the leaf)
- **Create** `CanvasSurface.svelte`: the canvas wrapper div + `GlyphOverlay` + `ProgressOverlay` + the single-engine mount (`factory.createLiveContext` once P5 lands; until then `new AnimationEngine()`), the ONE `$effect` → `engine.update(props)`, store-`$derived` reads, dispose + registry register/unregister. It imports **only** leaf overlays — never `AnimatorCanvas`, `DisassembleCanvasView`, `DisassembleTransition`, or `SplitCanvasView`.
- **Verify** `npm run check`. **Commit.**

### Task P4.2: Extract the diagnostic harness
- **Move** the 167-line LED/fire diagnostic blob (`AnimatorCanvas.svelte:428-595`) into `debug/animator-diagnostics.ts` as a function taking the engine/context. Wire it from the effects lab (or a dev-only context-menu action), not the production canvas. **Commit.**

### Task P4.3: Extract split orchestration → `SplitCanvasView.svelte`
- **Create** `SplitCanvasView.svelte`: the 2-canvas split state machine currently inside AnimatorCanvas (`:182-250`, `:825/849` using `AnimatorCanvasSelf`). It renders two `CanvasSurface` instances (blue-only / red-only). The `requestAnimationFrame`/split-ready race (`:223`) is recomputed here cleanly.
- Repoint AnimatorCanvas's split branch to render `<SplitCanvasView .../>`. **Commit.**

### Task P4.4: AnimatorCanvas becomes the thin shell; **remove the self-import**
- AnimatorCanvas now: chooses between `CanvasSurface` (normal), `SplitCanvasView` (split), `DisassembleCanvasView` (disassemble) and passes props through. **Delete** `import AnimatorCanvasSelf from "./AnimatorCanvas.svelte"` (`:53`) and its uses (`:825`, `:849`).
- Target ~120 script lines.

### Task P4.5: Repoint Disassemble views to the leaf
- `DisassembleCanvasView.svelte` (`:75/86/97`) and `DisassembleTransition.svelte` (`:319/330/341`): render `CanvasSurface` instead of `AnimatorCanvas`. Reconcile the two views — if `DisassembleTransition` is `DisassembleCanvasView` + an entry animation, compose rather than duplicate.

### Task P4.6: Delete the B0 bridge
- Remove `src/config/vite-plugin-animator-hmr-bridge.ts` and its registration in `vite.config.ts` (the import line + the array entry added in B0.1).

### Task P4.7: Phase P4 acceptance (spec §3.2)
- [ ] `grep -rn 'from "\./AnimatorCanvas.svelte"' src` → only the Disassemble views may remain, and only if AnimatorCanvas no longer renders them; **zero** matches for `AnimatorCanvasSelf`.
- [ ] Full self-import sweep returns zero: no file imports itself.
- [ ] **HMR survival test (ask user):** app running, disassemble (3) + split (2) views mounted; edit an upstream value-import (e.g. `getRenderContextRegistry.ts`); confirm the update applies with **no** `reading 'default'` crash and **no** forced full reload.
- [ ] B0 bridge deleted.
- [ ] Full gate (check + build + exercise all consumers).
- **Commit** (`refactor(animation): AnimatorCanvas thin shell + CanvasSurface leaf; remove self-import (permanent HMR fix); delete B0 bridge`).

---

## Phase P5 — Implement `createLiveContext`; build via factory; delete dead stubs

**Why:** Close the loop — `createLiveContext` (`RenderContextFactory.ts:13`) still throws; `CanvasSurface` should build through the factory so live and offscreen contexts share one construction path.

### Task P5.1: Implement `createLiveContext`
- Implement the stub to construct the engine/store+managers for a live container and return a registered `RenderContext` (mirror `createOffscreenContext` but with the live DOM container + resize observation).
- **Test:** two live contexts coexist, each renders independently, registry tracks both.

### Task P5.2: `CanvasSurface` builds via the factory
- Replace `new AnimationEngine()` in `CanvasSurface` with `await factory.createLiveContext(container)`. The `queueMicrotask` registry-registration (`AnimatorCanvas.svelte:644` original) is no longer needed — the factory registers.

### Task P5.3: Delete dead infrastructure
- Remove any now-unused: old `AnimatorCanvasInitializer` (absorbed by LifecycleManager), the engine's `getRenderContext()` shim if superseded, and any `StateSynchronizer.ts` file (its rationale is gone — confirm no imports remain via grep before deleting).
- [ ] **Phase P5 verification:** full gate. Grep confirms no references to deleted symbols.
- **Commit** (`refactor(animation): implement createLiveContext, build via factory, remove dead stubs`).

---

## Self-Review (completed by plan author)

- **Spec coverage:** Store + managers (P0/P1), no StateSynchronizer (P1.5 + P5.3), effect plugin registry + OverlayRenderer (P2), offscreen export + resize-hack deletion (P3), AnimatorCanvas thin shell + diagnostics extraction + disassemble consolidation + self-import removal + B0 deletion (P4), createLiveContext + factory build (P5), B0 interim bridge (B0). HMR root-cause (spec §1) addressed by P4's leaf extraction; §3.2 acceptance is P4.7; §3.3 acyclic-graph guidance enforced by the manager constructor contract.
- **Self-import nuance:** Spec §2 said "consolidate onto DisassembleCanvasView/Transition." Verified that alone is insufficient (those import AnimatorCanvas → A→B→A if AnimatorCanvas renders them). Plan resolves via the `CanvasSurface` leaf — a strictly stronger fix consistent with spec §1's "render a shared non-recursive child."
- **Type consistency:** Store setter/getter names are the single contract; manager constructors all take `(store, deps)`; `EffectPlugin`/`OverlayRenderer`/`EFFECT_PLUGINS` names consistent across P2 tasks.
- **Placeholder scan:** B0 + P0 carry full code. P1–P5 task code is authored at phase start against the P0 store contract and the verified `file:line` anchors cited in each task (mechanical strangler moves of already-verified blocks, not invented APIs).
