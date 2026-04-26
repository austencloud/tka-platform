# Mobile Effects Panel Redesign — Design Spec

**Date:** 2026-04-19
**Scope:** 2D sequence-viewer mobile only (Phase 1 of the 2D/3D effects unification roadmap).
**Status:** Ready for implementation.

---

## Goal

Make the Effects sub-sheet fit in the mobile bento (under ~300px) while keeping the canvas visible above, without hiding capability. The user must be able to toggle an effect, pick a preset, tune the dominant parameter live, and reach full customization — all without leaving the sheet and without losing sight of the canvas.

This is **Phase 1** of a four-phase unification plan (see "Roadmap Context" below). Phase 1 lands the mode-agnostic visual shell. Phase 2 unifies the effects engine itself. Phase 3 migrates 3D onto the unified engine. Phase 4 drops 3D into the same mobile bento shell.

---

## Problem Today

`EffectsPanel.svelte` stacks three vertical sections: effect chip picker (~200px), preset cards "Choose a Look" (~220px), customize sliders (~150px). Total ~570px. On iPhone SE (667px viewport) this overflows the bento sub-sheet; the sheet's internal scroller shrinks so tight the user sees a tiny slice and has to scroll inside a scroller to reach anything.

`EffectsPanel` today is 2D-only and diverges from the 3D `EffectsSettingsPanel`:

| | 2D today | 3D today |
|---|---|---|
| Effects | 10 (incl. Echo, Water, Bubbles) | 8 (incl. Motion; no Echo/Water/Bubbles) |
| Presets | Rich PRESET_GROUP per effect | None |
| Customize | 10 `*Customize.svelte` components | Single intensity slider |
| Sub-controls | None | Trails: rainbow/solid + left/both/right tracking |
| State | `AnimationVisibilityStateManager` + `EffectsConfigContext` | `EffectsConfigState` + per-performer `settings.effects` |

Phase 1 does **not** attempt to reconcile these. It only builds the mobile shell 2D uses today, in a way 3D can reuse verbatim after Phase 2/3 unifies the engine beneath.

---

## Roadmap Context

**Phase 1 (this spec):** Mobile Effects sub-sheet — compact horizontal strips. Uses mode-agnostic primitives. 2D only.

**Phase 2 (next project):** Unified Effects engine contract. One effect enum, one preset system, one parameter schema, one state interface. No UI change.

**Phase 3 (after Phase 2):** Migrate 3D `EffectsSettingsPanel` + `EffortPalette` onto the unified engine. Visual continuity; 3D gains presets and full Customize per effect.

**Phase 4 (after Phase 3):** Apply Phase 1 shell to 3D mobile. Drop-in: same tile strip, same preset chips, same primary slider, same More-tuning pattern. 3D adds additive tiles (Camera, Planes, Performers, Scene) using the same `rail-tile.css` primitives.

---

## Design

### Sheet anatomy (~284px total, content-driven height)

```
┌─ Sheet (left 8 / right 8 / bottom 8, max-height 85vh) ───────────┐
│ Header        EFFECTS                                    [✕]   ~40px
├───────────────────────────────────────────────────────────────────┤
│ Effect strip   [Trails*][Fire][LED][Coal]...(scroll h)   ~80px
│                                                                    │
│ Preset strip   [Classic*][Neon][Plasma]...(scroll h)     ~42px
│                (hidden when no effect active)                      │
│                                                                    │
│ Primary slider  Width   ───●────────  0.65              ~48px
│                (hidden when no effect active)                      │
│                                                                    │
│ More tuning…                                             ~40px
│                (hidden when no effect active)                      │
└───────────────────────────────────────────────────────────────────┘
```

When **no effect is active**, only the header + effect strip are visible. The sheet collapses to ~120px, leaving even more canvas visible.

### Effect strip (row 1)

- Horizontal scroll; `overflow-x: auto`, `scrollbar-width: none`.
- 10 tiles, each 64×64, `border-radius: 12px`, 8px gap.
- Content: 20px FontAwesome icon + 9px uppercase label (two lines).
- Active tile: tinted background (`color-mix(in srgb, {effect.color} 22%, rgba(20,22,32,0.6))`), `{effect.color}` border at 55% opacity, 2px outer ring of `{effect.color}` at 30%. Blue "dot" indicator at top-right.
- Data source: **the existing `EFFECTS` array in `EffectSelector.svelte`** (id, label, icon, color). Do not duplicate.
- Tap behavior: tap inactive → `handleEffectSelect(id)` turns it on. Tap active → turns it off ("none") per the existing round-trip behavior in `EffectsPanel.handleEffectSelect`.

### Preset strip (row 2)

