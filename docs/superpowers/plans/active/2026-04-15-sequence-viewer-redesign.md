# Sequence Viewer Redesign + Per-Performer Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Sequence Viewer chrome redesign (vertical right rail, 3-tab Gear popover with tile-grid Scene, always-visible bottom transport, per-performer effort/prop/effects) while retiring stale artifacts (fly/walk/orbit chip, 2D/3D toggle duplicates, grid scene toggle).

**Architecture:** Per-performer settings (`effortId`, `prop`, `effects`) live on the existing `AvatarInstanceState` (already the per-performer data carrier). `AnimationEngine` gains a `performerEffortResolver: (performerId) => EffortId` so its existing effort-driven motion logic reads per-performer values. Viewer chrome is a thin layer of new Svelte 5 components wrapping existing reusables (`BpmChips`, `EffortPalette`, `BentoPropGrid`, `EffectsSettingsPanel`, `Viewer3DViewPresets`). A single popover-stack state on `viewer-3d-state` enforces "one popover at a time."

**Tech Stack:** Svelte 5 (runes, `$state`, `$derived`, `$effect`), TypeScript, SvelteKit 2, Vitest 4.0 for unit tests, FontAwesome 6 for icons, ITI dependency injection.

**Spec:** `docs/superpowers/specs/2026-04-15-sequence-viewer-redesign-design.md`

---

## Prerequisites / environment notes

- **No branches. Work on `main`.** (`CLAUDE.md` — rule enforced.)
- **Port 5173 is the user's dev server.** If you need your own dev server, use `vite --port 5174`. Do not run `npm run dev`, `kill-port 5173`, or similar.
- **Build check:** `npm run check` (svelte-check) and `npm run build` are the correctness gates between phases.
- **No Svelte component tests exist in this project.** Vitest covers state/logic modules only. UI component changes are validated via build check + manual browser smoke. Do not invent a component test harness.
- **Test location convention:** `tests/unit/**/*.test.ts`. Example reference: `tests/unit/3d/GameBridge.test.ts` uses `describe/it/expect/vi` from `vitest` with jsdom.
- **Test runner command:** `npm run test -- --run <path>` or equivalent invocation of vitest with `--run`. Consult `package.json` for the exact npm script before the first test task.
- **Commits go to `main` directly.** Commit after every passing task (no cherry-picking later).
- **MCP for pictographs:** Not relevant to this plan — no pictograph rendering is touched.

---

## Phase 0 — Foundation (no new UI)

These tasks unblock all the UI work. They are TDD-friendly (pure state/logic). Complete Phase 0 and run the build before starting Phase 1.

---

### Task 1: Remove `grid` from the scene feature registry

**Files:**
- Modify: `src/lib/shared/3d/scene-features/domain/scene-feature-registry.ts`
- Test: `tests/unit/3d/scene-features/scene-feature-registry.test.ts` (create)

**Context:** The `grid` scene feature was carried over from the 2D viewer. In 3D, the `Planes` system replaces it with proper 3D geometry. Per spec §6.2, `SCENE_FEATURES` loses the `grid` entry. Any consumer reading `SCENE_FEATURES` now sees 5 entries.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/3d/scene-features/scene-feature-registry.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { SCENE_FEATURES } from "$lib/shared/3d/scene-features/domain/scene-feature-registry";

describe("SCENE_FEATURES", () => {
  it("does not include a 'grid' entry", () => {
    expect(SCENE_FEATURES.find((f) => f.key === "grid")).toBeUndefined();
  });

  it("contains the 5 canonical scene features", () => {
    const keys = SCENE_FEATURES.map((f) => f.key).sort();
    expect(keys).toEqual(["audience", "campfire", "environment", "stage", "tent"]);
  });
});
```

- [ ] **Step 2: Run the test; confirm it fails**

Run: `npx vitest run tests/unit/3d/scene-features/scene-feature-registry.test.ts`
Expected: first test fails ("Expected undefined, received object with key 'grid'").

- [ ] **Step 3: Remove the grid entry**

In `src/lib/shared/3d/scene-features/domain/scene-feature-registry.ts` lines 8-15, delete the line:

```ts
  { key: "grid",        label: "Grid",         defaultEnabled: true,  requiresAsyncLoad: false },
```

- [ ] **Step 4: Run tests — confirm pass**

Run: `npx vitest run tests/unit/3d/scene-features/scene-feature-registry.test.ts`
Expected: both tests pass.

- [ ] **Step 5: Run `npm run check`**

Expected: no new type errors. If `SceneFeatureToggles.svelte` references `grid` statically anywhere, fix those references (likely none — it iterates the registry).

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/3d/scene-features/domain/scene-feature-registry.ts tests/unit/3d/scene-features/scene-feature-registry.test.ts
git commit -m "refactor(3d): remove grid from SCENE_FEATURES (Planes replaces it)"
```

---

### Task 2: Add popover-stack state to viewer-3d-state

**Files:**
- Modify: `src/lib/shared/3d/state/viewer-3d-state.svelte.ts`
- Test: `tests/unit/3d/state/viewer-3d-state-popover-stack.test.ts` (create)

**Context:** Currently any rail popover can be open simultaneously with another (the "popover stomping" bug from spec §11.1). Add a single exclusive `activePopover` field of type `PopoverId | null`, plus `openPopover(id)` / `closePopover()` methods. All rail popovers and the header info chip will read/write this one field.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/3d/state/viewer-3d-state-popover-stack.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createViewer3DState } from "$lib/shared/3d/state/viewer-3d-state.svelte";

function makeDeps() {
  return {
    propInterpolator: { interpolate: () => null } as any,
    sequenceConverter: { convert: () => null } as any,
    viewer3DUndoManager: { push: () => {}, undo: () => {}, redo: () => {} } as any,
  };
}

describe("viewer-3d-state popover stack", () => {
  it("starts with no popover open", () => {
    const s = createViewer3DState(makeDeps());
    expect(s.activePopover).toBeNull();
  });

  it("openPopover sets the active popover", () => {
    const s = createViewer3DState(makeDeps());
    s.openPopover("performers");
    expect(s.activePopover).toBe("performers");
  });

  it("openPopover replaces the currently-open popover (exclusive)", () => {
    const s = createViewer3DState(makeDeps());
    s.openPopover("performers");
    s.openPopover("tempo");
    expect(s.activePopover).toBe("tempo");
  });

  it("closePopover clears the active popover", () => {
    const s = createViewer3DState(makeDeps());
    s.openPopover("export");
    s.closePopover();
    expect(s.activePopover).toBeNull();
  });

  it("openPopover with null is equivalent to closePopover", () => {
    const s = createViewer3DState(makeDeps());
    s.openPopover("gear");
    s.openPopover(null);
    expect(s.activePopover).toBeNull();
  });
});
```

- [ ] **Step 2: Run test; confirm fail**

Run: `npx vitest run tests/unit/3d/state/viewer-3d-state-popover-stack.test.ts`
Expected: all 5 tests fail — `activePopover`, `openPopover`, `closePopover` do not exist.

- [ ] **Step 3: Define PopoverId type and add state + methods**

In `src/lib/shared/3d/state/viewer-3d-state.svelte.ts`:

Near the top (after the existing imports/types), add:

```ts
export type PopoverId = "performers" | "tempo" | "export" | "gear" | "info";
```

Inside `createViewer3DState`, add a `$state` field and two methods. Place them near the existing top-level reactive fields (around line 275, adjacent to `renderMode`):

```ts
  let _activePopover = $state<PopoverId | null>(null);

  function openPopover(id: PopoverId | null): void {
    _activePopover = id;
  }

  function closePopover(): void {
    _activePopover = null;
  }
```

Expose them in the factory's return object:

```ts
    get activePopover() { return _activePopover; },
    openPopover,
    closePopover,
```

- [ ] **Step 4: Run test; confirm pass**

Run: `npx vitest run tests/unit/3d/state/viewer-3d-state-popover-stack.test.ts`
Expected: all 5 tests pass.

- [ ] **Step 5: Run `npm run check`**

Expected: no new type errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/3d/state/viewer-3d-state.svelte.ts tests/unit/3d/state/viewer-3d-state-popover-stack.test.ts
git commit -m "feat(viewer-3d): add exclusive popover-stack state to viewer-3d-state"
```

---

### Task 3: Extend AvatarInstanceState with PerformerSettings

**Files:**
- Modify: `src/lib/shared/3d/state/avatar-instance-state.svelte.ts`
- Create: `src/lib/shared/3d/state/performer-settings-types.ts`
- Test: `tests/unit/3d/state/avatar-instance-state-settings.test.ts` (create)

**Context:** Per spec §7.1, each performer needs `effortId`, `prop`, and `effects`. The existing `AvatarInstanceState` is already per-performer (holds position, facingAngle, moveInput) so we attach the new fields there. This keeps the "one object per performer" invariant. A separate `performer-settings-types.ts` holds the types so components can import them without pulling the whole state module.

- [ ] **Step 1: Create the types file**

Create `src/lib/shared/3d/state/performer-settings-types.ts`:

```ts
import type { EffortId } from "$lib/features/effort-lab/domain/effort-types";
import type { PropType } from "$lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry";

export type EffectId =
  | "trails"
  | "fire"
  | "charcoal"
  | "led"
  | "electricity"
  | "sparkles"
  | "motion"
  | "bloom";

export interface PerformerSettings {
  effortId: EffortId;
  prop: PropType;
  effects: Set<EffectId>;
}

export function makeDefaultPerformerSettings(): PerformerSettings {
  return {
    effortId: "linear",
    prop: "STAFF",
    effects: new Set(),
  };
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/unit/3d/state/avatar-instance-state-settings.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createAvatarInstanceState } from "$lib/shared/3d/state/avatar-instance-state.svelte";

function makeConfig() {
  return { id: "p1", initialPosition: { x: 0, z: 0 }, initialFacingAngle: 0 };
}
function makeDeps() { return {} as any; }

describe("AvatarInstanceState — performer settings", () => {
  it("starts with default settings (linear effort, STAFF prop, no effects)", () => {
    const a = createAvatarInstanceState(makeConfig(), makeDeps());
    expect(a.settings.effortId).toBe("linear");
    expect(a.settings.prop).toBe("STAFF");
    expect(a.settings.effects.size).toBe(0);
  });

  it("setEffort updates effortId", () => {
    const a = createAvatarInstanceState(makeConfig(), makeDeps());
    a.setEffort("glide");
    expect(a.settings.effortId).toBe("glide");
  });

  it("setProp updates prop", () => {
    const a = createAvatarInstanceState(makeConfig(), makeDeps());
    a.setProp("FAN");
    expect(a.settings.prop).toBe("FAN");
  });

  it("toggleEffect adds an inactive effect", () => {
    const a = createAvatarInstanceState(makeConfig(), makeDeps());
    a.toggleEffect("trails");
    expect(a.settings.effects.has("trails")).toBe(true);
  });

  it("toggleEffect removes an already-active effect", () => {
    const a = createAvatarInstanceState(makeConfig(), makeDeps());
    a.toggleEffect("fire");
    a.toggleEffect("fire");
    expect(a.settings.effects.has("fire")).toBe(false);
  });
});
```

