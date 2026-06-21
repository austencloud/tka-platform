# Tunnel View — Design Spec

**Date:** 2026-06-20
**Status:** Design (validated via throwaway harness `src/routes/test/prop-tunnel/+page.svelte`)
**Related:** prop-unlock celebration (`PropUnlockCelebration.svelte`), sequence-mandala project, effects-unification project.

---

## 1. Summary

Tunnel View turns the open sequence into a live algorithmic kaleidoscope: the
sequence overlaid with rotated (and optionally mirrored) copies of itself,
rendered on a single `AnimatorCanvas`, with per-tip effects covering every copy
and full per-effect tuning. It is a **mode inside the existing 2D animation
pane** (`AnimationPlayer`) — not a new viewer pane and not a new `ViewerMode`.

The same overlay + effect logic backs the prop-unlock celebration's REVEAL, so
both surfaces consume one shared tunnel renderer.

### Goals
- A "Tunnel" toggle in the 2D animation pane that applies the kaleidoscope to
  whatever sequence the viewer has open.
- Knobs-forward: the user drives fold / mirror / effect / speed live and tunes
  the active effect, then **saves looks as named presets** (no fabricated
  built-in gallery).
- Effects apply across **all** overlaid layers, not just the base pair.

### Non-goals (deferred)
- Per-layer tint/recolor (the prop-color plumbing is a separate lift; trail-based
  color already varies per layer).
- Extending the deterministic path cache to hold layer paths (layer trails are
  sourced from the live capturer; see §6).
- 3/6-fold (not representable on the 8-point grid; see §4).

---

## 2. Where it lives

`AnimationPlayer.svelte` is the 2D animation pane host. Tunnel is a **sub-mode**
of that pane (`normal` ↔ `tunnel`), surfaced as a toggle in the pane chrome. When
tunnel is on, a control strip appears and the canvas renders the overlaid stack.

Rejected alternatives (with reasons):
- *New split-pane card* (like `MandalaPane`): the user explicitly chose a mode
  over a pane — it avoids `ViewerSplitPane` / pane-registration work and keeps
  the user in the 2D viewer they already have open.
- *New top-level `ViewerMode`* (sibling of `animation` / `animation-3d`): tunnel
  is a treatment **of** the 2D animation, not a separate destination.

---

## 3. Config & preset model

```ts
interface TunnelConfig {
  fold: 2 | 4 | 8;     // rotational symmetry (see §4)
  mirror: boolean;     // adds the dihedral reflections
  effect: EffectType;  // which effect blankets the stack ("none" = clean)
  speed: number;       // beats/second for the shared playhead clock
  paused: boolean;
}

interface TunnelPreset { id: string; name: string; config: TunnelConfig; }
```

**Effect tuning is shared with the viewer.** Tunnel mode reads/writes the
viewer's existing effects config (`effects-config-context`,
`createEffectsConfigState`), NOT an isolated copy. Tuning fire in tunnel mode is
the same fire everywhere — one config, no duplication. A `TunnelPreset` therefore
stores only `TunnelConfig` (fold/mirror/effect-id/speed/paused); the effect's
parameters live in the shared effects config.

**Presets are the user's.** A "Save preset" action captures the current
`TunnelConfig` to localStorage (`tka_tunnel_presets`), following the
`mandala-viewer-controller` persistence pattern. Saved presets render as a chip
row (apply / delete). No curated built-in gallery — the pane opens on one
validated default (`fold:4, mirror:false, effect:"none", speed:0.3`) and the user
builds the library.

---

## 4. Fold math

The TKA grid is 8 points at 45° increments. `rotateSequence(seq, amount, …)`
lands only on 45° multiples, so the valid rotational folds are:

| Fold | Rotation amounts (`rotateSequence` units, 1 = 45°) | Degrees |
|---|---|---|
| 2 | `[4]` | 180 |
| 4 | `[2, 4, 6]` | 90 / 180 / 270 |
| 8 | `[1, 2, 3, 4, 5, 6, 7]` | 45 each |

3-fold / 6-fold (120° / 60°) are **not** grid-representable and are excluded.
**Mirror** reflects the whole rotational stack via `mirrorSequence`, adding the
dihedral reflections (doubles the layer count).

Validated cadence (from the harness): 4-fold at speed 0.3 reads as lush and
calm; 2-fold tolerates faster (≈1.0). Reduced-motion → cap at fold 2.

---

## 5. Rendering pipeline

Per frame, driven by an rAF playhead clock advancing `playheadBeat` at
`speed × dt`:

1. Build layer sequences once per topology change (fold or mirror):
   `rotateSequence(seq, amt)` for each amount, plus `mirrorSequence` of each when
   mirror is on.
2. For the base and every layer, derive prop states at the shared playhead via
   `interpolatePropAngles(step, progress)`.
3. Pass base `blueProp`/`redProp` + the layers as `additionalLayers`
   (`AdditionalLayerProps[]`) to one `AnimatorCanvas`. The canvas already renders
   additional layers' props.

This is exactly the harness's proven loop. The shared module owns the clock,
the layer build, and the per-layer prop derivation.

---

## 6. Engine changes (all-layer effects)

Today tip effects hit only the base pair; the overlaid layers get props but no
effects. The de-risk implemented the fix across all four effect paths (already
present in the working tree, type-clean; to be formalized in the plan).

### 6a. Tip-tracker effects (14 of 16)
`FireTipTracker` (consumed by fire / charcoal / zap and the registry effects
sparkles / echo / bloom / water / bubbles / petals / smoke / ink / frost / silk /
pulse) gains an optional `additionalLayers` config. When present it emits tips
for each layer's blue/red props at `propIndex ≥ 2` into a dynamic prev-store
(the fixed 16-slot base pool is untouched). Every effect filters tips by
`resolveEffect(propIndex, …)` with `"*"` matching any index, so all 14 cover the
stack for free. `PropTipData.propIndex` widened `0|1 → number`.

