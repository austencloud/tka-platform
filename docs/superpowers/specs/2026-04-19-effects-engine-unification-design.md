# Effects Engine Unification — Design Spec

**Date:** 2026-04-19
**Scope:** Phase 2 of the 2D/3D effects unification roadmap. Delete the legacy 3D effects state, migrate the 3D UI + remaining 3D renderers onto the shared `EffectsConfig`. No visible UI change in this phase.
**Status:** Ready for implementation plan.

---

## Goal

One effect enum, one parameter schema, one state store for both the 2D Canvas renderer and the 3D Threlte scene. After Phase 2, the 3D `EffectsSettingsPanel.svelte` reads and writes the exact same state object that `EffectsPanel.svelte` and `MobileEffectsPanel.svelte` read and write. The legacy file `src/lib/shared/3d/effects/state/effects-config-state.svelte.ts` is deleted. Effects behavior (what toggles exist, what their ranges are, how presets apply) becomes backend-agnostic.

Phase 3 uses this to migrate the 3D UI onto shared primitives (preset chips, Customize components, the mobile bento shell).

---

## Where We Start

The unification work is ~60% done. What already exists:

- `src/lib/shared/effects/domain/EffectsConfig.ts` — canonical Intent schema with all 11 effects (trails, fire, led, charcoal, zap, sparkles, echo, bloom, water, bubbles, petals). Single source of truth.
- `src/lib/shared/effects/state/effects-config-state.svelte.ts` — Svelte 5 factory + context plumbing. Used by desktop `EffectsPanel` and mobile `MobileEffectsPanel`.
- `src/lib/shared/effects/translators/canvas2d-translator.ts` — resolves Intent → 2D renderer params.
- `src/lib/shared/effects/translators/webgl3d-translator.ts` — resolves Intent → Three.js uniforms. Already consumed by `EffectsLayer.svelte` (3D) for echo/sparkles/zap/water/bubbles/petals.
- `EffectsLayer.svelte` dual-imports both the legacy 3D state AND the unified state — new effects route through unified, legacy effects through the old state.

What's still legacy:

- `src/lib/shared/3d/effects/state/effects-config-state.svelte.ts` — parallel state with its own type `EffectsConfig` (name collision), `MotionEffectsConfig`, and domain types (`TrailConfig`, `FireConfig`, `SparkleConfig`, `ElectricityConfig`, `GlowConfig`).
- `src/lib/shared/3d/components/controls/EffectsSettingsPanel.svelte` — 3D UI, reads legacy state. 8 effects, no presets, single intensity slider per effect, trails-only sub-controls (rainbow/solid, tracking mode).
- 3D renderers for trails/fire/led/charcoal/motion/bloom pull params from the legacy store.
- `performer.settings.effects: Set<EffectId>` — per-performer enable/disable flags. Out of Phase 2 scope (see below).

---

## Resolution of the Three Open Questions

### 1. Motion (3D-only blur + speedlines)

**Decision:** move out of the effects system entirely. Motion isn't a per-tip effect — it's a full-scene render modifier (motion blur pass + speed-line overlay). Putting it in the effect enum forces every 2D/3D parity conversation to either special-case it or pretend it applies to 2D.

**Where it goes:** new `Scene3DRenderConfig` state slice in `src/lib/shared/3d/scene-features/state/` (next to the existing scene-feature state). Owns `{ blur: boolean; speedLines: boolean; intensity: number }`. The 3D UI renders it in the Scene tab of the gear popover, not the Effects tab.

**Why not extend unified config:** "every effect tile means a per-tip effect that both renderers can display" is a strong invariant. Motion violates it. Keeping it separate preserves the invariant.

### 2. Per-performer `settings.effects: Set<EffectId>`

**Decision:** keep as-is. Out of scope for Phase 2.

This is a valid separate concept: the global `EffectsConfig` stores *how* each effect behaves (intensity, color, preset); the per-performer Set stores *which performers render* each effect. They compose: performer A renders Trails and Fire; performer B renders Trails only; both use the same Trails intensity because that's global.

