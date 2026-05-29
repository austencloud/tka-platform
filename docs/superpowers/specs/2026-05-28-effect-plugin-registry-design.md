# Effect Plugin Registry — Design (P2 of Animation Engine Re-Architecture)

**Date:** 2026-05-28
**Status:** Approved, ready for implementation plan
**Phase:** P2 of `2026-05-28-animation-engine-rearchitecture.md`
**Depends on:** P0 (AnimatorState), P1 (SRP managers + façade) — both complete and runtime-confirmed.

## Goal

Collapse the per-effect code that is currently smeared across five files into a single colocated-plugin architecture: one module per effect, one registry that aggregates them, and consumers that derive from the registry. Adding a new effect should be one new module + one import line — not edits across `EffectRendererManager`, `IAnimationRenderLoop`, `AnimationRenderLoop`, and `effects-config-state`.

This phase ships **zero user-visible change**. It is internal architecture: deduplication, extensibility, and a single source of truth. Success is measured by the "scratch 17th plugin" acceptance test, not by any new feature.

## Ground Truth (verified 2026-05-28)

A prior session already built part of this. What exists:

- `EffectRendererManager.ts:52` — an **inline, private `OverlayRenderer` interface** (5-method contract: `initialize/dispose/isInitialized/resize?/setCanvasZIndex?`). Not an abstract base; no shared implementation.
- `EffectRendererManager.ts:61` — `OverlayEffectEntry` registry-entry type with `effect`, `rendererField`, `configKey`, `RendererClass`, `onInit?`, `onDisable?`, `triggerRender?`.
- `EffectRendererManager.ts:79` — `OVERLAY_REGISTRY`: 14 entries (fire, charcoal + 12 canvas2d overlays). LED and trails are deliberately excluded (unique lifecycles).
- `EffectRendererManager.ts:212` — `prevEffectEnabled: Map<effect, boolean>` change-detection, **already consolidated**, with 14 legacy `prevHas*Tips` getter/setter shims (`:217-244`) kept for external callers.
- `EffectRendererManager.ts:255` — reflection-based `getOverlayRenderer`/`setOverlayRenderer` helpers over the named fields.
- `EffectRendererManager.ts:307` `syncOverlay` / `:358` `syncAllOverlays` — generic registry-driven lifecycle sync.
- `effects-config-state.svelte.ts:319` — a generic `updateEffect(id, patch)` **already exists**, alongside 16 typed `updateXxx` (`:191-318`) and 16 typed getters (`:397-412`).

What does NOT exist (the real P2 delta):

1. **No abstract `EffectRenderer` base class.** The 14 overlays each copy-paste ~8 boilerplate methods (`initialize/resize/clear/setVisible/setCanvasZIndex/dispose/isInitialized/getCanvas`) — verified in `WaterOverlayRenderer.ts:29-106`. ~560 lines of duplication.
2. **No single registry.** `OVERLAY_REGISTRY` covers 14; LED + trails are special-cased separately; `IAnimationRenderLoop` and `effects-config-state` each hand-list every effect again.
3. **`EffectRendererManager` still has 16 named renderer fields** (`:182-199`), accessed by reflection.
4. **`IAnimationRenderLoop.RenderLoopConfig` has 15 hand-typed `xRenderer?` slots** (`:51-85`).
5. **`effects-config-state` keeps 16 typed `updateXxx` + 16 typed getters** — the generic updater exists but the per-effect surface was never removed.

**Implication for design:** evolve `OVERLAY_REGISTRY` into the single registry. Do NOT build a parallel `EFFECT_PLUGINS` array next to it (that is the duplication the user explicitly forbade). The existing registry is the seed; this phase grows it into the one source of truth and deletes the parallel hand-lists.

## Architecture

### Principle: colocation

One effect = one module that exports a single `EffectPlugin` descriptor carrying everything about that effect: its renderer factory, default config, render-loop dispatch metadata, lifecycle hooks. A registry aggregates the descriptors. Every consumer (`EffectRendererManager`, the render loop, the config-state) derives its per-effect behavior from the registry.

This is the proven plugin shape used by Vite, Rollup, ESLint, and Babel: a descriptor object + an aggregation array + host code that iterates. Nothing exotic; the value is in applying it consistently so the five hand-lists collapse to one.

### 1. `EffectRenderer` abstract base

`src/lib/shared/animation-engine/services/effects/EffectRenderer.ts`

Abstract class implementing the shared canvas-overlay boilerplate extracted from the 14 overlays:

- `initialize(container, w, h): boolean` — create canvas, append, size, store refs.
- `resize(w, h)`, `clear()`, `setVisible(v)`, `setCanvasZIndex(z)`, `dispose()`, `isInitialized()`, `getCanvas()`.
- `protected abstract renderFrame(...)` — the only per-effect method.