- [ ] **Step 3: Run test; confirm fail**

Run: `npx vitest run tests/unit/3d/state/avatar-instance-state-settings.test.ts`
Expected: all fail — `settings`, `setEffort`, `setProp`, `toggleEffect` do not exist.

- [ ] **Step 4: Extend AvatarInstanceState**

In `src/lib/shared/3d/state/avatar-instance-state.svelte.ts`:

Add near the top-level imports:

```ts
import {
  makeDefaultPerformerSettings,
  type PerformerSettings,
  type EffectId,
} from "./performer-settings-types";
import type { EffortId } from "$lib/features/effort-lab/domain/effort-types";
import type { PropType } from "$lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry";
```

Inside `createAvatarInstanceState(config, deps)`, add a reactive settings field and three mutators:

```ts
  let _settings = $state<PerformerSettings>(makeDefaultPerformerSettings());

  function setEffort(effortId: EffortId): void {
    _settings = { ..._settings, effortId };
  }

  function setProp(prop: PropType): void {
    _settings = { ..._settings, prop };
  }

  function toggleEffect(effect: EffectId): void {
    const next = new Set(_settings.effects);
    if (next.has(effect)) next.delete(effect);
    else next.add(effect);
    _settings = { ..._settings, effects: next };
  }
```

Expose them on the returned object:

```ts
    get settings() { return _settings; },
    setEffort,
    setProp,
    toggleEffect,
```

- [ ] **Step 5: Run test; confirm pass**

Run: `npx vitest run tests/unit/3d/state/avatar-instance-state-settings.test.ts`
Expected: all 5 tests pass.

- [ ] **Step 6: Run `npm run check`**

If `PropType` import path differs from what I wrote, fix the import. The registry file path is `src/lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry.ts` — locate the actual exported type name (it may be exported as `PropType` directly or need a different alias).

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/3d/state/performer-settings-types.ts src/lib/shared/3d/state/avatar-instance-state.svelte.ts tests/unit/3d/state/avatar-instance-state-settings.test.ts
git commit -m "feat(viewer-3d): add per-performer settings (effort, prop, effects) to AvatarInstanceState"
```

---

### Task 4: AnimationEngine accepts per-performer effort resolver

**Files:**
- Modify: `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts`
- Test: `tests/unit/animation-engine/animation-engine-effort-resolver.test.ts` (create)

**Context:** `AnimationEngine` currently reads effort globally via `vm.getEffortPreset()` at approximately line 607. Per spec §7.2, we add a per-performer resolver callback. When set, the engine calls `resolver(performerId)` for each performer being updated; when null, it falls back to the existing global behavior. Backward compatible.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/animation-engine/animation-engine-effort-resolver.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { createAnimationEngine } from "$lib/shared/animation-engine/services/implementations/AnimationEngine.svelte";

// Use the simplest mock that satisfies the engine's dependency surface.
// The exact deps shape needs to be read from the engine's current factory signature.
function makeDeps() {
  return {
    visibilityManager: { getEffortPreset: () => "linear" },
    // Add other dep stubs here after reading AnimationEngine.svelte.ts factory.
  } as any;
}

describe("AnimationEngine — per-performer effort resolver", () => {
  it("setPerformerEffortResolver stores the resolver", () => {
    const engine = createAnimationEngine(makeDeps());
    const resolver = vi.fn((id: string) => (id === "p2" ? "glide" : "linear"));
    engine.setPerformerEffortResolver(resolver);
    expect(engine.getEffortForPerformer("p2")).toBe("glide");
    expect(resolver).toHaveBeenCalledWith("p2");
  });

  it("falls back to global effort when no resolver is set", () => {
    const engine = createAnimationEngine(makeDeps());
    expect(engine.getEffortForPerformer("anyone")).toBe("linear");
  });

  it("clears the resolver when passed null", () => {
    const engine = createAnimationEngine(makeDeps());
    engine.setPerformerEffortResolver(() => "glide");
    engine.setPerformerEffortResolver(null);
    expect(engine.getEffortForPerformer("p1")).toBe("linear");
  });
});
```

- [ ] **Step 2: Run test; confirm fail**

Run: `npx vitest run tests/unit/animation-engine/animation-engine-effort-resolver.test.ts`
Expected: tests fail — `setPerformerEffortResolver`, `getEffortForPerformer` do not exist. If the engine factory signature differs, update `makeDeps()` to match before proceeding (read the current factory at `AnimationEngine.svelte.ts` lines 1-50).

- [ ] **Step 3: Add resolver state + accessors to the engine**

In `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts`:

Add near the top of the factory function body (alongside other reactive fields, near line 190):

```ts
  import type { EffortId } from "$lib/features/effort-lab/domain/effort-types";
  // (if EffortId is already imported, skip this import line)

  let _performerEffortResolver: ((performerId: string) => EffortId) | null = null;

  function setPerformerEffortResolver(
    resolver: ((performerId: string) => EffortId) | null
  ): void {
    _performerEffortResolver = resolver;
  }

  function getEffortForPerformer(performerId: string): EffortId {
    if (_performerEffortResolver) return _performerEffortResolver(performerId);
    return deps.visibilityManager.getEffortPreset();
  }
```

Expose in the factory's return object:

```ts
    setPerformerEffortResolver,
    getEffortForPerformer,
```

- [ ] **Step 4: Rewire the effort read site**

Find the existing `vm.getEffortPreset()` call around line 607. Identify the loop/frame-update where it resolves the effort for the performer being animated. Replace with `getEffortForPerformer(performer.id)`. If the update loop doesn't currently iterate performers, leave the global `getEffortPreset()` call as the fallback inside `getEffortForPerformer` and call `getEffortForPerformer(currentPerformerId)` wherever `currentPerformerId` is known.

Example (exact line depends on the current code — adapt to match):

```ts
// BEFORE:
// const effort = vm.getEffortPreset();

// AFTER:
const effort = getEffortForPerformer(performer.id);
```

- [ ] **Step 5: Run test; confirm pass**

Run: `npx vitest run tests/unit/animation-engine/animation-engine-effort-resolver.test.ts`
Expected: all 3 tests pass.

- [ ] **Step 6: Run `npm run check`**

Fix any type errors. Ensure the `EffortId` import path is correct.

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts tests/unit/animation-engine/animation-engine-effort-resolver.test.ts
git commit -m "feat(animation-engine): accept per-performer effort resolver with global fallback"
```

---

### Task 5: Wire viewer-3d-state → AnimationEngine effort resolver

**Files:**
- Modify: `src/lib/shared/3d/state/viewer-3d-state.svelte.ts` (add init hook)
- Modify: wherever `AnimationEngine` is instantiated for the viewer (search: `createAnimationEngine(` call sites)
- Test: `tests/unit/3d/state/viewer-3d-state-effort-resolver-wiring.test.ts` (create)

**Context:** Now that the engine accepts a resolver and `AvatarInstanceState` exposes `settings.effortId`, connect them: the viewer registers `(id) => performerManager.performers.find(p => p.id === id)?.settings.effortId ?? "linear"` with the engine.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/3d/state/viewer-3d-state-effort-resolver-wiring.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
// Use a faux engine stand-in that records the resolver.
// This is an integration test for the wiring helper, not the whole viewer state.
import { installPerformerEffortResolver } from "$lib/shared/3d/state/viewer-3d-state-effort-wiring";

describe("installPerformerEffortResolver", () => {
  it("registers a resolver that looks up performer effort by id", () => {
    const fakeEngine = { setPerformerEffortResolver: vi.fn() };
    const performerManager = {
      performers: [
        { id: "p1", settings: { effortId: "linear" } },
        { id: "p2", settings: { effortId: "glide" } },
      ],
    };
    installPerformerEffortResolver(fakeEngine as any, performerManager as any);
    expect(fakeEngine.setPerformerEffortResolver).toHaveBeenCalledTimes(1);
    const [resolver] = fakeEngine.setPerformerEffortResolver.mock.calls[0];
    expect(resolver("p1")).toBe("linear");
    expect(resolver("p2")).toBe("glide");
  });

  it("returns 'linear' fallback for unknown performer id", () => {
    const fakeEngine = { setPerformerEffortResolver: vi.fn() };
    const performerManager = { performers: [] };
    installPerformerEffortResolver(fakeEngine as any, performerManager as any);
    const [resolver] = fakeEngine.setPerformerEffortResolver.mock.calls[0];
    expect(resolver("does-not-exist")).toBe("linear");
  });
});
```

- [ ] **Step 2: Run test; confirm fail**

Run: `npx vitest run tests/unit/3d/state/viewer-3d-state-effort-resolver-wiring.test.ts`
Expected: import fails — file does not exist yet.

- [ ] **Step 3: Create the wiring helper**

Create `src/lib/shared/3d/state/viewer-3d-state-effort-wiring.ts`:

```ts
import type { AnimationEngine } from "$lib/shared/animation-engine/services/implementations/AnimationEngine.svelte";
import type { PerformerManager } from "$lib/shared/3d/state/performer-manager.svelte";
import type { EffortId } from "$lib/features/effort-lab/domain/effort-types";

export function installPerformerEffortResolver(
  engine: Pick<AnimationEngine, "setPerformerEffortResolver">,
  performerManager: Pick<PerformerManager, "performers">,
): void {
  engine.setPerformerEffortResolver((id: string): EffortId => {
    const p = performerManager.performers.find((p) => p.id === id);
    return p?.settings.effortId ?? "linear";
  });
}
```

- [ ] **Step 4: Run test; confirm pass**

Run: `npx vitest run tests/unit/3d/state/viewer-3d-state-effort-resolver-wiring.test.ts`
Expected: both tests pass.

- [ ] **Step 5: Call the helper at viewer init**

Find where `createViewer3DState` is constructed with its engine dependency — inspect `SequenceViewerOrchestrator.svelte` and/or the DI container module that hands the engine to the viewer. After both the engine and `performerManager` are available, call `installPerformerEffortResolver(engine, performerManager)` once.

If the call site is ambiguous, place the install inside `createViewer3DState(deps)` at the end of the factory body, guarded by presence of `deps.animationEngine`:

```ts
  if (deps.animationEngine && performerManager) {
    installPerformerEffortResolver(deps.animationEngine, performerManager);
  }
```

- [ ] **Step 6: Run `npm run check`**

Fix type errors. Confirm the engine is actually reachable from the viewer-3d-state construction context.

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/3d/state/viewer-3d-state-effort-wiring.ts src/lib/shared/3d/state/viewer-3d-state.svelte.ts tests/unit/3d/state/viewer-3d-state-effort-resolver-wiring.test.ts
git commit -m "feat(viewer-3d): wire per-performer effort resolver from AvatarInstanceState"
```

---

### Task 6: Per-performer prop read site in the renderer

**Files:**
- Modify: the prop/staff renderer (likely `src/lib/shared/3d/components/SeatedFigure3D.svelte` and/or `Staff3D`-family files — find them via search)
- Test: `tests/unit/3d/state/performer-prop-resolution.test.ts` (create)

**Context:** Per spec §7.3, props become per-performer. The renderer currently reads a global `propType`. It should read `performer.settings.prop` instead. Memory note: `bluePropState = red visual prop in 3D` color-swap still happens at render layer regardless of per-performer prop.

- [ ] **Step 1: Locate the current global prop-type read**

Run: `Grep` for `propType` across `src/lib/shared/3d/components/` and `src/lib/shared/3d/services/`. Identify the site(s) that currently read from a global source. Record the file path(s) and line numbers.

- [ ] **Step 2: Write a small test for the resolution helper**

Create `tests/unit/3d/state/performer-prop-resolution.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolvePerformerProp } from "$lib/shared/3d/state/performer-prop-resolution";