Phase 2 just ensures per-performer Set references the unified `EffectType` enum (which it already does — the 3D code imports `EffectType` from `performer-settings-types.ts`, which we'll re-point at the canonical enum in `EffectsConfig.ts`).

### 3. Legacy 3D state deletion

**Decision:** delete at the end of Phase 2, not gradually. A parallel store that "sort of" works is more dangerous than a migration pain — every consumer will drift if we leave it half-alive.

Concrete: after every 3D consumer is migrated, the file `src/lib/shared/3d/effects/state/effects-config-state.svelte.ts` is removed in a single commit. Build breaks get fixed in that same commit.

---

## Architecture After Phase 2

```
┌────────────────────────────────────────────────────────────────┐
│ src/lib/shared/effects/domain/EffectsConfig.ts                  │  Intent schema
│   EffectType | TrailsIntent | FireIntent | ... | PetalsIntent   │  (unchanged)
└────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────┐
│ src/lib/shared/effects/state/effects-config-state.svelte.ts     │  Single state
│   createEffectsConfigState()                                    │  (unchanged)
│   getEffectsConfigContext()                                     │
└────────────────────────────────────────────────────────────────┘
         │                                              │
         ▼                                              ▼
   ┌───────────────┐                          ┌───────────────────┐
   │ 2D consumers  │                          │ 3D consumers      │
   │               │                          │                   │
   │ EffectsPanel  │                          │ EffectsSettings   │
   │ MobileEffects │                          │    Panel (unified)│
   │ Panel         │                          │                   │
   │               │                          │ EffectsLayer      │
   │ AnimatorCanvas│                          │ Trail/Fire/LED/   │
   │  2D renderers │                          │  …3D renderers    │
   │               │                          │                   │
   │ via           │                          │ via               │
   │ canvas2d-     │                          │ webgl3d-          │
   │ translator    │                          │ translator        │
   └───────────────┘                          └───────────────────┘

                                              ┌───────────────────┐
                                              │ Scene3DRender     │  NEW
                                              │ Config            │  (motion lives
                                              │  (motion blur +   │   here)
                                              │   speed lines)    │
                                              └───────────────────┘

                                              ┌───────────────────┐
                                              │ performer.        │  (unchanged)
                                              │  settings.effects │
                                              │  Set<EffectType>  │
                                              │  imports unified  │
                                              │  EffectType       │
                                              └───────────────────┘
```

---

## Migration Sequence

Phase 2 is decomposed into five landable sub-steps. Each can ship independently without breaking the app.

### 2a — Inventory & EffectType unification

- Grep every consumer of `getEffectsConfigState` from `3d/effects/state/`. Catalog which effects they read (trails/fire/led/charcoal/motion/bloom via legacy) and which via unified.
- Confirm `EffectType` in `performer-settings-types.ts` and `EffectType` in `EffectsConfig.ts` are identical unions. If they drift, re-export one from the other.
- Commit: inventory doc + any trivial type-alignment edits. No behavior change.

### 2b — Extract Motion to Scene3DRenderConfig

- Create `src/lib/shared/3d/scene-features/state/scene-3d-render-state.svelte.ts` with `{ motion: { blur, speedLines, intensity } }`.
- Copy current motion behavior from legacy effects state into this new file.
- Update every consumer of `config.motion` or `config.updateMotion` to read/write the new state.
- 3D UI: move motion from the "Effects" section of `EffectsSettingsPanel` to a "Scene" section. (The existing scene-feature-tiles or gear popover already has Camera/Planes/Scene tabs — Motion lives in Scene.)
- Tests: motion state round-trips; blur + speedLines toggle independently.
- Commit.

### 2c — Migrate 3D renderers (trails, fire, led, charcoal, bloom) to unified

- For each 3D renderer (Trail3D, Fire3D, LED3D, Charcoal3D, Bloom3D), replace `configState.trails` (etc.) reads with unified `EffectsConfig.trails` reads via the existing `resolveTrails3D` / `resolveFire3D` / etc. translators in `webgl3d-translator.ts`.
- Where a translator entry doesn't exist yet, add it (follows the existing pattern for echo/sparkles/zap/water/bubbles/petals — pure function, Intent in, 3D params out).
- Keep legacy store intact for this step — renderers just stop reading from it.
- Visual regression check: trails/fire/led/charcoal/bloom look identical in 3D.
- Commit per renderer (5 small commits). Each is independently revertable.

### 2d — Migrate 3D `EffectsSettingsPanel` to unified state

- `EffectsSettingsPanel.svelte` swaps its `getEffectsConfigState()` import for `getEffectsConfigContext()`.
- The 8-tile grid becomes an 11-tile grid (add echo/water/bubbles/petals; drop motion since it moved in 2b).
- Rainbow/Solid and Left/Both/Right sub-controls stay (they map to `trails.rainbow` and `trails.trackingMode` — both already in unified `TrailsIntent`).
- Single intensity slider stays. Hooked to `effect-primary-param.ts` adapter (Phase 1 artifact) for consistency.
- No preset picker in this step — that's Phase 3.
- Per-performer `performer.toggleEffect()` stays. Only the global config pointer changes.
- Visual test: per-performer toggling still works; each effect renders correctly in 3D.
- Commit.

### 2e — Delete legacy state

- Remove `src/lib/shared/3d/effects/state/effects-config-state.svelte.ts`.
- Remove `src/lib/shared/3d/effects/types/` entries for TrailConfig/FireConfig/etc. if they're only referenced inside that state file.
- Remove the dual-import in `EffectsLayer.svelte` — now single-sourced from unified.
- Build + visual QA across 2D and 3D to confirm nothing broke.
- Commit.

---

## Files

### Created
- `src/lib/shared/3d/scene-features/state/scene-3d-render-state.svelte.ts` — motion state, ~80 lines.
- `tests/unit/scene-3d-render-state.test.ts` — round-trip test, ~40 lines.
- (Optional, if new translator entries needed): additions to `webgl3d-translator.ts` for trails/fire/led/charcoal/bloom, following the existing `resolveEcho3D` pattern.

### Modified
- `src/lib/shared/3d/components/controls/EffectsSettingsPanel.svelte` — imports shared state, tile grid expands to 11.
- `src/lib/shared/3d/effects/EffectsLayer.svelte` — drops legacy import, all effects route through unified.
- Each 3D renderer component that reads legacy config (Trail/Fire/LED/Charcoal/Bloom3D).
- `src/lib/shared/3d/state/performer-settings-types.ts` — re-exports `EffectType` from `EffectsConfig.ts` if it doesn't already.

### Deleted
- `src/lib/shared/3d/effects/state/effects-config-state.svelte.ts`
- `src/lib/shared/3d/effects/types/` files whose only consumer was the legacy state (case-by-case).

### Untouched
- All 2D consumers (`EffectsPanel`, `MobileEffectsPanel`, `AnimatorCanvas`, 2D renderers).
- `performer.settings.effects` Set logic (per-performer enable/disable).
- Presets (`PRESET_GROUP`, `*Customize.svelte`) — Phase 3.
- 3D UI chrome (gear popover, Camera/Planes/Scene tabs) — Phase 3 / independent.
- Mobile bento shell — Phase 4 reuses it.

---

## Testing

### Unit
- `scene-3d-render-state.test.ts`: motion blur/speedLines toggle independently; intensity persists; state round-trips.
- Existing `canvas2d-translator.test.ts` and any `webgl3d-translator.test.ts` stay green.
- Existing effects-config-state tests stay green.

### Visual (Chrome DevTools MCP)
Before each commit in 2c and 2d, run a side-by-side: pre-change screenshot vs post-change screenshot of the 3D scene with the effect in question active. Any pixel diff is a bug. Document in the commit message which effect was checked.

### Migration correctness
After 2e, `grep -r "getEffectsConfigState" src/lib/shared/3d/` must return zero matches. After 2e, `grep -r "3d/effects/state/effects-config-state" src/` must return zero matches.

---

## Unification Hooks for Phase 3

Phase 3 (3D UI onto shared primitives) will be simpler because:

- Registry from Phase 1 (`effect-registry.ts`) already lists 11 effects — 3D UI reads them directly.
- Primary-param adapter from Phase 1 works for 3D as-is (same state store).
- `PRESET_GROUP` pattern from 2D works for 3D as-is (presets apply to the shared state).
- `*Customize.svelte` components from 2D can be dropped into 3D with no changes (they write to the shared state).

Phase 3 becomes mostly UI refactoring: replace the 3D `EffectsSettingsPanel.svelte` with a 3D equivalent of `MobileEffectsPanel.svelte` (or reuse `MobileEffectsPanel` directly on mobile; use `EffectsPanel` on desktop 3D). No new engine work.

---

## Risks

- **Silent renderer drift during 2c.** If I move Fire3D off the legacy store but Trail3D still reads it, the two may conflict when both are active (one preset applied to both locations). Mitigation: migrate in strict order, don't split across commits that anyone could bisect-break.
- **Performance regression from switching state readers.** Legacy 3D store and unified store use the same Svelte 5 runes pattern; no expected perf delta. Measure anyway: frame-time profile before/after 2c.
- **Motion extraction landing in wrong place.** Scene3DRenderConfig is the right home semantically but needs to live somewhere 3D controls can reach it. If the existing `scene-feature-state` already covers this, extend it rather than create a new file. Plan step confirms.
- **Translator coverage gaps.** Some intents may not round-trip cleanly to the legacy 3D params. If 2c reveals this, fall back to keeping the legacy reader for that specific effect until the translator gap is closed. Document as Phase 2.5 if needed.

---

## Acceptance

- `grep -r "getEffectsConfigState" src/lib/shared/3d/` returns zero matches.
- `src/lib/shared/3d/effects/state/effects-config-state.svelte.ts` does not exist.
- 3D viewer still renders every effect visible in 2D with identical behavior.
- Per-performer enable/disable still works in the Performer popover.
- Motion blur + speed lines still work (now driven by Scene3DRenderConfig).
- Desktop `EffectsPanel`, mobile `MobileEffectsPanel`, and 2D canvas rendering unchanged (no regression).
- Unit tests green. `svelte-check` error count not worse than baseline.
- Visual QA screenshots match pre-change for each migrated effect.