- Hidden when `activeEffect === "none"`.
- Horizontal scroll; chips sized `height: 32px`, `padding: 0 10px`, `border-radius: 8px`.
- Each chip shows a 10px `border-radius: 50%` color swatch + preset name.
- Active chip: `color-mix(in srgb, #4a9eff 18%, rgba(20,22,32,0.6))` background with 45% blue border. (The active-color matches the bento's shared accent; effect-specific accenting lives on the tile, not the preset.)
- Data source: **the existing `PRESET_GROUP.presets` array** for each effect. Swatch uses `preset.previewColor`.
- Tap behavior: `handlePresetSelect(id)` — the existing handler already wires `preset.apply(vm, effectsConfigState)` and `savePresetId`.

### Primary slider (row 3)

- Hidden when `activeEffect === "none"`.
- Single row, `padding: 8px 12px`, `background: rgba(255,255,255,0.03)`, `border-radius: 10px`.
- Left: uppercase 10px label (width 64px). Center: 6px-high track with gradient fill and 16px thumb. Right: 11px bold numeric readout.
- **Primary-parameter mapping** (defined per effect — see "Primary Parameter Table" below).
- Binding: read/write a single scalar via a shared adapter (see "Data Layer").

### More tuning (row 4)

- Hidden when `activeEffect === "none"`.
- Full-width button, 40px tall, "More tuning…" with a right chevron.
- Tap: swaps sheet body to the existing `*Customize.svelte` component for the active effect. The existing Customize components already accept an `onBack` prop (they currently render their own "Back to presets" button) — we reuse that contract by passing `onBack={() => (customizeOpen = false)}`.
- **Header changes in Customize mode:** a 28×28 back-arrow button appears left of the title; title reads "{EffectLabel}" with a 9px subtitle "MORE TUNING". Tapping ✕ or the back arrow both return to strips view. The close ✕ always closes the entire sheet; the back arrow returns to strips.
- Sheet keeps the same height; the Customize component scrolls inside `.sheet-body` if its content exceeds the body height.

### Primary parameter table

All params below already exist on `EffectsConfigState` — see `src/lib/shared/effects/domain/EffectsConfig.ts`. No schema changes needed.

| Effect | Primary param | Property path | Range | Setter | Display format |
|---|---|---|---|---|---|
| Trails | Thickness | `trails.thickness` | 1–12 (int) | `updateTrails({thickness})` | "1–12" |
| Fire | Intensity | `fire.intensity` | 0.45–1 | `updateFire({intensity})` | "0.45–1.00" |
| LED | Brightness | `led.brightness` | 1–5 (int) | `updateLed({brightness})` | "1–5" |
| Charcoal | Intensity | `charcoal.intensity` | 0–1 | `updateCharcoal({intensity})` | "0.00–1.00" |
| Zap | Intensity | `zap.intensity` | 0–1 | `updateZap({intensity})` | "0.00–1.00" |
| Sparkle | Rate | `sparkles.rate` | 0–1 | `updateSparkles({rate})` | "0.00–1.00" |
| Echo | Intensity | `echo.intensity` | 0–1 | `updateEcho({intensity})` | "0.00–1.00" |
| Bloom | Intensity | `bloom.intensity` | 0–1 | `updateBloom({intensity})` | "0.00–1.00" |
| Water | Intensity | `water.intensity` | 0–1 | `updateWater({intensity})` | "0.00–1.00" |
| Bubbles | Intensity | `bubbles.intensity` | 0–1 | `updateBubbles({intensity})` | "0.00–1.00" |

For discrete-range params (Trails thickness 1–12, LED brightness 1–5) the slider uses integer step=1. For float-range params, step=0.01.

### State flow

```
┌────────────────────────────────┐
│ MobileEffectsPanel.svelte      │
│                                │
│ activeEffect (local $state)    │
│ activePresetId (local $state)  │
│ customizeOpen (local $state)   │
│                                │
│ getAnimationVisibilityManager()│──┐
│ getEffectsConfigContext()      │  │
└────────────────────────────────┘  │  same wiring as EffectsPanel.svelte
                                    ▼
                          shared state — no divergence
```

The mobile panel does **not** duplicate EffectsPanel's preset-persistence logic. Both components load/save from the same `tka_active_effect_presets` key. A user who switches effect on mobile sees the same active preset when they return to desktop.

---

## Files

### New

- `src/lib/shared/animation-engine/components/effects-panel/effect-registry.ts` — shared source of truth for effect id/label/icon/color. The 10 entries move here from the inline `EFFECTS` arrays currently in `EffectSelector.svelte` and the inline `EFFECT_COLORS`/`EFFECT_LABELS` maps in `EffectsPanel.svelte`. Pure TS.
- `src/lib/shared/animation-engine/components/effects-panel/effect-primary-param.ts` — effect-id → primary-param adapter (getter + setter + label + range + format). Mode-agnostic. Pure TS.
- `src/lib/shared/animation-engine/components/effects-panel/MobileEffectsPanel.svelte` — the strips layout. Consumes the registry and the adapter.
- `tests/unit/effect-registry.test.ts` — registry has all 10 effects, no dupes, stable ordering.
- `tests/unit/effect-primary-param.test.ts` — verifies each effect's adapter maps to the right getter/setter.

### Modified

- `src/lib/shared/animation-engine/components/effects-panel/EffectSelector.svelte` — import `EFFECTS` from `effect-registry.ts` instead of defining inline.
- `src/lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte` — import `EFFECT_COLORS` and `EFFECT_LABELS` from `effect-registry.ts` (derive or re-export) instead of defining inline.
- `src/lib/shared/sequence-viewer/components/ExportVideoDrawer.svelte` — the Effects sub-sheet swaps `<EffectsPanel>` for `<MobileEffectsPanel>`.

### Untouched

- Every `*Customize.svelte` — reused wholesale. Their `onBack` already exists.
- Every `presets/*.ts` (PRESET_GROUP) — reused as-is.

---

## Unification Hooks (Phase 2 seams)

These boundaries are load-bearing for Phase 2 and must not be breached in Phase 1:

1. **Effect list is data, not markup.** `effect-registry.ts` is the single source of truth for both desktop and mobile. Phase 2 extends each entry with a `modes: ("2d" | "3d")[]` field and adds the 3D-only `motion` entry.

2. **Primary-param adapter is a pure function map.** `effect-primary-param.ts` is pure TS with no Svelte/VM imports beyond the type signatures. Phase 2 extends it by adding a `3d` branch per entry. No UI code reads state directly.

3. **Preset rendering is data-driven.** The preset strip renders whatever `PRESET_GROUP.presets` returns. Phase 2 ports the same PRESET_GROUP pattern to 3D.

4. **Customize is a black box behind `onBack`.** Phase 2 may replace `*Customize.svelte` with unified components; the mobile panel's More-tuning slot stays the same.

5. **`rail-tile.css` primitives stay mode-agnostic.** No 2D-specific selectors or colors. Any effect tint applied to tiles comes from the effect's own color, not a 2D palette.

**Explicitly out of scope for Phase 1:**
- Touching `EffectsPanel.svelte` (desktop).
- Touching `EffectsSettingsPanel.svelte` (3D).
- Porting presets to 3D.
- Adding Motion to 2D.
- Any change to `EffortCategory` / `EffortPalette`.
- Any change to the Effects tile behavior in the primary bento (just opens the sub-sheet).

---

## Testing

### Unit tests

- `tests/unit/effect-primary-param.test.ts`:
  - Every effect id has an entry.
  - Each entry's getter reads from the expected state property.
  - Each entry's setter writes to the expected state property.
  - Each entry's range matches the param's actual domain (min/max inclusive).
  - Each entry's formatter renders the value with the expected precision.

### Visual smoke (manual)

On iPhone SE emulation (375×667):
1. Open bento → tap Effects tile.
2. Sheet opens; canvas visible above.
3. Effect strip scrollable horizontally; all 10 effects reachable.
4. Tap Trails → tile goes active, preset strip + slider + More-tuning appear.
5. Tap Classic → selected state, slider value updates to preset's Width.
6. Drag slider → canvas trail width changes live.
7. Tap More tuning → body swaps to TrailCustomize; back arrow returns to strips.
8. Tap active Trails tile → turns off; strip-2/3/4 hide; sheet shrinks.

### Non-goals for visual smoke

- Desktop rendering (EffectsPanel untouched).
- 3D mode (EffectsSettingsPanel untouched).

---

## Risks

- **Preset-persistence collision.** Desktop and mobile both read `tka_active_effect_presets`. No risk today (same key, same format) but Phase 2 unification must preserve the key.
- **Customize component back-button cosmetics.** The existing Customize components render their own "Back to presets" button. In the mobile More-tuning view this button coexists with the sheet header's back arrow. Acceptable — both call the same `onBack`. A future tidy pass can suppress the inline back button in mobile mode.
- **Registry extraction affecting EffectsPanel rendering.** Moving `EFFECT_COLORS`/`EFFECT_LABELS` out of `EffectsPanel.svelte` is a code-move, not a behavior change. Desktop snapshot parity is the guard: visual output must be pixel-identical.

---

## Acceptance

- Sheet fits within 300px on iPhone SE, canvas always visible.
- All 10 effects reachable without leaving the strips view.
- Primary slider moves the canvas live for every effect.
- More-tuning opens the full existing Customize UI.
- No visible change to desktop `EffectsPanel`.
- No change to 3D `EffectsSettingsPanel`.
- Unit tests pass for the primary-param adapter.
- Type check and build pass.