describe("resolvePerformerProp", () => {
  it("returns the performer's own prop setting", () => {
    const performer = { id: "p1", settings: { prop: "FAN" } } as any;
    expect(resolvePerformerProp(performer, "STAFF")).toBe("FAN");
  });

  it("returns the global fallback when performer settings are absent", () => {
    expect(resolvePerformerProp(null, "STAFF")).toBe("STAFF");
  });
});
```

- [ ] **Step 3: Run test; confirm fail**

Run: `npx vitest run tests/unit/3d/state/performer-prop-resolution.test.ts`
Expected: fails — helper does not exist.

- [ ] **Step 4: Create the helper**

Create `src/lib/shared/3d/state/performer-prop-resolution.ts`:

```ts
import type { AvatarInstanceState } from "./avatar-instance-state.svelte";
import type { PropType } from "$lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry";

export function resolvePerformerProp(
  performer: AvatarInstanceState | null | undefined,
  globalFallback: PropType,
): PropType {
  return performer?.settings.prop ?? globalFallback;
}
```

- [ ] **Step 5: Rewire the renderer's prop read site**

At each site identified in Step 1, replace the global read with:

```svelte
<script lang="ts">
  import { resolvePerformerProp } from "$lib/shared/3d/state/performer-prop-resolution";
  // ...
  const propType = $derived(resolvePerformerProp(performer, globalPropType));
</script>
```

`performer` is whatever `AvatarInstanceState` the component already has access to (each 3D figure component is constructed with one). `globalPropType` is the existing read — keep it as the fallback.

- [ ] **Step 6: Run tests + build check**

```bash
npx vitest run tests/unit/3d/state/performer-prop-resolution.test.ts
npm run check
```

Expected: tests pass, no new type errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/3d/state/performer-prop-resolution.ts src/lib/shared/3d/components/ tests/unit/3d/state/performer-prop-resolution.test.ts
git commit -m "feat(viewer-3d): renderer reads prop from per-performer settings"
```

---

### Task 7: Per-performer effects — wire EffectsSettingsPanel data source

**Files:**
- Modify: `src/lib/shared/3d/components/controls/EffectsSettingsPanel.svelte`
- Test: `tests/unit/3d/state/avatar-instance-state-settings.test.ts` (extend existing)

**Context:** `EffectsSettingsPanel` currently reads from the global `getEffectsConfigState()` (line 12). Per spec §7.4 and the Component Reuse Contract, we change it to accept a `performer` prop and read/write that performer's `settings.effects` set. The panel keeps its 8-effect list, chip layout, and double-click-to-expand param drawer unchanged (only the data source changes). The `tipEffectMap` synchronization rule from memory must continue to be upheld — if the existing panel already updates `tipEffectMap`, preserve that call and adapt it to per-performer scope.

- [ ] **Step 1: Read the current panel**

Read `src/lib/shared/3d/components/controls/EffectsSettingsPanel.svelte` lines 1-80. Note: the 6-effect list (lines 15-22) needs LED added and already contains Zap/Sparkles/Motion/Bloom. Keep all 8.

- [ ] **Step 2: Add LED to the effect list**

In `EffectsSettingsPanel.svelte` around lines 15-22, add LED alongside the existing 6:

```ts
  const effectChips = [
    { key: "trails", label: "Trails", icon: "route", color: "#a855f7" },
    { key: "fire", label: "Fire", icon: "fire", color: "#f97316" },
    { key: "charcoal", label: "Charcoal", icon: "pen-nib", color: "#78716c" },
    { key: "led", label: "LED", icon: "lightbulb", color: "#4ade80" },
    { key: "electricity", label: "Zap", icon: "bolt", color: "#38bdf8" },
    { key: "sparkles", label: "Sparkles", icon: "star", color: "#fbbf24" },
    { key: "motion", label: "Motion", icon: "wind", color: "#22d3ee" },
    { key: "bloom", label: "Glow", icon: "sun", color: "#f472b6" },
  ];
```

- [ ] **Step 3: Add `performer` prop + switch data source**

At the top of the `<script>`, add a `performer` prop (optional — when absent, fall back to global behavior for backward compat with any other consumer):

```ts
  import type { AvatarInstanceState } from "$lib/shared/3d/state/avatar-instance-state.svelte";
  import type { EffectId } from "$lib/shared/3d/state/performer-settings-types";

  interface Props {
    performer?: AvatarInstanceState | null;
  }
  let { performer = null }: Props = $props();
```

Replace the `isEnabled` and toggle handlers to use performer settings when provided:

```ts
  function isEnabled(key: EffectId): boolean {
    if (performer) return performer.settings.effects.has(key);
    // Fallback to existing global getEffectsConfigState() read
    return config[key]?.enabled ?? false;
  }

  function handleToggle(key: EffectId): void {
    if (performer) {
      performer.toggleEffect(key);
      return;
    }
    // Fallback: existing global toggle behavior (preserve whatever the panel does today)
  }
```

