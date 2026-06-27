# Core Preset + Custom Restore — Design

**Date:** 2026-06-27
**Status:** ✅ Approved ("go nuts") — implementing
**Surface:** the 2D effects panel "Choose a Look" row (sequence viewer + tuner)

## Problem

Clicking a preset calls `applyPreset`, which overwrites the live effect config
outright. The 2D panel surfaces no way back — `saveAsBaseline`/`resetToBaseline`
exist but are wired only into the 3D panel, and `sceneUndo` captures the
pre-preset state but no Revert is shown. So a user who has tuned settings they
like, then clicks a preset, **cannot recover their settings** unless they were
already a named preset. The earlier phantom-Supernova bug came from the same
root: "base default" was a hidden config the highlighter had to guess about.

## The simplification: every state is a chip

The "Choose a Look" row becomes, left → right:

```
[ Default ]   [ named presets… ]   [ Custom ]
  shipped                            your tuning
```

- **Default** (new synthetic leading chip) = the shipped `DEFAULT_EFFECTS_CONFIG[fx]`.
  Click → reset the effect to factory. Highlights when the live config equals it.
  Promoting base-default to a visible chip is what removes the "hidden config"
  class of bug — the honest matcher just lights whichever chip the config equals.
- **Custom** (the existing per-effect `*-custom` chip, repurposed) = your last
  hand-tuned config. It **auto-captures on every manual edit**, so clicking a
  named preset is a safe excursion — your tuning waits in Custom, one click back.
  Click → restore your snapshot. Highlights when the live config equals the
  snapshot (and isn't Default or a named preset). Disabled until you've tuned
  something (no snapshot yet).
- Named presets unchanged.

**trail / fire are untouched** — their `*-custom` uses `resolvePatch` (custom
colour pickers), a different feature. Only the 14 empty-patch customs are
repurposed into snapshot-restore (they were near-dead markers).

## Why auto-capture, not explicit save

The failure is precisely that the user *didn't* save before exploring. Auto
capture on every `updateEffect` means there's nothing to remember to press.

## Data model — in-memory snapshots seeded from the persisted config

No new persisted key, **no config version bump, no migration**. The live config
already persists (`tka_effects_config`); the snapshot is seeded from it:

- `effects-config-state.svelte.ts`: an in-memory `customSnapshots` map.
  - **Seed** on factory create: `customSnapshots[fx] = clone(config[fx])` for each effect.
  - **Update** inside `updateEffect` (manual edits only) after the config write:
    `customSnapshots[fx] = clone(config[fx])`. `applyPreset` / `restoreCustom` /
    `resetToShipped` do **not** touch it.
  - New API: `customSnapshot(fx)`, `hasCustom(fx)` (snapshot exists and differs
    from `DEFAULT_EFFECTS_CONFIG[fx]`), `restoreCustom(fx)`, `resetToShipped(fx)`.
    Restore/reset write the config, null `activePresets[fx]`, and go through
    `sceneUndo` capture/commit like `applyPreset`.

Trade-off (acceptable for v1): tune → click preset → **reload** → the snapshot
re-seeds from the now-preset config, so the pre-preset look is lost only across a
reload-after-preset. The within-session flow — the actual complaint — is covered.
Persisting the snapshot is a clean follow-up if cross-reload restore is wanted.

## Highlight + clicks (EffectsPanel)

`selectedChip` (replaces the bare `activePresetId` passed down), in priority order:
1. `valuesEqual(cfg, DEFAULT_EFFECTS_CONFIG[fx])` → `"__default__"`.
2. `matchPresetId(group, cfg)` → that named id.
3. the group's custom preset, if it has **no** `resolvePatch`, `hasCustom(fx)`,
   and `valuesEqual(cfg, snapshot)` → that custom id.
4. else the agent's existing explicit-`activePresets` fallback (lights trail/fire
   resolvePatch customs the user clicked) → else `null`.

Export `valuesEqual` from `match-preset.ts` (already written there) for the
full-object comparisons in (1) and (3) and for `hasCustom`.

Clicks:
- Default chip → new `onSelectDefault` → `resetToShipped(fx)`.
- Custom chip (`handlePresetSelect`): if the preset is the custom one **without**
  `resolvePatch` → `restoreCustom(fx)`; otherwise the existing `applyPreset` path
  (named presets + trail/fire resolvePatch customs).

## Rendering (EffectPresetsSection)

- Prepend a synthetic **Default** chip (id `"__default__"`, neutral/accent dot),
  active when `activePresetId === "__default__"`, `onclick={onSelectDefault}`.
- The Custom chip already renders (it's in the group). Add a `customDisabled`
  prop → muted + non-interactive when the effect's custom is snapshot-based and
  `!hasCustom` (nothing saved yet). trail/fire customs are never disabled.
- No layout-shift: the Default chip is always present; the Custom chip is always
  present (disabled state toggles styling, not existence).

## Testing

- `effects-config-state` tests: `updateEffect` captures a snapshot; `applyPreset`
  does **not**; `restoreCustom` round-trips the pre-preset config; `resetToShipped`
  returns factory; `hasCustom` false at default, true after a real tweak.
- `match-preset` test: `valuesEqual` export covers scalars/arrays/objects/null.

## Files

- `effects-config-state.svelte.ts` (snapshots + 4 API methods)
- `presets/match-preset.ts` (export `valuesEqual`)
- `EffectsPanel.svelte` (`selectedChip`, `onSelectDefault`, custom-restore intercept)
- `EffectPresetsSection.svelte` (Default chip, `customDisabled`)
- `effects-config-state` test + `match-preset` test

## Out of scope

Persisting snapshots across reload; an explicit "Set as Default" that overwrites
the shipped Default (auto-Custom already covers "return to what I liked");
migrating trail/fire customs into the snapshot model.
