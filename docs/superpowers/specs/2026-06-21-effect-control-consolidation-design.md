# Effect Control Consolidation — Design

Date: 2026-06-21
Status: Approved (brainstorming complete)
Related: `2026-06-21-3d-effect-tuning-viewer-design.md` (this supersedes its ad-hoc `effect-curated-knobs.ts`), `project_effects_unification`

## Problem

Effect tuning controls are inconsistent on two axes:

1. **Per-effect complexity is all over the place.** 2D control counts span 3→17 (Charcoal 3, Fire 3, LED 4, Trails 6, Zap 5 … Echo 10, Bloom 13, Pulse 17). Effects don't "feel similar" to control.
2. **2D and 3D diverge.** They share the intent data (`EffectsConfig`) but render from *separate* UI code — 2D uses bespoke `*Panel.svelte`/`*Customize.svelte`; the 3D viewer uses a separate `CURATED_KNOBS` list (added 2026-06-21). So fixing 2D does NOT propagate to 3D; they drift. The 3D trails control (Rainbow/Solid binary) doesn't match the 2D model (per-hand color pickers, prop-matched default), which surfaced as a user-facing regression.

Goal: every effect feels equally simple to control, and 2D + 3D render the **same** controls from **one** source — so "fix 2D → fixes 3D" becomes literally true.

## Decisions (locked in brainstorming)

1. **Two-tier controls.** Every effect exposes a uniform **Primary** row; extra params move to an **Advanced** disclosure. Nothing deleted — Bloom/Pulse depth is preserved behind Advanced.
2. **Single shared manifest.** One per-effect control descriptor list is the source of truth. Both surfaces render from it via a shared component.
3. **Uniform Primary shape:** `Color/Palette · Intensity · Character A · Character B`, plus a standard **Tracking** segmented control for tip-emission effects.
4. **3D mirrors 2D** by construction (same manifest + same renderer). 3D shows Primary by default with an Advanced expander; 2D shows Primary + Advanced disclosure.
5. **3D viewer lists only effects with a live 3D renderer** (trails, fire, led, charcoal, pov). The 10 renderer-less effects (zap/echo/sparkles/bloom/water/bubbles/petals/smoke/ink/frost — confirmed no-ops in 3D) are hidden in the 3D chip grid.
6. **Per-effect Reset is dropped** in favor of the global Save Defaults / Reset baseline (shipped 2026-06-21).
7. **Charcoal** gains a single ember-tint Color so its Primary row matches the uniform 4.

## The normalized matrix

`*` = standard Tracking segmented shown alongside Primary for tip-emission effects.

| Effect | Primary (uniform 4) | Advanced |
|---|---|---|
| Trails | Color (per-hand pickers, prop-matched default + Rainbow opt) · Brightness · Thickness · Tail Length | — |
| Fire | Color (blend) · Intensity · Brightness · Turbulence | — |
| LED | Palette · Brightness · Pattern · Speed | color mode |
| Charcoal | Color (ember tint → coreColor) · Intensity · Spread · Glow | — |
| Zap | Color (L/R) · Intensity · Style · Frequency | Branching |
| Sparkles | Color · Rate · Mode · Size | Lifetime, Spread, Gravity |
| Echo | Color · Intensity · Shape · Decay | Interval, Thickness, Glow, Depth, Flash |
| Bloom | Color · Intensity · Radius · Falloff | Pulse, Rate, Streak, Spikes, Dispersion, Afterglow |
| Water | Palette · Intensity · Ambient · Motion `*` | Style, Clarity, Tension |
| Bubbles | Palette · Intensity · Ambient · Motion `*` | Jitter, Rise |
| Petals | Palette · Intensity · Ambient · Motion `*` | Carry, Streak, Fall |
| Smoke | Palette · Intensity · Ambient · Motion `*` | Curl, Rise |
| Ink | Palette · Intensity · Ambient · Motion `*` | Viscosity, Splatter |
| Frost | Palette · Intensity · Ambient · Motion `*` | Crystallinity, Spread |
| Silk | Palette · Intensity · Width · Flutter `*` | Duration, Tautness |
| Pulse | Palette · Intensity · Trigger · Reach `*` | Style, Lifetime, Thickness, Vel→Size, Asymmetry, Chromatic, Flash, Harmonics, Beat Interval |

## Architecture

### Control descriptor + manifest
`src/lib/shared/effects/domain/effect-control-manifest.ts`:

```ts
type ControlType = "slider" | "toggle" | "segmented" | "color" | "colorPair" | "palette" | "select";
type ControlTier = "primary" | "advanced" | "tracking";

interface ControlDescriptor {
  id: string;                 // stable key
  label: string;
  type: ControlType;
  field: string;              // intent field on the effect config object
  tier: ControlTier;
  min?: number; max?: number; step?: number; pct?: boolean;   // slider
  options?: { value: string; label: string }[];               // segmented/select
  showWhen?: (intent: Record<string, unknown>) => boolean;     // conditional (e.g. solid-only tint)
}

// EFFECT_CONTROLS: Record<EffectId, ControlDescriptor[]>
```