Keep the existing double-click-to-expand param drawer and Trails sub-controls intact. Those still read from the global config (param tuning isn't per-performer per spec §6.3).

- [ ] **Step 4: Preserve tipEffectMap sync**

Find any `tipEffectMap` update call in the current panel or in related state. Ensure that when `performer.toggleEffect(...)` is called, `tipEffectMap` still reflects the new active-effect set for that performer. If the current flow updates `tipEffectMap` via the global config, add a matching per-performer update call. If none exists, add a TODO comment referencing `feedback_tipeffectmap_sync` and ask the user before merging.

- [ ] **Step 5: Run `npm run check`**

Expected: no new type errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/3d/components/controls/EffectsSettingsPanel.svelte
git commit -m "feat(3d-effects): EffectsSettingsPanel accepts per-performer prop, adds LED, keeps 8 total"
```

---

## Phase 1 — Chrome removals (strip the bad)

Everything here is deletion. No new UI. Completes the "clean canvas" precondition for Phase 2.

---

### Task 8: Remove RenderModeToggle from ViewerFooter

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ViewerFooter.svelte`

**Context:** Per spec §6.1 and §11 #2, the 2D/3D toggle has one home — the header. Footer no longer owns it.

- [ ] **Step 1: Remove the import and mount**

In `ViewerFooter.svelte`:
- Delete the `RenderModeToggle` import (around line 24).
- Delete the `<RenderModeToggle ... />` mount from the markup.
- Delete any now-unused props (`renderMode`, `webgl2Available`, `onRenderModeChange`) if they were only used by that mount — leave them if they flow to other children.

- [ ] **Step 2: Run `npm run check`**

Expected: no callers of `ViewerFooter`'s removed props break. If they do, update call sites to stop passing those props.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ViewerFooter.svelte
git commit -m "refactor(sequence-viewer): remove 2D/3D toggle from ViewerFooter (moves to header)"
```

---

### Task 9: Remove RenderModeToggle from RecordSceneChrome

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/record-scene/RecordSceneChrome.svelte`

**Context:** Same reason as Task 8. RecordSceneChrome also owns Playback/Export popovers today; those stay for now — Task 10 replaces them via rail popovers, and we'll delete them in Task 22 once the rail is wired.

- [ ] **Step 1: Remove the import and mount**

In `RecordSceneChrome.svelte` around line 23, delete the `RenderModeToggle` import and mount.

- [ ] **Step 2: Remove the "Record Scene" title literal**

Search the file for the string literal `"Record Scene"`. Delete the element that renders it (usually a `<span>` or `<h2>` in the top-left). The sequence title will appear in the new header (Task 13), so no replacement is needed here.

- [ ] **Step 3: Run `npm run check`**

Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/record-scene/RecordSceneChrome.svelte
git commit -m "refactor(record-scene): remove 2D/3D toggle and 'Record Scene' label from chrome"
```

---

### Task 10: Remove NavModeToggle mount from Viewer3DCanvas

**Files:**
- Modify: `src/lib/shared/3d/components/Viewer3DCanvas.svelte`

**Context:** Per spec §6.5, the fly/walk/orbit chip cluster is removed from the Viewer entirely (component stays in codebase for future Stage). `Viewer3DCanvas.svelte` mounts it at ~line 23.

- [ ] **Step 1: Remove the import and mount**

In `Viewer3DCanvas.svelte`:
- Delete the `NavModeToggle` import (around line 23 of the `<script>`).
- Delete the `<NavModeToggle ... />` mount from the markup.
- **Do not delete the NavModeToggle component file.** It stays for Stage.

- [ ] **Step 2: Run `npm run check`**

Expected: no type errors. If `NavModeToggle` was the only consumer of some navModeState, that state still has consumers elsewhere (Stage will use it). Leave the state untouched.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/components/Viewer3DCanvas.svelte
git commit -m "refactor(viewer-3d): unmount NavModeToggle from canvas (orbit-only in Viewer)"
```

---

## Phase 2 — New chrome shells

Four new components. After this phase the user sees a header with badge/title/info chip, a right rail with four chips, and a bottom transport bar. Popovers are empty placeholders wired to the popover-stack.

---

### Task 11: DestinationBadge component

**Files:**
- Create: `src/lib/shared/sequence-viewer/components/DestinationBadge.svelte`

**Context:** Small pill that reads "VIEWER" (or in future, "STAGE"). Per spec §6.1, it is designed so Stage can reuse it with a different label and accent color later.

- [ ] **Step 1: Create the component**

Create `src/lib/shared/sequence-viewer/components/DestinationBadge.svelte`:

```svelte
<script lang="ts">
  interface Props {
    label: "VIEWER" | "STAGE";
    accent?: string; // CSS color; defaults to the viewer blue
  }
  let { label, accent = "#4a9eff" }: Props = $props();
</script>

<span class="badge" style:--badge-accent={accent} aria-label="Destination: {label}">
  {label}
</span>

<style>
  .badge {
    padding: 4px 10px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--badge-accent) 16%, transparent);
    border: 1px solid color-mix(in srgb, var(--badge-accent) 36%, transparent);
    color: color-mix(in srgb, var(--badge-accent) 85%, white);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.10em;
    line-height: 1;
    display: inline-block;
  }
</style>
```

- [ ] **Step 2: Run `npm run check`**

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/DestinationBadge.svelte
git commit -m "feat(sequence-viewer): add DestinationBadge pill (VIEWER/STAGE)"
```

---

### Task 12: InfoChipPopover component

**Files:**
- Create: `src/lib/shared/sequence-viewer/components/InfoChipPopover.svelte`

**Context:** Per spec §10, a small `i` chip in the header opens a popover with the "Sequence Viewer vs Stage" explainer. It participates in the popover-stack (closes other popovers when opened). The "Open in Stage" link calls the same stub action as the Gear's bridge button.

- [ ] **Step 1: Create the component**

Create `src/lib/shared/sequence-viewer/components/InfoChipPopover.svelte`:

```svelte
<script lang="ts">
  import { getViewer3DContext } from "$lib/shared/3d/context/viewer-3d-context";
  import { scale } from "svelte/transition";
  import { backOut, cubicOut } from "svelte/easing";

  const viewer = getViewer3DContext();
  const open = $derived(viewer.activePopover === "info");

  function toggle(e: MouseEvent) {
    e.stopPropagation();
    viewer.openPopover(open ? null : "info");
  }

  function openStageStub() {
    // Spec §8.4 — stub action until Stage ships.
    console.log("[stub] Stage destination not yet built");
  }
</script>

<div class="info-root">
  <button
    class="info-chip"
    onclick={toggle}
    aria-label="About this destination"
    aria-expanded={open}
    aria-haspopup="dialog"
  >
    <i class="fas fa-info"></i>
  </button>

  {#if open}
    <div
      class="info-popover"
      role="dialog"
      aria-label="Destination explainer"
      in:scale={{ duration: 220, start: 0.92, opacity: 0, easing: backOut }}
      out:scale={{ duration: 160, start: 0.95, opacity: 0, easing: cubicOut }}
    >
      <h3>Sequence Viewer</h3>
      <p>Watch one sequence, performed by 1 to N versions of you, each with their own effort, prop, and effects. Same choreography, different interpretations.</p>
      <p class="aside">
        Want different sequences per performer, with timing and music?
        <button class="link" onclick={openStageStub}>Open in Stage →</button>
      </p>
    </div>
  {/if}
</div>

<style>
  .info-root { position: relative; }
  .info-chip {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border-radius: 10px;
    border: 1px solid var(--theme-stroke, rgba(255,255,255,0.12));
    background: transparent;
    color: var(--theme-text-dim, rgba(255,255,255,0.62));
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px;
  }
  .info-chip:hover { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.95); }
  .info-popover {
    position: absolute; top: calc(100% + 8px); right: 0;
    width: 320px;
    padding: 16px 18px;
    background: rgba(20, 22, 32, 0.9);
    backdrop-filter: blur(22px) saturate(140%);
    border: 1px solid rgba(255,255,255,0.18);
    border-radius: 14px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.55);
    color: rgba(255,255,255,0.92);
    font-size: 13px;
    line-height: 1.55;
    z-index: 100;
  }
  .info-popover h3 { margin: 0 0 6px 0; font-size: 13px; font-weight: 700; }
  .info-popover p { margin: 0 0 8px 0; }
  .info-popover p.aside { color: rgba(255,255,255,0.68); font-size: 12px; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.08); }
  .link {
    background: none; border: none; padding: 0;
    color: #8fc3ff;
    text-decoration: underline;
    cursor: pointer;
    font: inherit;
  }
</style>
```

- [ ] **Step 2: Run `npm run check`**

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/InfoChipPopover.svelte
git commit -m "feat(sequence-viewer): add InfoChipPopover with Viewer vs Stage explainer"
```

---

### Task 13: ViewerHeader three-region layout

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ViewerHeader.svelte`

**Context:** Per spec §6.1, three balanced regions: left = Back + 2D/3D toggle, center = VIEWER badge + sequence title, right = info chip. This replaces the existing minimal header.

- [ ] **Step 1: Rewrite the header markup**

In `ViewerHeader.svelte`, replace the body with:

```svelte
<script lang="ts">
  import DestinationBadge from "./DestinationBadge.svelte";
  import InfoChipPopover from "./InfoChipPopover.svelte";
  import RenderModeToggle from "$lib/shared/3d/components/controls/RenderModeToggle.svelte";
  // Use whatever the existing path is; adjust if the toggle lives elsewhere.

  interface Props {
    sequenceTitle: string;
    renderMode: "2d" | "3d";
    onRenderModeChange: (mode: "2d" | "3d") => void;
    onBack: () => void;
  }
  let { sequenceTitle, renderMode, onRenderModeChange, onBack }: Props = $props();
</script>

<header class="viewer-header">
  <div class="header-left">
    <button class="icon-btn" onclick={onBack} aria-label="Back">
      <i class="fas fa-chevron-left"></i>
      <span>Back</span>
    </button>
    <RenderModeToggle {renderMode} {onRenderModeChange} />
  </div>

  <div class="header-center">
    <DestinationBadge label="VIEWER" />
    <span class="seq-title">{sequenceTitle}</span>
  </div>

  <div class="header-right">
    <InfoChipPopover />
  </div>
</header>

<style>
  .viewer-header {
    position: absolute;
    top: 12px; left: 12px; right: 12px;
    height: var(--min-touch-target);
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 8px 0 6px;
    background: rgba(20, 22, 32, 0.78);
    backdrop-filter: blur(20px) saturate(140%);
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 14px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    z-index: 10;
  }
  .header-left, .header-right { display: flex; align-items: center; gap: 6px; }
  .header-center {
    display: flex; align-items: center; gap: 10px;
    position: absolute; left: 50%; transform: translateX(-50%);
  }
  .icon-btn {
    height: var(--min-touch-target);
    min-width: var(--min-touch-target);
    padding: 0 12px;
    background: transparent; border: none; border-radius: 10px;
    color: rgba(255,255,255,0.62);
    font-size: 13px; font-weight: 500;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 6px;
  }
  .icon-btn:hover { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.95); }
  .seq-title { color: rgba(255,255,255,0.95); font-size: 14px; font-weight: 600; }
</style>
```

- [ ] **Step 2: Update call site to pass new props**

Find where `ViewerHeader` is mounted (likely `SequenceViewerOrchestrator.svelte`). Pass `sequenceTitle`, `renderMode`, `onRenderModeChange`, `onBack`. The old props (`isExportMode`, `darkMode`, etc.) can be dropped unless they were actually driving behavior — verify by reading the existing header before this task and preserving anything load-bearing.

- [ ] **Step 3: Run `npm run check`**

Fix import paths for `RenderModeToggle` — grep for `RenderModeToggle.svelte` to find its real location.

- [ ] **Step 4: Browser smoke check**

Open the viewer in a browser (user's dev server on 5173, navigate to any sequence). Verify: header shows Back · 2D/3D toggle · VIEWER badge + title · info chip. No "Record Scene" label. No duplicate 2D/3D toggle in the footer.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ViewerHeader.svelte
git commit -m "feat(sequence-viewer): header three-region layout with VIEWER badge + info chip"
```

---

### Task 14: RightRail component (shell, chips only, no popover content)

**Files:**
- Create: `src/lib/shared/sequence-viewer/components/RightRail.svelte`

**Context:** Per spec §6.2, four icon-only chips with tooltips. Chips call `viewer.openPopover(id)`. Popover content is mounted as children of each chip (separate tasks will build PerformerPopover, TempoPopover, ExportPopover, and the Gear popover content). For now this task delivers the rail shell + chip click wiring.

- [ ] **Step 1: Create the component**

Create `src/lib/shared/sequence-viewer/components/RightRail.svelte`:

```svelte
<script lang="ts">
  import { getViewer3DContext, type PopoverId } from "$lib/shared/3d/context/viewer-3d-context";

  const viewer = getViewer3DContext();

  interface Chip { id: PopoverId; icon: string; tooltip: string; }
  const CHIPS: Chip[] = [
    { id: "performers", icon: "fa-users", tooltip: "Performers" },
    { id: "tempo",      icon: "fa-drum",  tooltip: "Tempo" },
    { id: "export",     icon: "fa-film",  tooltip: "Export" },
    { id: "gear",       icon: "fa-gear",  tooltip: "Settings" },
  ];

  function onClick(id: PopoverId) {
    viewer.openPopover(viewer.activePopover === id ? null : id);
  }
</script>

<div class="right-rail" role="toolbar" aria-label="Viewer controls">
  {#each CHIPS as chip (chip.id)}
    <button
      class="rail-chip"
      aria-pressed={viewer.activePopover === chip.id}
      aria-label={chip.tooltip}
      data-tooltip={chip.tooltip}
      onclick={() => onClick(chip.id)}
    >
      <i class="fas {chip.icon}"></i>
    </button>
  {/each}
</div>

<style>
  .right-rail {
    position: absolute; top: 76px; right: 12px;
    display: flex; flex-direction: column; gap: 8px;
    z-index: 9;
  }
  .rail-chip {
    width: 56px; height: 56px;
    background: rgba(20, 22, 32, 0.78);
    backdrop-filter: blur(20px) saturate(140%);
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 14px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    color: rgba(255,255,255,0.62);
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    position: relative;
    transition: all 180ms cubic-bezier(0.2, 0, 0.13, 1.5);
  }
  .rail-chip:hover::after {
    content: attr(data-tooltip);
    position: absolute; right: calc(100% + 10px); top: 50%; transform: translateY(-50%);
    background: rgba(0,0,0,0.85); color: white;
    padding: 6px 10px; border-radius: 8px;
    font-size: 11px; font-weight: 600; letter-spacing: 0.04em;
    white-space: nowrap; pointer-events: none;
  }
  .rail-chip[aria-pressed="true"] {
    background: color-mix(in srgb, #4a9eff 18%, transparent);
    border-color: color-mix(in srgb, #4a9eff 50%, transparent);
    color: #8fc3ff;
    box-shadow: 0 4px 20px color-mix(in srgb, #4a9eff 25%, transparent);
  }
  .rail-chip i { font-size: 22px; }
</style>
```