### 6b. LED
`LedTipTracker` extended identically (LED has its own tracker). Each layer prop
reuses its hand's base color + pattern offset so colors stay coherent.
`LedTipData.propIndex` widened to number.

### 6c. Trails — inline path
The path cache holds base prop paths only. `TrailCapturer` already captures
layer positions; added `fillAdditionalLayerTrails`, and `gatherTrailPoints` now
always sources layer trails from the live capturer (the cache path and the
overlay-active gate both previously skipped them).

### 6d. Trails — overlay path
The trails-as-effect path uses `TrailOverlayCanvas`, which reads positions
directly from PropState and was base-only. It now captures each layer's tips into
per-layer rings and composites them into the **shared** blue/red accumulators —
so memory stays at two accumulator canvases regardless of fold count.

### 6e. LED default fix
`DEFAULT_LED_CONFIG`: `colorMode "unified" → "prop-matched"` (blue staff blue,
red staff red — no neon-green wash) and `brightness 1.0 → 0.6` (full-bright reads
as blinding on the dark stage).

### 6f. Effects-config isolation option
`createEffectsConfigState(initial, { persist?: boolean })` — `persist:false`
yields a fully isolated instance (no read/write of the shared `tka_effects_config`
key). The harness uses it; the shipped tunnel mode does **not** (it shares the
viewer config per §3). The option also fixes a latent leak where the "ephemeral"
animation scope still wrote the global key.

---

## 7. Controls (reuse, don't hand-roll)

The tunnel control strip composes existing primitives:
- **Fold / mirror / speed / pause** — small knob row in the pane chrome.
- **Effect picker** — selects the effect that blankets the stack (uniform
  `{"*": {effect}}` tip map).
- **Per-effect tuning** — mounts the **real** per-effect panel for the active
  effect: the 12 `effects-panel/customize/*Customize.svelte` views and the
  `settings-panels/{Fire,Charcoal,Led,Trails}Panel.svelte` panels. They read the
  shared `effects-config-context` and mutate via `updateEffect`. No new tuning UI.
- **Presets** — name / save / apply (chip) / delete, persisted to
  `tka_tunnel_presets`.

---

## 8. Celebration refactor

`PropUnlockCelebration.svelte` already runs the same overlay loop with a private
copy of the rotate-and-overlay logic. It refactors to consume the shared tunnel
module so the celebration's REVEAL and the viewer's Tunnel mode stay in lockstep
(and the celebration inherits all-layer effects).

---

## 9. Performance guard

Heavy GPU effects (fire / charcoal) and trails across an 8×+mirror stack (up to
~16 layers × 2 props) are the cost center. The mode must:
- Bound effect cost by fold: warn or soft-cap fire/charcoal/trails at the highest
  fold + mirror, and prefer the cheaper effects there.
- Honor reduced-motion: cap at fold 2.
- Surface any silent cap via a status line (no silent truncation).

The tip-tracker layer caps (`MAX_LAYER_TIPS`) and the single-accumulator trail
design keep memory bounded; the open cost is per-frame draw passes, not memory.

---

## 10. File structure (proposed)

| File | Responsibility |
|---|---|
| `…/sequence-viewer/…/tunnel/tunnel-mode-controller.svelte.ts` | State: `TunnelConfig`, presets (load/save/apply/delete), layer-sequence build, per-layer prop derivation, playhead clock. Factory + context, mirroring `mandala-viewer-controller`. |
| `…/sequence-viewer/…/tunnel/TunnelControlStrip.svelte` | Knob row + effect picker + per-effect panel host + preset chips. |
| `AnimationPlayer.svelte` (modify) | Add the `normal ↔ tunnel` sub-mode toggle; when tunnel, render the overlaid `AnimatorCanvas` + mount `TunnelControlStrip`. |
| Engine files (§6, already prototyped) | `fire-tip-tracker.ts`, `led-tip-tracker.ts`, `trail-capturer.ts` + `ITrailCapturer.ts`, `trail-overlay-canvas.ts`, `animation-render-loop.ts`, `fire-types.ts`, `led-types.ts`, `effects-config-state.svelte.ts`. |
| `PropUnlockCelebration.svelte` (modify) | Consume the shared tunnel module. |

Reused as-is: `AnimatorCanvas`, `rotateSequence`/`mirrorSequence`,
`interpolatePropAngles`, all `*Customize`/`*Panel` effect components,
`createEffectsConfigState` + `effects-config-context`.

---

## 11. Testing

- **Unit:** `rotAmountsFor(fold)` → correct amounts; preset save/apply/delete
  round-trips through localStorage; per-layer prop derivation at a given playhead.
- **Engine:** `FireTipTracker`/`LedTipTracker` emit layer tips at `propIndex ≥ 2`
  only when `additionalLayers` present (base path byte-identical when absent);
  `TrailCapturer.fillAdditionalLayerTrails` fills N layers; overlay layer rings
  grow/shrink with fold.
- **Visual:** the existing harness (`/test/prop-tunnel`) is the iteration surface
  through implementation; final check in the real `AnimationPlayer` mode.

---

## 12. Open items

- **Tint axis** deferred (§1 non-goals) — easy to add once the per-layer
  prop-color plumbing exists.
- **Path-cache layer extension** not done — layer trails come from the live
  capturer, which is sufficient; revisit only if gap-free layer trails are needed.
- **Perf guard thresholds** (§9) to be tuned during implementation against real
  device budgets.
