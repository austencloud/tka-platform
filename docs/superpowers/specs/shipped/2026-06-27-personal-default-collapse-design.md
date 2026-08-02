# Personal Default Collapse — Design

> Supersedes the two-chip model from `2026-06-27-core-preset-and-custom-restore-design.md`.
> Collapses **Default** (factory) + **Custom** (auto-snapshot) into ONE persisted
> personal **Default** chip; demotes the factory original to a buried escape hatch.

## Problem

The shipped model (commit `50f422e32a`) put two chips in every effect's "Choose a
Look" row: a synthetic **Default** that reset to the shipped factory config, and a
**Custom** that restored an in-memory auto-captured snapshot of your last hand-tuned
look. Two chips for "your look" vs "the original" is one concept too many, and the
snapshot was lost on reload (re-seeded from the persisted config, which may be a
preset excursion).

Austen's reframe: *"maybe default and custom are literally supposed to be the same
thing — you get a default, you change that default, it remembers your default, and
you can reset to the original default if you really really want to (lumped deep in
settings)."*

## Mental model

Three reference points exist; the chip surfaces only one.

- **Personal default** — your look. Auto-tracks every manual tweak; persisted across
  reload. The **Default** chip returns to this.
- **Named presets** — excursions. They do not touch your personal default. Parking on
  one lights that preset; clicking **Default** pulls you back to your look.
- **Factory original** — immutable, hidden. Reached only through "Reset to original."

Consequence: after any slider tweak, live config equals your personal default, so the
**Default** chip is lit and clicking it is a no-op. The chip earns its keep the moment
you wander onto a named preset. Factory reset is the rare deliberate nuke.

Decisions locked with Austen:
- **Promote model: auto (live-tracks).** No Save button — any manual edit silently
  becomes the persisted personal default.
- **Factory reset placement: both.** Per-effect reset in the Customize area AND a
  global reset-all in a panel footer.

## State — `effects-config-state.svelte.ts`

- Rename `customSnapshots` → `personalDefaults`. **Persist** to new localStorage key
  `tka_effects_custom` (a `Record<EffectId, intent>` map). Seed each effect on init
  from persisted-custom `??` the current loaded config (existing users' current look
  becomes their personal default). `persist:false` instances stay in-memory only.
- `updateEffect`: already writes `config[fx]` + the snapshot — add a debounced persist
  of the `personalDefaults` map (same 300ms cadence as config; can share the timer).
- `restoreCustom` → rename `restorePersonalDefault(id)`: `config[fx] = personalDefaults[fx]`,
  `activePresets[fx] = null`. Undo op `restore-custom-effect`.
- `resetToShipped` → rename `resetToFactory(id)`: `config[fx] = DEFAULT[fx]` **and**
  `personalDefaults[fx] = DEFAULT[fx]` (wipe the personal default so a later Default
  click can't resurrect old tuning), `activePresets[fx] = null`, persist. Undo op
  `reset-effect-default`.
- New `resetAllToFactory()`: every effect → `config = DEFAULT`, `personalDefaults = DEFAULT`,
  clear `activePresets`, persist both keys. One undo entry, new op `reset-all-effects`.
- Keep `hasCustom` (personal default ≠ factory) — no longer gates chip enablement, but
  useful for the per-effect reset button's enabled state.

## Chips — `EffectsPanel.svelte` + `EffectPresetsSection.svelte`

- Keep the **single synthetic Default chip** (leading, injected for all 16 effects),
  **always enabled**. Lit when `config[fx]` equals `personalDefaults[fx]`.
- **Delete the 14 empty-patch `*-custom` presets** (those with `previewColor: "custom"`
  and no `resolvePatch`) from their preset groups — the synthetic Default replaces them.
  **trail/fire keep their `resolvePatch` color-picker customs** (a distinct feature:
  custom blue/red, not a snapshot).
- `activePresetId` priority simplifies to:
  1. `valuesEqual(config[fx], personalDefaults[fx])` → Default chip
  2. `matchPresetId(group, config[fx])` → named preset
  3. trail/fire explicit `resolvePatch` custom via `activePresets[fx]`
  Drop the factory-equals branch and the snapshot-custom branch.
- `handlePresetSelect`: `DEFAULT_CHIP_ID` → `restorePersonalDefault(fx)` (was
  `resetToShipped`). Drop the separate snapshot-custom branch.
- Drop `customDisabled`.

## Factory reset — both placements

- **Per-effect:** a low-emphasis **"Reset to original"** button injected once in
  `EffectsPanel` directly under the rendered Customize component (covers all 16 with no
  per-customize edits) → `resetToFactory(activeEffect)`. Disabled when `!hasCustom`
  (already at factory). A real button, not faint text (clickables-look-like-buttons).
- **Global:** a **"Reset all effects to original"** button in a new low-emphasis panel
  footer section → confirm → `resetAllToFactory()`. Reuse the existing confirm
  primitive (grep before building). Destructive, so confirm is mandatory.

## Persistence / migration

- `tka_effects_custom` is a **separate key**, not part of `EffectsConfig` — **no
  `EFFECTS_CONFIG_VERSION` bump, no migration entry**. Absent key → seed from config.
- Undo op types: reuse `restore-custom-effect` and `reset-effect-default`; **add
  `reset-all-effects`** to `SceneUndoOperationType` and the `["effects"]` case in
  `scene-undo-manager.ts`.

## Testing

- State (`effects-config-state.test.ts`): personal-default persistence round-trip
  (persist:true instance writes `tka_effects_custom`, a fresh instance reads it);
  `resetToFactory` wipes the personal default (post-reset `hasCustom` false,
  `personalDefaults[fx]` == factory); `resetAllToFactory` returns all to factory;
  Default highlight tracks personal default not factory; preset excursion preserves
  personal default.
- Grep-gate: removing the 14 `*-custom` presets must not break `match-preset.ts`,
  summaries, or any consumer referencing those ids (grep before deleting).

## Out of scope

- Tuning-history / multi-step undo of personal defaults (factory is the only escape
  below your current default). YAGNI.
- Wiring the unrelated 3D-panel `saveAsBaseline`/`resetToBaseline` machinery into the
  2D panel — that stays the 3D panel's explicit baseline feature.