Export `PopoverId` from `viewer-3d-context.ts` if not already exported (it was defined in `viewer-3d-state.svelte.ts` in Task 2 — make sure it's re-exported from the context file too).

- [ ] **Step 2: Mount the rail on Viewer3DCanvas**

In `src/lib/shared/3d/components/Viewer3DCanvas.svelte`, add `<RightRail />` near where `NavModeToggle` used to mount (inside the overlay layer):

```svelte
<script lang="ts">
  import RightRail from "$lib/shared/sequence-viewer/components/RightRail.svelte";
  // ...
</script>

<!-- existing canvas setup -->
<RightRail />
```

- [ ] **Step 3: Run `npm run check` + browser smoke**

Expected: rail shows on the right, clicking each chip toggles `aria-pressed`. No popover content yet (next tasks).

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/RightRail.svelte src/lib/shared/3d/components/Viewer3DCanvas.svelte
git commit -m "feat(sequence-viewer): right-rail shell with 4 icon-only chips"
```

---

### Task 15: Bottom transport bar

**Files:**
- Create: `src/lib/shared/sequence-viewer/components/ViewerTransportBar.svelte`
- Modify: `src/lib/shared/3d/components/Viewer3DCanvas.svelte` (mount)

**Context:** Per spec §6.7, always-visible transport: play/pause (48px primary), scrubber with beat markers, loop toggle. Auto-hide after ~2s idle; reappears on any mouse/keyboard input.

- [ ] **Step 1: Create the component**

Create `src/lib/shared/sequence-viewer/components/ViewerTransportBar.svelte`:

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  // The existing playback controller — find the real context getter and import it.
  // Placeholder name used below; fix during first run.
  import { getPlaybackController } from "$lib/shared/sequence-viewer/context/playback-context";

  const playback = getPlaybackController();

  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let visible = $state(true);

  function ping() {
    visible = true;
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { visible = false; }, 2000);
  }

  onMount(() => {
    const handler = () => ping();
    window.addEventListener("mousemove", handler);
    window.addEventListener("keydown", handler);
    ping();
    return () => {
      window.removeEventListener("mousemove", handler);
      window.removeEventListener("keydown", handler);
      if (idleTimer) clearTimeout(idleTimer);
    };
  });

  function onScrub(e: MouseEvent) {
    const el = e.currentTarget as HTMLDivElement;
    const rect = el.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    playback.seekRatio(Math.max(0, Math.min(1, ratio)));
  }
</script>

{#if visible}
  <div class="transport" role="group" aria-label="Playback transport">
    <button
      class="transport-play"
      onclick={() => playback.togglePlayPause()}
      aria-label={playback.isPlaying ? "Pause" : "Play"}
    >
      <i class="fas {playback.isPlaying ? 'fa-pause' : 'fa-play'}"></i>
    </button>

    <span class="transport-time">
      {playback.currentTimeLabel} / {playback.totalTimeLabel}
    </span>

    <div class="transport-scrubber" onclick={onScrub} role="slider"
         aria-label="Playback progress"
         aria-valuemin="0" aria-valuemax="100"
         aria-valuenow={Math.round(playback.progress * 100)}>
      <div class="fill" style:width="{playback.progress * 100}%"></div>
      {#each playback.beatMarkers as pct}
        <div class="beat-marker" style:left="{pct * 100}%"></div>
      {/each}
      <div class="knob" style:left="{playback.progress * 100}%"></div>
    </div>

    <button
      class="transport-loop"
      aria-pressed={playback.loop}
      aria-label="Loop {playback.loop ? 'on' : 'off'}"
      onclick={() => playback.toggleLoop()}
    >
      <i class="fas fa-sync"></i>
    </button>
  </div>
{/if}

<style>
  .transport {
    position: absolute;
    bottom: 18px; left: 50%; transform: translateX(-50%);
    display: flex; align-items: center; gap: 12px;
    padding: 8px 14px;
    background: rgba(20, 22, 32, 0.78);
    backdrop-filter: blur(24px) saturate(150%);
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 999px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
    min-width: 520px; max-width: 720px;
    z-index: 8;
  }
  .transport-play {
    width: 48px; height: 48px;
    border-radius: 50%;
    background: #4a9eff;
    border: 1px solid color-mix(in srgb, #4a9eff 70%, white);
    color: white;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-size: 16px;
    flex-shrink: 0;
    box-shadow: 0 4px 14px color-mix(in srgb, #4a9eff 40%, transparent);
  }
  .transport-time {
    font-size: 11px; font-weight: 700;
    color: rgba(255,255,255,0.62);
    font-variant-numeric: tabular-nums;
    min-width: 100px; text-align: center;
  }
  .transport-scrubber {
    flex: 1; height: 6px;
    background: rgba(255,255,255,0.08);
    border-radius: 999px;
    position: relative;
    min-width: 200px;
    cursor: pointer;
  }
  .transport-scrubber .fill { position: absolute; left: 0; top: 0; height: 100%; background: #4a9eff; border-radius: 999px; }
  .transport-scrubber .knob { position: absolute; top: 50%; width: 16px; height: 16px; border-radius: 50%; background: white; transform: translate(-50%, -50%); box-shadow: 0 2px 8px rgba(0,0,0,0.6); }
  .beat-marker { position: absolute; top: -2px; width: 2px; height: 10px; background: rgba(255,255,255,0.25); border-radius: 1px; transform: translateX(-50%); }
  .transport-loop {
    width: var(--min-touch-target); height: var(--min-touch-target);
    border-radius: 50%;
    background: color-mix(in srgb, #4a9eff 22%, transparent);
    border: 1px solid color-mix(in srgb, #4a9eff 50%, transparent);
    color: #8fc3ff;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px;
  }
  .transport-loop[aria-pressed="false"] { background: transparent; color: rgba(255,255,255,0.4); border-color: rgba(255,255,255,0.12); }
</style>
```

- [ ] **Step 2: Wire the playback controller**

The `getPlaybackController()` import is a placeholder. Find the real playback state source — search for `isPlaying`, `togglePlayPause`, `seek` in the codebase. Likely candidates: `src/lib/shared/sequence-viewer/state/` or `SequenceViewerOrchestrator.svelte`. Adapt the import and API calls (`togglePlayPause`, `seekRatio`, `toggleLoop`, `isPlaying`, `progress`, `beatMarkers`, `currentTimeLabel`, `totalTimeLabel`, `loop`) to match the real API. If the real API lacks any of these, add them to the playback state module (each missing method is ~3 lines and trivial to add with a small unit test).

- [ ] **Step 3: Mount on Viewer3DCanvas**

In `Viewer3DCanvas.svelte`, add `<ViewerTransportBar />` next to `<RightRail />`.

- [ ] **Step 4: Run `npm run check` + browser smoke**

Expected: transport bar shows at the bottom center, play/pause works, scrubber seeks.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ViewerTransportBar.svelte src/lib/shared/3d/components/Viewer3DCanvas.svelte
git commit -m "feat(sequence-viewer): always-visible bottom transport bar with auto-hide"
```

---

## Phase 3 — Popover content

Four popovers live in the rail chips. Each is its own component. Each reuses existing reusables aggressively.

---

### Task 16: TempoPopover (wraps BpmChips)

**Files:**
- Create: `src/lib/shared/sequence-viewer/components/TempoPopover.svelte`
- Modify: `src/lib/shared/sequence-viewer/components/RightRail.svelte` (mount)

**Context:** Per spec §6.2, Tempo = BPM only. No FPS. Wrap the existing `BpmChips` full variant.

- [ ] **Step 1: Create the popover**

Create `src/lib/shared/sequence-viewer/components/TempoPopover.svelte`:

```svelte
<script lang="ts">
  import { getViewer3DContext } from "$lib/shared/3d/context/viewer-3d-context";
  import BpmChips from "$lib/features/compose/components/controls/BpmChips.svelte";
  import { scale } from "svelte/transition";
  import { backOut, cubicOut } from "svelte/easing";

  const viewer = getViewer3DContext();
  const open = $derived(viewer.activePopover === "tempo");
</script>

{#if open}
  <div
    class="pop"
    role="dialog"
    aria-label="Tempo"
    in:scale={{ duration: 220, start: 0.92, opacity: 0, easing: backOut }}
    out:scale={{ duration: 160, start: 0.95, opacity: 0, easing: cubicOut }}
  >
    <div class="pop-header">Tempo</div>
    <div class="pop-body">
      <BpmChips variant="full" />
    </div>
  </div>
{/if}

<style>
  .pop {
    position: absolute; right: calc(100% + 10px); top: 0;
    width: 340px;
    background: rgba(20, 22, 32, 0.82);
    backdrop-filter: blur(24px) saturate(150%);
    border: 1px solid rgba(255,255,255,0.18);
    border-radius: 18px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
    overflow: hidden;
    z-index: 100;
  }
  .pop-header { padding: 14px 16px 10px; border-bottom: 1px solid rgba(255,255,255,0.10); font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.42); }
  .pop-body { padding: 14px 16px 16px; }
</style>
```

- [ ] **Step 2: Mount in RightRail**

In `RightRail.svelte`, wrap the Tempo chip in a relative container and add the popover as a sibling:

```svelte
<script lang="ts">
  import TempoPopover from "./TempoPopover.svelte";
  // ...
</script>

<!-- For each chip, wrap it so the popover positions relative to it. Example for tempo: -->
<div class="chip-wrap">
  <button class="rail-chip" ...>...</button>
  <TempoPopover />
</div>
```

Or: render all popovers in the RightRail body once and let each one position itself relative to the viewport/rail. Choose whichever is cleaner given the existing layout.

- [ ] **Step 3: Build check + browser smoke**

Click the Tempo chip. Verify: popover opens, shows BPM controls. Click another chip — Tempo closes (popover-stack exclusivity).

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/TempoPopover.svelte src/lib/shared/sequence-viewer/components/RightRail.svelte
git commit -m "feat(sequence-viewer): TempoPopover wraps BpmChips full variant"
```

---

### Task 17: ExportPopover

**Files:**
- Create: `src/lib/shared/sequence-viewer/components/ExportPopover.svelte`
- Modify: `src/lib/shared/sequence-viewer/components/RightRail.svelte`
- Modify: `src/lib/shared/sequence-viewer/state/export-options-state.svelte.ts` (if any field needs defaults changed)

**Context:** Per spec §6.2 #3, export fields: Resolution (720/1080/4K/8K), Quality (Standard/Cinema), FPS (30/60/120), Advanced (loopCount, collapsed). **NO start-position, NO end-hold** — those are 2D-viewer features. Record button kicks off the existing 3D recording pipeline. Reuse `export-options-state.svelte.ts` as the data source (it already defines `VideoExportOptions`).

- [ ] **Step 1: Create the popover**

Create `src/lib/shared/sequence-viewer/components/ExportPopover.svelte`:

```svelte
<script lang="ts">
  import { getViewer3DContext } from "$lib/shared/3d/context/viewer-3d-context";
  import { getExportOptions } from "$lib/shared/sequence-viewer/state/export-options-state.svelte";
  import { scale } from "svelte/transition";
  import { backOut, cubicOut } from "svelte/easing";

  const viewer = getViewer3DContext();
  const open = $derived(viewer.activePopover === "export");

  const opts = getExportOptions();
  let advancedOpen = $state(false);

  const RESOLUTIONS = [720, 1080, 2160, 4320];
  function resLabel(r: number) { return r === 2160 ? "4K" : r === 4320 ? "8K" : String(r); }
  const QUALITY = ["standard", "cinema"] as const;
  const FPS = [30, 60, 120];

  // Spec §8.4 stub for the Record button — replace with real recorder call when wired.
  function record() {
    console.log("[stub] 3D record triggered with opts:", $state.snapshot(opts));
  }
</script>

{#if open}
  <div class="pop" role="dialog" aria-label="Export"
       in:scale={{ duration: 220, start: 0.92, opacity: 0, easing: backOut }}
       out:scale={{ duration: 160, start: 0.95, opacity: 0, easing: cubicOut }}>
    <div class="pop-header">Export</div>
    <div class="pop-body">
      <div class="row">
        <span class="label">Resolution</span>
        <div class="chips">
          {#each RESOLUTIONS as r}
            <button class="chip" aria-pressed={opts.resolution === r} onclick={() => opts.setResolution(r)}>{resLabel(r)}</button>
          {/each}
        </div>
      </div>
      <div class="row">
        <span class="label">Quality</span>
        <div class="chips">
          {#each QUALITY as q}
            <button class="chip" aria-pressed={opts.quality === q} onclick={() => opts.setQuality(q)}>{q === "standard" ? "Standard" : "Cinema"}</button>
          {/each}
        </div>
      </div>
      <div class="row">
        <span class="label">FPS</span>
        <div class="chips">
          {#each FPS as f}
            <button class="chip" aria-pressed={opts.fps === f} onclick={() => opts.setFps(f)}>{f}</button>
          {/each}
        </div>
      </div>

      <button class="advanced" onclick={() => advancedOpen = !advancedOpen} aria-expanded={advancedOpen}>
        Advanced (loop count)
      </button>
      {#if advancedOpen}
        <div class="row">
          <span class="label">Loops</span>
          <input type="number" min="1" max="99" bind:value={opts.loopCount} class="loops-input" />
        </div>
      {/if}

      <button class="record-btn" onclick={record}>
        <i class="fas fa-circle" style="color: #ff5555;"></i> Record
      </button>
    </div>
  </div>
{/if}

<style>
  .pop {
    position: absolute; right: calc(100% + 10px); top: 0;
    width: 340px;
    background: rgba(20, 22, 32, 0.82);
    backdrop-filter: blur(24px) saturate(150%);
    border: 1px solid rgba(255,255,255,0.18);
    border-radius: 18px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.55);
    overflow: hidden;
    z-index: 100;
  }
  .pop-header { padding: 14px 16px 10px; border-bottom: 1px solid rgba(255,255,255,0.10); font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.42); }
  .pop-body { padding: 14px 16px 16px; }
  .row { display: flex; justify-content: space-between; align-items: center; min-height: var(--min-touch-target); padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.04); gap: 10px; }
  .row:last-child { border-bottom: 0; }
  .label { font-size: 13px; color: rgba(255,255,255,0.62); font-weight: 500; }
  .chips { display: flex; gap: 4px; }
  .chip { min-height: 32px; min-width: 44px; padding: 0 10px; background: rgba(28,30,42,0.72); border: 1px solid rgba(255,255,255,0.10); border-radius: 8px; color: rgba(255,255,255,0.62); font-size: 11px; font-weight: 600; cursor: pointer; }
  .chip[aria-pressed="true"] { background: #4a9eff; border-color: #4a9eff; color: white; }
  .advanced { width: 100%; padding: 10px; background: transparent; border: 1px dashed rgba(255,255,255,0.10); border-radius: 10px; color: rgba(255,255,255,0.42); font-size: 12px; font-weight: 600; cursor: pointer; margin-top: 10px; }
  .loops-input { width: 80px; padding: 6px 10px; background: rgba(28,30,42,0.72); border: 1px solid rgba(255,255,255,0.10); border-radius: 8px; color: rgba(255,255,255,0.95); font-family: ui-monospace, monospace; text-align: right; }
  .record-btn {
    width: 100%; min-height: var(--min-touch-target);
    background: #4a9eff; border: 1px solid color-mix(in srgb, #4a9eff 70%, white);
    border-radius: 12px; color: white; font-size: 14px; font-weight: 700;
    cursor: pointer; margin-top: 14px;
    display: flex; align-items: center; justify-content: center; gap: 8px;
  }
</style>
```

- [ ] **Step 2: Verify `getExportOptions()` API**

Check `src/lib/shared/sequence-viewer/state/export-options-state.svelte.ts` for the actual method names (`setResolution`, `setQuality`, `setFps`, field names). Adjust the popover to match real names. If methods don't exist, prefer adding simple setters to that state module rather than mutating fields directly from the component.

- [ ] **Step 3: Mount in RightRail**

Add `<ExportPopover />` next to the Export chip.

- [ ] **Step 4: Build check + browser smoke**

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ExportPopover.svelte src/lib/shared/sequence-viewer/components/RightRail.svelte src/lib/shared/sequence-viewer/state/export-options-state.svelte.ts
git commit -m "feat(sequence-viewer): ExportPopover with real options (no start/end in 3D)"
```

---

### Task 18: PerformerPopover (chip strip + 3 sub-tabs)

**Files:**
- Create: `src/lib/shared/sequence-viewer/components/PerformerPopover.svelte`
- Modify: `src/lib/shared/sequence-viewer/components/RightRail.svelte`

**Context:** Per spec §6.3, the unified per-performer surface. Top: `PerformerChipStrip` (existing component, reused as-is). Below: tab bar with Prop / Effects / Effort. Each sub-tab mounts the appropriate existing component wired to the selected performer.

- [ ] **Step 1: Create the popover**

Create `src/lib/shared/sequence-viewer/components/PerformerPopover.svelte`:

```svelte
<script lang="ts">
  import { getViewer3DContext } from "$lib/shared/3d/context/viewer-3d-context";
  import PerformerChipStrip from "$lib/shared/3d/components/controls/PerformerChipStrip.svelte";
  import BentoPropGrid from "$lib/shared/settings/components/tabs/prop-type/BentoPropGrid.svelte";
  import EffectsSettingsPanel from "$lib/shared/3d/components/controls/EffectsSettingsPanel.svelte";
  import EffortPalette from "$lib/features/phrase-effort-lab/components/EffortPalette.svelte";
  import { scale } from "svelte/transition";
  import { backOut, cubicOut } from "svelte/easing";

  const viewer = getViewer3DContext();
  const open = $derived(viewer.activePopover === "performers");

  type TabId = "prop" | "effects" | "effort";
  let activeTab = $state<TabId>("effort");

  const selected = $derived(viewer.performerManager.performers[viewer.selectedPerformerIndex] ?? null);
</script>

{#if open}
  <div class="pop" role="dialog" aria-label="Performers"
       in:scale={{ duration: 220, start: 0.92, opacity: 0, easing: backOut }}
       out:scale={{ duration: 160, start: 0.95, opacity: 0, easing: cubicOut }}>
    <div class="pop-header">
      <div class="pop-title">Performers</div>
      <PerformerChipStrip />
    </div>

    <div class="pop-body">
      <div class="tabbar" role="tablist">
        <button class="tab" role="tab" aria-selected={activeTab === "prop"} onclick={() => activeTab = "prop"}>Prop</button>
        <button class="tab" role="tab" aria-selected={activeTab === "effects"} onclick={() => activeTab = "effects"}>Effects</button>
        <button class="tab" role="tab" aria-selected={activeTab === "effort"} onclick={() => activeTab = "effort"}>Effort</button>
      </div>

      {#if activeTab === "prop"}
        <BentoPropGrid
          variant="inline"
          value={selected?.settings.prop ?? "STAFF"}
          onchange={(p) => selected?.setProp(p)}
        />
      {:else if activeTab === "effects"}
        <EffectsSettingsPanel performer={selected} />
      {:else if activeTab === "effort"}
        <EffortPalette
          value={selected?.settings.effortId ?? "linear"}
          onchange={(e) => selected?.setEffort(e)}
        />
      {/if}
    </div>
  </div>
{/if}

<style>
  .pop {
    position: absolute; right: calc(100% + 10px); top: 0;
    width: 420px;
    background: rgba(20, 22, 32, 0.82);
    backdrop-filter: blur(24px) saturate(150%);
    border: 1px solid rgba(255,255,255,0.18);
    border-radius: 18px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.55);
    overflow: hidden;
    z-index: 100;
  }
  .pop-header { padding: 14px 16px 10px; border-bottom: 1px solid rgba(255,255,255,0.10); }
  .pop-title { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.42); margin-bottom: 10px; }
  .pop-body { padding: 14px 16px 16px; }
  .tabbar { display: flex; gap: 2px; padding: 3px; border-radius: 8px; background: rgba(0,0,0,0.45); border: 1px solid rgba(255,255,255,0.10); margin-bottom: 14px; }
  .tab { flex: 1; padding: 8px 10px; min-height: var(--min-touch-target); border: 1px solid transparent; border-radius: 6px; background: transparent; color: rgba(255,255,255,0.42); font-size: 11px; font-weight: 600; letter-spacing: 0.04em; cursor: pointer; text-align: center; }
  .tab[aria-selected="true"] { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.2); color: white; }
