# AnimationScope — per-surface animation state with a persistence-adapter boundary

**Date:** 2026-06-17
**Status:** approved (design); implementation plan to follow
**Author:** brainstormed with Austen

## Problem

Multiple independent animation surfaces — the landing "Infinite Spinner", the
sequence viewer, the compose module, the video exporter, and every pictograph
thumbnail — all render from **ambient global singletons**. Render and state code
reaches for them through module-level getters and a shared `localStorage`:

- `getAnimationVisibilityManager()` — global visibility/paths/effort/speed manager
- `animationSettings` — global bpm + trail singleton (`tka_animation_settings`)
- `createEffectsConfigState()` instances + `tka_active_effect_presets` localStorage

A retrofitted `override ?? global` pattern lets *some* readers honor a per-instance
override, but it is applied inconsistently. The reported failure: the landing
spinner's "Hybrid / path-shape" toggle writes a per-instance ephemeral manager,
but the renderer reads the global, so anti-spin rendered concave (the signed-in
user's account setting) while the panel showed it off.

This is not one bug. It is a structural class: **every render reader that forgets
the `?? override` is a silent leak**, and a new one appears every time the engine
grows. Verified bypass sites at time of writing:

| Site | Reads | Honors override? |
|---|---|---|
| `prop-interpolator.ts:resolvePathType` | path shape / motion-aware | NO (fixed transitionally — see Phase 1) |
| `animation-precomputer.svelte.ts:getSequencePathHash` | path shape / motion-aware | NO (fixed transitionally) |
| `animation-playback-controller.ts:449` | speed sync to visibility mgr | NO |
| `svg-generator.ts:29` | glyph manager | NO |
| `animation-engine.svelte.ts:259`, `animation-visibility-synchronizer.ts:42`, orchestrator effort `:303/:613` | various | yes (`override ?? global`) |

Three structural cracks underneath the leak class:

1. **Fragmented state.** Settings live in 3 uncoordinated stores; "isolate one
   surface" means chasing all three.
2. **Duplicated derived state.** `speed` lives in both the playback state and the
   global visibility manager; bpm→speed is converted in multiple places. They
   drift; the cache-invalidation sync at `controller.ts:449` exists to paper over
   it.
3. **Implicit persistence.** Autosave `$effect`s are baked into the state objects;
   `EffectsPanel.svelte:40-47,92` writes `localStorage` directly. "Ephemeral vs
   localStorage vs account" is scattered behavior, not a policy.

## Goals

- One cohesive **`AnimationScope`** per surface that owns every setting that
  surface renders from.
- Render code receives the scope (or the slice it needs) **explicitly**. No
  ambient global getters in the render path. The leak class becomes structurally
  impossible — there is no global to forget to override.
- Persistence is a **pluggable adapter** chosen at scope construction, supporting
  three tiers: `ephemeral`, `local`, `account`.
- A single source of truth for derived values (`speed`), computed once.
- Each migration phase ships independently and keeps the app green.

## Non-goals

- **Account-sync implementation.** The `account` adapter's *contract* is defined
  and the scope is account-ready, but the Firestore implementation (conflict
  policy, premium gating, which settings sync) is a separate follow-up spec. This
  build ships a stubbed `AccountAdapter`.
- No DI container (dissolved in this codebase by prior decision). This is the
  existing per-instance factory + Svelte-context pattern, made **total and
  consistent** — not a framework.
- No change to *what* the settings do (rendering behavior is preserved); only
  *where they live and how they flow*.

## Architecture

### The `AnimationScope`

One object per surface, owning unified slices that absorb the three current
stores:

```
AnimationScope
├── visibility   (grid, glyph, stepNumbers, props, word, progressBar)
├── paths        (shape: "arc" | "linear" | "concave", motionAware: boolean)
├── effort       (curve preset)
├── trail        (mode, effect, trackingMode, colors, width, opacity, tailLength, …)
├── tempo        (bpm)  →  speed = $derived(bpm / 60)
├── effects      (activeEffect, params, presets)
└── props        (bluePropType, redPropType)
```

Rules that keep it a cohesive unit, not a state bag:

- **Runes-native.** State is `$state`; consumers read via `$derived`-friendly
  accessors (`scope.paths.shape`), not imperative `getX()/setX()` scattered
  through render code.
- **`speed` is derived, never stored** — removes the playback-state ↔
  visibility-manager duplication and the `controller.ts:449` hack.
- **Provided once per surface via Svelte context**, extending the existing
  `setAnimationVisibilityContext` pattern to a single `setAnimationScopeContext`.
- **The "global app settings" become the *default scope*** — one ordinary
  instance the root app provides. Not a privileged ambient. Landing, thumbnails,
  and export each construct their own.

### The persistence adapter boundary

The scope holds state and emits debounced deltas; it does not know how it is
persisted. Construction selects the adapter:

```ts
interface PersistenceAdapter {
  load(): Partial<ScopeState> | null;      // seed on construct (incl. migrations)
  save(delta: Partial<ScopeState>): void;  // debounced write
}

new AnimationScope({ persistence: ephemeralAdapter });    // landing, thumbnails
new AnimationScope({ persistence: localAdapter(KEY) });   // app default (today's behavior)
new AnimationScope({ persistence: accountAdapter(uid) }); // CONTRACT ONLY this build
```

- `EphemeralAdapter` — `load()` → null, `save()` → no-op. Nothing persists.
- `LocalStorageAdapter` — owns today's `tka_animation_settings` /
  `tka_active_effect_presets` keys, the `loadSettings()` forced-vivid-trail
  migration, and the raw `localStorage` currently in `EffectsPanel`. All pulled
  out of state and components into one place.
- `AccountAdapter` — interface implemented, body stubbed (delegates to local or
  no-ops) with a `TODO(account-sync spec)` marker. The scope is account-ready.

This is why the reported bug becomes structurally impossible: the landing
constructs an ephemeral scope, render code only ever sees the scope it was
handed, and **there is no global path to read or write the user's settings**. The
`override ?? global` pattern is deleted — the `??` had nothing to fall back to
because the fallback *was* the bug.

## Migration (strangler-fig; each phase ships green on `main`)

- **Phase 0 — Scaffold.** Define `AnimationScope` + `PersistenceAdapter` + the
  three adapters. Stand up the default app scope (local adapter) reproducing
  today's exact behavior. No consumers migrated yet.
- **Phase 1 — De-globalize render readers.** Make `prop-interpolator`,
  `animation-precomputer`, `svg-generator.ts:29`, and the speed-sync at
  `animation-playback-controller.ts:449` take the scope/slice explicitly. During
  this phase the global remains as the *default* scope so nothing breaks. The
  already-applied `vm`-threading of the interpolator/precomputer/orchestrator is
  the beachhead — it is the transitional `?? default` form Phase 2 finishes.
- **Phase 2 — Consolidate stores.** Fold visibility, `animationSettings`, and
  effects-config into `AnimationScope` slices. Migrate the ~32 `animationSettings`
  consumers and the context consumers to read the scope. Delete the emptied
  stores. **Remove the `?? global` fallback** — the band-aid disappears.
- **Phase 3 — Unify speed.** Derive `speed` from `tempo.bpm` in the scope; remove
  the duplicate in playback state and the `:449` visibility-manager sync.
- **Phase 4 — Surface adoption.** Landing, thumbnails, and export each construct
  their own scope (ephemeral / local). The reported motion-paths leak is gone by
  construction; BPM/trail/tracking/effect-preset leaks go with it.

## Testing

- **Scope unit tests** with an in-memory adapter: set a slice, assert reads;
  assert `ephemeralAdapter` never persists; assert `localAdapter` round-trips
  through a fake storage. No globals, no real `localStorage` — deterministic.
- **Isolation test:** two scopes (one ephemeral, one local) mutated independently;
  assert neither observes the other. This is the regression guard for the whole
  bug class.
- **Render-parity test:** a sequence rendered through the default scope matches
  the pre-migration global-singleton output (per phase) — proves behavior
  preserved.
- **Speed-derivation test:** changing `tempo.bpm` updates `speed` and step
  duration with no second source.

## Risks

- **Wide blast radius in Phase 2** (~32 consumers). Mitigated by the strangler
  order: readers are de-globalized first (Phase 1) while the global still backs
  them, so Phase 2 is a mechanical source swap with the parity test as the gate.
- **Live engine, multiple agents on the tree.** Each phase is independently
  committable with an explicit pathspec; no phase leaves the app non-green.
- **Account adapter scope creep.** Explicitly fenced off as a stub with a
  follow-up spec; the contract is the only deliverable this build.

## Follow-up specs

- **Account-sync adapter** — Firestore per-user persistence: conflict/merge
  policy, which slices sync, premium gating, device reconciliation.
