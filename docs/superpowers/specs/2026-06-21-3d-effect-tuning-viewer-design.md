# 3D Effect Tuning in the Viewer — Design

Date: 2026-06-21
Status: Approved (brainstorming complete)
Related: `project_effects_unification` (this advances Phase 2/3), `feedback_diagnostic_clipboard_workflow`, `feedback_tipeffectmap_sync`

## Problem

The 3D sequence viewer's "All Performers" FX popover (`EffectsSettingsPanel.svelte` inside `PerformerHubDetail.svelte`) lets you toggle effects on/off and drag a single intensity slider — but that slider is **dead** for 3D. The 3D effect renderers hardcode their constants and ignore the translated `*3DParams` coming out of `webgl3d-translator.ts`. So:

- Fire is blown-out white (HDR `uEmissiveHot = 1.6` feeding a scene bloom pass at threshold 0.8) with no way to tame it in-viewer.
- There is no per-effect tuning, no Copy Diagnostic, and no Save Defaults reachable from the 3D viewer.

The translator seam already exists for all 16 effects; it just isn't plumbed into the renderers. `TrailRenderer3D` is the lone exception — it already consumes `Partial<TrailRendererConfig>`. It is the reference implementation.

## Scope

**In scope — the 5 effects that actually have a live 3D renderer:**

| Effect | Renderer | Config today |
|--------|----------|--------------|
| Trails | `src/lib/shared/3d/effects/trails/trail-renderer-3d.ts` | ✅ config-driven (reference) |
| Fire | `src/lib/shared/3d/effects/fire/fire-renderer-3d.ts` | ❌ hardcoded |
| LED | `src/lib/shared/3d/effects/led/led-renderer-3d.ts` | ⚠️ material-options only |
| Charcoal | `src/lib/shared/3d/effects/charcoal/charcoal-renderer-3d.ts` | ❌ hardcoded |
| POV / LED-strip | `src/lib/shared/3d/effects/poi/pov-strip-renderer-3d.ts` | ⚠️ persistence setter only |

**Out of scope:** the 10 effects whose translator param shapes exist but have **no 3D renderer** (Zap, Echo, Sparkles, Bloom, Water, Bubbles, Petals, Smoke, Ink, Frost). We are not building renderers this round. Their chips will not get an expand panel.

**Known gap to verify during impl (not assume):** what the no-renderer chips currently do in the 3D viewer — no-op vs 2D-overlay fallback. Confirm with a runtime check; surface the finding. Do not silently treat them as working.

## Decisions (locked in brainstorming)

1. Build the tuning system; fire tames by dragging its sliders (no throwaway stopgap).
2. **Curated** knobs per effect (3-5), not full param exposure, not universal-only.
3. Architecture: wire the 3D renderers to **consume the translated `EffectsConfig` intent** (one config drives 2D and 3D). This kills the dead-code gap and finishes the unification.
4. **Global** tuning only (no per-performer param overrides). Matches the existing global `tka_effects_config`.
5. Placement: curated sliders **expand inline in the FX popover** under the chip grid; Copy Diagnostic + Save Defaults + Reset as a popover footer.
6. Save Defaults = promote current tuning to a persisted **baseline** (Reset returns here, not factory). Copy Diagnostic emits JSON to bake into `defaults.ts` as the shipped default for everyone when wanted.

## Components

### 1. Renderer config seam
Add an `updateConfig(params)` method to `FireRenderer3D`, `CharcoalRenderer3D`, `LedRenderer3D`, and `PovStripRenderer3D`. Replace the hardcoded constants (`EMIT_RATE`, `BUOYANCY`, `DRAG`, `CURL_STRENGTH`, `uEmissiveHot`, charcoal `GRAVITY`/lifetime, LED brightness/persistence, POV persistence) with instance fields seeded from the resolved `*3DParams`. Material uniforms that already have setters (`updateMaterialUniforms`, `setPersistenceDuration`) get reused; physics constants become mutable fields read each frame.

`TrailRenderer3D` already does this — no renderer change, only the panel surfaces its knobs.

The translator maps an intent knob → renderer param. The blowout knob: Fire **Brightness** → `uEmissiveHot` (and thus the bloom feed); Fire **Intensity** → emission rate / density.