</style>
```

- [ ] **Step 2: Verify reused-component APIs**

- `BentoPropGrid`: verify it accepts `variant`, `value`, `onchange` props. If the real API differs, adapt the wrapper call above.
- `EffortPalette`: same check.
- `PerformerChipStrip`: verify it reads from the viewer context directly (it should — per the existing `Viewer3DGearPopover.svelte` it does). If it needs a `selected` prop or similar, pass it.
- `EffectsSettingsPanel`: we added a `performer` prop in Task 7 — confirm it still compiles.

For any mismatch, update the wrapper or extend the child component minimally (do not refactor the child's internals).

- [ ] **Step 3: Mount in RightRail**

Add `<PerformerPopover />` next to the Performers chip.

- [ ] **Step 4: Build check + browser smoke**

Click Performers chip → popover opens. Switch performers via the chip strip — Prop/Effects/Effort tabs reflect the selected performer's settings. Set performer 2 to a fan and performer 1 to staff — canvas shows both props simultaneously (validates Task 6 wiring too).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/PerformerPopover.svelte src/lib/shared/sequence-viewer/components/RightRail.svelte
git commit -m "feat(sequence-viewer): PerformerPopover unifies prop/effects/effort per performer"
```

---

### Task 19: SceneFeatureTiles (redesigned Scene tab)

**Files:**
- Create: `src/lib/shared/3d/scene-features/components/SceneFeatureTiles.svelte`
- Modify: `src/lib/shared/3d/components/Viewer3DGearPopover.svelte` (swap `SceneFeatureToggles` → `SceneFeatureTiles`)
- Create 5 thumbnail images at `static/images/scene-thumbs/{stage,audience,environment,campfire,tent}.png` — placeholder solid-color PNGs for now; a real-renders pass is separate follow-through.

**Context:** Per spec §6.2 (Scene tab redesign) and v8 mockup. Tile grid, thumbnail-per-feature, active glow + status dot, shimmer for async loading.

- [ ] **Step 1: Create placeholder thumbnails**

Under `static/images/scene-thumbs/`, create 5 placeholder PNGs. These can be solid-color gradients generated with any tool, or authored SVGs referenced with `.svg` extension — either works. Minimum acceptable: 240×240 images with distinct colors that hint at the feature:
- `stage.png` — warm wood-tone platform gradient
- `audience.png` — dark silhouettes on purple
- `environment.png` — horizon gradient (sky→ground)
- `campfire.png` — orange flame on dark
- `tent.png` — triangular tan shape on dark

If image generation is blocked, use inline CSS thumbnails in the component (see v8 mockup for CSS approximations) and swap to real PNGs later.

- [ ] **Step 2: Create the component**

Create `src/lib/shared/3d/scene-features/components/SceneFeatureTiles.svelte`:

```svelte
<script lang="ts">
  import { getSceneFeatureContext } from "../context/scene-feature-context";

  const sceneFeatures = getSceneFeatureContext();

  const ACCENTS: Record<string, string> = {
    stage: "#a78bfa",
    audience: "#ec4899",
    environment: "#f59e0b",
    campfire: "#f97316",
    tent: "#84cc16",
  };
</script>

<div class="tiles">
  {#each sceneFeatures.features as feature (feature.key)}
    {@const enabled = sceneFeatures.isEnabled(feature.key)}
    {@const loading = feature.requiresAsyncLoad && sceneFeatures.isLoading?.(feature.key)}
    <button
      class="tile"
      class:loading
      style:--tile-color={ACCENTS[feature.key] ?? "#888"}
      aria-pressed={enabled}
      onclick={() => sceneFeatures.toggle(feature.key)}
    >
      <div class="thumb" style:background-image="url(/images/scene-thumbs/{feature.key}.png)"></div>
      <div class="foot">
        <span class="label">{feature.label}</span>
        <span class="status"></span>
      </div>
    </button>
  {/each}
</div>

<style>
  .tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .tile {
    position: relative;
    aspect-ratio: 1;
    border-radius: 12px;
    border: 1.5px solid rgba(255,255,255,0.10);
    background: rgba(0, 0, 0, 0.35);
    padding: 0;
    cursor: pointer;
    overflow: hidden;
    display: flex; flex-direction: column;
    transition: transform 160ms cubic-bezier(0.2, 0, 0.13, 1.5), border-color 160ms, box-shadow 160ms;
  }
  .tile:hover { transform: translateY(-2px); border-color: rgba(255,255,255,0.22); }
  .thumb {
    flex: 1;
    background-size: cover; background-position: center;
    filter: saturate(0.25) brightness(0.55);
    transition: filter 160ms;
  }
  .tile[aria-pressed="true"] .thumb { filter: none; }
  .foot {
    height: 32px; padding: 0 10px;
    display: flex; align-items: center; justify-content: space-between;
    background: rgba(0, 0, 0, 0.45);
    border-top: 1px solid rgba(255,255,255,0.10);
  }
  .label { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.62); }
  .tile[aria-pressed="true"] .label { color: white; }
  .status {
    width: 8px; height: 8px; border-radius: 50%;
    background: rgba(255,255,255,0.12);
    transition: background 160ms, box-shadow 160ms;
  }
  .tile[aria-pressed="true"] {
    border-color: var(--tile-color);
    box-shadow: 0 6px 22px color-mix(in srgb, var(--tile-color) 30%, transparent), inset 0 1px 0 rgba(255,255,255,0.06);
  }
  .tile[aria-pressed="true"] .status {
    background: var(--tile-color);
    box-shadow: 0 0 10px var(--tile-color);
  }
  .tile.loading .thumb::after {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.10) 50%, transparent 100%);
    animation: shimmer 1.4s linear infinite;
  }
  @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
</style>
```

- [ ] **Step 3: Swap the Scene tab to use the new component**

In `src/lib/shared/3d/components/Viewer3DGearPopover.svelte`, change the import and mount:

```ts
// BEFORE
import SceneFeatureToggles from "../scene-features/components/SceneFeatureToggles.svelte";

// AFTER
import SceneFeatureTiles from "../scene-features/components/SceneFeatureTiles.svelte";
```

And in the Scene tab panel:

```svelte
<!-- BEFORE -->
<SceneFeatureToggles />

<!-- AFTER -->
<SceneFeatureTiles />
```