The exact shared signature is extracted by reading `WaterOverlayRenderer.ts` + `EchoOverlayRenderer.ts` and taking their common shape (per the original plan's P2.1 instruction). Any overlay with a genuinely divergent `initialize` overrides it and calls `super`.

WebGL renderers (fire, charcoal, LED) and the trail overlay do **not** extend this base — they keep their shader/ring-buffer internals. They satisfy the same *structural contract* (the `EffectRenderer` interface the base also implements), so the registry can hold them uniformly. The `kind` discriminator (below) tells the host which dispatch path to use.

### 2. `EffectPlugin` descriptor

`src/lib/shared/animation-engine/services/effects/EffectPlugin.ts`

```ts
export interface EffectPlugin<C = unknown> {
  id: EffectType;                                  // "fire" | "zap" | ...
  kind: "canvas2d" | "webgl" | "led" | "trails";   // dispatch strategy
  createRenderer(): EffectRendererLike;            // factory (replaces RendererClass: new()=>...)
  defaultConfig: C;                                // single source for config-state defaults
  configKey: keyof RenderLoopConfig & string;      // render-loop config slot
  needsDt?: boolean;                               // per-frame dt requirement
  triggerRender?: boolean;                         // default true
  onInit?(mgr: EffectRendererManager, r: EffectRendererLike): void;
  onDisable?(mgr: EffectRendererManager): void;
}
```

`EffectRendererLike` is the structural interface (today's inline `OverlayRenderer`), promoted to a shared exported contract so both the abstract base and the special renderers satisfy it. This is the existing `OverlayEffectEntry` evolved: `RendererClass` → `createRenderer`, plus `defaultConfig` + `kind`. The `rendererField` reflection key is removed — the manager stores renderers in a Map keyed by `id`, no named fields.

### 3. The registry

`src/lib/shared/animation-engine/services/effects/registry.ts`

```ts
export const EFFECT_PLUGINS: readonly EffectPlugin[] = [
  fireEffectPlugin, charcoalEffectPlugin, ledEffectPlugin, trailsEffectPlugin,
  zapEffectPlugin, sparklesEffectPlugin, echoEffectPlugin, bloomEffectPlugin,
  waterEffectPlugin, bubblesEffectPlugin, petalsEffectPlugin, smokeEffectPlugin,
  inkEffectPlugin, frostEffectPlugin, silkEffectPlugin, pulseEffectPlugin,
];
```

Each `xEffectPlugin` is exported from the effect's own module (colocated with its renderer). The registry file is the one place that lists all effects. `kind` lets the 4 special cases (fire/charcoal webgl, led, trails) live in the same array as the 12 canvas2d overlays — consumers branch on `kind` only where lifecycle genuinely differs.

A derived lookup `EFFECT_PLUGIN_BY_ID: Record<EffectType, EffectPlugin>` is exported for O(1) access.

### 4. Consumers derive — preserving type safety

The non-negotiable design constraint: registry-as-single-source **without** losing per-effect compile-time typing or autocomplete.

**`EffectRendererManager`**
- Replace 16 named fields (`:182-199`) with `private renderers = new Map<EffectType, EffectRendererLike>()`, populated by iterating `EFFECT_PLUGINS` and calling `createRenderer()` on demand.
- Public `getRenderer(id): EffectRendererLike | null` accessor for external callers.
- Delete the 14 `prevHas*Tips` getter/setter shims (`:217-244`); callers move to `prevEffectEnabled` Map access via a `wasEnabled(id)/setWasEnabled(id, v)` pair. (Grep + repoint `EffectSystem.initPrevState` and any others.)
- `syncOverlay`/`syncAllOverlays`/`syncEffectFlagsFromEffectiveMap` iterate the registry (largely already do).

**`IAnimationRenderLoop` / `AnimationRenderLoop`**
- `RenderLoopConfig`: replace the 15 hand-typed `xRenderer?` slots (`:51-85`) with `renderers?: Partial<Record<EffectType, EffectRendererLike>>`. The union-keyed `Record` keeps exhaustiveness — referencing a non-effect key is a compile error.
- Per-frame dispatch (`AnimationRenderLoop.ts:790-833`, the 3 parallel lists + `*Active` block): iterate `EFFECT_PLUGINS`, dispatch each enabled renderer by `kind` + `needsDt`. Remove the parallel lists.

**`effects-config-state.svelte.ts`**
- Delete the 16 typed `updateXxx` (`:191-318`); keep generic `updateEffect(id, patch)` (`:319`). Repoint callers (grep `updateFire`, `updateLed`, … across the codebase).
- Per-effect defaults seeded from each plugin's `defaultConfig` instead of inline literals.
- **Type safety preserved:** a type-level map `EffectConfigMap = { fire: FireIntent; zap: ZapIntent; … }` (derived from the plugin generics) backs a typed accessor `effect<K extends EffectType>(id: K): EffectConfigMap[K]`, so `ecs.effect("fire").intensity` stays fully typed. The 16 plain getters (`:397-412`) may stay as thin one-liners over `config[id]` if external call sites are heavy — decided during migration by grep count; the typed `effect(id)` accessor is the canonical path.

### 5. Special renderers

| Effect | `kind` | Base | Notes |
|---|---|---|---|
| 12 canvas2d overlays | `canvas2d` | extends `EffectRenderer` | boilerplate deduped |
| fire, charcoal | `webgl` | own WebGL base | satisfy contract; shader internals untouched |
| led | `led` | `WebGLLedRenderer` | unique tip-tracker lifecycle; `syncLedOverlay` stays but is registry-discovered |
| trails | `trails` | `ITrailOverlayCanvas` (Canvas/WebGL2 variants) | ring-buffer; `createTrailOverlay` factory becomes the plugin's `createRenderer` |

All four register in `EFFECT_PLUGINS`. The host branches on `kind` only at the few genuine lifecycle forks; everything else flows through the generic registry path.

## Migration Order — each sub-phase ships green

P2 splits into four commits, each independently green (scoped tsc + `animator-state` tests). A parallel Claude session may be committing concurrently, so each sub-phase stages only its own files by explicit path.

- **P2.1 — `EffectRenderer` base + migrate 14 overlays.** Create the abstract base; convert the 12 canvas2d overlays (and verify fire/charcoal/led/trails satisfy the promoted `EffectRendererLike` contract). Contained, per-overlay risk. One commit per ~4 overlays.
- **P2.2 — Colocate descriptors + build the registry.** Each effect module exports its `EffectPlugin`. Evolve `OVERLAY_REGISTRY` into `EFFECT_PLUGINS` (move to `services/effects/registry.ts`); include led + trails. Delete `OVERLAY_REGISTRY`.
- **P2.3 — Map-back `EffectRendererManager`.** Replace 16 named fields with the Map; delete `prevHas*` shims; repoint callers (`EffectSystem`, render-context factory, diagnostics).
- **P2.4 — Registry-driven render loop + config-state collapse.** The hot-loop touch. Generate `RenderLoopConfig.renderers`; drive per-frame dispatch off the registry; remove the parallel lists. Collapse `effects-config-state` to the generic updater + typed accessor. **Last and most carefully verified** — requires a runtime visual/perf parity glance before it lands.

## Verification

- Every sub-phase: scoped tsc clean on touched files (ignore the one known pre-existing choreo-card error) + `npx vitest run animator-state` 2/2.
- **Acceptance test (end of P2.4):** author a throwaway "scratch" 17th plugin — one module exporting a trivial `EffectPlugin` + a one-line renderer — add the single import line to the registry, and confirm it appears in the effect selector AND receives per-frame dispatch in the render loop with no other edits. Then delete the scratch. This proves the "1 module + 1 line" extensibility goal.
- **Hot-loop parity (P2.4):** before claiming done, runtime check that an active effect (fire or trails) renders identically and frame budget is unchanged. Requires a browser glance — cannot be self-verified.
- No effect's visual output changes anywhere in the app. This is the regression bar: 16 effects behave exactly as before.

## Out of Scope

- No new effects (the scratch plugin is deleted).
- No change to effect *visuals*, shaders, or physics.
- No change to the effect selector UI beyond it auto-listing from the registry.
- P3 (offscreen export) and P4 (thin shell / self-import) remain separate phases.

## Files

**Create**
- `services/effects/EffectRenderer.ts` — abstract base.
- `services/effects/EffectPlugin.ts` — `EffectPlugin` interface + `EffectRendererLike` contract.
- `services/effects/registry.ts` — `EFFECT_PLUGINS` + `EFFECT_PLUGIN_BY_ID`.
- `services/effects/registry.test.ts` — one entry per `EffectType`; each `createRenderer()` returns a contract-satisfying renderer.
- A colocated `xEffectPlugin` export added to each of the 16 effect renderer modules (no new files for these — exported alongside the renderer).

**Modify**
- 12 canvas2d overlay renderers — extend `EffectRenderer`, delete boilerplate.
- `EffectRendererManager.ts` — Map-backed; named fields + `prevHas*` shims removed.
- `IAnimationRenderLoop.ts` — `renderers` Record slot replaces 15 typed fields.
- `AnimationRenderLoop.ts` — registry-driven dispatch; parallel lists removed.
- `effects-config-state.svelte.ts` — typed `updateXxx` removed; defaults from plugins; typed `effect(id)` accessor.
- `EffectSystem.ts` — repoint `initPrevState` + renderer accessors to the Map / registry.