### 2. Orchestrator wiring
In `EffectOrchestrator3D.svelte` (~L600–648 instantiation, plus the per-frame update region), resolve the intent → `*3DParams` via the existing `resolve*3D()` functions and push to `renderer.updateConfig(...)` on a **dirty-check** (only when the effect's intent changed), not every frame. This is the single change that makes the existing intensity slider — and all new sliders — actually drive the 3D renderers.

### 3. Curated sliders (expand-in-popover)
Extend the existing expand region in `EffectsSettingsPanel.svelte` (where the lone intensity slider lives today). When an active chip whose effect has a 3D renderer is expanded, render its curated set, each bound to `effectsConfig.updateEffect(key, { … })` (auto-saves live, drives the translator reactively). Reuse the canonical bare `<input type="range">` + label + formatted `<span>` pattern from `customize/*` and its existing slider CSS — **no new slider primitive** (never-hand-roll). No checkboxes — Rainbow toggle uses the button + toggle-indicator pattern (no-checkboxes rule).

Curated sets bind to intent fields that already exist in `defaults.ts` (v21):

- **Fire:** Intensity · Brightness · Turbulence · Color (Natural↔Colored)
- **Trails:** Thickness · Brightness · Rainbow
- **LED:** Brightness · Pattern · Speed
- **Charcoal:** Intensity · Spread · Glow
- **POV/LED-strip:** Brightness · Persistence
- Effects with no 3D renderer: no expand panel.

### 4. Footer (popover)
- **Copy Diagnostic** — reuse the `DiagnosticPanel.svelte` clipboard pattern (`idle → copied/failed`, 2.5s reset, console fallback). Serializes the current per-effect intents (the tunable subset) to pretty JSON for pasting to bake into `defaults.ts`.
- **Save Defaults** — calls `saveAsBaseline()`.
- **Reset** — calls `resetToBaseline()`.

No layout shift: footer button labels swap text ("Copy Diagnostic" → "Copied") — size to the widest label (no-layout-shift rule).

### 5. Baseline store
In `effects-config-state.svelte.ts`, add:
- `saveAsBaseline()` — writes the current config snapshot to a separate localStorage key `tka_effects_baseline`.
- `resetToBaseline()` — loads the baseline if present, else `DEFAULT_EFFECTS_CONFIG`.

Live edits keep auto-saving to `tka_effects_config` as today; the baseline is the explicit "this is my normal" snapshot.

## Data flow

```
slider → effectsConfig.updateEffect(key, {…})   (auto-persist to tka_effects_config)
       → reactive resolve*3D(intent)
       → EffectOrchestrator3D dirty-check
       → renderer.updateConfig(params)           (mutate instance fields)
       → next frame reflects                     (live while playing)

Save Defaults → saveAsBaseline()  → tka_effects_baseline
Reset         → resetToBaseline() → load baseline or factory
Copy Diagnostic → JSON of current intents → clipboard → paste into defaults.ts
```

## Build order

1. **Fire vertical slice** — config seam + orchestrator wiring + curated Fire panel + footer + baseline store. Proves the pattern end-to-end AND tames fire.
2. Replicate the config seam to **Charcoal**, **LED**, **POV**.
3. **Trails** panel only (renderer already consumes config).
4. Verify the no-renderer chips' behavior; surface finding.

## Verification

- DevTools: fire on, drag Brightness down → before/after screenshot, blowout gone.
- Runtime query: `uEmissiveHot` uniform reflects the slider.
- Copy Diagnostic produces valid parseable JSON.
- Save Defaults → reload → values persist; Reset → returns to baseline.
- `npm run check` clean; build green.

## Risks / notes

- Live-tuning physics fields mid-simulation must not realloc particle pools (don't reconstruct renderers — mutate fields). Pool size stays quality-tier-driven.
- `setTipEffectMap` sync (`feedback_tipeffectmap_sync`) — tuning changes params, not which tips render; toggles still go through the existing path. Don't regress it.
- Bloom is a global scene pass; Fire Brightness is the per-effect lever (lowering emissive reduces what crosses the bloom threshold). Do not globally lower the bloom pass — it affects every HDR emitter.
