# Effect Plugin Registry Implementation Plan (P2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse per-effect code spread across five files into one colocated-plugin architecture — one `EffectPlugin` descriptor per effect, one `EFFECT_PLUGINS` registry, consumers derive from it. Adding an effect becomes one module + one import line.

**Architecture:** Evolve the existing `OVERLAY_REGISTRY` (in `EffectRendererManager.ts`) into a single `EFFECT_PLUGINS` registry under `services/effects/`. Extract an abstract `EffectRenderer` base for the 14 canvas2d overlays' shared boilerplate. Back `EffectRendererManager`, the render loop, and `effects-config-state` off the registry. No parallel registry; no duplication. Zero user-visible change.

**Tech Stack:** TypeScript, Svelte 5 runes, Canvas2D + WebGL renderers, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-28-effect-plugin-registry-design.md`
**Supersedes:** the (stale) P2 section of `docs/superpowers/plans/2026-05-28-animation-engine-rearchitecture.md`.

## Hard constraints (every task)

- Work on `main`. Never create branches. Never destructive git. Stage files by explicit path only (a parallel session commits concurrently — never `git add -A`/`.`).
- Never run `npm run build`/`build:fast` or full `npm run check` in the loop. Per-task verification = SCOPED tsc + `npx vitest run animator-state`.
- Scoped tsc command (capture once, grep): `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "animation-engine|effects/state" | grep -v "Catalog.ts\|tnd-family-aggregator\|pictograph-letter-lookup"` → expect empty. The one known choreo-card error is pre-existing; ignore it.
- Ship green per sub-phase: the engine + effects must always compile and the 16 effects must render unchanged. If blocked, ship a green partial and report precisely.

---

## Phase P2.1 — `EffectRenderer` base + migrate 14 canvas2d overlays

The 12 canvas2d overlays (zap, sparkles, echo, bloom, water, bubbles, petals, smoke, ink, frost, silk, pulse) plus the verification that fire/charcoal/led/trails satisfy the promoted contract. Each overlay copy-pastes 8 boilerplate methods; the base removes them.

### Task 1: Create the `EffectRendererLike` contract + `EffectRenderer` abstract base

**Files:**
- Create: `src/lib/shared/animation-engine/services/effects/EffectRenderer.ts`
- Reference: `src/lib/shared/animation-engine/services/implementations/WaterOverlayRenderer.ts` (the boilerplate being deduped)

- [ ] **Step 1: Write the base + contract**

```ts
// src/lib/shared/animation-engine/services/effects/EffectRenderer.ts
import { computeEffectScale } from "$lib/shared/effects/renderers/scale";

/**
 * Structural contract every effect renderer satisfies — canvas2d overlays
 * (via EffectRenderer base), WebGL fire/charcoal/led, and the trail overlay.
 * Promoted from the inline OverlayRenderer interface in EffectRendererManager.
 */
export interface EffectRendererLike {
  initialize(container: HTMLElement, w: number, h: number): boolean;
  dispose(): void;
  isInitialized(): boolean;
  resize?(w: number, h: number): void;
  setCanvasZIndex?(z: number): void;
}

/**
 * Abstract base for absolutely-positioned Canvas2D overlay renderers.
 * Owns the shared canvas lifecycle (create/style/append/resize/clear/dispose);
 * subclasses implement renderFrame() and may override the onClear/onDispose
 * hooks + zIndex getter.
 */
export abstract class EffectRenderer implements EffectRendererLike {
  protected canvas: HTMLCanvasElement | null = null;
  protected ctx: CanvasRenderingContext2D | null = null;
  protected width = 0;
  protected height = 0;
  protected scale = 1;

  /** z-index band; overlays in the bloom/echo/sparkles band use "2". Override if needed. */
  protected get zIndex(): string {
    return "2";
  }

  initialize(container: HTMLElement, width: number, height: number): boolean {
    this.dispose();

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = this.zIndex;
    canvas.style.background = "transparent";

    const ctx = canvas.getContext("2d");
    if (!ctx) return false;

    container.appendChild(canvas);
    this.canvas = canvas;
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.scale = computeEffectScale(width, height);
    this.onInitialized();
    return true;
  }

