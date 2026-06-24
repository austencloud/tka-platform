# Effect Tuner — Preset + Base-Default Editing

**Date:** 2026-06-24
**Status:** Design approved, pre-plan
**Surface:** `/test/effect-tuner` (dev-only tuning harness)

## Goal

Let the tuner write tuned values to **either** destination, with the active
destination always unmistakable on screen:

1. The **base default** — `DEFAULT_EFFECTS_CONFIG[<effect>]` in `defaults.ts`,
   the "first value users see" when no preset is active.
2. A **specific preset** — the `patch` of one `EffectPreset` in
   `<effect>-presets.ts` (e.g. Supernova in `bloom-presets.ts`).

Today the Save button always targets the base default. This adds a sticky,
clearly-labelled target selector and a second write-back path.

## Background (verified)

- Presets are data: `EffectPreset = { id, name, previewColor, previewColor2?,
  patch?: Partial<EffectConfigMap[E]>, resolvePatch? }`
  (`…/effects-panel/presets/types.ts`). `patch` lists only the fields a preset
  overrides; unset fields inherit the base default.
- Each effect's presets live in `<effect>-presets.ts` as `<EFFECT>_PRESETS`
  array → `<EFFECT>_PRESET_GROUP`. Bloom: Supernova, Comet, Prism, Halo, Custom.
- `effectsConfig.activePresets[fx]` holds the active preset id or `null`.
- **`updateEffect` resets `activePresets[fx] = null`**
  (`effects-config-state.svelte.ts:248`) — any slider tweak deselects the panel
  chip. Correct for the real app; it is the reason the tuner needs its OWN
  sticky target rather than reading the panel chip.
- The bloom presets already specify all 12 fields, so full-patch save (below)
  matches existing convention.
- "Custom" presets carry `previewColor: "custom"` and an empty/`resolvePatch`
  patch; their job is to open a blank Customize panel.

## Design

### 1. "Save to:" target picker

A single-select control in the tuner toolbar, beside Save. Built on the existing
**`FilterChipBase` `mode="dropdown"`** primitive (chip-primitives routing:
single-select group → shared primitive, no hand-rolled control).

Options for the active effect:

- **Base default** — sublabel "first value users see".
- One entry per preset in that effect's `<EFFECT>_PRESET_GROUP`, **excluding any
  preset with `previewColor === "custom"`** (the Custom chip; full-patch write
  would break its blank-Customize behavior). Presets that expose only
  `resolvePatch` (no static `patch`) are likewise excluded.

The option list rebuilds when the active effect changes.

### 2. Sticky target, load-on-select, persistent "Editing:" badge

- The target is held in **tuner-local state** (`saveTarget`), independent of
  `activePresets`. A slider tweak does NOT change it — this is the fix for the
  deselect problem.
- Selecting a target **loads its values** onto the stage so you edit what you
  see:
  - Base default → reset the effect's live intent to `DEFAULT_EFFECTS_CONFIG[fx]`.
  - Preset → apply base+patch via the existing `applyPreset(fx, id, patch)`
    (also highlights the matching panel chip).
- A persistent badge next to Save reads **`Editing: Supernova`** /
  **`Editing: Base default`** — driven by `saveTarget`, always visible, never
  ambiguous.
- Clicking a panel "CHOOSE A LOOK" chip also sets `saveTarget` to that preset
  (keeps the two in sync). Tweaking afterward un-highlights the chip but leaves
  `saveTarget` intact.
- Switching target discards unsaved tweaks on the previous target (standard;
  Copy-JSON remains the manual escape hatch).

### 3. Two write-back destinations

The Save POST body gains a `target` discriminator:

```jsonc
// base default (existing behavior)
{ "target": "default", "effect": "bloom", "intent": { … } }
// a preset
{ "target": { "preset": "bloom-supernova" }, "effect": "bloom", "intent": { … } }
```

Endpoint (`save-default/+server.ts`, dev-only) dispatches:

- `"default"` → existing per-field single-line swap in `defaults.ts`.
- `{ preset }` → in `<effect>-presets.ts`: locate the object literal whose
  `id: "<presetId>"`, then replace its `patch: { … }` object literal with the
  serialized full intent. `id` / `name` / `previewColor` untouched.

Status line names the destination:
**`Saved Supernova ✓ — bloom-presets.ts patched`** /
**`Saved base default ✓ — defaults.ts patched`**.

#### Patch-source mechanics (pure, testable)

Extract string→string transforms into `save-default/patch-source.ts` so the
filesystem-touching `+server.ts` stays thin and the logic is unit-tested:

- `patchDefaultsField(src, effect, key, value)` — the current single-line swap
  (moved out of `+server.ts` unchanged).
- `patchPresetPatch(src, presetId, serializedPatch)`:
  1. Find `id: "<presetId>"`.
  2. From there find the next `patch:` and its opening `{`.
  3. **Brace-match** to the matching `}` — depth counter over `{`/`}` that skips
     `"…"` string spans (preset values are simple double-quoted strings/enums
     and `[…]` arrays; no braces inside strings).
  4. Replace the inclusive `{ … }` span with `serializedPatch`.
- Effect → preset-file path + array const name is derived from a small map
  (e.g. `bloom` → `bloom-presets.ts`); the plan greps the existing registry the
  panel uses rather than duplicating it.
- Guard: if the located preset has no static `patch` (resolvePatch-only) or the
  id is not found, return a 400 with a clear message — never write.

`serialize()` (already in `+server.ts`) handles null/string/number/bool/array/
object. For preset mode it emits a multi-line object indented to the file's
patch depth (fields at 6 spaces, close brace at 4) so the result matches house
style.

### 4. Full-patch semantics

Saving to a preset writes **every field** of the live intent into `patch`. The
preset becomes self-contained (no surprise inheritance from later base-default
edits). What the stage shows is exactly what is stored.

## Files

- **Modify** `src/routes/test/effect-tuner/+page.svelte` — target picker
  (`FilterChipBase` dropdown), `saveTarget` state, `Editing:` badge, load-on-
  select, save dispatch with `target`.
- **Modify** `src/routes/test/effect-tuner/save-default/+server.ts` — accept
  `target`, dispatch to the two patchers; keep route path (less churn).
- **Create** `src/routes/test/effect-tuner/save-default/patch-source.ts` — pure
  `patchDefaultsField` + `patchPresetPatch` + brace-matcher.
- **Create** `src/routes/test/effect-tuner/save-default/patch-source.test.ts` —
  unit tests for both patchers (idempotency, single-field swap, preset patch
  replacement, brace-matching with nested arrays, not-found / resolvePatch
  guards).
- **Reuse** `FilterChipBase` (`…/browse/components/filter-chips/`).

## Testing / verification

- **Unit:** `patch-source.test.ts` covers the pure transforms (no filesystem).
- **Endpoint round-trip:** curl POST for a preset target → confirm a clean
  one-field diff in `<effect>-presets.ts`, idempotent re-POST (no change), then
  restore — same protocol used to verify the base-default path.
- **UI:** reload the tuner, pick each target, confirm the `Editing:` badge and
  loaded values, Save, confirm the status names the right file. (User eyeball;
  no screenshot unless requested.)

## Out of scope

- Editing preset metadata (name, previewColor) from the tuner.
- A diff-from-base view per preset.
- Any change to the real app's preset-deselect-on-tweak behavior.