The manifest encodes the matrix above. Ordered: primary first, then tracking, then advanced. Descriptors carry everything both renderers need; no per-surface logic.

### Shared renderer
`src/lib/shared/effects/components/EffectControlStack.svelte`:
- Props: `effect: EffectId`, `config: EffectsConfigState`, `tiers?: ControlTier[]` (default `["primary","tracking"]`; 2D and the 3D Advanced expander pass `["advanced"]`).
- Maps each descriptor to the canonical primitive:
  - `slider` → existing `<input type="range">` + label + tabular readout (reuse current styling, no new primitive)
  - `segmented` → `SegmentedControl` (`shared/3d/components/controls/SegmentedControl.svelte`) per chip-primitives rule
  - `toggle` → button + toggle-indicator (no checkbox, per no-checkboxes rule)
  - `color` / `colorPair` → existing color-picker primitive used by the 2D panels
  - `palette` → existing palette primitive
  - `select` → existing pattern/select control (LED pattern)
- Reads via `config.effect(id)[field]`, writes via `config.updateEffect(id, { [field]: value })`. Honors `showWhen`.

### Consumers
- **2D customize panels** (`*Customize.svelte`): replace bespoke markup with `<EffectControlStack {effect} {config} />` (primary+tracking) + an `<details>`-style Advanced disclosure rendering `tiers={["advanced"]}`. The bespoke `*Panel.svelte` bodies are retired as their controls move into the manifest.
- **3D viewer** (`EffectsSettingsPanel.svelte`): render `<EffectControlStack>` (primary+tracking) for the active effect above the chip grid; an "Advanced" expander shows `tiers={["advanced"]}`. Delete the local `effect-curated-knobs.ts` + `CURATED_KNOBS` (superseded). Chip grid filtered to renderer-backed effects.

### Effect set in 3D
`EffectsSettingsPanel` filters `effectChips` to effects with a 3D renderer (trails, fire, led, charcoal; pov is an led sub-mode). Source the set from a small `EFFECTS_WITH_3D_RENDERER` constant so it's explicit and greppable.

## Data flow

```
manifest descriptor → EffectControlStack → primitive
  read  : config.effect(id)[field]
  write : config.updateEffect(id, { [field]: value })   (auto-persist + reactive)
        → 2D renderer / 3D translator pick it up (already wired)
```

Identical in 2D and 3D because both mount the same `EffectControlStack` against the same manifest + same `EffectsConfigState`.

## Build order

1. **Manifest + types** — encode the full matrix. Unit-test: every effect has exactly 4 primary descriptors (or documented exception), every descriptor's `field` exists on its intent default.
2. **`EffectControlStack`** — render descriptors → primitives; per control-type. Snapshot/interaction tests where practical.
3. **3D viewer swap** — `EffectsSettingsPanel` renders the stack for the active effect; filter chips to renderer-backed; delete `effect-curated-knobs.ts`. This fixes the trail-color complaint (per-hand pickers replace Rainbow/Solid binary).
4. **2D panel swap** — one effect at a time (start Fire/Trails), replace bespoke panel body with the stack + Advanced disclosure. Verify parity against the old panel before deleting its bespoke markup.
5. **Cleanup** — remove dead `*Panel.svelte` bodies / `effect-primary-param.ts` once all consumers use the manifest.

## Verification

- Unit: manifest shape (4 primary/effect), field existence, `showWhen` predicates.
- Per migrated effect: 2D panel renders the same controls as before (primary+advanced union == old set), 3D shows the primary row.
- DevTools: trails in 3D shows per-hand color (prop-matched), no Rainbow/Solid binary; Fire primary row identical in 2D and 3D; dragging any primary slider changes the render.
- `npm run check` clean for touched files; build green.

## Risks / notes

- **Color/palette/select primitives must be reused, not rebuilt** (never-hand-roll). Identify the canonical color-picker + palette + LED-pattern-select components during Task 2 and wrap them; do not author new ones.
- **`SegmentedControl` is the canonical single-select** (chip-primitives rule) — Tracking, Style, Mode, Shape, Falloff, Trigger all route to it.
- **Migrate 2D one effect at a time** with a parity check before deleting bespoke markup — a big-bang rewrite risks silent control loss.
- Charcoal ember-tint Color writes `coreColor` (RGB); if the renderer wiring is non-trivial, ship Charcoal's other 3 primaries first and add Color in the same task once verified.
- This supersedes the ad-hoc `effect-curated-knobs.ts` from the prior spec; that file is deleted in Task 3.