`SceneFeatureToggles.svelte` stays in the codebase in case another consumer imports it (search to confirm; if no other consumer, you can delete it, but that's a separate cleanup not required by this spec).

- [ ] **Step 4: Build check + browser smoke**

Gear → Scene tab. Verify: 5 tiles (Stage, Audience, Environment, Campfire, Tent — no Grid). Each toggles. Active tile has a glow + status dot.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/3d/scene-features/components/SceneFeatureTiles.svelte src/lib/shared/3d/components/Viewer3DGearPopover.svelte static/images/scene-thumbs/
git commit -m "feat(viewer-3d): Scene tab redesigned as tile grid (5 features, no Grid)"
```

---

### Task 20: Viewer3DGearPopover cleanup — drop Performers + Visibility tabs, add Stage bridge footer

**Files:**
- Modify: `src/lib/shared/3d/components/Viewer3DGearPopover.svelte`

**Context:** Per spec §6.2 #4, the Gear popover's tab bar shrinks from 5 to 3 (Camera / Planes / Scene). `Performers` is replaced by the rail's dedicated Performer chip. `Visibility` is removed entirely (its toggles are 2D-viewer concerns). A "Stage this scene →" bridge button is added as a footer.

- [ ] **Step 1: Edit the TABS array and panel conditionals**

In `Viewer3DGearPopover.svelte` around line 31:

```ts
// BEFORE
const TABS: { id: TabId; label: string; disabled?: boolean }[] = [
  { id: "camera", label: "Camera" },
  { id: "planes", label: "Planes" },
  { id: "performers", label: "Performers" },
  { id: "scene", label: "Scene" },
  { id: "visibility", label: "Visibility" },
];

// AFTER
type TabId = "camera" | "planes" | "scene";
const TABS: { id: TabId; label: string }[] = [
  { id: "camera", label: "Camera" },
  { id: "planes", label: "Planes" },
  { id: "scene", label: "Scene" },
];
```

Remove the `{#if activeTab === "performers"}` and `{#if activeTab === "visibility"}` blocks and their imports (`PerformerTab`, `Viewer3DVisibilityToggles`). **Keep the Visibility component file** — other consumers (compose tab) may still use it.

- [ ] **Step 2: Add the Stage bridge footer**

After the last `{#if activeTab === "scene"}` block, inside the popover (before `</div>` close):

```svelte
<button class="bridge-btn" onclick={() => console.log("[stub] Stage destination not yet built")}>
  <span class="bridge-text">
    <span class="bridge-title">Stage this scene</span>
    <span class="bridge-sub">Multi-sequence · timeline · audio</span>
  </span>
  <span class="bridge-arrow"><i class="fas fa-arrow-right"></i></span>
</button>

<style>
  .bridge-btn {
    margin-top: 14px;
    min-height: var(--min-touch-target);
    padding: 12px 14px;
    background: linear-gradient(135deg, color-mix(in srgb, #a855f7 18%, transparent), color-mix(in srgb, #4a9eff 18%, transparent));
    border: 1px solid color-mix(in srgb, #a855f7 45%, transparent);
    border-radius: 12px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 14px;
    color: rgba(255,255,255,0.95);
    cursor: pointer; width: 100%; text-align: left;
  }
  .bridge-text { display: flex; flex-direction: column; gap: 2px; }
  .bridge-title { font-size: 13px; font-weight: 700; }
  .bridge-sub { font-size: 11px; color: rgba(255,255,255,0.42); }
  .bridge-arrow { color: #c89aff; font-size: 16px; }
</style>
```

- [ ] **Step 3: Build check + browser smoke**

Gear popover now shows Camera / Planes / Scene (3 tabs, equal-width). "Stage this scene →" button appears as a footer.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/components/Viewer3DGearPopover.svelte
git commit -m "refactor(viewer-3d): Gear popover = 3 tabs, add Stage bridge footer"
```

---

## Phase 4 — Integration + validation

---

### Task 21: Hook RightRail popovers to popover-stack (outside-click close)

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/RightRail.svelte` (or each popover individually)

**Context:** All popovers read `viewer.activePopover` already. But clicking outside a popover should close it. Add a window-level click handler that calls `viewer.closePopover()` when the click target is outside any popover and any rail chip.

- [ ] **Step 1: Add outside-click close logic**

In `RightRail.svelte`:

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  // ... existing ...
  let rootEl = $state<HTMLDivElement | null>(null);

  onMount(() => {
    function onDocClick(e: MouseEvent) {
      if (!viewer.activePopover) return;
      const target = e.target as Node;
      // If the click landed inside the rail or any popover, do nothing.
      if (rootEl && rootEl.contains(target)) return;
      const popovers = document.querySelectorAll('[role="dialog"]');
      for (const p of popovers) if (p.contains(target)) return;
      viewer.closePopover();
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  });
</script>

<div class="right-rail" bind:this={rootEl} ...>
  <!-- chips and popovers -->
</div>
```

- [ ] **Step 2: Build check + browser smoke**

Open a popover. Click on the canvas (anywhere outside). Popover closes. Open another popover, click on a different rail chip — the chip's popover opens (exclusive behavior from Task 2 still works).

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/RightRail.svelte
git commit -m "feat(sequence-viewer): outside-click closes any open rail popover"
```

---

### Task 22: Remove obsolete RecordSceneChrome popover children

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/record-scene/RecordSceneChrome.svelte`

**Context:** Now that the rail owns Tempo / Export, the old `RecordScenePlaybackPopover` and `RecordSceneExportPopover` mounts in `RecordSceneChrome` are dead code. Remove them. If the chrome becomes empty after removal, leave a placeholder comment documenting that export recording UI now lives in the rail.

- [ ] **Step 1: Remove the popover mounts and their imports**

In `RecordSceneChrome.svelte`:
- Delete `RecordScenePlaybackPopover` import + mount.
- Delete `RecordSceneExportPopover` import + mount.
- If the chrome now has no visible children at all, consider whether the component should be removed entirely (check: is anything else using it?). If unsure, leave it mounted but empty and flag as follow-up.

- [ ] **Step 2: Build check**

No type errors. Browser: viewer still renders; no orphaned popovers in the DOM.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/record-scene/RecordSceneChrome.svelte
git commit -m "refactor(record-scene): remove Playback/Export popovers (now on right rail)"
```

---

### Task 23: Validation pass against §15

**Files:**
- None (verification only)

- [ ] **Step 1: Walk through spec §15 validation criteria**

Open the Sequence Viewer at `/sequence/<id>` for any test sequence. Confirm each criterion:

- [ ] 2D/3D toggle never moves between modes (toggle 2D → switch to a different sequence → toggle back → toggle stays in header, never relocates)
- [ ] No fly/walk/orbit chips visible (canvas top-left is empty)
- [ ] No greyed-out / "coming soon" controls
- [ ] Effects toggle per performer (switch performer, toggle an effect → canvas changes for that performer only)
- [ ] Effort palette is per performer (switch performer, pick a different effort → that performer moves with the new quality)
- [ ] Prop type is per performer (performer 2 = fan, performer 3 = club → both visible simultaneously)
- [ ] Opening any rail popover closes any other
- [ ] Header shows: Back · 2D/3D toggle · VIEWER badge · sequence title · info chip
- [ ] Top-left of canvas is empty
- [ ] "Stage this scene →" appears in Gear popover (stub logs correctly)
- [ ] Info chip explainer opens and reads correctly
- [ ] 8 performers spawnable, each with a distinct effort, unison choreo with visibly distinct quality

- [ ] **Step 2: Record any failing criteria**

For each failing criterion, create a follow-up task in the plan or a GitHub issue (whichever the project prefers — check `.superpowers/` or `docs/feedback/` for the pattern).

- [ ] **Step 3: Commit (empty commit documenting validation)**

```bash
git commit --allow-empty -m "chore(sequence-viewer): validation pass — all §15 criteria met"
```

If any criterion failed, do NOT create the empty commit; instead, open tasks for the failures and rerun this task after fixes.

---

### Task 24: Update project memory

**Files:**
- Create/update: `C:\Users\Austen\.claude\projects\E--tka-platform\memory\project_viewer_redesign.md`
- Update: `C:\Users\Austen\.claude\projects\E--tka-platform\memory\MEMORY.md`

**Context:** Per the auto-memory system, significant completed projects get a memory entry. This one closes out multiple pending tracks (viewer chrome, per-performer foundation, 2D/3D toggle teleport, NavModeToggle orphan, Visibility tab stale toggles, grid artifact).

- [ ] **Step 1: Write the memory file**

```markdown
---
name: Sequence Viewer redesign
description: Viewer chrome = vertical right rail + bottom transport; per-performer effort/prop/effects live on AvatarInstanceState; Gear = 3 tabs (Camera/Planes/Scene); grid toggle removed; Stage bridge stubbed
type: project
---

Sequence Viewer was redesigned (spec 2026-04-15). Key outcomes:

- Chrome: vertical right rail with 4 icon-only chips (Performers/Tempo/Export/Gear); always-visible bottom transport; header with Back · 2D/3D · VIEWER badge · title · info chip
- Per-performer state lives on `AvatarInstanceState.settings` (effortId, prop, effects). `AnimationEngine.setPerformerEffortResolver((id) => EffortId)` bridges the data.
- Visibility tab and Grid scene feature removed (both 2D-viewer concepts that don't apply to 3D).
- Gear popover: 3 tabs (Camera/Planes/Scene). Scene tab = tile grid with thumbnails, 5 features.
- Stage bridge button in Gear footer is a stub; real Stage destination is the next spec.

**Why:** Identity drift, capability lies (effects visible but not wired), chrome polish. All three resolved in one cohesive spec.

**How to apply:** When adding per-performer features, extend `AvatarInstanceState.settings`. When adding viewer popovers, reuse the popover-stack (`viewer.activePopover`, `openPopover(id)`). Chip rail chips are icon-only with tooltips. No iOS toggles. No greyed-out affordances.
```

- [ ] **Step 2: Add to MEMORY.md index**

Append under Active Projects:

```markdown
- [Sequence Viewer redesign](project_viewer_redesign.md) — right rail + transport + per-performer foundation; Gear 3-tab + tile Scene; grid & Visibility removed; Stage bridge stubbed
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-04-15-sequence-viewer-redesign.md
git commit -m "docs: add sequence viewer redesign plan + memory"
```

---

## Self-review checklist

**Spec coverage:**
- §4 split table → captured in Phase 0 (foundation is viewer-only) + validation §15
- §5 capability levels → informative; no tasks
- §6.1 header → Task 13
- §6.2 rail → Tasks 14, 16, 17, 18, 20 (Gear trimming)
- §6.2 Scene redesign → Task 19
- §6.3 Performer popover → Task 18
- §6.4 mutex popovers → Task 2 + Task 21
- §6.5 removed elements → Tasks 8, 9, 10
- §6.7 transport bar → Task 15
- §7 per-performer foundation → Tasks 3, 4, 5, 6, 7
- §8 bridge → Task 20 footer (stub) + Task 12 info-popover link
- §10 info chip → Task 12
- §11 bug bundle → all covered in the deletion tasks (8, 9, 10, 22)
- §11.5 reuse contract → respected in Tasks 16, 17, 18
- §12 file list → tracked across phases
- §15 validation → Task 23

**Placeholder scan:** all code blocks contain actual code. Callouts where API/path needs runtime verification are explicit ("adapt to match real API" / "search for real playback state").

**Type consistency:** `PerformerSettings`, `EffectId`, `PopoverId` defined in Task 2-3 and referenced consistently in Tasks 4-7, 14, 18.

**Known gaps the engineer must resolve at runtime (not plan failures, just ground-truth-dependent):**
- Task 4: `AnimationEngine` factory signature must be read at Task 4 Step 1 to build the right `makeDeps()` in the test.
- Task 5: wiring call site depends on where `AnimationEngine` is instantiated in the viewer — the plan directs the engineer to place it inside `createViewer3DState` as the default location.
- Task 6: exact renderer file path(s) for the prop read site must be found via grep.
- Task 15: real playback controller API needs to be matched.
- Task 17: `export-options-state` setter names need verification.
- Task 18: `BentoPropGrid`, `EffortPalette`, `PerformerChipStrip` prop APIs need to match — any mismatches are solved by minimal adapter props on those components (never by inventing new control components).

These are all direct-inspection tasks the engineer handles in-flow; each one is a 1–2 line correction away from working.