  resize(width: number, height: number): void {
    if (!this.canvas) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.width = width;
    this.height = height;
    this.scale = computeEffectScale(width, height);
  }

  clear(): void {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.onClear();
  }

  setVisible(visible: boolean): void {
    if (!this.canvas) return;
    this.canvas.style.display = visible ? "" : "none";
  }

  setCanvasZIndex(z: number): void {
    if (this.canvas) this.canvas.style.zIndex = String(z);
  }

  dispose(): void {
    if (this.canvas?.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
    this.onDispose();
    this.canvas = null;
    this.ctx = null;
    this.width = 0;
    this.height = 0;
    this.scale = 1;
  }

  isInitialized(): boolean {
    return this.canvas !== null && this.ctx !== null;
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  /** Hook: called at the end of a successful initialize(). Override to init inner renderer state. */
  protected onInitialized(): void {}
  /** Hook: called by clear() after clearRect. Override to reset the inner renderer (e.g. particle pool). */
  protected onClear(): void {}
  /** Hook: called by dispose() before nulling refs. Override to dispose the inner renderer. */
  protected onDispose(): void {}
}
```

- [ ] **Step 2: Scoped tsc**

Run the scoped tsc command. Expected: empty (new file, no consumers yet).

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/animation-engine/services/effects/EffectRenderer.ts
git commit -m "feat(animation): add EffectRenderer abstract base + EffectRendererLike contract"
```

### Task 2: Migrate `WaterOverlayRenderer` to the base (reference migration)

**Files:**
- Modify: `src/lib/shared/animation-engine/services/implementations/WaterOverlayRenderer.ts`

- [ ] **Step 1: Rewrite to extend `EffectRenderer`**

```ts
// src/lib/shared/animation-engine/services/implementations/WaterOverlayRenderer.ts
import type { Water2DParams } from "$lib/shared/effects/translators/canvas2d-types";
import {
  Water2DRenderer,
  type WaterTipInput,
} from "$lib/shared/effects/renderers/Water2DRenderer";
import { EffectRenderer } from "../effects/EffectRenderer";

export class WaterOverlayRenderer extends EffectRenderer {
  private renderer = new Water2DRenderer();

  renderFrame(params: Water2DParams, tips: WaterTipInput, dt: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.width, this.height);
    this.renderer.render(ctx, params, tips, dt, this.scale);
  }

  protected onClear(): void {
    this.renderer.dispose();
  }

  protected onDispose(): void {
    this.renderer.dispose();
  }
}
```

- [ ] **Step 2: Scoped tsc** — expect empty.
- [ ] **Step 3: Verify the public surface is unchanged** — `getCanvas`, `setVisible`, `setCanvasZIndex`, `resize`, `clear`, `dispose`, `isInitialized`, `initialize`, `renderFrame` all still present (inherited or overridden). Grep callers of `waterRenderer.` to confirm no method was dropped:

Run: `grep -rn "waterRenderer\.\(getCanvas\|setVisible\|setCanvasZIndex\|clear\|renderFrame\)" src/lib --include=*.ts`
Expected: every called method exists on the new class (inherited or overridden).

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/WaterOverlayRenderer.ts
git commit -m "refactor(animation): WaterOverlayRenderer extends EffectRenderer base"
```

### Task 3: Migrate the remaining 11 canvas2d overlays (3 commits of ~4)

**Files (each modified the same way as Water):**
`ZapOverlayRenderer.ts`, `SparklesOverlayRenderer.ts`, `EchoOverlayRenderer.ts`, `BloomOverlayRenderer.ts`, `BubblesOverlayRenderer.ts`, `PetalsOverlayRenderer.ts`, `SmokeOverlayRenderer.ts`, `InkOverlayRenderer.ts`, `FrostOverlayRenderer.ts`, `SilkOverlayRenderer.ts`, `PulseOverlayRenderer.ts` — all under `src/lib/shared/animation-engine/services/implementations/`.

Per-overlay migration recipe (identical to Task 2):
1. `extends EffectRenderer`; delete the 8 boilerplate methods (`initialize`/`resize`/`clear`/`setVisible`/`setCanvasZIndex`/`dispose`/`isInitialized`/`getCanvas`) and the duplicated `canvas`/`ctx`/`width`/`height`/`scale` fields.
2. Keep the inner `renderer = new X2DRenderer()` field and the `renderFrame(...)` method (its signature is overlay-specific — preserve verbatim).
3. **Inspect each overlay's original `clear()` and `dispose()`** before deleting:
   - If `clear()` called `this.renderer.dispose()` (or `.reset()`/`.clear()`), move that call into `protected onClear()`.
   - If `dispose()` called `this.renderer.dispose()`, move it into `protected onDispose()`.
   - If the overlay used a non-`"2"` z-index in `initialize()`, override `protected get zIndex()` to return that value.
   - If `initialize()` did extra setup after `getContext` (e.g. seeding inner renderer with `width/height/scale`), move it into `protected onInitialized()`.
4. Preserve any non-boilerplate public methods the overlay defines beyond the standard 8 (grep for callers first).

- [ ] **Step 1: Migrate zap, sparkles, echo, bloom.** For each: read the file, apply the recipe, preserving `renderFrame` and any custom `onClear`/`onDispose`/`zIndex`/`onInitialized`.
- [ ] **Step 2: Scoped tsc** — expect empty.
- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/{Zap,Sparkles,Echo,Bloom}OverlayRenderer.ts
git commit -m "refactor(animation): migrate zap/sparkles/echo/bloom overlays to EffectRenderer base"
```

- [ ] **Step 4: Migrate bubbles, petals, smoke, ink.** Apply recipe. Scoped tsc empty. Commit:

```bash
git add src/lib/shared/animation-engine/services/implementations/{Bubbles,Petals,Smoke,Ink}OverlayRenderer.ts
git commit -m "refactor(animation): migrate bubbles/petals/smoke/ink overlays to EffectRenderer base"
```

- [ ] **Step 5: Migrate frost, silk, pulse.** Apply recipe. Scoped tsc empty. Commit:

```bash
git add src/lib/shared/animation-engine/services/implementations/{Frost,Silk,Pulse}OverlayRenderer.ts
git commit -m "refactor(animation): migrate frost/silk/pulse overlays to EffectRenderer base"
```

### Task 4: Confirm special renderers satisfy `EffectRendererLike` (no migration)

**Files (read-only verification):** `WebGLFireRenderer`, `charcoal/CharcoalSparkRenderer.ts`, `led/WebGLLedRenderer.ts`, `TrailOverlayWebGL2.ts`, `TrailOverlayCanvas.ts`.

- [ ] **Step 1: Type-assert each satisfies the contract.** In `EffectRenderer.ts` (or a temporary check), confirm each special renderer has `initialize(container, w, h): boolean`, `dispose()`, `isInitialized()`. If a signature diverges (e.g. fire's `initialize` takes extra args), note it — the plugin's `createRenderer` will adapt, do NOT change the special renderer. Document divergences in the P2.2 descriptor for that effect.
- [ ] **Step 2: Scoped tsc** — expect empty. No commit (verification only; findings inform P2.2).

**P2.1 verification:** scoped tsc empty; `npx vitest run animator-state` 2/2. Runtime: every canvas2d effect still renders (deferred to the end-of-P2 runtime glance).

---

## Phase P2.2 — Colocate descriptors + evolve `OVERLAY_REGISTRY` → `EFFECT_PLUGINS`

### Task 5: Define the `EffectPlugin` descriptor interface

**Files:**
- Create: `src/lib/shared/animation-engine/services/effects/EffectPlugin.ts`
- Reference: `EffectRendererManager.ts:61-77` (the `OverlayEffectEntry` being evolved), `IAnimationRenderLoop.ts` (`RenderLoopConfig`), `domain/types/TipEffectTypes.ts` (`EffectType`).

- [ ] **Step 1: Write the interface**

```ts
// src/lib/shared/animation-engine/services/effects/EffectPlugin.ts
import type { EffectType } from "../../domain/types/TipEffectTypes";
import type { RenderLoopConfig } from "../contracts/IAnimationRenderLoop";
import type { EffectRendererLike } from "./EffectRenderer";
import type { EffectRendererManager } from "../implementations/EffectRendererManager";

/** Dispatch strategy for an effect — selects the host's lifecycle/render path. */
export type EffectKind = "canvas2d" | "webgl" | "led" | "trails";

/**
 * Single colocated descriptor for one effect. Lives in the effect's own module,
 * aggregated into EFFECT_PLUGINS. Replaces the OverlayEffectEntry's RendererClass
 * (now createRenderer) and adds defaultConfig + kind so the render loop and
 * config-state can also derive from one source.
 */
export interface EffectPlugin<C = unknown> {
  /** Effect id; matches an EffectType union member. */
  id: EffectType;
  /** Dispatch strategy. Most effects are "canvas2d"; fire/charcoal "webgl", led, trails special. */
  kind: EffectKind;
  /** Factory producing a renderer satisfying the contract. */
  createRenderer(): EffectRendererLike;
  /** Default config seed for effects-config-state. */
  defaultConfig: C;
  /** Key on RenderLoopConfig where this effect's renderer slot lives. */
  configKey: keyof RenderLoopConfig & string;
  /** Whether per-frame dispatch needs dt. Default false. */
  needsDt?: boolean;
  /** Skip triggerRender() after lifecycle sync. Default true (= do trigger). */
  triggerRender?: boolean;
  /** Lifecycle hook after a successful renderer init. */
  onInit?(mgr: EffectRendererManager, renderer: EffectRendererLike): void;
  /** Lifecycle hook after disable+dispose. */
  onDisable?(mgr: EffectRendererManager): void;
}
```

- [ ] **Step 2: Scoped tsc** — expect empty.
- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/animation-engine/services/effects/EffectPlugin.ts
git commit -m "feat(animation): add EffectPlugin descriptor interface"
```

### Task 6: Export a colocated `EffectPlugin` from each effect module

**Files:** each of the 16 renderer modules under `services/implementations/` (12 canvas2d + `WebGLFireRenderer`, `charcoal/CharcoalSparkRenderer.ts`, `led/WebGLLedRenderer.ts`, and a trails module — trails uses the `createTrailOverlay` factory currently in `EffectRendererManager.ts:533`).

For each, append an exported descriptor. The values come from the existing `OVERLAY_REGISTRY` entry (`EffectRendererManager.ts:79-178`) for that effect plus its `defaultConfig` from `effects-config-state.svelte.ts` (the inline default literal currently passed to its intent). Example (water):

```ts
// appended to WaterOverlayRenderer.ts
import type { EffectPlugin } from "../effects/EffectPlugin";
import { DEFAULT_WATER_INTENT } from "$lib/shared/effects/state/effects-config-state"; // or wherever the literal lives

export const waterEffectPlugin: EffectPlugin = {
  id: "water",
  kind: "canvas2d",
  createRenderer: () => new WaterOverlayRenderer(),
  defaultConfig: DEFAULT_WATER_INTENT,
  configKey: "waterRenderer",
};
```

- [ ] **Step 1: Locate each effect's default-config literal.** Grep `effects-config-state.svelte.ts` for the initial `config` object's per-effect values; if defaults are inline, extract each to an exported `DEFAULT_<EFFECT>_INTENT` const in that file (or import the existing default if one exists). One commit for the default-const extraction:

```bash
git add src/lib/shared/effects/state/effects-config-state.svelte.ts
git commit -m "refactor(effects): export per-effect default intent consts for registry"
```

- [ ] **Step 2: Add the 14 canvas2d/webgl descriptors** (fire, charcoal use `kind:"webgl"`; carry over their `onInit`/`onDisable` from `OVERLAY_REGISTRY:80-105`). For fire/charcoal, `createRenderer` adapts any divergent constructor noted in Task 4. Scoped tsc empty. Commit:

```bash
git add src/lib/shared/animation-engine/services/implementations/*OverlayRenderer.ts src/lib/shared/animation-engine/services/implementations/WebGLFireRenderer.ts src/lib/shared/animation-engine/services/implementations/charcoal/CharcoalSparkRenderer.ts
git commit -m "feat(animation): colocate EffectPlugin descriptors on canvas2d + webgl renderers"
```

- [ ] **Step 3: Add the led + trails descriptors.** led: `kind:"led"`, `createRenderer: () => new WebGLLedRenderer()`, `configKey:"ledRenderer"`. trails: `kind:"trails"`, `createRenderer` wraps the current `createTrailOverlay()` logic (WebGL2-with-canvas-fallback). Scoped tsc empty. Commit:

```bash
git add src/lib/shared/animation-engine/services/implementations/led/WebGLLedRenderer.ts src/lib/shared/animation-engine/services/implementations/TrailOverlay*.ts
git commit -m "feat(animation): colocate led + trails EffectPlugin descriptors"
```

### Task 7: Build the `EFFECT_PLUGINS` registry + tests; delete `OVERLAY_REGISTRY`

**Files:**
- Create: `src/lib/shared/animation-engine/services/effects/registry.ts`
- Create: `src/lib/shared/animation-engine/services/effects/registry.test.ts`
- Modify: `EffectRendererManager.ts` (remove `OVERLAY_REGISTRY`; import from registry)

- [ ] **Step 1: Write the registry**

```ts
// src/lib/shared/animation-engine/services/effects/registry.ts
import type { EffectPlugin } from "./EffectPlugin";
import type { EffectType } from "../../domain/types/TipEffectTypes";
import { fireEffectPlugin } from "../implementations/WebGLFireRenderer";
import { charcoalEffectPlugin } from "../implementations/charcoal/CharcoalSparkRenderer";
import { ledEffectPlugin } from "../implementations/led/WebGLLedRenderer";
import { trailsEffectPlugin } from "../implementations/TrailOverlayWebGL2";
import { zapEffectPlugin } from "../implementations/ZapOverlayRenderer";
import { sparklesEffectPlugin } from "../implementations/SparklesOverlayRenderer";
import { echoEffectPlugin } from "../implementations/EchoOverlayRenderer";
import { bloomEffectPlugin } from "../implementations/BloomOverlayRenderer";
import { waterEffectPlugin } from "../implementations/WaterOverlayRenderer";
import { bubblesEffectPlugin } from "../implementations/BubblesOverlayRenderer";
import { petalsEffectPlugin } from "../implementations/PetalsOverlayRenderer";
import { smokeEffectPlugin } from "../implementations/SmokeOverlayRenderer";
import { inkEffectPlugin } from "../implementations/InkOverlayRenderer";
import { frostEffectPlugin } from "../implementations/FrostOverlayRenderer";
import { silkEffectPlugin } from "../implementations/SilkOverlayRenderer";
import { pulseEffectPlugin } from "../implementations/PulseOverlayRenderer";

/** The single source of truth for all effects. Add a new effect by adding one line here. */
export const EFFECT_PLUGINS: readonly EffectPlugin[] = [
  fireEffectPlugin, charcoalEffectPlugin, ledEffectPlugin, trailsEffectPlugin,
  zapEffectPlugin, sparklesEffectPlugin, echoEffectPlugin, bloomEffectPlugin,
  waterEffectPlugin, bubblesEffectPlugin, petalsEffectPlugin, smokeEffectPlugin,
  inkEffectPlugin, frostEffectPlugin, silkEffectPlugin, pulseEffectPlugin,
];

export const EFFECT_PLUGIN_BY_ID = Object.fromEntries(
  EFFECT_PLUGINS.map((p) => [p.id, p])
) as Record<EffectType, EffectPlugin>;
```

- [ ] **Step 2: Write the registry test**

```ts
// src/lib/shared/animation-engine/services/effects/registry.test.ts
import { describe, it, expect } from "vitest";
import { EFFECT_PLUGINS, EFFECT_PLUGIN_BY_ID } from "./registry";

describe("EFFECT_PLUGINS registry", () => {
  it("has a unique id per entry", () => {
    const ids = EFFECT_PLUGINS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every entry declares a kind and a configKey", () => {
    for (const p of EFFECT_PLUGINS) {
      expect(["canvas2d", "webgl", "led", "trails"]).toContain(p.kind);
      expect(typeof p.configKey).toBe("string");
      expect(typeof p.createRenderer).toBe("function");
    }
  });

  it("by-id lookup resolves every entry", () => {
    for (const p of EFFECT_PLUGINS) {
      expect(EFFECT_PLUGIN_BY_ID[p.id]).toBe(p);
    }
  });
});
```

- [ ] **Step 3: Run registry test** — `npx vitest run registry` → expect 3 passing.
- [ ] **Step 4: Delete `OVERLAY_REGISTRY` from `EffectRendererManager.ts`.** Replace its internal references with `EFFECT_PLUGINS` (filter by `kind` where the old code assumed canvas2d-only, e.g. `syncAllOverlays`). Keep the manager compiling — the deeper Map-backing is Task 8; here just repoint the registry import so there is ONE registry.
- [ ] **Step 5: Scoped tsc empty + `npx vitest run animator-state registry`** → 2 + 3 passing.
- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/animation-engine/services/effects/registry.ts src/lib/shared/animation-engine/services/effects/registry.test.ts src/lib/shared/animation-engine/services/implementations/EffectRendererManager.ts
git commit -m "feat(animation): single EFFECT_PLUGINS registry, retire OVERLAY_REGISTRY"
```

**P2.2 verification:** scoped tsc empty; `animator-state` + `registry` tests green.

---

## Phase P2.3 — Map-back `EffectRendererManager`

### Task 8: Replace 16 named renderer fields with a Map; delete `prevHas*` shims

**Files:**
- Modify: `EffectRendererManager.ts:182-244` (named fields + prevHas* getters/setters), `:255-259` (reflection helpers)
- Modify callers: `managers/EffectSystem.ts` (renderer accessors + `initPrevState`), any other reader of `prevHas*Tips` / named renderer fields.

- [ ] **Step 1: Inventory external readers** before editing:

Run: `grep -rn "prevHas\w*Tips\|\.\(fire\|charcoal\|zap\|sparkles\|echo\|bloom\|water\|bubbles\|petals\|smoke\|ink\|frost\|silk\|pulse\|led\|trail\)\(Renderer\|Overlay\)\b" src/lib --include=*.ts | grep -v "OverlayRenderer.ts:"`
Expected: a finite list (mostly `EffectSystem.ts`, render-context factory, diagnostics). These get repointed.

- [ ] **Step 2: Replace fields with a Map.** In `EffectRendererManager`:
  - Delete the 16 named `xRenderer`/`trailOverlay` fields (`:182-199`) and the 14 `prevHas*Tips` getter/setter shims (`:217-244`).
  - Keep `fireTipTracker`, `ledTipTracker`, `fireConfig`, `ledConfig`, `cellTip*Map`, `effectsConfigState` (not registry-derived).
  - Add `private renderers = new Map<EffectType, EffectRendererLike>()`, populated lazily/at init by iterating `EFFECT_PLUGINS` and calling `createRenderer()`.
  - Add public `getRenderer(id: EffectType): EffectRendererLike | null { return this.renderers.get(id) ?? null; }`.
  - Replace `prevHasXTips` access with `wasEnabled(id): boolean` / `setWasEnabled(id, v)` over the existing `prevEffectEnabled` Map.
  - Replace `getOverlayRenderer`/`setOverlayRenderer` reflection with Map get/set.
- [ ] **Step 3: Repoint callers.** `EffectSystem.ts` renderer accessors (`get fireRenderer()` etc.) become `this.rendererManager.getRenderer("fire")`; `initPrevState` loops `EFFECT_PLUGINS` calling `setWasEnabled`. Update render-context factory + diagnostics readers.
- [ ] **Step 4: Scoped tsc empty + `npx vitest run animator-state registry`** → green.
- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/EffectRendererManager.ts src/lib/shared/animation-engine/services/implementations/managers/EffectSystem.ts <other repointed files by path>
git commit -m "refactor(animation): Map-back EffectRendererManager off the registry"
```

**P2.3 verification:** scoped tsc empty; tests green. Named fields + prevHas* shims gone (`grep -c "prevHas" EffectRendererManager.ts` → 0).

---

## Phase P2.4 — Registry-driven render loop + config-state collapse (HOT LOOP — verify carefully)

### Task 9: Generate `RenderLoopConfig` renderer slot from the registry

**Files:**
- Modify: `IAnimationRenderLoop.ts:51-85` (15 hand-typed `xRenderer?` slots)
- Modify: `AnimationRenderLoop.ts:789-833` (the `*Active` block) + the per-frame dispatch block below it.

- [ ] **Step 1: Replace typed slots with a union-keyed record.** In `RenderLoopConfig`, replace the 15 `xRenderer?: XRenderer | null` fields with:

```ts
renderers?: Partial<Record<EffectType, import("../effects/EffectRenderer").EffectRendererLike>>;
```

Keep `fireConfig`/`ledConfig`/per-effect `xConfig` param fields (those carry frame data, not renderers) unless they too are registry-derivable — leave them this task.

- [ ] **Step 2: Drive the `*Active` block off the registry.** Replace the 16 `const xActive = params.xConfig != null && this.xRenderer?.isInitialized()` consts + the `hasActiveWork` OR-chain (`:789-854`) with:

```ts
const activeByEffect = new Map<EffectType, boolean>();
for (const p of EFFECT_PLUGINS) {
  const renderer = config.renderers?.[p.id];
  // presence of the per-effect config in params gates activity (matches prior logic)
  const cfgPresent = (params as Record<string, unknown>)[`${p.id}Config`] != null
    || (p.id === "led" && params.ledConfig?.enabled === true);
  activeByEffect.set(p.id, cfgPresent && renderer?.isInitialized() === true);
}
const anyEffectActive = [...activeByEffect.values()].some(Boolean);
const hasActiveWork = this.needsRender || isPlaying || backgroundTransitioning || anyEffectActive;
```

(Preserve the exact gating semantics from `:789-833` — read that block live; `fireConfig` gates both fire and charcoal, `led` gates on `ledConfig.enabled`.)

- [ ] **Step 3: Drive the per-frame render dispatch off the registry.** Read the dispatch block below `:854` (where each `this.xRenderer.renderFrame(...)` is called). Replace the parallel per-effect calls with a loop over `EFFECT_PLUGINS` that, for each active effect, resolves `config.renderers?.[p.id]` and calls its `renderFrame` with the params it needs. Where a renderer's `renderFrame` signature is effect-specific, branch by `p.kind` or `p.id` for the few that differ; keep canvas2d overlays uniform.
- [ ] **Step 4: Repoint the config assembly** — wherever `RenderLoopConfig` was built with named `xRenderer` fields (grep `xRenderer:` / `updateConfig({`), populate the `renderers` record from `EffectRendererManager` (`getRenderer(id)` over `EFFECT_PLUGINS`).
- [ ] **Step 5: Scoped tsc empty + `npx vitest run animator-state registry`** → green.
- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/animation-engine/services/contracts/IAnimationRenderLoop.ts src/lib/shared/animation-engine/services/implementations/AnimationRenderLoop.ts <config-assembly files by path>
git commit -m "refactor(animation): registry-driven render-loop dispatch"
```

### Task 10: Collapse `effects-config-state` per-effect surface

**Files:**
- Modify: `effects-config-state.svelte.ts:191-318` (16 typed `updateXxx`), `:397-412` (16 typed getters), `:319` (keep generic `updateEffect`).

- [ ] **Step 1: Inventory callers of the typed updaters:**

Run: `grep -rn "\.update\(Trails\|Fire\|Led\|Charcoal\|Zap\|Sparkles\|Echo\|Bloom\|Water\|Bubbles\|Petals\|Smoke\|Ink\|Frost\|Silk\|Pulse\)\b" src/lib --include=*.ts --include=*.svelte`
Expected: a finite caller list to repoint to `updateEffect(id, patch)`.

- [ ] **Step 2: Add the typed accessor.** Add a type-level config map + accessor preserving per-effect typing:

```ts
// effects-config-state.svelte.ts
import type { EffectType } from "$lib/shared/animation-engine/domain/types/TipEffectTypes";
// EffectConfigMap maps each id to its intent type (derive from existing intent types)
export interface EffectConfigMap {
  trails: TrailsIntent; fire: FireIntent; led: LedIntent; charcoal: CharcoalIntent;
  zap: ZapIntent; sparkles: SparklesIntent; echo: EchoIntent; bloom: BloomIntent;
  water: WaterIntent; bubbles: BubblesIntent; petals: PetalsIntent; smoke: SmokeIntent;
  ink: InkIntent; frost: FrostIntent; silk: SilkIntent; pulse: PulseIntent;
}
// in the returned API:
effect<K extends keyof EffectConfigMap>(id: K): EffectConfigMap[K] {
  return (config as Record<string, unknown>)[id] as EffectConfigMap[K];
}
```

- [ ] **Step 3: Repoint callers.** Replace `ecs.updateFire(patch)` → `ecs.updateEffect("fire", patch)`, `ecs.fire` → `ecs.effect("fire")` (or keep the plain getters as thin one-liners if the caller count is high — decide by the grep count from Step 1; if >20 sites for a getter, keep that getter as `get fire() { return config.fire; }`). Delete the 16 typed `updateXxx`.
- [ ] **Step 4: Seed defaults from plugins.** Where the initial `config` object inlined per-effect defaults, import them from `EFFECT_PLUGIN_BY_ID[id].defaultConfig` (or keep the exported `DEFAULT_<EFFECT>_INTENT` consts from Task 6 as the shared source both sides use).
- [ ] **Step 5: Scoped tsc empty + `npx vitest run animator-state registry`** → green.
- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/effects/state/effects-config-state.svelte.ts <repointed caller files by path>
git commit -m "refactor(effects): collapse config-state to generic updateEffect + typed accessor"
```

### Task 11: Acceptance test — scratch 17th plugin + runtime parity

- [ ] **Step 1: Author a throwaway scratch plugin.** Create `services/effects/__scratch__ScratchOverlayRenderer.ts` extending `EffectRenderer` with a trivial `renderFrame` (fill a faint rect), export `scratchEffectPlugin` (`id` cast to a temp value or add a temp `"scratch"` member to the `EffectType` union ONLY for this test), add ONE line to `EFFECT_PLUGINS`. Confirm via a temporary log/test that it receives `createRenderer()` + appears in the registry iteration. (If adding to the `EffectType` union is too invasive, assert the registry mechanics in a unit test instead: a fake plugin pushed into a copy of the array flows through `EFFECT_PLUGIN_BY_ID` and a mock manager's Map.)
- [ ] **Step 2: Delete the scratch plugin + its line.** Confirm scoped tsc empty after removal.
- [ ] **Step 3: Runtime parity glance (REQUIRES USER).** Cannot self-verify. Ask the user: load a sequence in the 3D pane, enable fire (webgl), trails, and one canvas2d overlay (e.g. water); confirm all render identically to before and frame rate is unchanged.
- [ ] **Step 4: Full gate before declaring P2 done.** ONE `npm run check` (full, capture once) → zero new errors. Commit any final cleanup.

**P2.4 verification:** scoped tsc empty per task; full `npm run check` clean at the end; `animator-state` + `registry` tests green; runtime parity confirmed by user; the scratch test proved "1 module + 1 line" extensibility.

---

## Self-review notes

- **Spec coverage:** P2.1 (base + 14 overlays) → Tasks 1-4. P2.2 (colocate + registry) → Tasks 5-7. P2.3 (Map-back) → Task 8. P2.4 (render loop + config-state) → Tasks 9-10. Acceptance test → Task 11. All spec sections mapped.
- **Type consistency:** `EffectRendererLike` (contract), `EffectRenderer` (base), `EffectPlugin.createRenderer` returns `EffectRendererLike`, `getRenderer(id)` + `renderers` Map keyed by `EffectType`, `RenderLoopConfig.renderers: Partial<Record<EffectType, EffectRendererLike>>`, config-state `effect<K>(id)` + `updateEffect(id, patch)` — names consistent across tasks.
- **Risk ordering:** contained per-overlay work first (P2.1), hot-loop touch last (P2.4) with mandated runtime parity check.
